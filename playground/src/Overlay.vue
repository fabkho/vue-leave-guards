<script setup lang="ts">
import { provideLeaveGuards } from 'vue-leave-guards'

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

// This host owns a scope, so closing it consults only what is inside it — and
// it registers with whatever scope encloses it as one composite guard.
const { confirmLeave, dirty, size } = provideLeaveGuards()

async function close() {
  if (!(await confirmLeave())) return
  emit('close')
}
</script>

<template>
  <div class="overlay">
    <header>
      <strong>{{ title }}</strong>
      <span class="badge" :class="{ dirty }">
        {{ size }} guard(s){{ dirty ? ' · dirty' : '' }}
      </span>
      <button type="button" @click="close">
        Close
      </button>
    </header>
    <slot />
  </div>
</template>
