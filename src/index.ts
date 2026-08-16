export type {
  LeaveGuard,
  LeaveGuardEntry,
  LeaveGuardRegistry,
  LeaveGuardScope,
  LeaveGuardScopeOptions,
  NavigationContext,
} from './scope.js'

export { createLeaveGuardScope } from './scope.js'

export type { ReactiveLeaveGuardScope, UseLeaveGuardReturn } from './guards.js'

export {
  createReactiveLeaveGuardScope,
  leaveGuardsKey,
  provideLeaveGuards,
  useLeaveGuard,
} from './guards.js'
