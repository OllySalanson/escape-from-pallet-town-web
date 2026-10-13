/**
 * A FireRed place from pret's disassembly, redrawn in this game's own tiles,
 * so a district can be judged blind beside the real thing (README, "Judging a
 * map"): the same tiles on both sides, so what a judge sees is the layout.
 *
 *   npx vite-node tools/mapcraft/fromPret.mts -- <pokefirered> <Layout> <out.png> [--crop=x,y,w,h] [--shuffle=seed] [--swap=seed]
 *
 * Every metatile is read as what it is, from its behaviour and its collision
 * (`include/constants/metatile_behaviors.h`): water is water, tall grass is tall
 * grass, sand is the beach, a ledge is a ledge, and what is left is ground or a
 * wall by whether it can be walked on - green ground is grass and green wall a
 * wood, anything else rock or sand by its colour. Nothing is placed by hand.
 * `--shuffle` deals every 8x8 block of the place out again at random and
 * `--swap` trades four of them, the broken controls every batch of judging has.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blank, readPalette, tilesetPair } from '../../scripts/gba.mjs';
import { writePng } from '../tileset/tileSheet.mjs';
import { MAP_FILE_FORMAT, type MapFile } from '../../src/game/world/mapFile';
import { MapProgram, seeded } from './program';
import { mapPicture } from './picture.mts';

const args = process.argv.slice(2);
const [pret, layoutName, out] = args.filter((value) => !value.startsWith('--'));
const flag = (name: string) => args.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];
if (!pret || !layoutName || !out) {
  console.error('usage: fromPret.mts -- <pokefirered> <Layout> <out.png> [--crop=x,y,w,h] [--shuffle=seed] [--swap=seed]');
  process.exit(2);
}

const layouts = JSON.parse(readFileSync(join(pret, 'data/layouts/layouts.json'), 'utf8')).layouts as {
  name: string;
  width: number;
  height: number;
  primary_tileset: string;
  secondary_tileset: string;
}[];
const layout = layouts.find((candidate) => candidate.name === `${layoutName}_Layout`);
if (!layout) throw new Error(`pret has no layout ${layoutName}`);
const dir = (name: string) => name.replace(/^gTileset_/, '').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toLowerCase();
const primary = join(pret, 'data/tilesets/primary', dir(layout.primary_tileset));
const secondary = join(pret, 'data/tilesets/secondary', dir(layout.secondary_tileset));
const palettes = Array.from({ length: 13 }, (_, n) =>
  readPalette(join(n < 7 ? primary : secondary, 'palettes', `${String(n).padStart(2, '0')}.pal`)),
);
const pair = tilesetPair({
  primaryTiles: join(primary, 'tiles.png'),
  secondaryTiles: join(secondary, 'tiles.png'),
  primaryMetatiles: join(primary, 'metatiles.bin'),
  secondaryMetatiles: join(secondary, 'metatiles.bin'),
  palettes,
  split: { tiles: 640, metatiles: 640 },
});
const attributes = [readFileSync(join(primary, 'metatile_attributes.bin')), readFileSync(join(secondary, 'metatile_attributes.bin'))];
const behaviour = (metatile: number) =>
  (metatile < 640 ? attributes[0].readUInt32LE(metatile * 4) : attributes[1].readUInt32LE((metatile - 640) * 4)) & 0x1ff;
const colour = new Map<number, [number, number, number]>();
const colourOf = (metatile: number): [number, number, number] => {
  const known = colour.get(metatile);
  if (known) return known;
  const image = blank(16, 16);
  pair.drawMetatile(image, metatile, 0, 0);
  const sum = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] === 0) continue;
    for (let k = 0; k < 3; k += 1) sum[k] += image.data[i + k];
    count += 1;
  }
  const average = sum.map((value) => value / Math.max(1, count)) as [number, number, number];
  colour.set(metatile, average);
  return average;
};

const WATER = new Set([0x10, 0x11, 0x12, 0x13, 0x15, 0x19, 0x1a, 0x1b]);
const LEDGES = new Set([0x38, 0x39, 0x3a, 0x3b]);
const blocks = readFileSync(join(pret, 'data/layouts', layoutName, 'map.bin'));
const letterAt = (x: number, y: number): string => {
  const value = blocks.readUInt16LE((y * layout.width + x) * 2);
  const metatile = value & 1023;
  const solid = ((value >> 10) & 3) !== 0;
  const kind = behaviour(metatile);
  if (WATER.has(kind)) return 'W';
  if (kind === 0x17 || kind === 0x16) return 'w';
  if (kind === 0x02) return 'g';
  if (LEDGES.has(kind)) return '=';
  if (kind === 0x21) return '~';
  const [r, g, b] = colourOf(metatile);
  const green = g > r + 8 && g > b;
  if (solid) return green ? 'T' : 'C';
  if (green) return '.';
  return r > b + 30 ? 'd' : 'P';
};
let rows = Array.from({ length: layout.height }, (_, y) =>
  Array.from({ length: layout.width }, (_, x) => letterAt(x, y)).join(''),
);

// The broken controls: blocks of eight dealt out again, or four of them traded.
const BLOCK = 8;
const blocksOf = () => {
  const list: [number, number][] = [];
  for (let by = 0; by + BLOCK <= layout.height; by += BLOCK)
    for (let bx = 0; bx + BLOCK <= layout.width; bx += BLOCK) list.push([bx, by]);
  return list;
};
const moveBlocks = (from: [number, number][], to: [number, number][]) => {
  const grid = rows.map((row) => [...row]);
  from.forEach(([fx, fy], index) => {
    const [tx, ty] = to[index];
    for (let y = 0; y < BLOCK; y += 1) for (let x = 0; x < BLOCK; x += 1) grid[ty + y][tx + x] = rows[fy + y][fx + x];
  });
  rows = grid.map((row) => row.join(''));
};
for (const [name, count] of [['shuffle', Infinity], ['swap', 4]] as const) {
  const seed = flag(name);
  if (seed === undefined) continue;
  const random = seeded(Number(seed));
  const list = blocksOf();
  const chosen = count === Infinity ? list : list.sort(() => random.next() - 0.5).slice(0, count);
  const dealt = [...chosen].sort(() => random.next() - 0.5);
  moveBlocks(chosen, dealt);
}

const width = Math.max(20, layout.width);
const height = Math.max(16, layout.height);
const p = new MapProgram(width, height, 'W');
p.draw(0, 0, rows);
const ground = p.compile();
let open: [number, number] | undefined;
for (let y = 0; y < height && !open; y += 1)
  for (let x = 0; x < width && !open; x += 1) if ('.d~gP'.includes(ground[y][x])) open = [x, y];
const [ox, oy] = open ?? [0, 0];
const file: MapFile = {
  format: MAP_FILE_FORMAT,
  id: 'pret-view',
  name: 'View',
  maker: 'pret',
  width,
  height,
  ground,
  buildings: [],
  dropIns: [{ x: ox, y: oy, name: 'Here' }],
  exits: [{ x: ox, y: oy, name: 'Out', opens: { when: 'always' } }],
  itemSpots: [],
  wildlife: 'meadow',
};
const crop = flag('crop')?.split(',').map(Number);
const picture = mapPicture(file, crop ? { x: crop[0], y: crop[1], width: crop[2], height: crop[3] } : undefined);
writePng(out, picture);
console.log(`${out}: ${layoutName} ${layout.width}x${layout.height} in this game's tiles`);
