import type { ComputedRef, InjectionKey } from 'vue'
import type { LeaveGuard, LeaveGuardEntry, LeaveGuardRegistry, LeaveGuardScope, LeaveGuardScopeOptions } from './scope.js'
import { computed, getCurrentInstance, getCurrentScope, hasInjectionContext, inject, onScopeDispose, provide, shallowRef } from 'vue'
import { createLeaveGuardScope } from './scope.js'

/** `any` because one key spans scopes of differing `Route` types; callers
 * recover it through `useLeaveGuard<Route>()`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const leaveGuardsKey: InjectionKey<LeaveGuardRegistry<any>> = Symbol('vue-leave-guards')

/**
 * Vue resolves `inject` against the *parent's* provides, so a component that
 * opens a scope and also registers a guard would reach past its own scope.
 * VueUse's `provideLocal`/`injectLocal`, narrowed to one key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localRegistries = new WeakMap<object, LeaveGuardRegistry<any>>()

function currentOwner(): object | null {
  return getCurrentInstance()?.proxy ?? getCurrentScope() ?? null
}

export interface ReactiveLeaveGuardScope<Route = unknown> extends LeaveGuardScope<Route> {
  /**
   * True while anything below reports unsaved changes. Tracks mounting and
   * unmounting as well as each guard's state, provided that state is reactive;
   * `isDirty()` is the escape hatch for state Vue cannot see.
   */
  dirty: ComputedRef<boolean>
  /** Live entry count; a nested scope counts as one. */
  size: ComputedRef<number>
}

/**
 * The registry stays a plain `Set` in framework-free code; this adds the ref
 * that changes alongside it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createReactiveLeaveGuardScope<Route = unknown>(
  options: LeaveGuardScopeOptions<Route> = {},
): ReactiveLeaveGuardScope<Route> {
  const version = shallowRef(0)
  const scope = createLeaveGuardScope<Route>({
    ...options,
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
 * Opens a scope for a dismissable host. Each scope registers with its parent as
 * one composite guard, so a modal consults its own subtree while an outer scope
 * still sees everything inside it. Pass a `confirm` to own the one dialog for
 * everything below.
 *
 * @example
 * ```ts
 * const { confirmLeave } = provideLeaveGuards({ confirm: () => askOnce() })
 * if (!(await confirmLeave())) return
 * emit('close')
 * ```
 */
export function provideLeaveGuards<Route = unknown>(
  options: LeaveGuardScopeOptions<Route> = {},
): ReactiveLeaveGuardScope<Route> {
  const parent = hasInjectionContext() ? inject(leaveGuardsKey, null) : null

  // An ancestor's `dirty` caches whichever guards existed when it last read
  // through this composite; without notifying it, a form mounted here later
  // would change a value nothing upstream is watching.
  const scope = createReactiveLeaveGuardScope<Route>({
    ...options,
    onChange: () => {
      options.onChange?.()
      parent?.notify()
    },
  })

  parent?.register(scope.composite)
  // Outside an effect scope — a plugin, a test — there is nothing to dispose on.
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
 * Warns rather than throws: a hard failure would take down an app over a guard,
 * but silence is how an unguarded form ships.
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
