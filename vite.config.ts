import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
// Vitest 4 no longer augments Vite's own config type, so `test` needs this one.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue(),
    // Declaration maps are worth having locally, but only `dist` is published,
    // so shipped ones would point at sources the consumer never receives.
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.json',
      compilerOptions: { declarationMap: false },
    }),
  ],
  build: {
    // tsconfig's `sourceMap` never reaches the bundler; this is what emits .js.map.
    sourcemap: true,
    lib: {
      // Two entries, flat: `src/router.ts` rather than `src/router/index.ts`, so
      // the emitted declaration lands at `dist/router.d.ts` and the `./router`
      // export condition can name it without a directory hop.
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        router: fileURLToPath(new URL('./src/router.ts', import.meta.url)),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // vue-router is an optional peer: the core never imports it, and the
      // router entry must resolve to the consumer's copy, not a bundled one.
      external: ['vue', 'vue-router'],
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
            // A failing assertion is already legible from its message; the PNGs
            // only ever accumulated as untracked debris.
            screenshotFailures: false,
          },
        },
      },
    ],
  },
})
