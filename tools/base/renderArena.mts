/**
 * Draws THE RAID ARENA's hall as the game composes it, without a browser: the
 * floor, the rings, the hall's tile layers and the over layer, slid for
 * somebody standing where you say, and cropped to what a window shows.
 *
 *   npx vite-node tools/base/renderArena.mts -- out.png --at=32,62 --view=400x256 --scale=2 --survey=all
 *   npx vite-node tools/base/renderArena.mts -- out.png --whole --scale=1 --survey=none
 *
 * `--survey=none|all|some`: what this save has walked. `--whole` is the hall
 * from above, which no player ever sees. Flames and mist are the scene's and
 * are not drawn here; the photographs under `docs/screens/arena-hall/` are.
 */
import { readPng, writePng } from '../tileset/tileSheet.mjs';
import { ARENA_HALL_SHEET, ARENA_HALL_GROUND, ARENA_HALL_OVER } from '../../src/game/base/generated/arenaHallTiles';
import {
  ARENA_DARK_BELOW,
  ARENA_HALL_HEIGHT,
  ARENA_HALL_WIDTH,
  ARENA_TILE,
  FLOOR_PARALLAX,
  PIT_MAP_CENTRE,
  PIT_TIERS,
  PODIUM_PARALLAX,
  TIER_PARALLAX,
  cameraLean,
  parallaxShift,
} from '../../src/game/base/arenaHall';
import { PIT_FLOOR_SIZE, RING_ORIGIN, paintPitFloor, paintPodium, paintTier } from '../../src/game/base/arenaPit';
import { buildMinimap, type Minimap } from '../../src/game/world/minimap';
import { getWorldMap } from '../../src/game/worldMap';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const out = args.find((arg) => !arg.startsWith('--')) ?? 'arena.png';
const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const whole = args.includes('--whole');
const scale = Number(option('scale') ?? 1);
const [atX, atY] = (option('at') ?? '32,62').split(',').map(Number);
const [viewW, viewH] = (option('view') ?? '400x256').split('x').map(Number);
const survey = option('survey') ?? 'some';

const WIDTH = ARENA_HALL_WIDTH * ARENA_TILE;
const HEIGHT = ARENA_HALL_HEIGHT * ARENA_TILE + ARENA_DARK_BELOW;
const canvas = Buffer.alloc(WIDTH * HEIGHT * 4);
for (let at = 3; at < canvas.length; at += 4) canvas[at] = 255;

const blit = (picture: { width: number; height: number; data: Uint8ClampedArray | Buffer }, left: number, top: number): void => {
  for (let y = 0; y < picture.height; y += 1) {
    const hallY = y + top;
    if (hallY < 0 || hallY >= HEIGHT) continue;
    for (let x = 0; x < picture.width; x += 1) {
      const hallX = x + left;
      if (hallX < 0 || hallX >= WIDTH) continue;
      const from = (y * picture.width + x) * 4;
      if (picture.data[from + 3] === 0) continue;
      const to = (hallY * WIDTH + hallX) * 4;
      canvas[to] = picture.data[from];
      canvas[to + 1] = picture.data[from + 1];
      canvas[to + 2] = picture.data[from + 2];
    }
  }
};

const player = { x: atX * ARENA_TILE + 8, y: atY * ARENA_TILE + 8 };
const map = getWorldMap('greystone-vale');
const tiles = new Set<number>();
if (survey !== 'none') {
  for (let y = 0; y < 384; y += 1) {
    for (let x = 0; x < 384; x += 1) {
      const inSome = survey === 'all' || (Math.hypot(x - 170, y - 200) < 70 || Math.hypot(x - 100, y - 150) < 30);
      if (inSome) tiles.add(y * map.width + x);
    }
  }
}
const full = buildMinimap({ map, surveyed: tiles });
const picture: Minimap = { ...full, width: 384, height: 384, rows: full.rows.slice(0, 384).map((row) => row.slice(0, 384)) };
const floor = paintPitFloor(picture);
const shiftBy = (amount: number): { x: number; y: number } => parallaxShift(amount, player);
const floorShift = shiftBy(FLOOR_PARALLAX);
blit(
  floor,
  PIT_MAP_CENTRE.x - PIT_FLOOR_SIZE / 2 + floorShift.x,
  PIT_MAP_CENTRE.y - PIT_FLOOR_SIZE / 2 + floorShift.y,
);
const podiumShift = shiftBy(PODIUM_PARALLAX);
blit(paintPodium(), RING_ORIGIN.x + podiumShift.x, RING_ORIGIN.y + podiumShift.y);
for (let tier = PIT_TIERS - 1; tier >= 0; tier -= 1) {
  const shift = shiftBy(TIER_PARALLAX[tier]);
  blit(paintTier(tier), RING_ORIGIN.x + shift.x, RING_ORIGIN.y + shift.y);
}

const sheet = readPng(new URL('../../public/assets/arena-hall.png', import.meta.url).pathname);
const layer = (encoded: string): void => {
  encoded.split('\n').forEach((row, tileY) => {
    for (let tileX = 0; tileX < ARENA_HALL_WIDTH; tileX += 1) {
      const code = row.slice(tileX * 3, tileX * 3 + 3);
      if (code === '---') continue;
      const tile = parseInt(code, 36);
      const column = tile % ARENA_HALL_SHEET.columns;
      const sheetRow = Math.floor(tile / ARENA_HALL_SHEET.columns);
      for (let y = 0; y < ARENA_TILE; y += 1) {
        for (let x = 0; x < ARENA_TILE; x += 1) {
          const from = ((sheetRow * ARENA_TILE + y) * sheet.width + column * ARENA_TILE + x) * 4;
          if (sheet.data[from + 3] === 0) continue;
          const to = ((tileY * ARENA_TILE + y) * WIDTH + tileX * ARENA_TILE + x) * 4;
          canvas[to] = sheet.data[from];
          canvas[to + 1] = sheet.data[from + 1];
          canvas[to + 2] = sheet.data[from + 2];
        }
      }
    }
  });
};
layer(ARENA_HALL_GROUND);
layer(ARENA_HALL_OVER);

let left = 0;
let top = 0;
let cropW = WIDTH;
let cropH = HEIGHT;
if (!whole) {
  cropW = viewW;
  cropH = viewH;
  const lean = cameraLean(player, cropH);
  left = Math.max(0, Math.min(WIDTH - cropW, player.x + lean.x - cropW / 2));
  top = Math.max(0, Math.min(HEIGHT - cropH, player.y + lean.y - cropH / 2));
}
const outW = cropW * scale;
const outH = cropH * scale;
const image = Buffer.alloc(outW * outH * 4);
for (let y = 0; y < outH; y += 1) {
  for (let x = 0; x < outW; x += 1) {
    const from = ((top + Math.floor(y / scale)) * WIDTH + left + Math.floor(x / scale)) * 4;
    image.set(canvas.subarray(from, from + 4), (y * outW + x) * 4);
  }
}
writePng(out, { width: outW, height: outH, data: image });
console.log(`${out}: ${outW}x${outH}`);
