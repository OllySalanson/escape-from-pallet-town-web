/**
 * A festival-style site plan of a map, as one web page you can zoom from the
 * whole world down to a single tile: a lettered grid, every place outlined and
 * named, and every building, door, exit and feature named on hover.
 *
 *   npm run site-plan                                  # Greystone Vale, to out/site-plan
 *   npm run site-plan -- <map-id> --out=<folder>
 *
 * The picture is the map exactly as the game draws it (`tileset/mapPicture.mts`,
 * the same layers from the same builder), cut into a pyramid of 256-pixel
 * images so the page loads only what is on screen. What the plan says is
 * `planData.ts`, read off the same map. The folder it writes is the whole
 * thing: `index.html` and `tiles/`, opened straight from disk.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { lowerOwnPriority } from '../lowPriority.mjs';
import { drawWorldMap } from '../tileset/mapPicture.mts';
import { TILE_SIZE } from '../tileset/tileSheet.mjs';
import { buildPlanData, ANNEX_GAP } from './planData';
import { assemblePage } from './page';
import type { WorldMapId } from '../../src/game/worldMap';

lowerOwnPriority();

/** Pixels across one image of the pyramid. */
const PIECE = 256;

const args = process.argv.slice(2);
const mapId = (args.find((value) => !value.startsWith('--')) ?? 'greystone-vale') as WorldMapId;
const outFlag = args.find((value) => value.startsWith('--out='));
const out = resolve(outFlag ? outFlag.slice(6) : 'out/site-plan');

interface Picture {
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}

const started = Date.now();
const plan = buildPlanData(mapId);

// The whole plan at one game pixel a pixel, clear where there is only paper.
const picture: Picture = {
  width: plan.width * TILE_SIZE,
  height: plan.height * TILE_SIZE,
  data: Buffer.alloc(plan.width * TILE_SIZE * plan.height * TILE_SIZE * 4),
};
function paste(source: Picture, tileX: number, tileY: number) {
  const left = tileX * TILE_SIZE;
  const top = tileY * TILE_SIZE;
  for (let y = 0; y < source.height; y += 1) {
    const from = y * source.width * 4;
    source.data.copy(
      picture.data,
      ((top + y) * picture.width + left) * 4,
      from,
      from + source.width * 4,
    );
  }
}
paste(drawWorldMap(mapId, [0, 0, plan.outdoors.w, plan.outdoors.h]), 0, 0);
for (const room of plan.features.filter((feature) => feature.kind === 'room')) {
  const { x, y, w, h } = room.rects[0];
  // The plan moved the rooms east of where the game lays them; draw each from where it really is.
  paste(drawWorldMap(mapId, [x - ANNEX_GAP, y, w, h]), x, y);
}

function crc32(bytes: Buffer): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
}
/** A piece as a PNG: RGB where it is all map, RGBA where paper shows through. */
function png(source: Picture, left: number, top: number): Buffer | null {
  const width = Math.min(PIECE, source.width - left);
  const height = Math.min(PIECE, source.height - top);
  let any = false;
  let clear = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (source.data[((top + y) * source.width + left + x) * 4 + 3]) any = true;
      else clear = true;
    }
  }
  if (!any) return null;
  const channels = clear ? 4 : 3;
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = ((top + y) * source.width + left + x) * 4;
      const j = y * (stride + 1) + 1 + x * channels;
      raw[j] = source.data[i];
      raw[j + 1] = source.data[i + 1];
      raw[j + 2] = source.data[i + 2];
      if (channels === 4) raw[j + 3] = source.data[i + 3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
/** Half the size, each pixel the average of the four under it, weighted by how much of each is map. */
function halve(source: Picture): Picture {
  const width = Math.ceil(source.width / 2);
  const height = Math.ceil(source.height / 2);
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const sx = 2 * x + dx;
          const sy = 2 * y + dy;
          if (sx >= source.width || sy >= source.height) continue;
          const i = (sy * source.width + sx) * 4;
          const weight = source.data[i + 3];
          r += source.data[i] * weight;
          g += source.data[i + 1] * weight;
          b += source.data[i + 2] * weight;
          a += weight;
        }
      }
      const j = (y * width + x) * 4;
      if (a > 0) {
        data[j] = Math.round(r / a);
        data[j + 1] = Math.round(g / a);
        data[j + 2] = Math.round(b / a);
        data[j + 3] = Math.round(a / 4);
      }
    }
  }
  return { width, height, data };
}

rmSync(join(out, 'tiles'), { recursive: true, force: true });
const levels: { columns: number; rows: number; pieces: string }[] = [];
let level: Picture = picture;
let bytes = 0;
for (let z = 0; ; z += 1) {
  const columns = Math.ceil(level.width / PIECE);
  const rows = Math.ceil(level.height / PIECE);
  mkdirSync(join(out, 'tiles', String(z)), { recursive: true });
  // Which pieces exist, a character a piece: the page asks for no image that is only paper.
  let pieces = '';
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const image = png(level, column * PIECE, row * PIECE);
      pieces += image ? '1' : '0';
      if (image) {
        writeFileSync(join(out, 'tiles', String(z), `${column}_${row}.png`), image);
        bytes += image.length;
      }
    }
  }
  levels.push({ columns, rows, pieces });
  if (columns === 1 && rows === 1) break;
  level = halve(level);
}

const here = dirname(fileURLToPath(import.meta.url));
const commit = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
})();
const page = assemblePage(
  readFileSync(join(here, 'viewer.html'), 'utf8'),
  readFileSync(join(here, 'viewMotion.mjs'), 'utf8'),
  { ...plan, piece: PIECE, levels, made: new Date().toISOString().slice(0, 10), commit },
);
writeFileSync(join(out, 'index.html'), page);
const count = levels.reduce(
  (total, { pieces }) => total + [...pieces].filter((piece) => piece === '1').length,
  0,
);
console.log(
  `${join(out, 'index.html')}  ${plan.width}x${plan.height} tiles, ${plan.features.length} features, ` +
    `${levels.length} zoom levels, ${count} images (${(bytes / 1e6).toFixed(1)} MB), ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
