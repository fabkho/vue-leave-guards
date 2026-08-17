import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  /* A project page is served from /<repo>/, not the domain root, so every asset
     URL needs the prefix. Absolute paths would 404 on Pages and work locally,
     which is the worst way round to find out. */
  base: process.env.PAGES_BASE ?? '/',
  plugins: [vue()],
  resolve: {
    alias: {
      // Point at source, not dist: the playground is the development surface and
      // must reflect edits without a rebuild.
      'vue-leave-guards/router': fileURLToPath(new URL('../src/router.ts', import.meta.url)),
      'vue-leave-guards': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      /* Vite discovers index.html on its own; demo.html is the staging page the
         readme stills are shot from and has to be named to be built. */
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        demo: fileURLToPath(new URL('./demo.html', import.meta.url)),
      },
    },
  },
})
