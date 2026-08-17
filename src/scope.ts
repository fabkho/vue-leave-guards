/**
 * The registry, with no framework in it — so it is testable without mounting
 * anything. `Route` is a type parameter rather than vue-router's
 * `RouteLocationNormalized` so the core imports nothing from vue-router;
 * `vue-leave-guards/router` instantiates it.
 */

export interface NavigationContext<Route = unknown> {
  to: Route
  from: Route
}

/** `false` aborts the leave; a promise lets the guard prompt first. */
export type LeaveGuard<Route = unknown> = (
  context?: NavigationContext<Route>,
) => boolean | Promise<boolean>

export interface LeaveGuardEntry<Route = unknown> {
  /** Omit to let the enclosing scope's prompt speak for this guard. */
  confirm?: LeaveGuard<Route>
  /** Synchronous: `beforeunload` cannot await a dialog. */
  isDirty?: () => boolean
  /** Absent means every navigation. */
  shouldGuard?: (to: Route, from: Route) => boolean
}

export interface LeaveGuardRegistry<Route = unknown> {
  register: (entry: LeaveGuardEntry<Route>) => void
  unregister: (entry: LeaveGuardEntry<Route>) => void
  /**
   * Something changed below this scope without its own membership changing. A
   * nested scope calls this on its parent so an ancestor watching `dirty`
   * re-reads a subtree it had already cached.
   */
  notify: () => void
  /** Live entry count; a nested scope counts as one. */
  readonly size: number
}

export interface LeaveGuardScope<Route = unknown> {
  /** Without a context, asks everything; with one, only guards that opt in. */
  confirmLeave: (context?: NavigationContext<Route>) => Promise<boolean>
  isDirty: () => boolean
  registry: LeaveGuardRegistry<Route>
  /** This whole scope, as a single guard for a parent scope. */
  composite: LeaveGuardEntry<Route>
}

export interface LeaveGuardScopeOptions<Route = unknown> {
  /**
   * Asked once for everything below that brought no prompt of its own. Guards
   * carrying their own `confirm` are still asked individually — two different
   * dialog functions cannot be merged, only replaced by one standing for both.
   */
  confirm?: LeaveGuard<Route>
  /**
   * A plain `Set` is invisible to any reactivity system, so this is the seam
   * `createReactiveLeaveGuardScope` uses to track mounting and unmounting.
   */
  onChange?: () => void
}

/**
 * Composites, mapped to "do you hold dirty work nobody below you will ask
 * about?". A `WeakMap` rather than a field, so the published entry shape is
 * unchanged and a consumer's own entry cannot collide with it.
 */
const unclaimed = new WeakMap<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LeaveGuardEntry<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (context?: NavigationContext<any>) => boolean
>()

/**
 * A scope with no ties to a component tree, for the application-wide one a
 * plugin owns. Inside a component prefer `provideLeaveGuards()`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createLeaveGuardScope<Route = unknown>(
  options: LeaveGuardScopeOptions<Route> = {},
): LeaveGuardScope<Route> {
  const { confirm: confirmScope, onChange } = options
  const entries = new Set<LeaveGuardEntry<Route>>()

  // The copy survives a guard unregistering mid-await.
  function applicable(context?: NavigationContext<Route>): LeaveGuardEntry<Route>[] {
    return [...entries].filter(
      entry => !(context && entry.shouldGuard && !entry.shouldGuard(context.to, context.from)),
    )
  }

  function canPrompt(): boolean {
    return confirmScope !== undefined || [...entries].some(entry => entry.confirm !== undefined)
  }

  /**
   * Claimed-ness cannot be read off `entry.confirm`: a nested scope exposes one
   * as soon as *any* guard inside it brings a prompt, which would leave that
   * scope's reporter-only guards unasked by anyone. Composites answer through
   * `unclaimed` instead, recursing so `shouldGuard` re-applies at every level.
   */
  function hasUnclaimedDirty(context?: NavigationContext<Route>): boolean {
    return applicable(context).some((entry) => {
      const nested = unclaimed.get(entry)
      return nested
        ? nested(context)
        : !entry.confirm && (entry.isDirty?.() ?? false)
    })
  }

  async function confirmLeave(context?: NavigationContext<Route>): Promise<boolean> {
    const asking = applicable(context)

    // The broad question first.
    if (confirmScope && hasUnclaimedDirty(context)) {
      if (!(await confirmScope(context))) return false
    }

    // Sequential and bailing early: two guards prompting at once would stack
    // dialogs.
    for (const entry of asking) {
      if (!entry.confirm) continue
      if (!(await entry.confirm(context))) return false
    }

    return true
  }

  const isDirty = () => [...entries].some(entry => entry.isDirty?.() ?? false)

  const scope: LeaveGuardScope<Route> = {
    confirmLeave,
    isDirty,
    registry: {
      register: (entry) => {
        if (entries.has(entry)) return
        entries.add(entry)
        onChange?.()
      },
      unregister: (entry) => {
        if (entries.delete(entry)) onChange?.()
      },
      notify: () => onChange?.(),
      get size() {
        return entries.size
      },
    },
    composite: {
      /**
       * A getter: whether this scope can answer for itself depends on what is
       * currently inside it. Undefined folds it into an ancestor's prompt,
       * where answering `true` would let its unsaved work through unasked.
       */
      get confirm() {
        return canPrompt() ? confirmLeave : undefined
      },
      isDirty,
      // Entries without a `shouldGuard` want every navigation, so they make the
      // whole scope opt in.
      shouldGuard: (to, from) =>
        [...entries].some(entry => entry.shouldGuard?.(to, from) ?? true),
    },
  }

  unclaimed.set(scope.composite, context => !confirmScope && hasUnclaimedDirty(context))

  return scope
}
