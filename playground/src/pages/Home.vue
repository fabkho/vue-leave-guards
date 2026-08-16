<script setup lang="ts">
import { ref } from 'vue'
import DirtyForm from '../DirtyForm.vue'
import Overlay from '../Overlay.vue'

const drawer = ref(false)
const modal = ref(false)
</script>

<template>
  <section>
    <h2>A page</h2>
    <p>
      Every field below registers one guard. Make any of them dirty, then try to
      navigate, close its host, or reload the tab.
    </p>

    <DirtyForm label="Page field" />

    <button type="button" @click="drawer = true">
      Open drawer
    </button>

    <!-- The awkward case: three levels of host, each with its own scope and its
         own dirty field, all reachable from the one root route guard. -->
    <Overlay v-if="drawer" title="Drawer" @close="drawer = false">
      <DirtyForm label="Drawer field" />

      <button type="button" @click="modal = true">
        Open modal
      </button>

      <Overlay v-if="modal" title="Modal" @close="modal = false">
        <DirtyForm label="Modal field" />
      </Overlay>
    </Overlay>
  </section>
</template>
