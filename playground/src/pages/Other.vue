<script setup lang="ts">
import DirtyForm from '../DirtyForm.vue'
</script>

<template>
  <section>
    <h2>Another page</h2>
    <p>
      This field guards navigation back to the first page only, via
      <code>shouldGuard</code>, and reports nothing to <code>beforeunload</code>
      — so reloading the tab loses it without a word.
    </p>
    <DirtyForm label="Route-scoped field" only="/" :unload="false" />
  </section>
</template>
