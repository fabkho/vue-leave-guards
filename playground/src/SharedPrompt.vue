<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { provideLeaveGuards } from 'vue-leave-guards'

/**
 * A host that owns the one dialog for everything inside it. The fields below
 * report whether they are dirty and nothing else, so leaving with six of them
 * unsaved asks once rather than six times.
 */
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

let settle: ((leave: boolean) => void) | undefined

const { dirty, size } = provideLeaveGuards({
  confirm: () => {
    dialog.value?.showModal()
    return new Promise<boolean>((resolve) => {
      settle = resolve
    })
  },
})

function answer(leave: boolean) {
  dialog.value?.close()
  settle?.(leave)
  settle = undefined
}
</script>

<template>
  <div class="shared">
    <span class="badge" :class="{ 'is-dirty': dirty }">
      {{ size }} field{{ size === 1 ? '' : 's' }} reporting, one dialog
    </span>
    <slot />
  </div>

  <dialog ref="dialog" @cancel.prevent="answer(false)">
    <p>This form has unsaved changes.</p>
    <div class="row">
      <button type="button" class="plain" @click="answer(false)">
        Keep editing
      </button>
      <button type="button" class="plain plain--danger" @click="answer(true)">
        Discard
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.shared {
  display: grid;
  justify-items: start;
  gap: 0.25rem;
  width: 100%;
}

.badge {
  margin-bottom: 0.5rem;
}
</style>
