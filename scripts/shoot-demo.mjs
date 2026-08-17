/**
 * Shoots the readme stills from playground/demo.html, then composes the hero.
 *
 *   pnpm dev                # in one shell
 *   pnpm demo:shoot         # in another
 *
 * Stills, not a recording: `page.screenshot()` honours deviceScaleFactor, which
 * CDP's screencast does not — its frames are always CSS pixels.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const URL = process.env.DEMO_URL ?? 'http://localhost:5173/demo.html'
const OUT_DIR = join('docs', 'shots')

/** 2x, so a shot stays crisp shown at half size. */
const DPR = 2
const VIEWPORT = { width: 1600, height: 1000 }
const PAD = 44

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch()

const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: DPR,
  colorScheme: 'light',
  reducedMotion: 'reduce',
})
const page = await context.newPage()
await page.goto(`${URL}?bare`, { waitUntil: 'networkidle' })
await pause(400)

async function boxOf(targets) {
  const boxes = (await Promise.all(
    targets.map(async (selector) => {
      const locator = page.locator(selector).first()
      return await locator.count() ? locator.boundingBox() : null
    }),
  )).filter(Boolean)
  const left = Math.min(...boxes.map(box => box.x))
  const right = Math.max(...boxes.map(box => box.x + box.width))
  const top = Math.min(...boxes.map(box => box.y))
  const bottom = Math.max(...boxes.map(box => box.y + box.height))
  return { left, right, top, bottom }
}

/** Clipped to the union of what matters plus a margin, so a shadow survives. */
async function shoot(name, targets, pad = PAD) {
  const box = await boxOf(targets)
  await page.screenshot({
    path: join(OUT_DIR, `${name}.png`),
    /* Transparent, so a shot carries only the subject and its shadow — no grey
       rectangle to sit awkwardly inside the hero. */
    omitBackground: true,
    clip: {
      x: Math.max(0, box.left - pad),
      y: Math.max(0, box.top - pad),
      width: Math.min(VIEWPORT.width, box.right - box.left + pad * 2),
      height: Math.min(VIEWPORT.height, box.bottom - box.top + pad * 2),
    },
  })
  return name
}

/**
 * Hides everything but the subject. `visibility`, not `display`: the dialog is
 * in the top layer but the panels are its siblings, and a descendant can only
 * opt back out of `visibility`.
 */
async function isolate(only) {
  await page.evaluate((keep) => {
    for (const element of document.querySelectorAll('.stage, .panel, .ask')) {
      if (element instanceof HTMLElement) {
        element.style.visibility = keep === null || element.matches(keep) ? '' : 'hidden'
      }
    }
  }, only)
  await pause(150)
}

const written = []

// ─── Stills ───

written.push(await shoot('01-form', ['.panel']))
written.push(await shoot('02-tower', ['.tower']))

// The dialog, opened by the real guard rather than posed.
await page.locator('.panel .btn', { hasText: 'Cancel' }).first().click()
await page.waitForSelector('dialog[open]')
await pause(350)

/* The backdrop is a viewport-filling layer, so it fills the cut-out with a grey
   wash that `omitBackground` cannot see past. Killed here rather than in the
   component: it is a property of the shoot, not of the page. */
await page.addStyleTag({ content: '::backdrop { background: transparent !important; }' })
await isolate('.ask')
written.push(await shoot('03-dialog', ['.ask'], 36))
await isolate(null)

console.log(`stills: ${written.join(', ')}`)

// ─── Heroes ───

/**
 * Composed in HTML, not an image tool: real shadows, real gradient, real type.
 * Stills go in as data URLs, so this needs no server and no temp files.
 */
const inline = name =>
  `data:image/png;base64,${readFileSync(join(OUT_DIR, `${name}.png`)).toString('base64')}`

/* Straight out of the IHDR chunk. Every subject has to be drawn at one scale,
   or the same card appears at two sizes in one picture. */
function pngSize(name) {
  const header = readFileSync(join(OUT_DIR, `${name}.png`)).subarray(16, 24)
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) }
}

const at = (name, scale) => `width="${Math.round(pngSize(name).width * scale)}"`

const GRADIENT = `data:image/png;base64,${readFileSync(join('docs', 'assets', 'gradient.png')).toString('base64')}`

const CHROME = `
  * { box-sizing: border-box; margin: 0; }
  body {
    display: grid; place-items: center;
    font: 400 15px/1.4 -apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif;
    color: #1d1d1f;
    overflow: hidden;
  }
  /* The ground goes on its own layer so it can be positioned and flipped
     independently of the composition sitting on it. */
  .ground {
    position: fixed; inset: 0; z-index: -1;
    background-image: url("${GRADIENT}");
    /* The whole gradient, not a crop: \`cover\` cuts most of the artwork away.
       A soft gradient has no hard edges to distort. Flipped, so the light falls
       from above and the dark settles under the composition. */
    background-size: 100% 100%;
    transform: rotate(180deg);
  }
  img {
    display: block;
    filter:
      drop-shadow(0 2px 4px rgb(0 0 0 / 8%))
      drop-shadow(0 16px 34px rgb(0 0 0 / 14%))
      drop-shadow(0 46px 80px rgb(0 0 0 / 12%));
  }
  .plate {
    padding: 62px 84px;
    border-radius: 34px;
    background: rgb(255 255 255 / 18%);
    backdrop-filter: blur(44px) saturate(140%);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 38%),
      0 30px 70px rgb(0 0 0 / 10%);
  }
  /* Centred, not top-aligned: these subjects differ a lot in height, and
     flush tops leave the plate with a void under the shorter one. */
  .stage { display: flex; align-items: center; gap: 72px; }
  figcaption { font-size: 15px; letter-spacing: -0.01em; color: #6e6e73; text-align: center; }
  figcaption b { display: block; font-weight: 590; color: #1d1d1f; letter-spacing: -0.015em; }
`

const SIZE = { width: 1600, height: 900 }

/**
 * The hero: depth on the left, the one question it produces on the right —
 * which is the whole proposition in a picture. Both subjects are drawn at a
 * single scale, or the same card would appear at two sizes in one image.
 */
const HEROES = [{
  name: 'hero',
  scale: 0.46,
  body: s => `<div class="stage">
    <img src="${inline('02-tower')}" ${at('02-tower', s)}>
    <img src="${inline('03-dialog')}" ${at('03-dialog', s)}>
  </div>`,
}]

for (const hero of HEROES) {
  const heroContext = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: DPR,
    colorScheme: 'light',
  })
  const heroPage = await heroContext.newPage()
  await heroPage.setContent(
    `<!doctype html><meta charset="utf-8"><style>${CHROME}
     body { width: ${SIZE.width}px; height: ${SIZE.height}px; }
     ${hero.css ?? ''}</style>
     <div class="ground"></div><div class="plate">${hero.body(hero.scale)}</div>`,
    { waitUntil: 'load' },
  )
  await pause(300)
  await heroPage.screenshot({ path: join('docs', `${hero.name}.png`) })
  await heroContext.close()
  written.push(hero.name)
}

await context.close()
await browser.close()

console.log(`wrote ${written.length} images to ${OUT_DIR} and docs/`)
