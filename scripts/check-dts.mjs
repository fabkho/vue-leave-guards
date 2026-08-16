/**
 * Guards the emitted declarations against the one packaging bug this project
 * cannot see from the inside.
 *
 * Under `moduleResolution: node16`/`nodenext` a relative specifier must carry an
 * explicit extension. Get it wrong and a consumer on those settings resolves
 * nothing — but only if they also set `skipLibCheck: false`, which almost nobody
 * does. With it on, the errors disappear and every export silently becomes
 * `any`. Our own `vue-tsc` runs on the sources under `bundler` resolution, so it
 * stays green throughout.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist', import.meta.url))

/** Every path named by an `exports` condition has to actually be emitted. */
const REQUIRED = ['index.js', 'index.d.ts', 'router.js', 'router.d.ts']

const missing = REQUIRED.filter(name => !existsSync(`${dist}/${name}`))
if (missing.length > 0) {
  console.error(`check-dts: dist/ is missing ${missing.join(', ')} — run \`pnpm build\` first.`)
  process.exit(1)
}

const RELATIVE = /\bfrom\s+'(\.\.?\/[^']+)'/g
const problems = []

for (const name of readdirSync(dist).filter(file => file.endsWith('.d.ts'))) {
  const content = readFileSync(`${dist}/${name}`, 'utf8')
  for (const [, specifier] of content.matchAll(RELATIVE)) {
    if (!/\.[cm]?js$/.test(specifier)) {
      problems.push(`${name}: '${specifier}' — needs an explicit .js extension`)
    }
  }
}

if (problems.length > 0) {
  console.error(`check-dts: ${problems.length} unresolvable specifier(s):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

console.log('check-dts: both entries emitted, all specifiers resolvable.')
