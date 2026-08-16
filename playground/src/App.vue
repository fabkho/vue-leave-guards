<script setup lang="ts">
import { inject } from 'vue'
import { rootScopeKey } from './rootScope'

/**
 * The live page. Every case is something a consumer would actually build — an
 * unsaved marker in the masthead, a form that asks before it closes — rather
 * than a tour of the registry.
 */
const root = inject(rootScopeKey)
</script>

<template>
  <header class="masthead">
    <h1>vue-leave-guards</h1>
    <p>
      Register a guard anywhere and it is asked before the user leaves, however
      deeply it is nested. Everything below is live.
      <a href="https://github.com/fabkho/vue-leave-guards">Source</a>
    </p>

    <nav>
      <RouterLink class="plain" to="/">
        A page
      </RouterLink>
      <RouterLink class="plain" to="/other">
        Another page
      </RouterLink>
      <!-- What a real app puts in its header: one marker for everything below. -->
      <span class="badge" :class="{ 'is-dirty': root?.dirty.value }">
        {{ root?.dirty.value ? 'Unsaved changes' : 'All saved' }}
      </span>
    </nav>
  </header>

  <RouterView />
</template>

<style scoped>
.masthead {
  max-width: 46rem;
  margin: 0 auto 3rem;
  text-align: center;
}

.masthead h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.masthead p {
  margin: 0;
  color: #4a5560;
  font-size: 0.9375rem;
  line-height: 1.55;
}

nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

nav a.router-link-active {
  background: rgb(255 255 255 / 95%);
  box-shadow: inset 0 0 0 1px rgb(20 40 55 / 18%);
}
</style>
