import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createLeaveGuards } from 'vue-leave-guards/router'
import App from './App.vue'
import Home from './pages/Home.vue'
import Other from './pages/Other.vue'
import { rootScopeKey } from './rootScope'
import './style.css'

// Hash history: GitHub Pages serves static files, so a deep link under history
// mode would 404 before Vue ever loaded.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/other', component: Other },
  ],
})

const guards = createLeaveGuards({ router })

createApp(App)
  .use(router)
  .use(guards)
  .provide(rootScopeKey, guards.scope)
  .mount('#app')
