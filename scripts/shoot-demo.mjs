/**
 * Shoots the readme stills from playground/demo.html, then composes the hero
 * candidates.
 *
 *   pnpm dev                # in one shell
 *   pnpm demo:shoot         # in another
 *
 * Stills rather than a recording, deliberately. `page.screenshot()` honours
 * deviceScaleFactor — unlike CDP's screencast, whose frames are always CSS
 * pixels — so these come out at 2x and lossless.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const URL = process.env.DEMO_URL ?? 'http://localhost:5173/demo.html'
const OUT_DIR = join('docs', 'shots')

/** 2x, so a shot is crisp on a retina display and can be shown at half size. */
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
 * Composed in HTML rather than with an image tool, so the presentation has real
 * shadows, a real gradient and real type. The stills are inlined as data URLs,
 * so this needs no server and no temporary files.
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
 * Five candidates on one ground and one plate, differing in which subjects they
 * lead with and how they are arranged. Every subject in a given hero is drawn at
 * a single scale.
 */
const HEROES = [
  {
    // 1 — the pair, closest in shape to the colour picker's hero.
    name: 'hero-1-form-and-dialog',
    scale: 0.46,
    body: s => `<div class="stage">
      <img src="${inline('01-form')}" ${at('01-form', s)}>
      <img src="${inline('03-dialog')}" ${at('03-dialog', s)}>
    </div>`,
  },
  {
    // 2 — the mechanic: depth on the left, the one question it produces.
    name: 'hero-2-tower-and-dialog',
    scale: 0.46,
    body: s => `<div class="stage">
      <img src="${inline('02-tower')}" ${at('02-tower', s)}>
      <img src="${inline('03-dialog')}" ${at('03-dialog', s)}>
    </div>`,
  },
  {
    // 3 — the dialog overlapping the form it belongs to, rather than beside it.
    name: 'hero-3-overlap',
    scale: 0.52,
    css: `
      .stage { display: block; position: relative; }
      /* Low and to the right, so it reads as arriving over the form without
         burying the buttons it is asking about. */
      .stage img.over {
        position: absolute; right: -118px; bottom: -112px;
        filter:
          drop-shadow(0 3px 6px rgb(0 0 0 / 10%))
          drop-shadow(0 22px 44px rgb(0 0 0 / 18%))
          drop-shadow(0 60px 100px rgb(0 0 0 / 14%));
      }`,
    body: s => `<div class="stage">
      <img src="${inline('01-form')}" ${at('01-form', s)}>
      <img class="over" src="${inline('03-dialog')}" ${at('03-dialog', s)}>
    </div>`,
  },
  {
    // 4 — all three, the whole story in one row.
    name: 'hero-4-three-up',
    scale: 0.38,
    css: `.stage { gap: 52px; }`,
    body: s => `<div class="stage">
      <img src="${inline('01-form')}" ${at('01-form', s)}>
      <img src="${inline('02-tower')}" ${at('02-tower', s)}>
      <img src="${inline('03-dialog')}" ${at('03-dialog', s)}>
    </div>`,
  },
  {
    // 5 — the tower alone and large, no plate: the single idea, uncrowded.
    name: 'hero-5-tower-solo',
    scale: 0.92,
    css: `.plate { background: none; backdrop-filter: none; box-shadow: none; padding: 0; }`,
    body: s => `<div class="stage">
      <img src="${inline('02-tower')}" ${at('02-tower', s)}>
    </div>`,
  },
]

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
