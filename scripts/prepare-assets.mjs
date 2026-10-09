// Usage: npm run assets
// Builds shipped art from design/reference/ (reference files are never shipped):
//   public/mascot/tsupher-<state>.webp  sliced from Appearances.png (DRAFT cut-outs)
//   public/mascot/tsupher-hero.webp     from Para_.png (already transparent)
//   public/icons/*.png                  from Logo.png
// Sprite cut-outs are automatic: the sheet's beige background is flood-filled
// away from the crop edges. Replace with clean exports when available.
import { mkdirSync, statSync } from 'node:fs'
import sharp from 'sharp'

const REF = 'design/reference'
mkdirSync('public/mascot', { recursive: true })
mkdirSync('public/icons', { recursive: true })

// Crop boxes on the 1254 x 1254 sheet: [left, top, width, height].
// State names follow BUILD_PHASES.md section 2.6.
const SPRITES = {
  happy: [14, 50, 176, 212], // Front (Happy)
  thinking: [345, 812, 150, 168],
  map: [840, 808, 190, 174], // Reading a Map
  'thumbs-up': [176, 812, 164, 168],
  confused: [950, 574, 150, 180],
  sad: [654, 588, 150, 166],
  sign: [20, 812, 150, 168], // Holding a Sign
  driving: [8, 336, 200, 190],
  luggage: [1044, 800, 200, 184], // With Luggage
  jumping: [420, 300, 212, 226],
  love: [1094, 588, 150, 166],
  excited: [172, 588, 160, 166],
}

const BG_TOLERANCE = 30
const SHADOW_MIN_LIGHT = 168
const SCALE = 2 // upscale the small sheet sprites so they hold up on 2x screens

async function sliceSprite(sheet, state, [left, top, width, height]) {
  const { data } = await sheet
    .clone()
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Background colour: median of the crop's top edge.
  const edge = []
  for (let x = 0; x < width; x++) edge.push([data[x * 3], data[x * 3 + 1], data[x * 3 + 2]])
  const median = (c) => edge.map((p) => p[c]).sort((a, b) => a - b)[edge.length >> 1]
  const bg = [median(0), median(1), median(2)]
  const dist = (i) =>
    Math.hypot(data[i * 3] - bg[0], data[i * 3 + 1] - bg[1], data[i * 3 + 2] - bg[2])

  // Flood fill from the crop border through background-like pixels.
  const outside = new Uint8Array(width * height)
  const stack = []
  // The soft ground shadow is a darker, still colourless beige: also background.
  const isShadow = (i) => {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]
    return Math.max(r, g, b) - Math.min(r, g, b) < 26 && (r + g + b) / 3 > SHADOW_MIN_LIGHT
  }
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = y * width + x
    if (outside[i] || (dist(i) > BG_TOLERANCE && !isShadow(i))) return
    outside[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < width; x++) (visit(x, 0), visit(x, height - 1))
  for (let y = 0; y < height; y++) (visit(0, y), visit(width - 1, y))
  while (stack.length > 0) {
    const i = stack.pop()
    const x = i % width
    const y = (i - x) / width
    visit(x + 1, y), visit(x - 1, y), visit(x, y + 1), visit(x, y - 1)
  }

  // Keep only the largest opaque blob plus anything near it (drops label text).
  const label = new Int32Array(width * height)
  const sizes = [0]
  for (let start = 0; start < width * height; start++) {
    if (outside[start] || label[start]) continue
    const id = sizes.length
    let size = 0
    const queue = [start]
    label[start] = id
    while (queue.length > 0) {
      const i = queue.pop()
      size++
      const x = i % width
      const y = (i - x) / width
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const n = ny * width + nx
        if (outside[n] || label[n]) continue
        label[n] = id
        queue.push(n)
      }
    }
    sizes.push(size)
  }
  const main = sizes.indexOf(Math.max(...sizes))
  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let i = 0; i < width * height; i++) {
    if (label[i] !== main) continue
    const x = i % width
    const y = (i - x) / width
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  // Small detached parts (question mark, motion lines) are kept only inside the main bounds.
  const keep = (i) => {
    if (label[i] === main) return true
    if (!label[i] || sizes[label[i]] < 12) return false
    const x = i % width
    const y = (i - x) / width
    return y <= maxY - 6 && y >= minY - 30 && x >= minX - 30 && x <= maxX + 30
  }

  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = data[i * 3]
    rgba[i * 4 + 1] = data[i * 3 + 1]
    rgba[i * 4 + 2] = data[i * 3 + 2]
    rgba[i * 4 + 3] = keep(i) ? 255 : 0
  }

  const file = `public/mascot/tsupher-${state}.webp`
  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim()
    .resize({ width: Math.round(width * SCALE), height: Math.round(height * SCALE), fit: 'inside', kernel: 'lanczos3' })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(file)
  return file
}

const outputs = []
const sheet = sharp(`${REF}/Appearances.png`)
for (const [state, box] of Object.entries(SPRITES)) outputs.push(await sliceSprite(sheet, state, box))

// Hero: Para_.png already has a transparent background.
await sharp(`${REF}/Para_.png`)
  .trim()
  .resize({ width: 720, height: 720, fit: 'inside' })
  .webp({ quality: 80, alphaQuality: 90 })
  .toFile('public/mascot/tsupher-hero.webp')
outputs.push('public/mascot/tsupher-hero.webp')

// Icons: Logo.png is a full-bleed tile, so the same art serves "any" and "maskable".
// The mascot is cropped at the corner by design; a maskable mask crops it further.
for (const [name, size] of [['pwa-192', 192], ['pwa-512', 512], ['maskable-512', 512], ['apple-touch-icon', 180], ['favicon-64', 64]]) {
  const file = `public/icons/${name}.png`
  await sharp(`${REF}/Logo.png`).resize(size, size).png({ compressionLevel: 9, palette: true }).toFile(file)
  outputs.push(file)
}

let mascotBytes = 0
for (const file of outputs) {
  const { size } = statSync(file)
  if (file.includes('/mascot/')) mascotBytes += size
  console.log(`${String(Math.round(size / 1024)).padStart(4)} KB  ${file}`)
}
console.log(`mascot total ${(mascotBytes / 1024).toFixed(0)} KB (budget 1024 KB)`)
