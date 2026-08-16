# Contributing

## Scripts

| | |
| --- | --- |
| `pnpm dev` | The playground, aliased to `src/` so edits show without a rebuild |
| `pnpm build` | Vite library mode, both entries, declarations via `vite-plugin-dts` |
| `pnpm check:dts` | Structural check on the emitted declarations |
| `pnpm test` | Unit tier — the pure registry, in Node |
| `pnpm test:browser` | Browser tier — component trees, the router, `beforeunload` |
| `pnpm test:all` | Both |
| `pnpm build:playground` | Builds the demo and then *drives* it, asserting a guard fires |
| `pnpm typecheck` / `pnpm lint` | |

## Source

```
src/
  scope.ts     the registry, with no framework in it — sequencing, bailing
               early, collapsing a subtree into one composite entry
  guards.ts    provide/inject, scope disposal, and the reactive wrapper
  index.ts     core entry — vue only
  router.ts    `/router` entry — the plugin owning the one route guard and
               the one beforeunload listener
```

`scope.ts` imports nothing. That is deliberate: it is where every interesting
decision lives, so it should be testable without mounting anything.

## Testing

Two tiers, one config. Anything that needs a component tree, a real router or a
real `beforeunload` goes in `tests/browser`; the rest is Node.

Any assertion of the form "X did not happen" needs a sibling test proving the
detector fires. Both `shouldGuard` tests and the missing-scope warning are
written as pairs for this reason.

## Traps that cost real time

**A computed caches the subtree it read.** An ancestor's `dirty` reads through a
child scope's composite, so it collects dependencies on whichever guards existed
at that moment. A form mounted in that child *afterwards* changes a ref nothing
upstream is watching, and the ancestor stays clean forever. Hence
`registry.notify()`: a child tells its parent when its own membership changes,
and the parent's version ref invalidates the cache. The symptom is a header
badge that works one level down and not two.

**Mounted apps leak their `beforeunload` listener.** A test that mounts without
unmounting leaves a live listener answering for the *next* test's window. Which
is precisely the singleton problem this package exists to fix, so the suite has
to fix it too — `enableAutoUnmount(afterEach)`.

**`router.isReady()` before mount deadlocks under memory history.** The initial
navigation is what `app.use(router)` triggers, so awaiting readiness first waits
on something that has not started. `await router.push('/')` first.

**Vue's `Plugin` type is a union**, so an interface cannot extend it. Spell the
`install` signature out instead.

**Plain `inject` resolves against the parent.** A component that calls
`provideLeaveGuards()` and `useLeaveGuard()` would reach past its own scope into
the enclosing one. `guards.ts` keeps a `WeakMap` of owner → registry to close
that, the same fix as VueUse's `provideLocal`/`injectLocal`, narrowed to one key.

**"Build green, page 200, console clean" cannot see a guard that guards
nothing.** A guard reaching no scope no-ops silently — the page renders, the
buttons work, and the only symptom is lost work. `scripts/verify-playground.mjs`
therefore drives the built demo and asserts a navigation was actually blocked.

## Commits

Conventional commits, enforced by commitlint. Releases are cut by
release-please; do not edit `version` by hand.
