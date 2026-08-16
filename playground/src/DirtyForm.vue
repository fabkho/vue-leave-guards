<script setup lang="ts">
import type { RouteLocationNormalized } from 'vue-router'
import { ref, useTemplateRef } from 'vue'
import { useLeaveGuard } from 'vue-leave-guards'

const { label, only, unload = true } = defineProps<{
  label: string
  /** Guard only navigations heading here. Absent means every navigation. */
  only?: string
  /** Whether this field's state reaches the tab-close warning. */
  unload?: boolean
}>()

const value = ref('')
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

let settle: ((leave: boolean) => void) | undefined

useLeaveGuard<RouteLocationNormalized>({
  isDirty: unload ? () => value.value !== '' : undefined,
  shouldGuard: only ? to => to.path === only : undefined,
  // Returning a promise is what lets the prompt be a real dialog rather than
  // `window.confirm`, and what keeps two of them from opening at once.
  confirm: () => {
    if (value.value === '') return true
    dialog.value?.showModal()
    return new Promise<boolean>((resolve) => {
      settle = resolve
    })
  },
})

function answer(leave: boolean) {
  dialog.value?.close()
  if (leave) value.value = ''
  settle?.(leave)
  settle = undefined
}
</script>

<template>
  <label class="field">
    <span class="field__label">{{ label }}</span>
    <input v-model="value" type="text" placeholder="type to make it unsaved">
    <span v-if="value" class="badge is-dirty">unsaved</span>
  </label>

  <dialog ref="dialog" @cancel.prevent="answer(false)">
    <p><strong>{{ label }}</strong> has unsaved changes.</p>
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
.field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.375rem 0;
  font-size: 0.9375rem;
}

.field__label {
  min-width: 7rem;
}

input {
  flex: 1;
  min-width: 0;
  max-width: 18rem;
  padding: 0.4375rem 0.6875rem;
  border: 0;
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 70%);
  box-shadow: inset 0 0 0 1px rgb(20 40 55 / 12%);
  color: #1c2b36;
  font: inherit;
  font-size: 0.875rem;
}

input::placeholder {
  color: #9aa5af;
}
</style>
