/**
 * The registry, with no framework in it. Everything interesting about leave
 * guards — sequencing, bailing early, collapsing a subtree into one entry —
 * happens here, so it is testable without mounting anything.
 *
 * `Route` is a type parameter rather than vue-router's `RouteLocationNormalized`
 * so the core stays router-agnostic; `vue-leave-guards/router` instantiates it.
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
  /**
   * This guard's own prompt. Omit it to let the scope's prompt speak for the
   * guard instead — which is what collapses a form full of dirty fields into a
   * single dialog rather than one per field.
   */
  confirm?: LeaveGuard<Route>
  /** Synchronous: `beforeunload` cannot await a dialog. */
  isDirty?: () => boolean
  /** Narrows the guard to the navigations it cares about. Absent means all. */
  shouldGuard?: (to: Route, from: Route) => boolean
}

export interface LeaveGuardRegistry<Route = unknown> {
  register: (entry: LeaveGuardEntry<Route>) => void
  unregister: (entry: LeaveGuardEntry<Route>) => void
  /**
   * Reports that something changed below this scope without its own membership
   * changing. A nested scope calls this on its parent so an ancestor watching
   * `dirty` re-reads a subtree it had already cached.
   */
  notify: () => void
  /** Live guard count. Exposed for tests and devtools, not for control flow. */
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
   * The scope's own prompt, asked **once** for everything below it that did not
   * bring a prompt of its own.
   *
   * This is the shape most forms want: each field reports whether it is dirty,
   * the host owns the one dialog, and leaving a form with six unsaved fields
   * asks once. Guards that supply their own `confirm` are still asked
   * individually, because two different dialog functions cannot be merged into
   * one — only replaced by a prompt that stands for both.
   */
  confirm?: LeaveGuard<Route>
  /**
   * Called when the entry set gains or loses a guard, or when `notify()` is.
   *
   * A plain `Set` is invisible to any reactivity system, so this is the seam
   * `createReactiveLeaveGuardScope` uses to make `dirty` and `size` track
   * mounting and unmounting as well as the values inside each guard.
   */
  onChange?: () => void
}

/**
 * Composite entries, mapped to "do you hold dirty work nobody below you will
 * ask about?".
 *
 * A `WeakMap` rather than a field on `LeaveGuardEntry`, so the published entry
 * shape is unchanged and a consumer's hand-built entry cannot collide with it.
 */
const unclaimed = new WeakMap<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LeaveGuardEntry<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (context?: NavigationContext<any>) => boolean
>()

/**
 * Creates a scope with no ties to a component tree.
 *
 * Call this directly for the application-wide scope a plugin owns; inside a
 * component, prefer `provideLeaveGuards()`, which also wires the injection.
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

  /** Whether anything here can put a question to the user. */
  function canPrompt(): boolean {
    return confirmScope !== undefined || [...entries].some(entry => entry.confirm !== undefined)
  }

  /**
   * Dirty work below here that nothing below here will ask about, and which an
   * ancestor's prompt therefore has to cover.
   *
   * Whether an entry is claimed cannot be read off `entry.confirm`: a nested
   * scope exposes one as soon as *any* single guard inside it brings a prompt,
   * which would leave that scope's reporter-only guards unasked by anyone.
   * Composites answer for themselves through `unclaimed` instead, recursing so
   * the check re-applies `shouldGuard` at every level.
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

    // One prompt for everything that did not bring its own, asked before them
    // so the broad question comes first.
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
       * A getter, because whether this scope can answer for itself depends on
       * what is currently inside it. A scope opened purely for structure, whose
       * guards only report dirtiness, must fold into an ancestor's single
       * prompt — answering `true` on its own behalf would let its unsaved work
       * through without anyone being asked.
       */
      get confirm() {
        return canPrompt() ? confirmLeave : undefined
      },
      isDirty,
      // A scope guards a navigation if anything inside it does. Entries without
      // a `shouldGuard` want every navigation, so they make the whole scope opt in.
      shouldGuard: (to, from) =>
        [...entries].some(entry => entry.shouldGuard?.(to, from) ?? true),
    },
  }

  // A scope with a prompt of its own claims everything below it; one without
  // passes the question upwards.
  unclaimed.set(scope.composite, context => !confirmScope && hasUnclaimedDirty(context))

  return scope
}
