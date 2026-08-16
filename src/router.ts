import type { App } from 'vue'
import type { RouteLocationNormalized, Router } from 'vue-router'
import type { ReactiveLeaveGuardScope } from './guards.js'
import type { LeaveGuard, LeaveGuardEntry, NavigationContext } from './scope.js'
import { createReactiveLeaveGuardScope, leaveGuardsKey } from './guards.js'

/** The core types, fixed to vue-router's route, so `shouldGuard` types itself. */
export type RouteNavigationContext = NavigationContext<RouteLocationNormalized>
export type RouteLeaveGuard = LeaveGuard<RouteLocationNormalized>
export type RouteLeaveGuardEntry = LeaveGuardEntry<RouteLocationNormalized>
export type RouteLeaveGuardScope = ReactiveLeaveGuardScope<RouteLocationNormalized>

export interface LeaveGuardsOptions {
  /**
   * Guards route navigation. Omit to guard only `beforeunload` — useful for an
   * app with no router, or one that installs its own `beforeEach`.
   */
  router?: Router
  /**
   * The application's one prompt, asked once for every guard that did not bring
   * a prompt of its own. Without it, such guards report to `beforeunload` and
   * nothing else.
   */
  confirm?: RouteLeaveGuard
  /**
   * Warns before a reload or tab close while any guard reports dirty state.
   *
   * @default true
   */
  beforeUnload?: boolean
  /** A custom `window`, for iframes, tests and SSR. */
  window?: Window
}

/**
 * Structurally a Vue `ObjectPlugin`, spelled out rather than extending
 * `Plugin` — which is a union, and so not extendable.
 */
export interface LeaveGuardsPlugin {
  install: (app: App) => void
  /** The root scope, for asking outside a component — a logout button, say. */
  scope: RouteLeaveGuardScope
}

/**
 * The application-wide scope: one route guard and one `beforeunload` for the
 * whole app, however many dirty forms are mounted.
 *
 * A per-form listener cannot work — `window.onbeforeunload` is a singleton, so
 * a modal opening over a dirty page overwrites the page's handler and nulls it
 * again on unmount. Registering guards against one scope is what makes an
 * arbitrary tree of them collapse into a single listener.
 *
 * @example
 * ```ts
 * app.use(createLeaveGuards({ router }))
 * ```
 */
export function createLeaveGuards(options: LeaveGuardsOptions = {}): LeaveGuardsPlugin {
  const {
    router,
    confirm,
    beforeUnload = true,
    window: win = typeof window === 'undefined' ? undefined : window,
  } = options

  const scope = createReactiveLeaveGuardScope<RouteLocationNormalized>({ confirm })

  return {
    scope,
    install(app: App) {
      app.provide(leaveGuardsKey, scope.registry)

      const teardown: Array<() => void> = []

      if (router) {
        teardown.push(router.beforeEach((to, from) => scope.confirmLeave({ to, from })))
      }

      if (beforeUnload && win) {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
          // Browsers ignore any message we set; `preventDefault` is the whole API.
          if (scope.isDirty()) event.preventDefault()
        }
        win.addEventListener('beforeunload', onBeforeUnload)
        teardown.push(() => win.removeEventListener('beforeunload', onBeforeUnload))
      }

      app.onUnmount(() => {
        for (const undo of teardown) undo()
      })
    },
  }
}
