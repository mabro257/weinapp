// Rastert das App-Icon (Weinglas auf Beerenfläche) als PNG, ohne externe Abhängigkeiten.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x7a, 0x1f, 0x3d], WHITE = [255, 255, 255], ROSE = [0xf1, 0xdc, 0xe3]

function crc32(buf) {
  let c, crc = ~0
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c }
  return ~crc >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

// Farbe an Punkt (x, y) in 512er-Koordinaten; fullBleed = ohne runde Ecken (maskable/Apple)
function color(x, y, fullBleed) {
  const r = 112
  if (!fullBleed) {
    const cx = Math.min(Math.max(x, r), 512 - r), cy = Math.min(Math.max(y, r), 512 - r)
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return null
  }
  // Kelch: halbe Ellipse unten, oben gerade
  const inBowl = y >= 112 && y <= 288 && (() => {
    const half = y < 200 ? 80 : 80 * Math.sqrt(Math.max(0, 1 - ((y - 200) / 88) ** 2))
    return Math.abs(x - 256) <= half
  })()
  if (inBowl) return y >= 200 ? ROSE : WHITE
  if (y > 284 && y <= 380 && Math.abs(x - 256) <= 12) return WHITE
  if (y >= 372 && y <= 400 && Math.abs(x - 256) <= 72) return WHITE
  return BG
}

function png(size, fullBleed) {
  const ss = 3, raw = Buffer.alloc(size * (size * 4 + 1))
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0
    for (let px = 0; px < size; px++) {
      let rr = 0, gg = 0, bb = 0, aa = 0
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = color(((px + (sx + 0.5) / ss) / size) * 512, ((py + (sy + 0.5) / ss) / size) * 512, fullBleed)
        if (c) { rr += c[0]; gg += c[1]; bb += c[2]; aa += 255 }
      }
      const n = ss * ss, o = py * (size * 4 + 1) + 1 + px * 4, cov = aa / 255 || 1
      raw[o] = rr / cov; raw[o + 1] = gg / cov; raw[o + 2] = bb / cov; raw[o + 3] = aa / n
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const out = process.argv[2]
writeFileSync(`${out}/icon-192.png`, png(192, true))
writeFileSync(`${out}/icon-512.png`, png(512, true))
writeFileSync(`${out}/apple-touch-icon.png`, png(180, true))
console.log('ok')
