<script setup lang="ts">
import { inject, ref } from 'vue'
import DirtyForm from '../DirtyForm.vue'
import Overlay from '../Overlay.vue'
import SharedPrompt from '../SharedPrompt.vue'
import { rootScopeKey } from '../rootScope'

const root = inject(rootScopeKey)

const drawer = ref(false)
const modal = ref(false)
</script>

<template>
  <main class="cases">
    <!-- Nesting first and on its own. It is the reason to use this over a route
         guard, and it has to be opened to be understood. -->
    <section class="card card--wide showcase">
      <h2>Three levels deep</h2>
      <p>
        Type in any field, then try to leave — navigate, close a host, or reload
        the tab. Each host below opens its own scope, and each field registers
        one guard with the nearest one.
      </p>

      <div class="showcase__stage">
        <DirtyForm label="On the page" />

        <button
          v-if="!drawer"
          type="button"
          class="plain"
          @click="drawer = true"
        >
          Open a drawer
        </button>

        <Overlay v-else title="Drawer" @close="drawer = false">
          <DirtyForm label="In the drawer" />

          <button
            v-if="!modal"
            type="button"
            class="plain"
            @click="modal = true"
          >
            Open a modal
          </button>

          <Overlay v-else title="Modal" @close="modal = false">
            <DirtyForm label="In the modal" />
          </Overlay>
        </Overlay>
      </div>

      <p class="showcase__claim">
        The root scope holds
        <span class="badge" :class="{ 'is-dirty': root?.dirty.value }">
          {{ root?.size.value ?? 0 }} entr{{ root?.size.value === 1 ? 'y' : 'ies' }}
        </span>
        — and opening both hosts adds exactly one, with the modal and every field
        inside them folded into it. That is why the app needs one route guard and
        one <code>beforeunload</code> rather than one per form.
      </p>
    </section>

    <section class="card card--wide">
      <h2>The host owns the dialog</h2>
      <p>
        Two unrelated things unsaved at once — a draft and a filter. Neither
        knows how to ask; each only reports that it is dirty, and the host
        around them owns the single prompt. That is the usual shape: one guard
        per form, and the dialog written once for the whole app. Give a guard
        its own <code>confirm</code> instead — as the three above have — and it
        is asked for separately.
      </p>
      <SharedPrompt>
        <DirtyForm label="Draft note" prompt="shared" />
        <DirtyForm label="Column filter" prompt="shared" />
      </SharedPrompt>
    </section>
  </main>
</template>

<style scoped>
.card.showcase {
  padding: 2.5rem 1.5rem 2rem;
}

.showcase h2 {
  font-size: 1.25rem;
}

/* Room for the drawer — the first thing a visitor opens — so that click does not
   push the rest of the page around. Reserving for the modal as well would leave
   a void half the card tall before anything has been touched, which reads as a
   broken layout rather than as considerate. */
.showcase__stage {
  display: grid;
  justify-items: start;
  align-content: start;
  gap: 0.5rem;
  width: 100%;
  min-height: 9rem;
}

.showcase__claim {
  margin: 0.5rem 0 0;
}
</style>
