import type { ComputedRef, InjectionKey } from 'vue'
import type { LeaveGuard, LeaveGuardEntry, LeaveGuardRegistry, LeaveGuardScope, LeaveGuardScopeOptions } from './scope.js'
import { computed, getCurrentInstance, getCurrentScope, hasInjectionContext, inject, onScopeDispose, provide, shallowRef } from 'vue'
import { createLeaveGuardScope } from './scope.js'

/**
 * One key for a tree of scopes of possibly differing `Route` types, which no
 * single instantiation can express. Callers recover the type by passing it to
 * `useLeaveGuard<Route>()`; the looseness never surfaces in the public API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const leaveGuardsKey: InjectionKey<LeaveGuardRegistry<any>> = Symbol('vue-leave-guards')

/**
 * Vue resolves `inject` against the *parent's* provides, so a component that
 * opens a scope and also registers a guard would reach past its own scope into
 * the enclosing one. Recording the registry against the owner closes that gap.
 *
 * Same idea as VueUse's `provideLocal`/`injectLocal`, narrowed to one key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localRegistries = new WeakMap<object, LeaveGuardRegistry<any>>()

function currentOwner(): object | null {
  return getCurrentInstance()?.proxy ?? getCurrentScope() ?? null
}

export interface ReactiveLeaveGuardScope<Route = unknown> extends LeaveGuardScope<Route> {
  /**
   * True while anything in this scope reports unsaved changes — bind a header
   * dot to it. Tracks guards mounting and unmounting as well as the state each
   * one reads, provided that state is reactive; `isDirty()` is the escape hatch
   * for guards that read something Vue cannot see.
   */
  dirty: ComputedRef<boolean>
  /** Live entry count. A nested scope counts as one, however deep it goes. */
  size: ComputedRef<number>
}

/**
 * A scope whose membership is observable. The registry itself stays a plain
 * `Set` in framework-free code; this adds the ref that changes alongside it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createReactiveLeaveGuardScope<Route = unknown>(
  options: LeaveGuardScopeOptions = {},
): ReactiveLeaveGuardScope<Route> {
  const version = shallowRef(0)
  const scope = createLeaveGuardScope<Route>({
    onChange: () => {
      version.value++
      options.onChange?.()
    },
  })

  return {
    ...scope,
    dirty: computed(() => {
      void version.value
      return scope.isDirty()
    }),
    size: computed(() => {
      void version.value
      return scope.registry.size
    }),
  }
}

/**
 * Opens a leave-guard scope for a dismissable host, returning the question it
 * asks before closing. Guards register by injection, so a form with pending
 * edits is reached however deeply it is nested.
 *
 * Scopes nest: each registers with its parent as one composite guard, so a
 * modal consults its own subtree while an outer scope still sees everything
 * inside it.
 *
 * @example
 * ```ts
 * const { confirmLeave } = provideLeaveGuards()
 * if (!(await confirmLeave())) return
 * emit('close')
 * ```
 */
export function provideLeaveGuards<Route = unknown>(): ReactiveLeaveGuardScope<Route> {
  const parent = hasInjectionContext() ? inject(leaveGuardsKey, null) : null

  // An ancestor's `dirty` reads through this scope's composite, so it caches
  // whichever guards existed at the time. Without telling the parent, a form
  // mounted in here later would change a value nothing upstream is watching.
  const scope = createReactiveLeaveGuardScope<Route>({ onChange: () => parent?.notify() })

  parent?.register(scope.composite)
  // The scope may be created outside an effect scope — in a plugin, or a test —
  // in which case there is nothing to dispose on and the caller unregisters.
  if (getCurrentScope()) onScopeDispose(() => parent?.unregister(scope.composite))

  const owner = currentOwner()
  if (owner) localRegistries.set(owner, scope.registry)
  if (hasInjectionContext()) provide(leaveGuardsKey, scope.registry)

  return scope
}

export interface UseLeaveGuardReturn {
  /** Registration is undone on scope dispose; call this to end it sooner. */
  unregister: () => void
  /** `false` when no scope was found, so the guard is inert. */
  registered: boolean
}

/**
 * Registers a guard with the nearest scope for as long as the calling scope
 * lives. A bare function guards every navigation and reports nothing to
 * `beforeunload`.
 *
 * Warns rather than throwing when no scope is in the tree: a hard failure would
 * take down an app over a guard, but silence is how an unguarded form ships.
 */
export function useLeaveGuard<Route = unknown>(
  guard: LeaveGuard<Route> | LeaveGuardEntry<Route>,
): UseLeaveGuardReturn {
  const owner = currentOwner()
  const registry
    = (owner && localRegistries.get(owner))
      ?? (hasInjectionContext() ? inject(leaveGuardsKey, null) : null)

  if (!registry) {
    // eslint-disable-next-line no-console
    console.warn(
      '[vue-leave-guards] useLeaveGuard() found no scope and will not guard anything. '
      + 'Install the plugin from `vue-leave-guards/router`, or call provideLeaveGuards() in an ancestor.',
    )
    return { unregister: () => {}, registered: false }
  }

  const entry = typeof guard === 'function' ? { confirm: guard } : guard
  registry.register(entry)

  let live = true
  const unregister = () => {
    if (!live) return
    live = false
    registry.unregister(entry)
  }

  if (getCurrentScope()) onScopeDispose(unregister)

  return { unregister, registered: true }
}
