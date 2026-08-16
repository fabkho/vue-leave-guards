<script setup lang="ts">
import { inject } from 'vue'
import { rootScopeKey } from './rootScope'

const root = inject(rootScopeKey)
</script>

<template>
  <header class="bar">
    <h1>vue-leave-guards</h1>
    <nav>
      <RouterLink to="/">
        Page
      </RouterLink>
      <RouterLink to="/other">
        Another page
      </RouterLink>
    </nav>
    <span class="badge" :class="{ dirty: root?.dirty.value }">
      root scope: {{ root?.size.value ?? 0 }}{{ root?.dirty.value ? ' · dirty' : '' }}
    </span>
  </header>

  <main>
    <RouterView />
  </main>

  <footer>
    <p>
      However deep the nesting, the root holds one entry per top-level host —
      and the app has exactly one route guard and one <code>beforeunload</code>.
    </p>
  </footer>
</template>
