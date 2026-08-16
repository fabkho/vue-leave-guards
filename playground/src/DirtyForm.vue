<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useLeaveGuard } from 'vue-leave-guards'
import type { RouteLocationNormalized } from 'vue-router'

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
    <span>{{ label }}</span>
    <input v-model="value" type="text" placeholder="type to make it dirty">
    <em v-if="value">unsaved</em>
  </label>

  <dialog ref="dialog" @cancel.prevent="answer(false)">
    <p><strong>{{ label }}</strong> has unsaved changes.</p>
    <div class="row">
      <button type="button" @click="answer(false)">
        Stay
      </button>
      <button type="button" class="danger" @click="answer(true)">
        Discard
      </button>
    </div>
  </dialog>
</template>
