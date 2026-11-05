/**
 * The ride a way out is: what stands on an exit to take the player away.
 *
 * An exit used to be a green square with an arrow on it, which said "way out"
 * to nobody who had not been told. A Pokemon game leaves a place by something -
 * Mr. Briney's boat, a Bicycle, Pidgeot's Fly - so every exit is now the ride
 * that suits the ground it stands on, picked here from that ground and nothing
 * else. Nothing is stored and no map names one: a map maker's exit and a
 * stitched district's stand-in get the right ride by being where they are, and
 * a map redrawn under an exit changes its ride with it.
 *
 * The rule, first that applies:
 *
 * - under a roof - a cave, a tunnel, a room - it is a **minecart**, on rails
 *   that run away along the floor;
 * - beside deep water it is a **boat**, moored on the water beside the exit
 *   with its bow to the open water, which it leaves by;
 * - near a cliff it is **Pidgeot**, high ground's way out, hovering over the
 *   exit and flying off upward;
 * - anywhere else it is a **bicycle**, standing side on and ridden off toward
 *   the side with less ground beside it - into the wood the way out leads into.
 *
 * It changes no rule: the exit is still the one tile it was, still opens when
 * it opened and still takes whoever steps on it. The ride is drawn and nothing
 * else - it is never a wall - so collision, walk-up and every structural rule
 * read exactly what they read before. This module is Phaser-free: the picture
 * of each ride and its idle, arrival and departure are pure functions of time
 * (`rideIdle`, `rideArrival`, `rideDeparture`), drawn by `ui/ExitVehicleSprite.ts`.
 */
import type { Direction, GridPosition } from '../movement/gridMovement';
import { EXIT_VEHICLE_ART } from './generated/exitVehicleArt';
import { RIDE_ART } from './generated/rideArt';
import { placedAreaAt, type PlacedArea } from './mapAreas';
import type { Material } from './tileset/materials';

export type ExitVehicle = 'boat' | 'bike' | 'bird' | 'minecart';

export const EXIT_VEHICLES: readonly ExitVehicle[] = ['boat', 'bike', 'bird', 'minecart'];

/** What a ride is called where one is named. */
export const EXIT_VEHICLE_NAMES: Readonly<Record<ExitVehicle, string>> = {
  boat: 'Boat',
  bike: 'Bicycle',
  bird: 'Pidgeot',
  minecart: 'Minecart',
};

/** What an exit's ride is read off: the ground round it, and whether it is under a roof. */
export interface ExitGround {
  readonly width: number;
  readonly height: number;
  /** The material of a tile, or undefined off the map. */
  materialAt(x: number, y: number): Material | undefined;
  /** Whether the exit is in a cave, a tunnel or a room rather than out of doors. */
  readonly underground: boolean;
}

export interface ExitRide {
  readonly vehicle: ExitVehicle;
  /** The way it leaves by: a boat's bow, a bicycle's front wheel. */
  readonly facing: Direction;
  /** The tile it stands on: the exit itself, or a boat's water beside it. */
  readonly at: GridPosition;
}

const STEPS: Readonly<Record<Direction, GridPosition>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** How far out a boat looks for open water, and a ride for ground beside it. */
const LOOK_STEPS = 4;
/** How near a cliff has to be for an exit to be high ground. */
const HIGH_GROUND_REACH = 2;

const isGround = (material: Material | undefined): boolean =>
  material !== undefined &&
  material !== 'water' &&
  material !== 'tree' &&
  material !== 'hedge' &&
  material !== 'cliff' &&
  material !== 'fence' &&
  material !== 'wall';

export function exitRideFor(ground: ExitGround, exit: GridPosition): ExitRide {
  const along = (facing: Direction, steps: number): Material | undefined =>
    ground.materialAt(exit.x + STEPS[facing].x * steps, exit.y + STEPS[facing].y * steps);
  const sideOn = (): Direction => {
    // Toward the side with less ground beside it: the way out leads off the
    // map or into the wood, and a ride parked facing the open lane reads as
    // one that came in rather than one about to leave.
    const open = (facing: Direction): number => {
      let count = 0;
      for (let step = 1; step <= LOOK_STEPS; step += 1) {
        if (!isGround(along(facing, step))) {
          break;
        }
        count += 1;
      }
      return count;
    };
    const left = open('left');
    const right = open('right');
    if (left !== right) {
      return left < right ? 'left' : 'right';
    }
    return exit.x < ground.width / 2 ? 'left' : 'right';
  };

  if (ground.underground) {
    return { vehicle: 'minecart', facing: sideOn(), at: exit };
  }

  // The water with the most open water beyond it, so a boat on a quay faces
  // the sea rather than the harbour wall beside it.
  let water: { facing: Direction; reach: number } | undefined;
  for (const facing of ['down', 'right', 'left', 'up'] as const) {
    if (along(facing, 1) !== 'water') {
      continue;
    }
    let reach = 1;
    while (reach < LOOK_STEPS && along(facing, reach + 1) === 'water') {
      reach += 1;
    }
    if (!water || reach > water.reach) {
      water = { facing, reach };
    }
  }
  if (water) {
    const step = STEPS[water.facing];
    return { vehicle: 'boat', facing: water.facing, at: { x: exit.x + step.x, y: exit.y + step.y } };
  }

  for (let dy = -HIGH_GROUND_REACH; dy <= HIGH_GROUND_REACH; dy += 1) {
    for (let dx = -HIGH_GROUND_REACH; dx <= HIGH_GROUND_REACH; dx += 1) {
      if (ground.materialAt(exit.x + dx, exit.y + dy) === 'cliff') {
        return { vehicle: 'bird', facing: 'up', at: exit };
      }
    }
  }

  return { vehicle: 'bike', facing: sideOn(), at: exit };
}

