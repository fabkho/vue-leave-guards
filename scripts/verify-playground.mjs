/**
 * Drives the *built* playground and checks that a guard actually fires.
 *
 * "Build green, page 200, console clean" is not evidence here. A leave guard
 * that reaches no scope no-ops silently — the page still renders, every button
 * still works, and the only symptom is that unsaved work disappears. So the
 * check has to be behavioural: make a field dirty, navigate, and assert the
 * navigation did not happen.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dist = fileURLToPath(new URL('../playground/dist', import.meta.url))

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
}

/* A Pages build is rooted at /<repo>/, so its asset URLs carry that prefix and
   serving dist at `/` would 404 every one of them. Mirror the deployed shape. */
const base = process.env.PAGES_BASE ?? '/'

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://x').pathname
  const path = normalize(pathname.startsWith(base) ? pathname.slice(base.length - 1) : pathname)
    .replace(/^(\.\.[/\\])+/, '')
  const file = join(dist, path === '/' ? 'index.html' : path)
  try {
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    response.end(body)
  }
  catch {
    response.writeHead(404).end('not found')
  }
})

await new Promise(resolve => server.listen(0, resolve))
const origin = `http://localhost:${server.address().port}`

const browser = await chromium.launch()
const page = await browser.newPage()

const problems = []
page.on('pageerror', error => problems.push(`page error: ${error.message}`))

try {
  await page.goto(`${origin}${base}#/`, { waitUntil: 'networkidle' })

  // The nested hosts have to exist before anything can be nested inside them.
  await page.getByRole('button', { name: 'Open drawer' }).click()
  await page.getByRole('button', { name: 'Open modal' }).click()

  const modalField = page.getByRole('textbox').nth(2)
  await modalField.fill('unsaved work')

  // Two scopes up from the field, the root has to know it is dirty.
  const badge = page.locator('header.bar .badge')
  if (!(await badge.textContent()).includes('dirty')) {
    problems.push('the root scope did not see a guard two scopes below it')
  }

  await page.getByRole('link', { name: 'Another page' }).click()

  const dialog = page.getByRole('dialog')
  if (!(await dialog.isVisible())) {
    problems.push('navigating away from a dirty nested form did not prompt')
  }
  else {
    await page.getByRole('button', { name: 'Stay' }).click()
    if (!page.url().endsWith('#/') && !page.url().endsWith(base)) {
      problems.push(`refusing the prompt did not stop the navigation (at ${page.url()})`)
    }
  }
}
finally {
  await browser.close()
  server.close()
}

if (problems.length > 0) {
  console.error('\nThe built playground does not guard anything:')
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}

console.log('playground verified — a nested guard reaches the root and blocks navigation')
