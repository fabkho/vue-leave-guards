# vue-leave-guards

[![CI](https://github.com/fabkho/vue-leave-guards/actions/workflows/ci.yml/badge.svg)](https://github.com/fabkho/vue-leave-guards/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/vue-leave-guards.svg)](https://www.npmjs.com/package/vue-leave-guards)
[![license](https://img.shields.io/npm/l/vue-leave-guards.svg)](./LICENSE)

Register an unsaved-changes guard anywhere in a Vue app and it is asked before
the user leaves — however deeply it is nested, and whatever "leave" means at
that depth.

**[Try it →](https://fabkho.github.io/vue-leave-guards/)**

![Three nested hosts, each holding unsaved work, and the single dialog they produce between them](./docs/hero.png)

## Install

```bash
npm i vue-leave-guards
```

```ts
// main.ts
import { createLeaveGuards } from 'vue-leave-guards/router'

app.use(router).use(createLeaveGuards({ router, confirm: () => myConfirmDialog() }))
```

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useLeaveGuard } from 'vue-leave-guards'

const draft = ref('')

useLeaveGuard({ isDirty: () => draft.value !== '' })
</script>
```

That is the whole contract. The form reports a fact; the dialog belongs to the
application. The component does not know whether it sits on a route, in a modal,
or three overlays deep.

## What vue-router already does

`onBeforeRouteLeave` reaches any component below a `<RouterView>`, however
deeply nested — so if all you need is "ask before this route changes", use it
and stop here.

What it does not do:

| | |
| --- | --- |
| **One dialog for a form** | Every guard prompts on its own. Six dirty fields ask six times, and there is no way to collapse them. |
| **Anything that is not a navigation** | A modal closing itself is not a route change. `confirmLeave()` is. |
| **Reload and tab close** | `beforeunload` is untouched. |
| **A shared dirty flag** | Nothing to bind a header marker to. |
| **Hosts outside the RouterView** | A modal mounted by a global overlay host, or teleported out, never registers a guard at all. |

## Scopes nest

Any host that can dismiss itself opens a scope, and asks it before closing:

```vue
<script setup lang="ts">
import { provideLeaveGuards } from 'vue-leave-guards'

const { confirmLeave } = provideLeaveGuards()

async function close() {
  if (!(await confirmLeave())) return
  emit('close')
}
</script>
```

- Guards inside reach the **nearest** scope, by injection.
- Each scope registers with its parent as **one composite guard**, so a tree of
  any depth collapses into a single entry at the root.
- Closing a modal asks only that modal's subtree. Navigating asks everything.
- The app ends up with **one route guard and one `beforeunload` listener**,
  regardless of how many forms are mounted.

That last point is not a micro-optimisation: `window.onbeforeunload` is a
singleton, so per-form listeners overwrite each other and null each other out on
unmount.

## Who owns the dialog

Set `confirm` once, on the plugin, and no form ever touches your dialog code:

```ts
// main.ts — the app's leave dialog, written once
app.use(createLeaveGuards({ router, confirm: () => myConfirmDialog() }))

// any form, anywhere below it
useLeaveGuard({ isDirty: () => form.isDirty })
```

One guard per form, reporting a fact. Every form asks the same way, and none of
them import a modal to do it.

Put `confirm` on the guard when a particular form needs its own wording:

```ts
useLeaveGuard({ isDirty, confirm: () => askAboutThisOne() })
```

Guards carrying their own are asked individually, in turn, bailing at the first
refusal so the dialogs never overlap. Where one scope holds several — two
separately-saveable sections, or a form beside an unsaved filter — the scope's
prompt covers all those that brought none, and is asked once before them.

A scope opened purely for structure, holding only reporters, defers to whichever
ancestor can actually ask.

`isDirty` is separate, and synchronous, because `beforeunload` cannot await a
dialog — browsers only accept a synchronous `preventDefault()`, and ignore any
message you pass. It is also what `dirty` reads, so a header can show an unsaved
marker for everything below it. A guard with `isDirty` and no `confirm` anywhere
above it warns on tab close and permits in-app navigation, which is the right
behaviour for a draft the server already holds.

## Narrowing a guard

`shouldGuard` decides which navigations a guard cares about. It is consulted
only for navigations; a host closing itself asks everything.

```ts
useLeaveGuard<RouteLocationNormalized>({
  confirm: askTheUser,
  shouldGuard: (to, from) => to.name !== from.name,
})
```

## Without a router

The core imports nothing but `vue`. Skip the plugin and own the scope yourself:

```ts
import { createReactiveLeaveGuardScope, leaveGuardsKey } from 'vue-leave-guards'

const scope = createReactiveLeaveGuardScope()
app.provide(leaveGuardsKey, scope.registry)
```

`createLeaveGuards({ beforeUnload: true })` with no `router` is the same thing
with the unload listener already wired.

## API

### `vue-leave-guards`

| Export | Description |
| --- | --- |
| `useLeaveGuard(guard)` | Registers a guard with the nearest scope, for as long as the calling scope lives. A bare function guards every navigation and reports nothing to `beforeunload`. Returns `{ unregister, registered }`. |
| `provideLeaveGuards(options?)` | Opens a scope at this component and returns it. Takes the `confirm` that speaks for everything below it. Registers with the enclosing scope, if any. |
| `createReactiveLeaveGuardScope(options?)` | A scope with no component attached, for a plugin or a store. |
| `createLeaveGuardScope(options?)` | The same, without Vue reactivity — no framework import at all. |
| `leaveGuardsKey` | The injection key, for providing a registry by hand. |

### `LeaveGuardEntry`

| Field | Type | Description |
| --- | --- | --- |
| `confirm` | `(ctx?) => boolean \| Promise<boolean>` | This guard's own prompt; `false` aborts the leave. Omit to defer to the scope's. |
| `isDirty` | `() => boolean` | Synchronous. Feeds `beforeunload`, `dirty`, and whether the scope's prompt is asked. Absent means never dirty. |
| `shouldGuard` | `(to, from) => boolean` | Absent means every navigation. |

### Scope

| Field | Type | Description |
| --- | --- | --- |
| `confirmLeave(ctx?)` | `Promise<boolean>` | Asks the subtree. Without a context, asks everything. |
| `dirty` | `ComputedRef<boolean>` | True while anything below reports unsaved changes. |
| `size` | `ComputedRef<number>` | Live entry count; a nested scope counts as one. |
| `isDirty()` | `boolean` | The non-reactive read, for guards whose state Vue cannot see. |
| `registry` | `LeaveGuardRegistry` | What gets provided to descendants. |
| `composite` | `LeaveGuardEntry` | This scope as one entry, for a parent. |

### `vue-leave-guards/router`

`createLeaveGuards(options?)` returns a Vue plugin carrying its root `scope`.

| Option | Default | Description |
| --- | --- | --- |
| `router` | — | Guards navigation. Omit to guard only `beforeunload`. |
| `confirm` | — | The application's one prompt, for guards that bring none. |
| `beforeUnload` | `true` | Warns before reload and tab close while anything is dirty. |
| `window` | `globalThis.window` | For iframes, tests and SSR. |

Also exported: `RouteLeaveGuard`, `RouteLeaveGuardEntry`, `RouteLeaveGuardScope`,
`RouteNavigationContext` — the core types with vue-router's route filled in.

## Notes

- `vue-router` is an **optional** peer. The core never imports it, not even for
  a type.
- `useLeaveGuard` **warns** rather than throwing when it finds no scope. A guard
  that silently no-ops is how an unguarded form ships.
- `dirty` tracks guards mounting and unmounting, and the reactive state each one
  reads. A guard reading something Vue cannot see needs `isDirty()`.
- ESM only.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licence

MIT
