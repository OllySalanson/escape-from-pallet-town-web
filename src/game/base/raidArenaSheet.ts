import { tileReader, withDoorway, type PropDefinition } from '../world/tileset/catalogue';

/**
 * THE RAID ARENA's own front, drawn by `scripts/draw-raid-arena.mjs` onto
 * `public/assets/raid-arena.png`: Saffron's Gym from FireRed's own cut with the
 * GYM plate reading RAID, a badge reading ARENA on the other side of the door,
 * the emblem in red, the door lit, a lantern either side and a flag on each end
 * of the roof - and beside it the forecourt's red banners and the runner from
 * the door. Numbered from 19000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const RAID_ARENA_SHEET = {
  imagePath: 'assets/raid-arena.png',
  columns: 10,
  rows: 5,
} as const;

export const RAID_ARENA_SHEET_SOURCE = tileReader(
  { textureKey: 'raidArena', ...RAID_ARENA_SHEET },
  19000,
);

/** Where each piece sits on the sheet, in tiles. The script draws them there. */
export const RAID_ARENA_PIECES = {
  building: { column: 0, row: 0, width: 7, height: 5 },
  banners: { column: 7, row: 0, width: 2, height: 2 },
  statue: { column: 7, row: 2, width: 1, height: 2 },
  runner: { column: 9, row: 0, width: 1, height: 3 },
} as const;

/** A piece as a landmark, solid in every cell. */
function piece(label: string, name: keyof typeof RAID_ARENA_PIECES): PropDefinition {
  const place = RAID_ARENA_PIECES[name];
  return {
    label,
    width: place.width,
    height: place.height,
    cells: Array.from({ length: place.width * place.height }, (_cell, index) => {
      const x = index % place.width;
      const y = Math.floor(index / place.width);
      return { tile: RAID_ARENA_SHEET_SOURCE.at(place.column + x, place.row + y), solid: true };
    }),
  };
}

/** The Arena itself, 7x5, with its door open where the Gym's was. */
export const RAID_ARENA_BUILDING: PropDefinition = withDoorway(piece('raid arena', 'building'), [[3, 4]]);

/** The forecourt's pair of banners on their poles, in the Arena's red: solid edge to edge, as the CC0 pair it is dyed from is. */
export const RAID_ARENA_BANNERS: PropDefinition = piece('arena banners', 'banners');

/** FireRed's Gym statue with RAID on its plinth where it said GYM. */
export const RAID_ARENA_STATUE: PropDefinition = piece('arena statue', 'statue');

/** One tile of the runner from the door: its head, a length of it, or its fringed foot. Walked on. */
function runnerTile(row: 0 | 1 | 2): PropDefinition {
  const place = RAID_ARENA_PIECES.runner;
  return {
    label: 'arena runner',
    width: 1,
    height: 1,
    cells: [{ tile: RAID_ARENA_SHEET_SOURCE.at(place.column, place.row + row), solid: false }],
  };
}

export const RAID_ARENA_RUNNER_HEAD = runnerTile(0);
export const RAID_ARENA_RUNNER = runnerTile(1);
export const RAID_ARENA_RUNNER_FOOT = runnerTile(2);