// -- the picture --------------------------------------------------------------

/** The two textures a ride is drawn from. */
export const EXIT_VEHICLE_TEXTURE = 'exit-vehicles';
export const EXIT_VEHICLE_PATH = 'assets/exit-vehicles.png';
export const PIDGEOT_RIDE_TEXTURE = 'ride-pidgeot';
export const PIDGEOT_RIDE_PATH = 'assets/rides/pidgeot.png';
/** Both sheets are 32x32 frames. */
export const RIDE_FRAME = 32;

/** The cells of `exit-vehicles.png`, in the order `scripts/cut-exit-vehicles.mjs` lays them. */
const VEHICLE_CELLS = ['boat-down', 'boat-up', 'boat-left', 'bike-left', 'minecart-left'] as const;
type VehicleCell = (typeof VEHICLE_CELLS)[number];

/** Pidgeot's sheet: two frames a row, rows down, up, left, right. Its wings beat between the two. */
const PIDGEOT_DOWN_FRAMES = [0, 1] as const;

export interface RidePicture {
  readonly texture: string;
  /** The texture's file, for a picture drawn outside Phaser (the map maker's canvas). */
  readonly path: string;
  /** The frame of a still picture; a bird's wings beat between `frames`. */
  readonly frame: number;
  readonly frames?: readonly number[];
  readonly flipX: boolean;
  /**
   * Where the frame's centre stands, in pixels from the top-left of the tile
   * the ride stands on, at rest.
   */
  readonly centre: { readonly x: number; readonly y: number };
  /** The pixels the art covers at rest, from the same corner: what a caption is seated round. */
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Whether a shadow is drawn on the ground under it (a bird is in the air). */
  readonly shadow?: { readonly x: number; readonly y: number; readonly width: number };
}

const TILE = 16;
/** How far a moored boat lies out from the quay, so its stern meets the exit's edge. */
const BOAT_STANDOFF = 8;
/** How high Pidgeot hovers over the exit, its feet clear of the ground. */
const BIRD_HOVER = 5;

function cellBounds(cell: VehicleCell, flipX: boolean): { left: number; top: number; right: number; bottom: number } {
  const art = EXIT_VEHICLE_ART[cell];
  return flipX
    ? { left: RIDE_FRAME - 1 - art.right, right: RIDE_FRAME - 1 - art.left, top: art.top, bottom: art.bottom }
    : art;
}

/**
 * The picture of a ride standing on its tile. A side-on ride (bicycle,
 * minecart) has its art centred on the tile and its wheels on the tile's last
 * row; a boat lies out on the water with its stern against the exit; a bird
 * hovers over the exit with its shadow under it.
 */
export function ridePicture(ride: ExitRide): RidePicture {
  if (ride.vehicle === 'bird') {
    const art = RIDE_ART.pidgeot;
    // The art's foot row stands BIRD_HOVER over the tile's last row.
    const centreY = TILE - BIRD_HOVER - (art.bottomPixelY + 1) + RIDE_FRAME / 2;
    return {
      texture: PIDGEOT_RIDE_TEXTURE,
      path: PIDGEOT_RIDE_PATH,
      frame: PIDGEOT_DOWN_FRAMES[0],
      frames: PIDGEOT_DOWN_FRAMES,
      flipX: false,
      centre: { x: TILE / 2, y: centreY },
      bounds: {
        x: TILE / 2 - RIDE_FRAME / 2,
        y: centreY - RIDE_FRAME / 2 + art.topPixelY,
        width: RIDE_FRAME,
        height: art.bottomPixelY - art.topPixelY + 1,
      },
      shadow: { x: TILE / 2, y: TILE - 3, width: 14 },
    };
  }
  const cell: VehicleCell =
    ride.vehicle === 'boat'
      ? ride.facing === 'down'
        ? 'boat-down'
        : ride.facing === 'up'
          ? 'boat-up'
          : 'boat-left'
      : ride.vehicle === 'bike'
        ? 'bike-left'
        : 'minecart-left';
  const flipX = ride.facing === 'right';
  const art = cellBounds(cell, flipX);
  const artWidth = art.right - art.left + 1;
  const artHeight = art.bottom - art.top + 1;
  // Where the art's own middle and foot are put, from the tile's corner.
  let artLeft = Math.round(TILE / 2 - artWidth / 2);
  let artTop = TILE - artHeight;
  if (ride.vehicle === 'boat') {
    artLeft = Math.round(TILE / 2 - artWidth / 2) + STEPS[ride.facing].x * BOAT_STANDOFF;
    artTop = Math.round(TILE / 2 - artHeight / 2) + STEPS[ride.facing].y * BOAT_STANDOFF;
  }
  return {
    texture: EXIT_VEHICLE_TEXTURE,
    path: EXIT_VEHICLE_PATH,
    frame: VEHICLE_CELLS.indexOf(cell),
    flipX,
    centre: { x: artLeft - art.left + RIDE_FRAME / 2, y: artTop - art.top + RIDE_FRAME / 2 },
    bounds: { x: artLeft, y: artTop, width: artWidth, height: artHeight },
  };
}

