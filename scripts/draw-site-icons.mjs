// Draws the browser-tab and home-screen icons from the game's own Poke Ball
// icon (public/assets/icons/poke-ball.png), so the tab shows the thing a raid
// is for rather than a blank square.
//
//   node scripts/draw-site-icons.mjs
//
// The icon is 16x16 pixel art, and a browser smooths a small PNG it scales up,
// so each size is drawn at a whole multiple, one square per source pixel:
//
// - public/favicon.svg       - one <rect> per pixel, crisp at any tab size;
// - public/favicon-32.png    - 2x, for a browser that does not take an SVG icon;
// - public/apple-touch-icon.png - 11x on a 180x180 cream square, the size iOS
//   asks for when a page is added to a home screen (it would paint any
//   transparency black).
//
// The output is byte-stable: run it again and nothing changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const SOURCE = new URL('../public/assets/icons/poke-ball.png', import.meta.url);
const OUT = new URL('../public/', import.meta.url);
/** The title screen's cream, behind the home-screen icon. */
const TOUCH_BACKGROUND = [0xf8, 0xf5, 0xd7, 255];

/** An 8-bit RGBA, non-interlaced PNG, as every icon in the set is. */
function readRgbaPng(path) {
  const file = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error(`${path} is not 8-bit RGBA, non-interlaced`);
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const data = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? data[y * stride + x - 4] : 0;
      const b = y > 0 ? data[(y - 1) * stride + x] : 0;
      const c = y > 0 && x >= 4 ? data[(y - 1) * stride + x - 4] : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`${path}: unknown PNG filter ${filter}`);
      data[y * stride + x] = (value + predicted) & 0xff;
    }
  }
  return { width, height, data };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, body) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
};

function writeRgbaPng(path, { width, height, data }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

/** The source scaled by a whole number, centred on a square of `size`. */
function scaled(source, scale, size, background = [0, 0, 0, 0]) {
  const data = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) data.set(background, i * 4);
  const inset = Math.floor((size - source.width * scale) / 2);
  for (let y = 0; y < source.height * scale; y += 1) {
    for (let x = 0; x < source.width * scale; x += 1) {
      const from = (Math.floor(y / scale) * source.width + Math.floor(x / scale)) * 4;
      if (source.data[from + 3] === 0) continue;
      data.set(source.data.subarray(from, from + 4), ((y + inset) * size + x + inset) * 4);
    }
  }
  return { width: size, height: size, data };
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

function svg(source) {
  const rects = [];
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const at = (y * source.width + x) * 4;
      const [r, g, b, a] = source.data.subarray(at, at + 4);
      if (a === 0) continue;
      const opacity = a === 255 ? '' : ` fill-opacity="${(a / 255).toFixed(3)}"`;
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${hex(r, g, b)}"${opacity}/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${source.width} ${source.height}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`;
}

const ball = readRgbaPng(SOURCE);
writeFileSync(new URL('favicon.svg', OUT), svg(ball));
writeRgbaPng(new URL('favicon-32.png', OUT), scaled(ball, 2, 32));
writeRgbaPng(new URL('apple-touch-icon.png', OUT), scaled(ball, 11, 180, TOUCH_BACKGROUND));
console.log('favicon.svg, favicon-32.png, apple-touch-icon.png written to public/');
