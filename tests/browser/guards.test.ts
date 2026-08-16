import type { LeaveGuardScope, ReactiveLeaveGuardScope } from '../../src/index.js'
import type { RouteLocationNormalized } from 'vue-router'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { provideLeaveGuards, useLeaveGuard } from '../../src/index.js'
import { createLeaveGuards } from '../../src/router.js'

// Every mounted app installs a `beforeunload` listener, and one left behind
// answers for a later test's window. Which is the failure mode this package
// exists to remove — it just has to be removed from the suite as well.
enableAutoUnmount(afterEach)

/** Registers a guard and nothing else; the leaf of every tree here. */
function guardedLeaf(confirm: () => boolean | Promise<boolean>, isDirty = () => true) {
  return defineComponent({
    setup() {
      useLeaveGuard({ confirm, isDirty })
      return () => h('div', 'leaf')
    },
  })
}

describe('scopes through a real component tree', () => {
  it('reaches a guard nested below a component that knows nothing about guards', async () => {
    const confirm = vi.fn(() => false)
    const Leaf = guardedLeaf(confirm)
    const Passthrough = defineComponent({ setup: () => () => h(Leaf) })

    let scope!: LeaveGuardScope
    mount(defineComponent({
      setup() {
        scope = provideLeaveGuards()
        return () => h(Passthrough)
      },
    }))

    expect(scope.isDirty()).toBe(true)
    await expect(scope.confirmLeave()).resolves.toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('collapses a nested scope into one entry and still reaches inside it', async () => {
    const confirm = vi.fn(() => false)
    const Leaf = guardedLeaf(confirm)

    const Modal = defineComponent({
      setup() {
        provideLeaveGuards()
        return () => h(Leaf)
      },
    })

    let root!: LeaveGuardScope
    mount(defineComponent({
      setup() {
        root = provideLeaveGuards()
        return () => h(Modal)
      },
    }))

    expect(root.registry.size).toBe(1)
    await expect(root.confirmLeave()).resolves.toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('keeps a root `dirty` correct when a guard appears two scopes down later', async () => {
    const value = ref('')
    const Leaf = defineComponent({
      setup() {
        useLeaveGuard({ confirm: () => true, isDirty: () => value.value !== '' })
        return () => h('div')
      },
    })

    const Drawer = defineComponent({
      props: { open: Boolean },
      setup(props) {
        provideLeaveGuards()
        return () => (props.open ? h(Leaf) : h('div'))
      },
    })

    let root!: ReactiveLeaveGuardScope
    const wrapper = mount(defineComponent({
      setup() {
        root = provideLeaveGuards()
        const open = ref(false)
        return { open }
      },
      render() {
        // Reading it here is the point: the root computed caches a dependency
        // set before the leaf below the drawer exists.
        return h('div', [String(root.dirty.value), h(Drawer, { open: this.open })])
      },
    }))

    // Rendered once with an empty subtree, so the cache is primed.
    expect(root.dirty.value).toBe(false)

    await wrapper.setData({ open: true })
    value.value = 'unsaved'

    expect(root.dirty.value).toBe(true)
  })

  it('unregisters a guard when its component unmounts', async () => {
    const Leaf = guardedLeaf(() => false)

    let root!: LeaveGuardScope
    const wrapper = mount(defineComponent({
      setup() {
        root = provideLeaveGuards()
        const open = ref(true)
        return { open }
      },
      render() {
        return this.open ? h(Leaf) : h('div', 'empty')
      },
    }))

    expect(root.registry.size).toBe(1)
    expect(root.isDirty()).toBe(true)

    await wrapper.setData({ open: false })

    expect(root.registry.size).toBe(0)
    expect(root.isDirty()).toBe(false)
    await expect(root.confirmLeave()).resolves.toBe(true)
  })

  it('registers into its own scope when one component both provides and guards', async () => {
    const confirm = vi.fn(() => false)

    let own!: LeaveGuardScope
    let root!: LeaveGuardScope
    const Both = defineComponent({
      setup() {
        own = provideLeaveGuards()
        // Plain `inject` resolves against the parent, so without the local
        // lookup this guard would land in the root scope instead.
        useLeaveGuard({ confirm, isDirty: () => true })
        return () => h('div')
      },
    })

    mount(defineComponent({
      setup() {
        root = provideLeaveGuards()
        return () => h(Both)
      },
    }))

    expect(own.registry.size).toBe(1)
    // The composite only — the guard itself belongs to the inner scope.
    expect(root.registry.size).toBe(1)
    await expect(own.confirmLeave()).resolves.toBe(false)
    expect(confirm).toHaveBeenCalledOnce()
  })
})

describe('a guard with no scope', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('warns instead of guarding nothing in silence', () => {
    mount(guardedLeaf(() => false))

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('[vue-leave-guards]')
  })

  it('says nothing when a scope is present', () => {
    const Leaf = guardedLeaf(() => false)
    mount(defineComponent({
      setup() {
        provideLeaveGuards()
        return () => h(Leaf)
      },
    }))

    // The test above is this assertion's negative control: the same spy, the
    // same mount, and it does fire when the scope is missing.
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('the router plugin', () => {
  /**
   * Landed on `/` before anything mounts. `isReady()` alone would deadlock —
   * with memory history the initial navigation is what `app.use(router)`
   * triggers, so awaiting it first waits for something that has not started.
   * Doing it here also keeps the initial navigation out of the guards' way.
   */
  async function makeRouter() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { render: () => h('div', 'home') } },
        { path: '/away', component: { render: () => h('div', 'away') } },
      ],
    })
    await router.push('/')
    await router.isReady()
    return router
  }

  it('blocks a navigation a nested guard refuses, and allows one it permits', async () => {
    const router = await makeRouter()
    const answer = vi.fn(() => false)
    const Leaf = guardedLeaf(answer)
    const guards = createLeaveGuards({ router })

    mount(defineComponent({ setup: () => () => h(Leaf) }), {
      global: { plugins: [router, guards] },
    })

    await router.push('/away')
    expect(router.currentRoute.value.path).toBe('/')
    expect(answer).toHaveBeenCalledOnce()

    answer.mockReturnValue(true)
    await router.push('/away')
    expect(router.currentRoute.value.path).toBe('/away')
  })

  it('passes the navigation to shouldGuard so a guard can ignore it', async () => {
    const router = await makeRouter()
    const confirm = vi.fn(() => false)

    const Leaf = defineComponent({
      setup() {
        // The type parameter is how a core-only caller gets a typed route; the
        // `/router` entry's aliases are the alternative.
        useLeaveGuard<RouteLocationNormalized>({
          confirm,
          shouldGuard: to => to.path === '/nowhere',
        })
        return () => h('div')
      },
    })

    mount(Leaf, { global: { plugins: [router, createLeaveGuards({ router })] } })

    await router.push('/away')
    expect(router.currentRoute.value.path).toBe('/away')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('warns on unload only while something is dirty, and stops on unmount', () => {
    const dirty = ref(false)
    const Leaf = defineComponent({
      setup() {
        useLeaveGuard({ confirm: () => true, isDirty: () => dirty.value })
        return () => h('div')
      },
    })

    const wrapper = mount(Leaf, { global: { plugins: [createLeaveGuards()] } })

    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }

    expect(unload()).toBe(false)

    dirty.value = true
    expect(unload()).toBe(true)

    // The listener is the app's, not the window's forever.
    wrapper.unmount()
    dirty.value = true
    expect(unload()).toBe(false)
  })
})
