// Draws a stretch of THE RAID ARENA's hall as painted - its sheet laid by its two
// layers, with no figures, captions or lights - scaled up, to look at without a
// browser. The tiles are the hall's own (x 0-70, y 0-73).
//
//   node tools/playtest/hallCrop.mjs <out.png> <left> <top> <width> <height> [scale]
//
// `docs/screens/keepers-one-box/` was made with `21 59 29 16 3` and `38 64 7 5 8`.
import { readFileSync } from 'node:fs';
import { readPng, writePng } from '../tileset/tileSheet.mjs';

const repo = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const [out, l, t, w, h, s = '3'] = process.argv.slice(2);
const [left, top, width, height, scale] = [l, t, w, h, s].map(Number);
const source = readFileSync(`${repo}/src/game/base/generated/arenaHallTiles.ts`, 'utf8');
const layer = (name) => {
  const text = new RegExp(`export const ${name} = \`([^\`]*)\``).exec(source)[1];
  return text.split('\n').map((row) => Array.from({ length: row.length / 3 }, (_c, x) => row.slice(x * 3, x * 3 + 3)));
};
const ground = layer('ARENA_HALL_GROUND');
const over = layer('ARENA_HALL_OVER');
const sheet = readPng(`${repo}/public/assets/arena-hall.png`);
const T = 16;
const W = width * T * scale;
const H = height * T * scale;
const data = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i += 1) {
  data[i * 4] = 20; data[i * 4 + 1] = 20; data[i * 4 + 2] = 28; data[i * 4 + 3] = 255;
}
const paint = (rows) => {
  for (let ty = 0; ty < height; ty += 1) {
    for (let tx = 0; tx < width; tx += 1) {
      const code = rows[top + ty]?.[left + tx];
      if (!code || code === '---') continue;
      const index = Number.parseInt(code, 36);
      const sx = (index % 40) * T;
      const sy = Math.floor(index / 40) * T;
      for (let y = 0; y < T; y += 1) {
        for (let x = 0; x < T; x += 1) {
          const from = ((sy + y) * sheet.width + sx + x) * 4;
          if (sheet.data[from + 3] === 0) continue;
          for (let dy = 0; dy < scale; dy += 1) {
            for (let dx = 0; dx < scale; dx += 1) {
              const to = (((ty * T + y) * scale + dy) * W + (tx * T + x) * scale + dx) * 4;
              data[to] = sheet.data[from]; data[to + 1] = sheet.data[from + 1]; data[to + 2] = sheet.data[from + 2]; data[to + 3] = 255;
            }
          }
        }
      }
    }
  }
};
paint(ground);
paint(over);
writePng(out, { width: W, height: H, data });
console.log(`${W}x${H}`);
