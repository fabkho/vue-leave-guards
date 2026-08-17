import { createApp } from 'vue'
import { createLeaveGuards } from 'vue-leave-guards/router'
import Demo from './Demo.vue'
import './demo.css'

/**
 * The staging page the readme stills are shot from. Separate from index.html so
 * shots can be retaken without scrolling past every teaching case, and so the
 * subjects can be dressed as a plausible product rather than a demo.
 *
 * No router: the leave here is a host closing itself, which is the shape that
 * photographs. The plugin still owns the one `beforeunload`.
 */
// `?bare` drops the stage background, so `omitBackground` yields a cut-out
// carrying only the subject and its own shadow.
if (new URLSearchParams(location.search).has('bare')) {
  document.body.classList.add('bare')
}

createApp(Demo)
  .use(createLeaveGuards())
  .mount('#app')
