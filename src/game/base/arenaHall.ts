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
 * Everything a player does before a raid is done on this platform
 * (`arenaRim.ts`, `BaseScene`). **The stations stand just inside the door**: the
 * bench, the armoury rack and the locker (`ARENA_STATIONS`), either side of the
 * runner along the row a held key walks from the mat, none of them between the
 * fence and the walk round it. **Nobody stands behind anything**: what rises over
 * the floor is solid under the part of it that would hide a figure, and no tile is
 * left that goes nowhere (`arenaWalk.ts` is the walking this leaves room for). And
 * **the fence is one low run nobody but the player needs to get past**: it is
 * solid, one tile thick, and every tile of it (`ARENA_FENCE`) has a tile of
 * platform to stand on beside it, so going over it is one authored hop from
 * anywhere on the ring. `pitTileAt` says which tile of the map any point in the
 * pit is showing, and `pitPointOf` where on the floor any tile of the map lies.
 */

export const ARENA_TILE = 16;

/**
 * The hall in tiles: an odd width, so a tile stands on its centre line. It is
 * wider than it is tall because the walks east and west of the pit are wider than
 * those north and south of it: at 65 a player had five tiles of floor there and
 * felt it (the captain, 31 Oct 2026), so the wall stands further out on those two
 * sides and the pit has not changed at all.
 */
export const ARENA_HALL_WIDTH = 71;
export const ARENA_HALL_HEIGHT = 63;
/** How far past the hall's foot the camera may go, so the player on the mat is not at the very bottom of the screen. */
export const ARENA_DARK_BELOW = 64;

/** The middle of the hall, in pixels. */
export const ARENA_CENTRE = { x: 568, y: 528 } as const;

