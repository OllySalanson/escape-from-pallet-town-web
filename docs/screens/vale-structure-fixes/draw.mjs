// Draws this folder's before-and-after pictures: each district as the game
// draws it (`tools/mapcraft/world.mts` writes `<out>-millbrook.png` and
// `<out>-tanglewood.png`), cropped, with what the structure rules saw marked on
// it - the landing and its straight walks, figures' beats, and tiles sealed off.
//   node docs/screens/vale-structure-fixes/draw.mjs <out-base>
import { readPng, writePng } from '../../../tools/tileset/tileSheet.mjs';

const [outBase] = process.argv.slice(2);
const T = 16;
const SCALE = 2;
const COLOURS = {
  landing: [255, 214, 0],
  walk: [255, 140, 0],
  figure: [40, 110, 255],
  door: [230, 30, 30],
  sealed: [200, 0, 200],
};

/** One crop of a district picture, tiles [x0, y0] to [x1, y1] inclusive, marked. */
function panel(image, [x0, y0, x1, y1], marks) {
  const width = (x1 - x0 + 1) * T * SCALE;
  const height = (y1 - y0 + 1) * T * SCALE;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = ((y0 * T + Math.floor(y / SCALE)) * image.width + x0 * T + Math.floor(x / SCALE)) * 4;
      image.data.copy(data, (y * width + x) * 4, from, from + 4);
    }
  }
  const tint = (px, py, [r, g, b], alpha) => {
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const at = (py * width + px) * 4;
    data[at] = Math.round(data[at] * (1 - alpha) + r * alpha);
    data[at + 1] = Math.round(data[at + 1] * (1 - alpha) + g * alpha);
    data[at + 2] = Math.round(data[at + 2] * (1 - alpha) + b * alpha);
    data[at + 3] = 255;
  };
  const size = T * SCALE;
  for (const { kind, tiles, line } of marks) {
    for (const [tx, ty] of tiles) {
      const left = (tx - x0) * size;
      const top = (ty - y0) * size;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const edge = x < 3 || y < 3 || x >= size - 3 || y >= size - 3;
          if (line) {
            const mid = Math.abs(x - size / 2) < 3 || Math.abs(y - size / 2) < 3;
            if (mid) tint(left + x, top + y, COLOURS[kind], 0.75);
          } else {
            tint(left + x, top + y, COLOURS[kind], edge ? 1 : 0.4);
          }
        }
      }
    }
  }
  return { width, height, data };
}

/** Before and after side by side, a gap between. */
function pair(before, after) {
  const gap = 16;
  const width = before.width + gap + after.width;
  const height = Math.max(before.height, after.height);
  const data = Buffer.alloc(width * height * 4, 255);
  for (const [image, offset] of [[before, 0], [after, before.width + gap]]) {
    for (let y = 0; y < image.height; y += 1) {
      image.data.copy(data, (y * width + offset) * 4, y * image.width * 4, (y + 1) * image.width * 4);
    }
  }
  return { width, height, data };
}

const run = (from, x, y, dx, dy, steps) =>
  Array.from({ length: steps }, (_, i) => [x + dx * (i + 1), y + dy * (i + 1)]);
const walks = (x, y, [up, down, left, right]) => [
  ...run(null, x, y, 0, -1, up),
  ...run(null, x, y, 0, 1, down),
  ...run(null, x, y, -1, 0, left),
  ...run(null, x, y, 1, 0, right),
];

const millbrook = readPng(`${outBase}-millbrook.png`);
const tanglewood = readPng(`${outBase}-tanglewood.png`);

// Mill Square: the landing, its straight walks, and the square's Pidgey.
const square = [20, 22, 41, 41];
writePng(
  new URL('mill-square.png', import.meta.url).pathname,
  pair(
    panel(millbrook, square, [
      { kind: 'walk', tiles: walks(30, 32, [49, 5, 1, 17]), line: true },
      { kind: 'landing', tiles: [[30, 32]] },
      { kind: 'figure', tiles: [[26, 28], [27, 28], [27, 27]] },
      { kind: 'sealed', tiles: [[26, 27]] },
    ]),
    panel(millbrook, square, [
      { kind: 'walk', tiles: walks(32, 33, [4, 4, 3, 4]), line: true },
      { kind: 'landing', tiles: [[32, 33]] },
      { kind: 'figure', tiles: [[26, 28], [27, 28], [26, 27]] },
    ]),
  ),
);

// The flower house's alley, and the orchard's Caterpie (its beat was one tile, and its
// door the tile it roamed to).
const alley = [50, 30, 60, 41];
writePng(
  new URL('flower-house-alley.png', import.meta.url).pathname,
  pair(
    panel(millbrook, alley, [
      { kind: 'figure', tiles: [[57, 35], [57, 34], [57, 33], [56, 38], [57, 38]] },
      { kind: 'sealed', tiles: [[57, 36], [57, 37]] },
    ]),
    panel(millbrook, alley, [{ kind: 'figure', tiles: [[57, 35], [57, 36], [57, 37], [56, 38], [57, 38]] }]),
  ),
);
const orchard = [41, 44, 50, 52];
writePng(
  new URL('orchard-nook.png', import.meta.url).pathname,
  pair(
    panel(millbrook, orchard, [
      { kind: 'figure', tiles: [[45, 47]] },
      { kind: 'door', tiles: [[45, 48]] },
    ]),
    panel(millbrook, orchard, [{ kind: 'figure', tiles: [[45, 47]] }]),
  ),
);

// Tanglewood's three nooks: the Tea Woman, a Pidgey and a Venonat.
for (const [name, crop, start, door] of [
  ['tanglewood-tea-woman.png', [48, 15, 58, 25], [53, 21], [53, 20]],
  ['tanglewood-pidgey.png', [0, 32, 9, 42], [2, 37], [3, 37]],
  ['tanglewood-venonat.png', [21, 36, 31, 46], [26, 41], [26, 42]],
]) {
  writePng(
    new URL(name, import.meta.url).pathname,
    pair(
      panel(tanglewood, crop, [
        { kind: 'figure', tiles: [start, door] },
        { kind: 'door', tiles: [door] },
      ]),
      panel(tanglewood, crop, [{ kind: 'figure', tiles: [start] }]),
    ),
  );
}