// -- how it moves --------------------------------------------------------------

/** A ride's pose at one moment: a whole-pixel offset from rest, how opaque, and a frame. */
export interface RidePose {
  readonly dx: number;
  readonly dy: number;
  readonly alpha: number;
  /** Index into `RidePicture.frames`, for a ride whose picture has some. */
  readonly beat: number;
}

/** How a locked exit's ride is drawn: there, but not yet come for anybody. */
export const LOCKED_RIDE_ALPHA = 0.4;
/** How long a ride takes to come in once its exit opens. */
export const RIDE_ARRIVAL_MS = 600;
/**
 * How long a ride takes to leave with the player. Under the 700ms the world
 * stands before the result screen (`RUN_RESULT_DELAY_MS`), so it is seen to go.
 */
export const RIDE_DEPARTURE_MS = 640;
/** How far a ride goes in its departure, and comes from in its arrival. */
const DEPARTURE_PIXELS = 3 * TILE;
const ARRIVAL_PIXELS = 2 * TILE;
/** How long a bird's wing takes to beat, idle and in flight. */
const WING_BEAT_MS = 360;
const FLIGHT_WING_BEAT_MS = 120;
/** How long a moored boat takes to rise and fall on the water. */
const SWELL_MS = 1800;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** At rest: a boat rides the swell a pixel, a bird beats its wings and bobs, wheels stand still. */
export function rideIdle(vehicle: ExitVehicle, nowMs: number): RidePose {
  if (vehicle === 'boat') {
    const phase = (nowMs % SWELL_MS) / SWELL_MS;
    return { dx: 0, dy: phase < 0.5 ? 0 : 1, alpha: 1, beat: 0 };
  }
  if (vehicle === 'bird') {
    const beat = Math.floor(nowMs / WING_BEAT_MS) % 2;
    // Up a pixel on the downbeat, as a hovering bird is lifted by it.
    return { dx: 0, dy: beat === 1 ? -1 : 0, alpha: 1, beat };
  }
  return { dx: 0, dy: 0, alpha: 1, beat: 0 };
}

/** Coming in, as the exit opens: from the way it will leave by (a bird from the sky), easing to rest. */
export function rideArrival(ride: ExitRide, elapsedMs: number): RidePose {
  const t = clamp01(elapsedMs / RIDE_ARRIVAL_MS);
  const remaining = Math.round(ARRIVAL_PIXELS * (1 - t) * (1 - t));
  const alpha = LOCKED_RIDE_ALPHA + (1 - LOCKED_RIDE_ALPHA) * t;
  if (ride.vehicle === 'bird') {
    return { dx: 0, dy: -remaining, alpha, beat: Math.floor(elapsedMs / FLIGHT_WING_BEAT_MS) % 2 };
  }
  const step = STEPS[ride.facing];
  return { dx: step.x * remaining, dy: step.y * remaining, alpha, beat: 0 };
}

/** Leaving with the player: away the way it faces, gathering speed, gone by the end. */
export function rideDeparture(ride: ExitRide, elapsedMs: number): RidePose {
  const t = clamp01(elapsedMs / RIDE_DEPARTURE_MS);
  const travelled = Math.round(DEPARTURE_PIXELS * t * t);
  const alpha = clamp01((1 - t) / 0.4);
  if (ride.vehicle === 'bird') {
    // Up and away, wings going hard.
    return { dx: 0, dy: -travelled, alpha, beat: Math.floor(elapsedMs / FLIGHT_WING_BEAT_MS) % 2 };
  }
  const step = STEPS[ride.facing];
  return { dx: step.x * travelled, dy: step.y * travelled, alpha, beat: 0 };
}

/** A map as far as a ride is read off it: its ground, and its places under a roof. */
export interface RideMap {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly (readonly Material[])[];
  readonly areas?: readonly PlacedArea[];
}

/** The ride standing on an exit of a built map. */
export function rideOnMap(map: RideMap, exit: GridPosition): ExitRide {
  const area = map.areas ? placedAreaAt(map.areas, exit) : undefined;
  return exitRideFor(
    {
      width: map.width,
      height: map.height,
      materialAt: (x, y) => map.terrain[y]?.[x],
      underground: area !== undefined && area.kind !== 'outdoors',
    },
    exit,
  );
}
