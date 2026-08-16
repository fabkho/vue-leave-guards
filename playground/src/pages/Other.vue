<script setup lang="ts">
import DirtyForm from '../DirtyForm.vue'
</script>

<template>
  <main class="cases">
    <section class="card card--wide">
      <h2>Narrowed to the navigations it cares about</h2>
      <p>
        <code>shouldGuard</code> decides which navigations reach a guard. This
        one asks on the way back to the first page and stays quiet going
        anywhere else. It also reports nothing to <code>beforeunload</code>, so
        reloading the tab discards it without a word — which is the right
        behaviour for a draft the server already has.
      </p>
      <DirtyForm label="Filter" only="/" :unload="false" />
    </section>
  </main>
</template>
