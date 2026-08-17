import { describe, expect, it, vi } from 'vitest'
import { createLeaveGuardScope } from '../../src/scope.js'

interface Route { path: string }

const nav = (to: string, from = '/') => ({ to: { path: to }, from: { path: from } })

describe('createLeaveGuardScope', () => {
  it('lets a leave through when nothing is registered', async () => {
    await expect(createLeaveGuardScope().confirmLeave()).resolves.toBe(true)
  })

  it('asks every guard when all of them agree', async () => {
    const scope = createLeaveGuardScope()
    const first = vi.fn(() => true)
    const second = vi.fn(() => true)

    scope.registry.register({ confirm: first })
    scope.registry.register({ confirm: second })

    await expect(scope.confirmLeave()).resolves.toBe(true)
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('stops at the first refusal so prompts never stack', async () => {
    const scope = createLeaveGuardScope()
    const refuses = vi.fn(async () => false)
    const later = vi.fn(() => true)

    scope.registry.register({ confirm: refuses })
    scope.registry.register({ confirm: later })

    await expect(scope.confirmLeave()).resolves.toBe(false)
    expect(refuses).toHaveBeenCalledOnce()
    // The negative control for this assertion is the test above, where the same
    // spy in the same position does fire.
    expect(later).not.toHaveBeenCalled()
  })

  it('unregisters cleanly, including twice', () => {
    const scope = createLeaveGuardScope()
    const entry = { confirm: () => true }

    scope.registry.register(entry)
    expect(scope.registry.size).toBe(1)

    scope.registry.unregister(entry)
    scope.registry.unregister(entry)
    expect(scope.registry.size).toBe(0)
  })

  it('survives a guard unregistering itself mid-await', async () => {
    const scope = createLeaveGuardScope()
    const second = vi.fn(() => true)
    const secondEntry = { confirm: second }

    scope.registry.register({
      confirm: async () => {
        scope.registry.unregister(secondEntry)
        return true
      },
    })
    scope.registry.register(secondEntry)

    // The pass iterates a copy, so the entry removed mid-flight is still asked
    // rather than the iteration breaking.
    await expect(scope.confirmLeave()).resolves.toBe(true)
    expect(second).toHaveBeenCalledOnce()
    expect(scope.registry.size).toBe(1)
  })
})

describe('one prompt for the whole scope', () => {
  it('asks once for any number of dirty guards that brought no prompt', async () => {
    const confirm = vi.fn(() => true)
    const scope = createLeaveGuardScope({ confirm })

    scope.registry.register({ isDirty: () => true })
    scope.registry.register({ isDirty: () => true })
    scope.registry.register({ isDirty: () => true })

    await expect(scope.confirmLeave()).resolves.toBe(true)
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('refuses the leave when that one prompt is refused', async () => {
    const scope = createLeaveGuardScope({ confirm: () => false })
    scope.registry.register({ isDirty: () => true })

    await expect(scope.confirmLeave()).resolves.toBe(false)
  })

  it('stays quiet when nothing is dirty', async () => {
    const confirm = vi.fn(() => true)
    const scope = createLeaveGuardScope({ confirm })

    scope.registry.register({ isDirty: () => false })
    scope.registry.register({ isDirty: () => true, confirm: () => true })

    await expect(scope.confirmLeave()).resolves.toBe(true)
    // The guard carrying its own prompt does not also trigger the scope's.
    expect(confirm).not.toHaveBeenCalled()
  })

  it('still asks a guard that brought its own prompt, after the shared one', async () => {
    const order: string[] = []
    const scope = createLeaveGuardScope({
      confirm: () => {
        order.push('scope')
        return true
      },
    })

    scope.registry.register({ isDirty: () => true })
    scope.registry.register({
      isDirty: () => true,
      confirm: () => {
        order.push('own')
        return true
      },
    })

    await expect(scope.confirmLeave()).resolves.toBe(true)
    expect(order).toEqual(['scope', 'own'])
  })

  it('hands the navigation to both kinds of prompt', async () => {
    const scopePrompt = vi.fn(() => true)
    const ownPrompt = vi.fn(() => true)
    const scope = createLeaveGuardScope<Route>({ confirm: scopePrompt })

    scope.registry.register({ isDirty: () => true })
    scope.registry.register({ confirm: ownPrompt })

    const context = nav('/away', '/here')
    await scope.confirmLeave(context)

    // A guard reading `context.to` was relying on untested behaviour.
    expect(scopePrompt).toHaveBeenCalledWith(context)
    expect(ownPrompt).toHaveBeenCalledWith(context)
  })

  it('lets a reporter through untouched when no prompt exists anywhere', async () => {
    // Legitimate: `isDirty` alone feeds `beforeunload`, which needs no dialog.
    const scope = createLeaveGuardScope()
    scope.registry.register({ isDirty: () => true })

    await expect(scope.confirmLeave()).resolves.toBe(true)
    expect(scope.isDirty()).toBe(true)
  })
})

describe('a structural scope with no prompt of its own', () => {
  it('folds into an ancestor prompt instead of answering for itself', async () => {
    const confirm = vi.fn(() => false)
    const root = createLeaveGuardScope({ confirm })
    const inner = createLeaveGuardScope()

    root.registry.register(inner.composite)
    inner.registry.register({ isDirty: () => true })

    // The composite offers no `confirm`, so the root counts it among the guards
    // its own prompt speaks for.
    expect(inner.composite.confirm).toBeUndefined()
    await expect(root.confirmLeave()).resolves.toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('folds its unclaimed guards upward even when one of them can prompt', async () => {
    const rootPrompt = vi.fn(() => true)
    const ownPrompt = vi.fn(() => true)
    const root = createLeaveGuardScope<Route>({ confirm: rootPrompt })
    const inner = createLeaveGuardScope<Route>()

    root.registry.register(inner.composite)
    // One field wants its own wording, the rest only report. Such a modal used
    // to lose the reporters: the composite looked claimed, and the scope inside
    // had no prompt to claim them with.
    inner.registry.register({ confirm: ownPrompt })
    inner.registry.register({ isDirty: () => true })

    await expect(root.confirmLeave()).resolves.toBe(true)
    expect(rootPrompt).toHaveBeenCalledOnce()
    expect(ownPrompt).toHaveBeenCalledOnce()
  })

  it('reaches unclaimed work two structural scopes down', async () => {
    const rootPrompt = vi.fn(() => false)
    const root = createLeaveGuardScope<Route>({ confirm: rootPrompt })
    const mid = createLeaveGuardScope<Route>()
    const deep = createLeaveGuardScope<Route>()

    root.registry.register(mid.composite)
    mid.registry.register(deep.composite)
    mid.registry.register({ confirm: () => true })
    deep.registry.register({ isDirty: () => true })

    await expect(root.confirmLeave()).resolves.toBe(false)
    expect(rootPrompt).toHaveBeenCalledOnce()
  })

  it('does not ask about nested work that opted out of this navigation', async () => {
    const rootPrompt = vi.fn(() => true)
    const root = createLeaveGuardScope<Route>({ confirm: rootPrompt })
    const inner = createLeaveGuardScope<Route>()
    root.registry.register(inner.composite)

    inner.registry.register({ isDirty: () => true, shouldGuard: () => false })
    inner.registry.register({ isDirty: () => false })

    // Flat in the root these two would not trigger the prompt; nesting must
    // not change the answer.
    await expect(root.confirmLeave(nav('/away'))).resolves.toBe(true)
    expect(rootPrompt).not.toHaveBeenCalled()

    // Negative control: the same guard, for the navigation it does care about.
    inner.registry.register({ isDirty: () => true, shouldGuard: to => to.path === '/away' })
    await expect(root.confirmLeave(nav('/away'))).resolves.toBe(true)
    expect(rootPrompt).toHaveBeenCalledOnce()
  })

  it('answers for itself again as soon as it can prompt', async () => {
    const rootConfirm = vi.fn(() => false)
    const root = createLeaveGuardScope({ confirm: rootConfirm })
    const inner = createLeaveGuardScope()

    root.registry.register(inner.composite)
    inner.registry.register({ isDirty: () => true, confirm: () => true })

    // Negative control for the test above: same shape, one guard now carries a
    // prompt, and the composite stops deferring.
    expect(inner.composite.confirm).toBeTypeOf('function')
    await expect(root.confirmLeave()).resolves.toBe(true)
    expect(rootConfirm).not.toHaveBeenCalled()
  })
})

describe('shouldGuard', () => {
  it('skips guards that opt out of this navigation', async () => {
    const scope = createLeaveGuardScope<Route>()
    const confirm = vi.fn(() => false)

    scope.registry.register({ confirm, shouldGuard: to => to.path === '/away' })

    await expect(scope.confirmLeave(nav('/nearby'))).resolves.toBe(true)
    expect(confirm).not.toHaveBeenCalled()

    // Negative control: the same guard does fire for the navigation it wants.
    await expect(scope.confirmLeave(nav('/away'))).resolves.toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('ignores shouldGuard entirely when asked without a context', async () => {
    const scope = createLeaveGuardScope<Route>()
    const confirm = vi.fn(() => false)

    scope.registry.register({ confirm, shouldGuard: () => false })

    // A host closing itself is not a navigation, so every guard applies.
    await expect(scope.confirmLeave()).resolves.toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
  })
})

describe('isDirty', () => {
  it('is true when any guard is dirty, and treats an absent reporter as clean', () => {
    const scope = createLeaveGuardScope()

    scope.registry.register({ confirm: () => true })
    expect(scope.isDirty()).toBe(false)

    scope.registry.register({ confirm: () => true, isDirty: () => false })
    expect(scope.isDirty()).toBe(false)

    scope.registry.register({ confirm: () => true, isDirty: () => true })
    expect(scope.isDirty()).toBe(true)
  })
})

describe('nesting', () => {
  it('reaches a grandchild guard through two composites', async () => {
    const root = createLeaveGuardScope<Route>()
    const modal = createLeaveGuardScope<Route>()
    const form = createLeaveGuardScope<Route>()

    root.registry.register(modal.composite)
    modal.registry.register(form.composite)

    const confirm = vi.fn(() => false)
    form.registry.register({ confirm, isDirty: () => true })

    await expect(root.confirmLeave(nav('/away'))).resolves.toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
    // One entry at the root, whatever the depth below it.
    expect(root.registry.size).toBe(1)
    expect(root.isDirty()).toBe(true)
  })

  it('lets an inner scope answer for itself without consulting its parent', async () => {
    const root = createLeaveGuardScope<Route>()
    const modal = createLeaveGuardScope<Route>()
    root.registry.register(modal.composite)

    const outerGuard = vi.fn(() => false)
    root.registry.register({ confirm: outerGuard })
    modal.registry.register({ confirm: () => true })

    // Closing the modal asks the modal's subtree only.
    await expect(modal.confirmLeave()).resolves.toBe(true)
    expect(outerGuard).not.toHaveBeenCalled()

    // Negative control: the outer guard is reachable, just not from in there.
    await expect(root.confirmLeave()).resolves.toBe(false)
    expect(outerGuard).toHaveBeenCalledOnce()
  })

  it('tells the parent when its own membership changes', () => {
    const onChange = vi.fn()
    const parent = createLeaveGuardScope<Route>({ onChange })
    const child = createLeaveGuardScope<Route>({ onChange: () => parent.registry.notify() })

    parent.registry.register(child.composite)
    expect(onChange).toHaveBeenCalledTimes(1)

    // The parent's entry set is unchanged, but what it reaches through is not.
    const entry = { confirm: () => true }
    child.registry.register(entry)
    expect(onChange).toHaveBeenCalledTimes(2)

    child.registry.unregister(entry)
    expect(onChange).toHaveBeenCalledTimes(3)

    // Negative control: a no-op unregister changes nothing, so it says nothing.
    child.registry.unregister(entry)
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('opts a composite into a navigation only when something inside it does', () => {
    const parent = createLeaveGuardScope<Route>()
    const child = createLeaveGuardScope<Route>()
    parent.registry.register(child.composite)

    const away = nav('/away')
    // Empty: nothing to ask, so nothing to opt in.
    expect(child.composite.shouldGuard!(away.to, away.from)).toBe(false)

    child.registry.register({ confirm: () => true, shouldGuard: to => to.path === '/elsewhere' })
    expect(child.composite.shouldGuard!(away.to, away.from)).toBe(false)

    // An entry with no opinion wants every navigation, so the scope does too.
    child.registry.register({ confirm: () => true })
    expect(child.composite.shouldGuard!(away.to, away.from)).toBe(true)
  })
})
