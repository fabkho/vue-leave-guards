import type { InjectionKey } from 'vue'
import type { RouteLeaveGuardScope } from 'vue-leave-guards/router'

/**
 * The plugin provides its *registry* under the library's own key, which is all
 * a guard needs. The header wants the reactive `dirty` and `size` off the scope
 * as well, so main.ts hands that down separately.
 */
export const rootScopeKey: InjectionKey<RouteLeaveGuardScope> = Symbol('rootScope')
