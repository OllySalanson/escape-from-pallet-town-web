import type { GridPosition } from '../movement/gridMovement';

/**
 * THE RAID ARENA's inside, as geometry: a great oval hall about four times as
 * wide as any other room in the harbour, a stone platform all the way round
 * it, and in the middle of the platform a pit with a fence along its edge.
 * What is at the bottom of the pit is Greystone Vale (`arenaPit.ts`).
 *
 * Everything that has to agree is worked out here from two ellipses, so it
 * cannot drift: the art (`scripts/draw-arena-hall.mts`), the collision, the
 * pillars and torches, and what a player at the fence is looking at. Nothing
 * here knows Phaser or the save.
 *
 * Two promises are made here for what comes next. **The platform is deep
 * enough to furnish**: `PLATFORM_CLEAR` tiles of open floor stand between the
 * fence and the pillars all the way round, so places to get ready can stand on
 * it. And **the fence is one low run nobody but the player needs to get past**:
 * it is solid, one tile thick, and every tile of it (`ARENA_FENCE`) has a tile
 * of platform to stand on beside it, so going over it is one authored hop from
 * anywhere on the ring. `pitTileAt` already says which tile of the map any
 * point in the pit is showing.
 */

export const ARENA_TILE = 16;

/** The hall in tiles: an odd width, so a tile stands on its centre line. */
export const ARENA_HALL_WIDTH = 65;
export const ARENA_HALL_HEIGHT = 63;
/** How far past the hall's foot the camera may go, so the player on the mat is not at the very bottom of the screen. */
export const ARENA_DARK_BELOW = 64;

/** The middle of the hall, in pixels. */
export const ARENA_CENTRE = { x: 520, y: 528 } as const;

