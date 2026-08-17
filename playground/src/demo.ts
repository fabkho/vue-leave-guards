import { createApp } from 'vue'
import { createLeaveGuards } from 'vue-leave-guards/router'
import Demo from './Demo.vue'
import './demo.css'

/**
 * The staging page the readme stills are shot from, dressed as a product rather
 * than a demo. No router: the leave here is a host closing itself, which is the
 * shape that photographs.
 */
// `?bare` drops the stage background, so `omitBackground` yields a cut-out.
if (new URLSearchParams(location.search).has('bare')) {
  document.body.classList.add('bare')
}

createApp(Demo)
  .use(createLeaveGuards())
  .mount('#app')
