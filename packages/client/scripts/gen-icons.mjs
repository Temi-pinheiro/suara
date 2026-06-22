/**
 * Generates Suara's app assets from the brand glyph — no design files, no image deps.
 * The mark is the same ascending "voice" soundmark used on the entry screen (7 bars),
 * teal + white, so the icon, splash, and first screen all read as one brand.
 *
 *   node scripts/gen-icons.mjs   →  assets/{icon,adaptive-icon,splash-icon,favicon}.png
 *
 * Pure Node (zlib only): we draw RGBA pixels and hand-encode a PNG (capsule bars with
 * 1px anti-aliasing). Re-run any time the palette or mark changes.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');

// Brand palette (theme.ts): teal primary + warm-white.
const TEAL = [0x0f, 0x8e, 0x78];
const WHITE = [0xff, 0xff, 0xff];
const TRANSPARENT = null;

// Relative bar heights — a balanced rise-and-fall, peak in the middle.
const PATTERN = [0.34, 0.52, 0.74, 1.0, 0.78, 0.56, 0.4];

// --- tiny PNG encoder (RGBA / color type 6) -------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10,11,12 = compression / filter / interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- drawing --------------------------------------------------------------------

/** Distance from pixel (x,y) to a vertical segment x=cx, y in [ya,yb]. */
function distToVSeg(x, y, cx, ya, yb) {
  const cy = Math.min(Math.max(y, ya), yb);
  const dx = x - cx;
  const dy = y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Draw the soundmark, centered, onto a fresh RGBA buffer.
 * @param scale fraction of the canvas the mark's tallest bar occupies (0..1)
 */
function render({ size, bg, bar, scale }) {
  const rgba = Buffer.alloc(size * size * 4);
  // Background fill.
  if (bg) {
    for (let i = 0; i < size * size; i++) {
      rgba[i * 4] = bg[0];
      rgba[i * 4 + 1] = bg[1];
      rgba[i * 4 + 2] = bg[2];
      rgba[i * 4 + 3] = 255;
    }
  }

  const n = PATTERN.length;
  const maxH = size * scale;
  const barW = (size * scale) / 6.0; // proportional stroke weight
  const gap = barW * 0.62;
  const r = barW / 2;
  const totalW = n * barW + (n - 1) * gap;
  const startX = (size - totalW) / 2;
  const midY = size / 2;

  // Per-bar capsule segments (centered vertically on midY).
  const segs = PATTERN.map((p, i) => {
    const h = Math.max(p * maxH, barW); // never shorter than a dot
    const cx = startX + barW / 2 + i * (barW + gap);
    return { cx, ya: midY - h / 2 + r, yb: midY + h / 2 - r };
  });

  const x0 = Math.floor(startX - r - 1);
  const x1 = Math.ceil(startX + totalW + r + 1);
  for (let y = 0; y < size; y++) {
    for (let x = Math.max(0, x0); x < Math.min(size, x1); x++) {
      let cover = 0;
      for (const s of segs) {
        if (Math.abs(x - s.cx) > r + 1.5) continue;
        const d = distToVSeg(x + 0.5, y + 0.5, s.cx, s.ya, s.yb);
        cover = Math.max(cover, Math.min(Math.max(r - d + 0.5, 0), 1));
        if (cover >= 1) break;
      }
      if (cover <= 0) continue;
      const idx = (y * size + x) * 4;
      // Composite bar color over whatever is there (bg or transparent).
      const a = cover;
      const ba = rgba[idx + 3] / 255;
      const outA = a + ba * (1 - a);
      for (let k = 0; k < 3; k++) {
        const src = bar[k];
        const dst = rgba[idx + k];
        rgba[idx + k] = outA === 0 ? 0 : Math.round((src * a + dst * ba * (1 - a)) / outA);
      }
      rgba[idx + 3] = Math.round(outA * 255);
    }
  }
  return rgba;
}

function emit(name, size, opts) {
  const rgba = render({ size, ...opts });
  const out = join(ASSETS, name);
  writeFileSync(out, encodePng(size, size, rgba));
  console.log(`  ${name}  ${size}×${size}`);
}

mkdirSync(ASSETS, { recursive: true });
console.log('Generating Suara assets →', ASSETS);
emit('icon.png', 1024, { bg: TEAL, bar: WHITE, scale: 0.5 }); // iOS/store icon
emit('adaptive-icon.png', 1024, { bg: TRANSPARENT, bar: WHITE, scale: 0.34 }); // Android fg (safe zone)
emit('splash-icon.png', 1024, { bg: TRANSPARENT, bar: WHITE, scale: 0.3 }); // on teal splash bg
emit('favicon.png', 196, { bg: TEAL, bar: WHITE, scale: 0.5 }); // web
console.log('Done.');
