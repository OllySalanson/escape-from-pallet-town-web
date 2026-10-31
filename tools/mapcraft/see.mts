/**
 * One district as a raid map drawn alone, with everything that stands on it
 * marked: the quick look while filling a place. `world.mts` stitches the whole
 * vale, about a minute; this is seconds, and it draws the people, which that does not.
 *
 *   npx vite-node tools/mapcraft/see.mts -- <file.ts> <export> <out.png> [x y width height]
 *
 * Marks: people red, Pokemon yellow (a beat's other tiles paler), trainers purple,
 * signs white, landmarks cyan, item spots green, berry trees pink, ways out black.
 * It prints each failing hard check, and how many figures a 25x16 screen holds and
 * the tiles whose screen holds none (`tools/tileset/screens.mts` is the same
 * question asked of the stitched map).
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beatSpots, type MapFile } from '../../src/game/world/mapFile';
import { writePng } from '../tileset/tileSheet.mjs';
import { allPassed, hardChecks } from './checks';
import { griddedPicture, mapPicture } from './picture.mts';
import type { MapcraftResult } from './report';

const [path, name, out, ...rect] = process.argv.slice(2).filter((value) => value !== '--');
if (!path || !name || !out) {
  console.error('usage: npx vite-node tools/mapcraft/see.mts -- <file.ts> <export> <out.png> [x y width height]');
  process.exit(2);
}
const module = (await import(pathToFileURL(resolve(path)).href)) as Record<string, () => MapcraftResult>;
const { file, limits, notes } = module[name]();
const checks = hardChecks(file, { limits });
for (const check of checks.filter((one) => !one.passed)) console.log(`FAIL ${check.label}\n  ${check.problems.join('\n  ')}`);
for (const note of notes ?? []) console.log(`note ${note}`);

const crop = rect.length === 4
  ? { x: Number(rect[0]), y: Number(rect[1]), width: Number(rect[2]), height: Number(rect[3]) }
  : { x: 0, y: 0, width: file.width, height: file.height };
const picture = mapPicture(file, crop);
const scale = picture.width / crop.width;
/** A hollow square on a tile, drawn into the picture. */
function mark(x: number, y: number, [r, g, b]: readonly number[], inset = 4): void {
  const margin = (inset * scale) / 16;
  for (let j = margin; j < scale - margin; j += 1) {
    for (let i = margin; i < scale - margin; i += 1) {
      const inner = i > margin + 1 && j > margin + 1 && i < scale - margin - 2 && j < scale - margin - 2;
      const at = (Math.floor((y - crop.y) * scale + j) * picture.width + Math.floor((x - crop.x) * scale + i)) * 4;
      if (inner || at < 0 || at >= picture.data.length) continue;
      picture.data[at] = r;
      picture.data[at + 1] = g;
      picture.data[at + 2] = b;
      picture.data[at + 3] = 255;
    }
  }
}
const outdoors = (spot: { readonly area?: string }) => spot.area === undefined;
const people = (file.people ?? []).filter(outdoors);
const pokemon = (file.pokemon ?? []).filter(outdoors);
const trainers = (file.trainers ?? []).filter(outdoors);
for (const one of people) {
  mark(one.x, one.y, [255, 40, 40]);
  for (const spot of beatSpots(one)) mark(spot.x, spot.y, [255, 160, 160], 6);
}
for (const one of pokemon) {
  mark(one.x, one.y, [255, 230, 0]);
  for (const spot of beatSpots(one)) mark(spot.x, spot.y, [255, 240, 150], 6);
}
for (const one of trainers) mark(one.x, one.y, [160, 0, 255]);
for (const one of (file.signs ?? []).filter(outdoors)) mark(one.x, one.y, [255, 255, 255]);
for (const one of (file.landmarks ?? []).filter(outdoors)) mark(one.x, one.y, [0, 255, 255]);
for (const one of file.itemSpots.filter(outdoors)) mark(one.x, one.y, [0, 200, 80], 6);
for (const one of (file.berryTrees ?? []).filter(outdoors)) mark(one.x, one.y, [255, 120, 200]);
for (const one of file.exits.filter(outdoors)) mark(one.x, one.y, [0, 0, 0]);
writePng(out, griddedPicture(picture, crop));

function screens({ ground, width, height }: MapFile): { mean: number; empty: string[] } {
  const figures = [...people, ...pokemon, ...trainers];
  const view = { width: 25, height: 16 };
  const empty: string[] = [];
  let total = 0;
  let tiles = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ('TCWFB#'.includes(ground[y]?.[x] ?? 'T')) continue;
      const left = Math.max(0, Math.min(width - view.width, x - 12));
      const top = Math.max(0, Math.min(height - view.height, y - 8));
      const held = figures.filter(
        (one) => one.x >= left && one.x < left + view.width && one.y >= top && one.y < top + view.height,
      ).length;
      total += held;
      tiles += 1;
      if (held === 0) empty.push(`${x},${y}`);
    }
  }
  return { mean: total / tiles, empty };
}
const { mean, empty } = screens(file);
console.log(
  `people ${people.length}, Pokemon ${pokemon.length}, trainers ${trainers.length}; ${mean.toFixed(1)} figures a screen; ` +
    `${empty.length} tiles with nobody in view: ${empty.slice(0, 20).join(' ')}`,
);
console.log(allPassed(checks) ? 'every hard check passes' : 'FAILING');
