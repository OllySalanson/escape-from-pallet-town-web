import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../testing/pngPixels';
import { TOWN_PIECES, TOWN_SHEET } from '../world/generated/townPieces';
import { BASE_TILESET } from './baseTileset';
import {
  RAID_ARENA_BUILDING,
  RAID_ARENA_PIECES,
  RAID_ARENA_SHEET,
} from './raidArenaSheet';

const TILE = 16;
const png = (path: string) => decodePng(readFileSync(new URL(`../../../public/${path}`, import.meta.url)));
const sheet = png(RAID_ARENA_SHEET.imagePath);
const towns = png(TOWN_SHEET.imagePath);

function inkIn(column: number, row: number): number {
  let ink = 0;
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      if (sheet.at(column * TILE + x, row * TILE + y)[3] > 0) ink += 1;
    }
  }
  return ink;
}

/**
 * The sheet is drawn by `scripts/draw-raid-arena.mjs` and addressed by
 * `raidArenaSheet.ts`, so the two can only disagree if one was changed alone:
 * this reads the pieces back out of the PNG.
 */
describe('THE RAID ARENA sheet', () => {
  it('is the size its table says', () => {
    expect([sheet.width, sheet.height]).toEqual([RAID_ARENA_SHEET.columns * TILE, RAID_ARENA_SHEET.rows * TILE]);
  });

  it.each(Object.entries(RAID_ARENA_PIECES))('draws every cell of %s', (_name, piece) => {
    for (let y = 0; y < piece.height; y += 1) {
      for (let x = 0; x < piece.width; x += 1) {
        expect(inkIn(piece.column + x, piece.row + y), `cell ${x},${y}`).toBeGreaterThan(0);
      }
    }
  });

  it('is the harbour\'s Arena, solid but for its door, where the Gym it is drawn from had it', () => {
    expect(BASE_TILESET.props.raidArena).toBe(RAID_ARENA_BUILDING);
    const gym = TOWN_PIECES.saffronGym;
    expect([RAID_ARENA_BUILDING.width, RAID_ARENA_BUILDING.height]).toEqual([gym.width, gym.height]);
    const open = RAID_ARENA_BUILDING.cells.flatMap((cell, index) =>
      cell.solid ? [] : [[index % RAID_ARENA_BUILDING.width, Math.floor(index / RAID_ARENA_BUILDING.width)]],
    );
    expect(open).toEqual(gym.doors.map(([x, y]) => [x, y]));
  });

  it('no longer says GYM: the plate left of the door is not the Gym\'s', () => {
    const gym = TOWN_PIECES.saffronGym;
    // The GYM plate's letters, in the Gym's own pixels.
    let differs = 0;
    for (let y = 62; y < 65; y += 1) {
      for (let x = 22; x < 33; x += 1) {
        const before = towns.at(gym.column * TILE + x, gym.row * TILE + y).join();
        const after = sheet.at(RAID_ARENA_PIECES.building.column * TILE + x, y).join();
        if (before !== after) differs += 1;
      }
    }
    expect(differs).toBeGreaterThan(10);
  });
});
