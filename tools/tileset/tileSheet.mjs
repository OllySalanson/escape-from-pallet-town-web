/**
 * Reading a tile sheet, without a dependency.
 *
 * A tile sheet is one image and stays one image - chopping it into files
 * destroys the grid relationship the whole catalogue is addressed by. This
 * module is the smallest thing that can decode a PNG into tiles so the
 * catalogue tools can hash, group and draw them.
 */
import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const TILE_SIZE = 16;

/** Decodes a non-interlaced 8-bit PNG into straight RGBA bytes. */
export function readPng(path) {
  const file = readFileSync(path);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let colourType = 6;
  let palette = null;
  let alphaPalette = null;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8) throw new Error(`unsupported bit depth ${body[8]}`);
      colourType = body[9];
      if (body[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (type === 'PLTE') {
      palette = Buffer.from(body);
    } else if (type === 'tRNS') {
      alphaPalette = Buffer.from(body);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colourType];
  if (channels === undefined) throw new Error(`unsupported colour type ${colourType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const lines = Buffer.alloc(height * stride);

  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source];
    source += 1;
    const line = lines.subarray(y * stride, (y + 1) * stride);
    const previous = y === 0 ? null : lines.subarray((y - 1) * stride, y * stride);
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source + x];
      const a = x >= channels ? line[x - channels] : 0;
      const b = previous ? previous[x] : 0;
      const c = previous && x >= channels ? previous[x - channels] : 0;
      switch (filter) {
        case 0: line[x] = value; break;
        case 1: line[x] = (value + a) & 0xff; break;
        case 2: line[x] = (value + b) & 0xff; break;
        case 3: line[x] = (value + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          line[x] = (value + pred) & 0xff;
          break;
        }
        default: throw new Error(`unknown PNG filter ${filter}`);
      }
    }
    source += stride;
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const s = i * channels;
    const d = i * 4;
    if (colourType === 6) {
      rgba[d] = lines[s]; rgba[d + 1] = lines[s + 1]; rgba[d + 2] = lines[s + 2]; rgba[d + 3] = lines[s + 3];
    } else if (colourType === 2) {
      rgba[d] = lines[s]; rgba[d + 1] = lines[s + 1]; rgba[d + 2] = lines[s + 2]; rgba[d + 3] = 255;
    } else if (colourType === 3) {
      const index = lines[s];
      rgba[d] = palette[index * 3]; rgba[d + 1] = palette[index * 3 + 1]; rgba[d + 2] = palette[index * 3 + 2];
      rgba[d + 3] = alphaPalette && index < alphaPalette.length ? alphaPalette[index] : 255;
    } else if (colourType === 0) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = lines[s]; rgba[d + 3] = 255;
    } else {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = lines[s]; rgba[d + 3] = lines[s + 1];
    }
  }
  return { width, height, data: rgba };
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
}

export function writePng(path, image) {
  const stride = image.width * 4;
  const raw = Buffer.alloc(image.height * (stride + 1));
  for (let y = 0; y < image.height; y += 1) {
    raw[y * (stride + 1)] = 0;
    image.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

/** One tile's pixels, as RGBA, row major. */
export function tileBytes(sheet, index) {
  const columns = sheet.width / TILE_SIZE;
  const tx = (index % columns) * TILE_SIZE;
  const ty = Math.floor(index / columns) * TILE_SIZE;
  const out = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4);
  for (let y = 0; y < TILE_SIZE; y += 1) {
    const from = ((ty + y) * sheet.width + tx) * 4;
    sheet.data.copy(out, y * TILE_SIZE * 4, from, from + TILE_SIZE * 4);
  }
  return out;
}

/** Fully transparent pixels differ only in colour nobody sees, so flatten them. */
export function tileHash(bytes) {
  const normal = Buffer.from(bytes);
  for (let i = 0; i < normal.length; i += 4) {
    if (normal[i + 3] === 0) { normal[i] = 0; normal[i + 1] = 0; normal[i + 2] = 0; }
  }
  return createHash('sha1').update(normal).digest('hex');
}

export function tileCount(sheet) {
  return (sheet.width / TILE_SIZE) * (sheet.height / TILE_SIZE);
}