export interface Oval {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

/** The foot of the outer wall. */
export const WALL_FOOT: Oval = { ...ARENA_CENTRE, rx: 536, ry: 464 };
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
export const ARENA_MAT: GridPosition = { x: 35, y: 62 };

/** The mat is three tiles of red across the porch, and all three of them are the way out. */
export const ARENA_MAT_REACH = 1;

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

/** Whether a tile is the hall's outer wall, with the stands behind it: not the porch's own sides, and not the fence. */
export function isOuterWall(tile: GridPosition): boolean {
  const inOrBesidePorch = Math.abs(tile.x - ARENA_MAT.x) <= 2 && tile.y >= ARENA_MAT.y - 3;
  if (inOrBesidePorch) {
    return false;
  }
  if (isPlatform(tile)) {
    return WALLED_OFF.has(`${tile.x},${tile.y}`);
  }
  return tileCorners(tile).some(([x, y]) => acrossOval(WALL_FOOT, x, y) > 1);
}

const PILLAR_COUNT = 28;
/** How far across the platform the pillars stand, from fence to wall: back against the wall, with no walk behind them. */
const PILLAR_REACH = 0.97;

/**
 * The pillars, as the tile each stands on, evenly round the platform against the
 * wall and mirrored about the hall's centre line. The ring is turned half a step
 * and has a gap at the door: the two that would stand either side of the runner
 * stood between a newcomer and everything they had come in for, and the walk to
 * the bench or the rack went behind them.
 */
export const ARENA_PILLARS: readonly GridPosition[] = (() => {
  const pillars: GridPosition[] = [];
  for (let index = 1; index < PILLAR_COUNT - 1; index += 1) {
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

/** Where the hall's keeper stands: beside the runner, in full view of the door, a row up from where the stations are walked along. */
export const ARENA_KEEPER_TILE: GridPosition = { x: ARENA_MAT.x - 2, y: ARENA_MAT.y - 3 };

const sameTile = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;

/** Where a player gets ready for a raid: who comes, what they carry, what comes home whatever happens. */
export type ArenaStationId = 'bench' | 'rack' | 'locker';

export interface ArenaStation {
  readonly id: ArenaStationId;
  /** The tiles it stands on: one row, walked up to from the floor in front of it. */
  readonly tiles: readonly GridPosition[];
  /** The torch at the end of its row, which answers for it: walking along the row and pressing on towards the flame still reaches what they came for. */
  readonly past: readonly GridPosition[];
  /** The row behind it, when it stands taller than a person: whoever walked there would be out of sight, so nobody can. */
  readonly rises: readonly GridPosition[];
}

const stationRow = (left: number, width: number, y: number): readonly GridPosition[] =>
  Array.from({ length: width }, (_tile, index) => ({ x: left + index, y }));

/** The row the stations stand on: the last before the south wall, so the row a held key walks from the mat is the floor in front of every one of them. */
const STATION_ROW = 59;

const station = (id: ArenaStationId, left: number, width: number, past: readonly GridPosition[], tall: boolean): ArenaStation => ({
  id,
  tiles: stationRow(left, width, STATION_ROW),
  past,
  rises: tall ? stationRow(left, width, STATION_ROW - 1) : [],
});

/** The standing torches either side of the way up from the door, where the first two pillars would be: the light the bench and the rack are read by. */
export const ARENA_STAND_TORCHES: readonly GridPosition[] = [
  { x: ARENA_MAT.x - 3, y: STATION_ROW },
  { x: ARENA_MAT.x + 3, y: STATION_ROW },
];

/**
 * The stations, either side of the runner, where the first screen of the hall
 * shows all three: the bench to the west, the rack and the locker to the east.
 * Each is one row of solid tiles; anything taller rises over the row behind it,
 * and that row is solid too, so nobody walks out of sight behind it.
 */
export const ARENA_STATIONS: readonly ArenaStation[] = [
  station('bench', ARENA_MAT.x - 8, 5, [ARENA_STAND_TORCHES[0]], false),
  station('rack', ARENA_MAT.x + 4, 3, [ARENA_STAND_TORCHES[1]], true),
  station('locker', ARENA_MAT.x + 7, 2, [], true),
];

/** The station on this tile, if there is one. */
export function arenaStationAt(tile: GridPosition): ArenaStation | undefined {
  return ARENA_STATIONS.find((station) => station.tiles.some((each) => sameTile(each, tile)));
}

/**
 * The brass telescopes, one each side of the runner where the straight of the
 * fence ends: the only place the whole of the map below can be seen at once
 * (`valeOverview.ts`). They stood half a lap away at the pit's sides, out of sight
 * from anywhere a newcomer had been, and it took the captain ages to find one. Here
 * both are on the first screen of the hall, and the rail's own row runs over the
 * plate of each.
 */
export interface ArenaTelescope {
  readonly side: 'west' | 'east';
  /** What it stands on: the first tile of platform past the fence's straight run. */
  readonly tile: GridPosition;
  /** Where a player puts their eye to it, the near side from the pit, with a brass plate let into the floor. */
  readonly stance: GridPosition;
}

/** The fence's straight run along the south of the pit. */
const TELESCOPE_ROW = STATION_ROW - 4;

const telescopeOn = (side: ArenaTelescope['side']): ArenaTelescope => {
  const way = side === 'east' ? 1 : -1;
  let x = ARENA_MAT.x;
  while (!isPlatform({ x, y: TELESCOPE_ROW })) {
    x += way;
  }
  return { side, tile: { x, y: TELESCOPE_ROW }, stance: { x, y: TELESCOPE_ROW + 1 } };
};

export const ARENA_TELESCOPES: readonly ArenaTelescope[] = [telescopeOn('west'), telescopeOn('east')];

/** How the tube is painted: how long, how far of it is on the player's side of the middle, and how high it stands over the tile's foot. */
export const TELESCOPE_TUBE = { length: 42, fromMiddle: 18, standsUp: 31, slope: -0.3, bigEndHalf: 7 } as const;

/** Where its big end catches the light, in hall pixels: the top of the brass, over the rail. */
export function telescopeGlintPoint({ tile, side }: ArenaTelescope): { readonly x: number; readonly y: number } {
  const beyond = TELESCOPE_TUBE.length - TELESCOPE_TUBE.fromMiddle - 2;
  return {
    x: tile.x * ARENA_TILE + 8 + (side === 'east' ? -beyond : beyond),
    y: tile.y * ARENA_TILE + ARENA_TILE - 1 - TELESCOPE_TUBE.standsUp + Math.round(beyond * TELESCOPE_TUBE.slope) - TELESCOPE_TUBE.bigEndHalf,
  };
}

/**
 * Where a little of the hall catches the light now and then, in hall pixels, so
 * it is seen from across the room: the telescopes' brass, the locker's lock and
 * the gold along the bench's cushion. Nothing else in the hall sparkles.
 */
export const ARENA_GLINTS: readonly { readonly x: number; readonly y: number }[] = [
  ...ARENA_TELESCOPES.map(telescopeGlintPoint),
  { x: (ARENA_STATIONS[2].tiles[0].x + 1) * ARENA_TILE - 1, y: STATION_ROW * ARENA_TILE + ARENA_TILE - 16 },
  { x: (ARENA_STATIONS[0].tiles[4].x + 1) * ARENA_TILE - 7, y: STATION_ROW * ARENA_TILE + ARENA_TILE - 9 },
];

/** The tiles of the rail either side of a telescope: where somebody looking through it goes round to, to look down for themselves. */
export function railBeside({ tile, stance, side }: ArenaTelescope): readonly GridPosition[] {
  const way = side === 'east' ? 1 : -1;
  return [
    { x: tile.x - way, y: stance.y },
    { x: tile.x + way, y: tile.y },
  ];
}

/** The telescope on this tile, if there is one. */
export function arenaTelescopeAt(tile: GridPosition): ArenaTelescope | undefined {
  return ARENA_TELESCOPES.find((telescope) => sameTile(telescope.tile, tile));
}

/** A pillar's shaft rises over this many tiles behind its foot, and whoever stood there would be behind it. */
const PILLAR_HIDES_TILES = 2;

/** Whether a tile has something standing on it, or rising over it far enough to hide whoever stood there. */
const standsOn = (tile: GridPosition): boolean =>
  // Past the ends of the stations their row goes nowhere.
  (tile.y === STATION_ROW && (tile.x < ARENA_STATIONS[0].tiles[0].x || tile.x > ARENA_STATIONS[2].tiles[1].x)) ||
  ARENA_PILLARS.some((pillar) => pillar.x === tile.x && pillar.y >= tile.y && pillar.y - tile.y <= PILLAR_HIDES_TILES) ||
  arenaStationAt(tile) !== undefined ||
  arenaTelescopeAt(tile) !== undefined ||
  ARENA_STATIONS.some((station) => [...station.past, ...station.rises].some((each) => sameTile(each, tile)));

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The floor in front of a station goes nowhere else, and is what it is for. */
const frontsAStation = (tile: GridPosition): boolean =>
  ARENA_STATIONS.some((station) => [...station.tiles, ...station.past].some((each) => each.x === tile.x && each.y + 1 === tile.y));

/**
 * The floor nobody walks on: what the pillars rise over, and then whatever that
 * leaves with one way in. A tile with one way in is only a place to stop against
 * something, so it is taken away, and the tile that led to it asked again.
 */
const WALLED_OFF: ReadonlySet<string> = (() => {
  const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
  const walled = new Set<string>();
  const open = (tile: GridPosition): boolean => isPlatform(tile) && !standsOn(tile) && !walled.has(key(tile));
  for (let changed = true; changed; ) {
    changed = false;
    for (let y = 0; y < ARENA_HALL_HEIGHT; y += 1) {
      for (let x = 0; x < ARENA_HALL_WIDTH; x += 1) {
        const tile = { x, y };
        if (open(tile) && !inPorch(tile) && !frontsAStation(tile) && SIDES.filter(([dx, dy]) => open({ x: x + dx, y: y + dy })).length <= 1) {
          walled.add(key(tile));
          changed = true;
        }
      }
    }
  }
  return walled;
})();

/** What cannot be walked on, by tile. The keeper is a figure, and solid as figures are. */
export function arenaCollision(): boolean[][] {
  return Array.from({ length: ARENA_HALL_HEIGHT }, (_row, y) =>
    Array.from({ length: ARENA_HALL_WIDTH }, (_cell, x) => {
      const tile = { x, y };
      return !isPlatform(tile) || standsOn(tile) || WALLED_OFF.has(`${x},${y}`);
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
      if (!blocked || arenaTelescopeAt({ x, y }) !== undefined) {
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
  readonly on: 'pillar' | 'wall' | 'stand';
}

/** How far above its tile's top a pillar's torch burns, in pixels. */
const PILLAR_TORCH_RISE = 25;
/** How far above its tile's top a standing torch burns, in pixels. */
const STAND_TORCH_RISE = 14;

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
 * Every torch in the hall: one on each pillar, one on the bare wall in every
 * other gap along the north side, where the wall's face can be seen, and the two
 * standing either side of the way up from the door.
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
  for (const stand of ARENA_STAND_TORCHES) {
    torches.push({ x: stand.x * ARENA_TILE + 8, y: stand.y * ARENA_TILE - STAND_TORCH_RISE, on: 'stand' });
  }
  return torches;
})();

// --- the pit -----------------------------------------------------------------

/** The most the map at the bottom of the pit is across, in game pixels: Greystone Vale, a pixel to the tile. */
export const PIT_MAP_SIZE = 384;

/**
 * How a map sits on the pit's floor. Greystone Vale is a pixel to the tile; a
 * smaller map is drawn at the largest whole number of pixels to the tile that
 * still fits, so a player's 64x64 is not a postage stamp a long way down.
 */
export interface PitFrame {
  /** The map's size, in tiles. */
  readonly width: number;
  readonly height: number;
  /** Game pixels to the tile. */
  readonly scale: number;
}

export function pitFrameFor(width: number, height: number): PitFrame {
  return { width, height, scale: Math.max(1, Math.floor(PIT_MAP_SIZE / Math.max(width, height, 1))) };
}

const VALE_FRAME: PitFrame = pitFrameFor(PIT_MAP_SIZE, PIT_MAP_SIZE);

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
export const MIST_PARALLAX = 0.28;
/**
 * The floor slides half as far as the player walks. It is a very long way down,
 * and the further away a thing is the more nearly it stays under whoever is
 * looking at it - which is what makes walking round the rim a walk over the
 * country: from the west rail the west of the vale is under you, and the middle
 * of it comes on to the screen from either side.
 */
export const FLOOR_PARALLAX = 0.5;

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
  frame: PitFrame = VALE_FRAME,
): GridPosition | null {
  const shift = parallaxShift(FLOOR_PARALLAX, player);
  const x = Math.floor((point.x - shift.x - PIT_MAP_CENTRE.x + (frame.width * frame.scale) / 2) / frame.scale);
  const y = Math.floor((point.y - shift.y - PIT_MAP_CENTRE.y + (frame.height * frame.scale) / 2) / frame.scale);
  return x < 0 || y < 0 || x >= frame.width || y >= frame.height ? null : { x, y };
}

/** The other way about: where the middle of a tile of the map lies in the hall, for somebody standing at `player`. */
export function pitPointOf(
  tile: GridPosition,
  player: { readonly x: number; readonly y: number },
  frame: PitFrame = VALE_FRAME,
): { readonly x: number; readonly y: number } {
  const shift = parallaxShift(FLOOR_PARALLAX, player);
  return {
    x: PIT_MAP_CENTRE.x + shift.x + (tile.x + 0.5) * frame.scale - (frame.width * frame.scale) / 2,
    y: PIT_MAP_CENTRE.y + shift.y + (tile.y + 0.5) * frame.scale - (frame.height * frame.scale) / 2,
  };
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

/** How far above a way in's light its name plate is seated, and below it when there is no room above. */
const PLATE_ABOVE = 26;
const PLATE_BELOW = 10;
/** Kept clear at the screen's right edge, where the page's FEEDBACK tab stands over the canvas. */
const PLATE_RIGHT_CLEAR = 14;

/**
 * Where a way in's name plate sits for a view of the hall, or null if it would
 * not be whole. A plate is about a mark, so with the mark off the screen there
 * is nothing to name; with the mark on it, the plate slides along to stay on it
 * rather than be cut by the screen's edge. It is drawn under the hall's floor,
 * so it must also stand wholly over the pit or the stone would cut it instead.
 */
export function namePlatePlace(
  mark: { readonly x: number; readonly y: number },
  plate: { readonly width: number; readonly height: number },
  view: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } | null {
  const right = view.x + view.width - PLATE_RIGHT_CLEAR;
  const bottom = view.y + view.height;
  if (mark.x < view.x || mark.x >= right || mark.y < view.y || mark.y >= bottom) {
    return null;
  }
  const x = Math.min(right - plate.width, Math.max(view.x, Math.round(mark.x - plate.width / 2)));
  const above = Math.round(mark.y) - PLATE_ABOVE;
  const y = above >= view.y ? above : Math.round(mark.y) + PLATE_BELOW;
  const fits =
    x >= view.x &&
    y + plate.height <= bottom &&
    [
      [x, y],
      [x + plate.width, y],
      [x, y + plate.height],
      [x + plate.width, y + plate.height],
    ].every(([cornerX, cornerY]) => acrossOval(PIT_RIM, cornerX, cornerY) < 1);
  return fits ? { x, y } : null;
}

/** How far the camera leans out over the pit from wherever the player stands, as a share of the way to the middle. */
const CAMERA_LEAN = 0.2;
/** What the most it leans has to leave at the edge of a screen: the player's own tile and the hint under it. */
const CAMERA_LEAN_CLEAR = 56;

/**
 * How far the camera stands from the player, towards the pit. The hall is far
 * bigger than a screen and the pit is what it is for, so whichever way round the
 * ring somebody walks the screen shows more of the hole than of the wall - and
 * from the north rail, where the steps are at their deepest, shows the floor past
 * them. It only ever leans in, and by a share of how far they stand from the
 * middle, so a step moves it by a share of a step and it never turns round: it
 * used to look out at the stands from the last few tiles by the wall, which was a
 * swing of two hundred pixels across three tiles, into the dark beyond the seats.
 */
export function cameraLean(
  player: { readonly x: number; readonly y: number },
  view: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } {
  const dx = (ARENA_CENTRE.x - player.x) * CAMERA_LEAN;
  const dy = (ARENA_CENTRE.y - player.y) * CAMERA_LEAN;
  const across = dx / Math.max(1, view.width / 2 - CAMERA_LEAN_CLEAR);
  const down = dy / Math.max(1, view.height / 2 - CAMERA_LEAN_CLEAR);
  const scale = 1 / Math.max(1, Math.hypot(across, down));
  return { x: Math.round(dx * scale), y: Math.round(dy * scale) };
}

/** How long the camera takes to come most of the way to where it is going, and the fastest it ever goes. */
const CAMERA_EASE_MS = 240;
const CAMERA_MOST_PER_MS = 0.24;

/**
 * The camera on its way to where it should be: gently, and never faster than a
 * person turns to look at something. Walking moves the goal by a share of a step,
 * so this is only ever felt when something asks it to look somewhere else.
 */
export function cameraEased(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  deltaMs: number,
): { readonly x: number; readonly y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const away = Math.hypot(dx, dy);
  if (away < 1) {
    return to;
  }
  const moved = Math.min(away * (1 - Math.exp(-deltaMs / CAMERA_EASE_MS)), CAMERA_MOST_PER_MS * deltaMs);
  return { x: from.x + (dx / away) * moved, y: from.y + (dy / away) * moved };
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
