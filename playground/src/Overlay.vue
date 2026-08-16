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
      <span class="badge" :class="{ 'is-dirty': dirty }">
        {{ size }} guard{{ size === 1 ? '' : 's' }} inside
      </span>
      <button type="button" class="plain" @click="close">
        Close
      </button>
    </header>
    <slot />
  </div>
</template>

<style scoped>
/* Nested hosts are nested sheets, so the scope tree is the page layout. Each
   sits slightly brighter than its parent rather than casting its own shadow —
   stacked shadows would read as depth the scopes do not have. */
.overlay {
  width: 100%;
  margin: 0.5rem 0 0;
  padding: 1rem 1.125rem 1.25rem;
  border-radius: 0.875rem;
  background: rgb(255 255 255 / 45%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 70%);
}

.overlay > header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.overlay > header strong {
  font-size: 0.875rem;
  font-weight: 600;
}

.overlay > header .plain {
  margin-left: auto;
}
</style>
