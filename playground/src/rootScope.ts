import type { InjectionKey } from 'vue'
import type { RouteLeaveGuardScope } from 'vue-leave-guards/router'

/**
 * The plugin provides only its *registry* under the library's key, which is all
 * a guard needs; the header wants the reactive `dirty` and `size` too.
 */
export const rootScopeKey: InjectionKey<RouteLeaveGuardScope> = Symbol('rootScope')
