<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { provideLeaveGuards, useLeaveGuard } from 'vue-leave-guards'

/**
 * Subjects for the readme stills, dressed as a product rather than a demo.
 *
 * The dialog is not a mock-up: the panel opens a real scope whose `confirm`
 * shows it, the fields register real guards, and the shot is taken while the
 * library is genuinely waiting on the promise.
 */
const ask = useTemplateRef<HTMLDialogElement>('ask')
let settle: ((leave: boolean) => void) | undefined

const { confirmLeave, dirty } = provideLeaveGuards({
  confirm: () => {
    ask.value?.showModal()
    return new Promise<boolean>((resolve) => {
      settle = resolve
    })
  },
})

function answer(leave: boolean) {
  ask.value?.close()
  settle?.(leave)
  settle = undefined
}

const company = ref('Acme Industries GmbH')
const email = ref('ops@acme.example')
const notes = ref('Renewal moved to Q3 — waiting on the signed addendum.')

// A pristine copy, so "unsaved" means edited rather than merely non-empty.
const saved = { company: 'Acme Industries GmbH', email: 'ops@acme.example', notes: '' }

useLeaveGuard({ isDirty: () => company.value !== saved.company })
useLeaveGuard({ isDirty: () => email.value !== saved.email })
useLeaveGuard({ isDirty: () => notes.value !== saved.notes })
</script>

<template>
  <div class="stage">
    <!-- Subject 1: a form with unsaved work, and the marker that says so. -->
    <section class="panel">
      <header class="panel__head">
        <h1>Customer details</h1>
        <span v-if="dirty" class="pill">Unsaved changes</span>
      </header>

      <label class="field">
        <span>Company</span>
        <input v-model="company" type="text">
      </label>

      <label class="field">
        <span>Contact email</span>
        <input v-model="email" type="text">
      </label>

      <label class="field">
        <span>Notes</span>
        <textarea v-model="notes" rows="2" />
      </label>

      <footer class="panel__foot">
        <button type="button" class="btn" @click="confirmLeave()">
          Cancel
        </button>
        <button type="button" class="btn btn--primary">
          Save changes
        </button>
      </footer>
    </section>

    <!-- Subject 2: static, a still life of what three nested hosts look like. -->
    <section class="panel tower">
      <header class="panel__head">
        <h1>Subscription</h1>
        <span class="pill">Unsaved changes</span>
      </header>

      <div class="sheet">
        <div class="sheet__head">
          <strong>Billing contact</strong>
          <span class="pill pill--soft">Unsaved</span>
        </div>

        <div class="sheet">
          <div class="sheet__head">
            <strong>Add payment method</strong>
            <span class="pill pill--soft">Unsaved</span>
          </div>
          <div class="line line--edited" />
          <div class="line line--short" />
        </div>
      </div>
    </section>
  </div>

  <!-- Subject 3: what the user is actually asked. -->
  <dialog ref="ask" class="ask" @cancel.prevent="answer(false)">
    <h2>Discard unsaved changes?</h2>
    <p>Your edits to <b>Customer details</b> have not been saved.</p>
    <div class="ask__row">
      <button type="button" class="btn" @click="answer(false)">
        Keep editing
      </button>
      <button type="button" class="btn btn--danger" @click="answer(true)">
        Discard
      </button>
    </div>
  </dialog>
</template>

<style scoped>
.stage {
  display: flex;
  align-items: flex-start;
  gap: 4rem;
}

.panel {
  width: 27rem;
  display: grid;
  gap: 1.125rem;
  padding: 1.75rem;
  border-radius: 1.375rem;
  background: #fff;
  box-shadow:
    inset 0 0 0 1px rgb(20 40 55 / 6%),
    0 1px 2px rgb(20 40 55 / 4%);
}

.panel__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.panel__head h1 {
  font-size: 1.3125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.pill {
  margin-left: auto;
  padding: 0.1875rem 0.625rem;
  border-radius: 999px;
  background: #fff4d6;
  box-shadow: inset 0 0 0 1px rgb(180 120 20 / 20%);
  color: #8a5a08;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

/* Quieter the deeper it sits, so the eye reads the nesting as one marker
   propagating up rather than three competing badges. */
.pill--soft {
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  background: #fdf6e6;
  box-shadow: inset 0 0 0 1px rgb(180 120 20 / 14%);
  color: #a2762c;
}

.field {
  display: grid;
  gap: 0.375rem;
}

.field span {
  color: #6e6e73;
  font-size: 0.8125rem;
}

input,
textarea {
  width: 100%;
  padding: 0.5625rem 0.75rem;
  border: 0;
  border-radius: 0.625rem;
  background: #f6f7f9;
  box-shadow: inset 0 0 0 1px rgb(20 40 55 / 7%);
  color: #1d1d1f;
  font: inherit;
  font-size: 0.9375rem;
  resize: none;
}

/* The edited field, marked the way an app would mark it. */
textarea {
  background: #fffdf6;
  box-shadow: inset 0 0 0 1px rgb(180 120 20 / 28%);
}

.panel__foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.btn {
  padding: 0.5rem 0.9375rem;
  border: 0;
  border-radius: 999px;
  background: #f1f2f4;
  box-shadow: inset 0 0 0 1px rgb(20 40 55 / 6%);
  color: #1d1d1f;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn--primary {
  background: #111214;
  box-shadow: none;
  color: #fff;
}

.btn--danger {
  background: #e14b5a;
  box-shadow: none;
  color: #fff;
}

/* Nested hosts as nested sheets: the scope tree, drawn. */
.sheet {
  display: grid;
  gap: 0.625rem;
  padding: 0.875rem 1rem 1rem;
  border-radius: 0.875rem;
  background: #f6f7f9;
  box-shadow: inset 0 0 0 1px rgb(20 40 55 / 6%);
}

.sheet .sheet {
  background: #fff;
}

.sheet__head {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.875rem;
}

.sheet__head strong {
  font-weight: 590;
}

.sheet__head .pill {
  margin-left: auto;
}

/* Stand-ins for form rows: the tower is about depth, not about its fields. */
.line {
  height: 0.5rem;
  border-radius: 999px;
  background: #e9ebee;
}

.line--edited {
  background: #f6e3bd;
}

.line--short {
  width: 55%;
}

.ask {
  /* The reset zeroes every margin, which for a modal dialog also removes the
     `margin: auto` that centres it in the top layer — it would otherwise sit in
     the viewport's top-left corner and clip against two edges. */
  margin: auto;
  width: 25.5rem;
  padding: 1.625rem;
  border: 0;
  border-radius: 1.125rem;
  background: #fff;
  box-shadow:
    inset 0 0 0 1px rgb(20 40 55 / 6%),
    0 1px 2px rgb(20 40 55 / 4%);
  color: #1d1d1f;
}

.ask h2 {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.015em;
}

.ask p {
  margin-top: 0.4375rem;
  color: #6e6e73;
  font-size: 0.9375rem;
}

.ask b {
  color: #1d1d1f;
  font-weight: 590;
}

.ask__row {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.375rem;
}

/* Transparent in bare mode so the cut-out carries no grey wash of the stage. */
.ask::backdrop {
  background: rgb(20 40 55 / 22%);
}

:global(body.bare) .ask::backdrop {
  background: transparent;
}
</style>