export interface Oval {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

/** The foot of the outer wall. */
export const WALL_FOOT: Oval = { ...ARENA_CENTRE, rx: 488, ry: 464 };
/** How tall the outer wall's face is drawn on the north side, in pixels. */
export const WALL_FACE_HEIGHT = 48;
/** The inside edge of the fence's kerb: everything inside this is the pit. */
export const PIT_RIM: Oval = { ...ARENA_CENTRE, rx: 376, ry: 360 };
/** How wide the fence's kerb is, in pixels. */
export const KERB_WIDTH = 7;

/** Tiles of open floor promised between the fence and the pillars, all the way round. */
export const PLATFORM_CLEAR = 3;

/** How far a point is across an oval: 1 is on its edge. */
export function acrossOval(oval: Oval, x: number, y: number): number {
  const dx = (x - oval.x) / oval.rx;
  const dy = (y - oval.y) / oval.ry;
  return Math.sqrt(dx * dx + dy * dy);
}

/** An oval grown (or shrunk) by some pixels all round. */
export function grownOval(oval: Oval, by: number): Oval {
  return { ...oval, rx: oval.rx + by, ry: oval.ry + by };
}

/** A point on an oval, by angle: 0 is east and a quarter turn is south. */
export function ovalPoint(oval: Oval, angle: number): { readonly x: number; readonly y: number } {
  return { x: oval.x + Math.cos(angle) * oval.rx, y: oval.y + Math.sin(angle) * oval.ry };
}

const tileCorners = (tile: GridPosition): readonly (readonly [number, number])[] => {
  const left = tile.x * ARENA_TILE;
  const top = tile.y * ARENA_TILE;
  const right = left + ARENA_TILE;
  const bottom = top + ARENA_TILE;
  return [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ];
};

/** The door mat's middle tile: in through the south wall, on the hall's centre line. */
export const ARENA_MAT: GridPosition = { x: 32, y: 62 };

/** The porch the mat stands in, cut through the south wall. */
const inPorch = (tile: GridPosition): boolean =>
  Math.abs(tile.x - ARENA_MAT.x) <= 1 && tile.y >= ARENA_MAT.y - 2 && tile.y <= ARENA_MAT.y;

/** Every tile of the platform before anything stands on it. */
function isPlatform(tile: GridPosition): boolean {
  if (inPorch(tile)) {
    return true;
  }
  const corners = tileCorners(tile);
  const rim = grownOval(PIT_RIM, KERB_WIDTH);
  return (
    corners.every(([x, y]) => acrossOval(WALL_FOOT, x, y) <= 1) &&
    corners.every(([x, y]) => acrossOval(rim, x, y) >= 1)
  );
}

const PILLAR_COUNT = 28;
/** How far across the platform the pillars stand, from fence to wall. */
const PILLAR_REACH = 0.8;

/**
 * The pillars, as the tile each stands on, evenly round the platform close to
 * the wall and mirrored about the hall's centre line. The ring is turned half
 * a step, so the two nearest the door stand either side of the runner.
 */
export const ARENA_PILLARS: readonly GridPosition[] = (() => {
  const pillars: GridPosition[] = [];
  for (let index = 0; index < PILLAR_COUNT; index += 1) {
    const angle = ((index + 0.5) * Math.PI * 2) / PILLAR_COUNT + Math.PI / 2;
    const at = (radius: (oval: Oval) => number, axis: 'x' | 'y'): number => {
      const start = radius(PIT_RIM);
      const end = radius(WALL_FOOT);
      const reach = start + (end - start) * PILLAR_REACH;
      return axis === 'x' ? Math.cos(angle) * reach : Math.sin(angle) * reach;
    };
    const x = at((oval) => oval.rx, 'x');
    const y = at((oval) => oval.ry, 'y');
    pillars.push({
      // Rounded from the centre line outwards, so the two sides mirror exactly.
      x: ARENA_MAT.x + Math.sign(x) * Math.round(Math.abs(x) / ARENA_TILE),
      y: Math.floor((ARENA_CENTRE.y + y) / ARENA_TILE),
    });
  }
  return pillars;
})();

/** Where the hall's keeper stands: beside the runner, a step off the mat's line. */
export const ARENA_KEEPER_TILE: GridPosition = { x: ARENA_MAT.x - 2, y: ARENA_MAT.y - 2 };

const sameTile = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;

/** What cannot be walked on, by tile. The keeper is a figure, and solid as figures are. */
export function arenaCollision(): boolean[][] {
  return Array.from({ length: ARENA_HALL_HEIGHT }, (_row, y) =>
    Array.from({ length: ARENA_HALL_WIDTH }, (_cell, x) => {
      const tile = { x, y };
      return !isPlatform(tile) || ARENA_PILLARS.some((pillar) => sameTile(pillar, tile));
    }),
  );
}

/** Every tile of solid ground right beside the pit: what a player faces to look down. */
export const ARENA_FENCE: readonly GridPosition[] = (() => {
  const solid = arenaCollision();
  const fence: GridPosition[] = [];
  const rim = grownOval(PIT_RIM, KERB_WIDTH);
  solid.forEach((row, y) =>
    row.forEach((blocked, x) => {
      if (!blocked) {
        return;
      }
      const centreX = (x + 0.5) * ARENA_TILE;
      const centreY = (y + 0.5) * ARENA_TILE;
      if (acrossOval(rim, centreX, centreY) > 1.08) {
        return;
      }
      const beside = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const;
      if (beside.some(([bx, by]) => solid[by]?.[bx] === false)) {
        fence.push({ x, y });
      }
    }),
  );
  return fence;
})();

const FENCE_KEYS = new Set(ARENA_FENCE.map((tile) => `${tile.x},${tile.y}`));

export function isArenaFence(tile: GridPosition): boolean {
  return FENCE_KEYS.has(`${tile.x},${tile.y}`);
}

// --- torches -----------------------------------------------------------------

/** A flame, in hall pixels: the point it burns from, at the head of its stick. */
export interface ArenaTorch {
  readonly x: number;
  readonly y: number;
  /** What it is fixed to, which decides how its stick is drawn. */
  readonly on: 'pillar' | 'wall';
}

/** How far above its tile's top a pillar's torch burns, in pixels. */
const PILLAR_TORCH_RISE = 25;

/** One gap between two pillars, as a turn of the hall: where the wall is bare. */
const PILLAR_GAP = (Math.PI * 2) / PILLAR_COUNT;
/** North, as `ovalPoint` turns. */
const NORTH = -Math.PI / 2;

/**
 * The bare stretches of the north wall, by how many gaps each stands from due
 * north, alternating: a banner in one, a torch in the next. The wall's face
 * runs out towards the ends of the arc, so they stop short of them.
 */
const WALL_GAPS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

/** Where the wall's banners hang, as the point of the wall's foot under each. */
export const ARENA_BANNERS: readonly { readonly x: number; readonly y: number }[] = WALL_GAPS.filter(
  (gap) => gap % 2 === 0,
).map((gap) => {
  const foot = ovalPoint(WALL_FOOT, NORTH + gap * PILLAR_GAP);
  return { x: Math.round(foot.x), y: Math.round(foot.y) };
});

/**
 * Every torch in the hall: one on each pillar, and one on the bare wall in
 * every other gap along the north side, where the wall's face can be seen.
 */
export const ARENA_TORCHES: readonly ArenaTorch[] = (() => {
  const torches: ArenaTorch[] = ARENA_PILLARS.map((pillar) => ({
    x: pillar.x * ARENA_TILE + 8,
    y: pillar.y * ARENA_TILE - PILLAR_TORCH_RISE,
    on: 'pillar',
  }));
  for (const gap of WALL_GAPS.filter((each) => each % 2 !== 0)) {
    const foot = ovalPoint(WALL_FOOT, NORTH + gap * PILLAR_GAP);
    torches.push({ x: Math.round(foot.x), y: Math.round(foot.y) - 32, on: 'wall' });
  }
  return torches;
})();

// --- the pit -----------------------------------------------------------------

/** The map at the bottom of the pit, a game pixel to the tile, by its size in tiles. */
export const PIT_MAP_SIZE = 384;

/**
 * The stepped rings down from the fence to the floor: how wide each tread is,
 * and how far each ring stands lower in the picture than the one above - which
 * is what shows a riser on the north side and hides it on the south, as looking
 * down into anything does in this game's view.
 */
export const PIT_TIERS = 4;
export const PIT_TREAD = 16;
export const PIT_TIER_DROP = 3;
/** The sheer wall at the foot of the steps, with its gates in it. */
export const PIT_PODIUM_WIDTH = 24;
export const PIT_PODIUM_DROP = 14;

/** How much less each thing moves than the platform as the player walks: depth. */
export const TIER_PARALLAX = [0.016, 0.032, 0.048, 0.064] as const;
export const PODIUM_PARALLAX = 0.08;
export const MIST_PARALLAX = 0.09;
export const FLOOR_PARALLAX = 0.11;

/** The rest position of one ring's hole: the rim's own oval, stepped in and down. */
export function tierHole(tier: number): Oval {
  const inset = (tier + 1) * PIT_TREAD;
  return {
    x: PIT_RIM.x,
    y: PIT_RIM.y + (tier + 1) * PIT_TIER_DROP,
    rx: PIT_RIM.rx - inset,
    ry: PIT_RIM.ry - inset,
  };
}

/** The hole in the podium: the floor is what shows through it. */
export function podiumHole(): Oval {
  const inset = PIT_TIERS * PIT_TREAD + PIT_PODIUM_WIDTH;
  return {
    x: PIT_RIM.x,
    y: PIT_RIM.y + PIT_TIERS * PIT_TIER_DROP + PIT_PODIUM_DROP,
    rx: PIT_RIM.rx - inset,
    ry: PIT_RIM.ry - inset,
  };
}

/** Where the middle of the map stands when the player is at the hall's middle. */
export const PIT_MAP_CENTRE = { x: podiumHole().x, y: podiumHole().y } as const;

const NORTH_SOUTH_PARALLAX = 0.6;

/**
 * How far a layer has slid for somebody standing at a point of the hall: things
 * further down move less than the platform, so they slide towards whoever is
 * looking - the point straight below you stays below you. Whole pixels, because
 * a pixel that is not whole is a blurred one.
 */
export function parallaxShift(
  amount: number,
  player: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  return {
    x: Math.round((player.x - ARENA_CENTRE.x) * amount),
    // Less up and down than across: this game's view looks down at a slant, and
    // sliding as far south as east would hide every step from the south rail,
    // which is the first thing anybody coming through the door looks over.
    y: Math.round((player.y - ARENA_CENTRE.y) * amount * NORTH_SOUTH_PARALLAX),
  };
}

/**
 * Which tile of the map is under a point of the hall, for somebody standing at
 * `player`, or null past the map's edge: the one question picking a place from
 * the rim has to ask.
 */
export function pitTileAt(
  point: { readonly x: number; readonly y: number },
  player: { readonly x: number; readonly y: number },
): GridPosition | null {
  const shift = parallaxShift(FLOOR_PARALLAX, player);
  const x = Math.floor(point.x - shift.x - PIT_MAP_CENTRE.x + PIT_MAP_SIZE / 2);
  const y = Math.floor(point.y - shift.y - PIT_MAP_CENTRE.y + PIT_MAP_SIZE / 2);
  return x < 0 || y < 0 || x >= PIT_MAP_SIZE || y >= PIT_MAP_SIZE ? null : { x, y };
}

/**
 * The point in the pit somebody standing on `tile` at the fence is looking at:
 * straight out towards the middle of the hall (the fence runs round a curve, so
 * "out" is not quite the way they face), just past the foot of the steps.
 */
export function pitLookPoint(tile: GridPosition): { readonly x: number; readonly y: number } {
  const from = { x: (tile.x + 0.5) * ARENA_TILE, y: (tile.y + 0.5) * ARENA_TILE };
  const dx = PIT_MAP_CENTRE.x - from.x;
  const dy = PIT_MAP_CENTRE.y - from.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const shift = parallaxShift(PODIUM_PARALLAX, from);
  const hole = podiumHole();
  const opening = { ...hole, x: hole.x + shift.x, y: hole.y + shift.y };
  let reach = 0;
  while (reach < distance && acrossOval(opening, from.x + (dx / distance) * reach, from.y + (dy / distance) * reach) > LOOK_PAST_FOOT) {
    reach += 2;
  }
  return { x: Math.round(from.x + (dx / distance) * reach), y: Math.round(from.y + (dy / distance) * reach) };
}

/** How far across the hole a player's eye lands: just past the foot of the steps. */
const LOOK_PAST_FOOT = 0.92;

/** How far the camera leans out over the pit from wherever the player stands, as a share of the way to the middle. */
const CAMERA_LEAN = 0.2;
/** What the most it leans has to leave at the foot of a screen: the player's own tile and the hint under it. */
const CAMERA_LEAN_CLEAR = 56;

/**
 * How far the camera stands from the player, towards the pit. The hall is far
 * bigger than a screen and the pit is what it is for, so whichever way round
 * the ring somebody walks the screen shows more of the hole than of the wall -
 * and from the north rail, where the steps are at their deepest, shows the
 * floor past them. A pure function of where they stand, so it needs no easing.
 */
export function cameraLean(
  player: { readonly x: number; readonly y: number },
  viewHeight: number,
): { readonly x: number; readonly y: number } {
  const dx = (ARENA_CENTRE.x - player.x) * CAMERA_LEAN;
  const dy = (ARENA_CENTRE.y - player.y) * CAMERA_LEAN;
  const length = Math.hypot(dx, dy);
  const most = viewHeight / 2 - CAMERA_LEAN_CLEAR;
  const scale = length > most ? most / length : 1;
  return { x: Math.round(dx * scale), y: Math.round(dy * scale) };
}

// --- stone -------------------------------------------------------------------

/**
 * The hall's stone, dark to light, every colour a 15-bit value as the GBA draws
 * them. It is one warm ramp for the whole hall - floor, wall, pillars and steps
 * - so everything is lit by moving along it, dithered, the way FireRed shades a
 * cave, rather than by a soft gradient that belongs to no game on this hardware.
 */
export const STONE_RAMP: readonly (readonly [number, number, number])[] = [
  [16, 16, 24],
  [32, 24, 32],
  [48, 40, 40],
  [72, 56, 48],
  [96, 72, 56],
  [120, 96, 72],
  [144, 120, 88],
  [168, 144, 112],
  [192, 168, 136],
  [216, 192, 160],
];

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** Whether a share (0 to 1) of a pixel is lit, as an ordered dither: whole pixels only. */
export function dithered(share: number, x: number, y: number): boolean {
  return share > (BAYER_4[y & 3][x & 3] + 0.5) / 16;
}

/** A step along the stone ramp as a colour, the fraction of a step dithered. */
export function stoneAt(level: number, x: number, y: number): readonly [number, number, number] {
  const clamped = Math.max(0, Math.min(STONE_RAMP.length - 1, level));
  const whole = Math.floor(clamped);
  const index = dithered(clamped - whole, x, y) ? whole + 1 : whole;
  return STONE_RAMP[Math.min(STONE_RAMP.length - 1, index)];
}

/** A cheap, repeatable scatter in [0, 1) for a pair of whole numbers. */
export function scatter(a: number, b: number): number {
  const mixed = Math.imul(a * 374761393 + b * 668265263, 1274126177) >>> 0;
  return ((mixed ^ (mixed >>> 13)) >>> 0) % 1000 / 1000;
}
