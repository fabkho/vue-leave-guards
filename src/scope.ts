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
  confirm: LeaveGuard<Route>
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

export interface LeaveGuardScopeOptions {
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
 * Creates a scope with no ties to a component tree.
 *
 * Call this directly for the application-wide scope a plugin owns; inside a
 * component, prefer `provideLeaveGuards()`, which also wires the injection.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createLeaveGuardScope<Route = unknown>(
  options: LeaveGuardScopeOptions = {},
): LeaveGuardScope<Route> {
  const { onChange } = options
  const entries = new Set<LeaveGuardEntry<Route>>()

  async function confirmLeave(context?: NavigationContext<Route>): Promise<boolean> {
    // Sequential and bailing early: two guards prompting at once would stack
    // dialogs. The copy survives a guard unregistering mid-await.
    for (const entry of [...entries]) {
      if (context && entry.shouldGuard && !entry.shouldGuard(context.to, context.from)) continue
      if (!(await entry.confirm(context))) return false
    }
    return true
  }

  const isDirty = () => [...entries].some(entry => entry.isDirty?.() ?? false)

  return {
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
      confirm: confirmLeave,
      isDirty,
      // A scope guards a navigation if anything inside it does. Entries without
      // a `shouldGuard` want every navigation, so they make the whole scope opt in.
      shouldGuard: (to, from) =>
        [...entries].some(entry => entry.shouldGuard?.(to, from) ?? true),
    },
  }
}
