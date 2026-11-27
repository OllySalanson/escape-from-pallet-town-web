import { getSpeciesById } from '../pokemon/species';
import type { WildEncounterEntry } from '../pokemon/encounters';
import { DEEP_WATER_SLOTS, FISHING_WATER_SLOTS } from '../world/generated/fishingWaters';

/**
 * THE POINT's coin telescope, looked through (`seaTelescopeView.ts` draws it).
 *
 * Faced from the walk behind it, the camera comes down out of the sky, swings
 * round behind the player's head, and goes in through the eyepiece: a round of
 * glass over the open sea, panned with the arrows and zoomed with Z or the
 * wheel. Out on the water are the Pokémon that live in the harbour's sea - the
 * sea's own FireRed slots, every rod's and surfing's (`DEEP_WATER_SLOTS`), so
 * nothing is out there that the water does not hold - swimming, leaping,
 * bobbing, breaching, small in the distance. The Super Rod's kinds are the far
 * ones, out by the horizon, and only show with the glass zoomed in. Held in the
 * middle of the glass, close enough, for a moment, a kind is SEEN in the
 * Pokédex (`SaveManager.registerSeen`), as a fight's first sight of it would
 * be - never owned.
 *
 * Everything here is a pure function of the clock and a roll, so the view only
 * draws it, and the tests ask it directly.
 */

/** How a kind is seen at sea: what it does with its time out there. */
export type SeaMotion =
  /** Swims along the surface, half out of the water, a wake behind it. */
  | 'drift'
  /** Under the water, a ring now and then, and then a leap clean out of it. */
  | 'leap'
  /** Sits upright in the swell, and now and then dives and comes up somewhere else. */
  | 'bob'
  /** Long under, then up out of the sea in one go and down again with a great splash. */
  | 'breach'
  /** On a rock out in the water, side-stepping. */
  | 'perch';

/**
 * What each kind the sea holds does out there. A kind the generated slots add
 * fails `seaTelescope.test.ts` until it has a row.
 */
export const SEA_MOTIONS: Readonly<Record<string, SeaMotion>> = {
  tentacool: 'drift',
  psyduck: 'drift',
  magikarp: 'leap',
  horsea: 'bob',
  seadra: 'bob',
  shellder: 'bob',
  krabby: 'perch',
  gyarados: 'breach',
};

/** Where a sighting is out on the water: the near water, or the far by the horizon. */
export type SeaBand = 'near' | 'far';

/** A table of what lives in a band, by FireRed's own rates. */
interface SeaGroup {
  readonly band: SeaBand;
  /** How often a near sighting is from this table rather than another near one. */
  readonly share: number;
  readonly slots: readonly WildEncounterEntry[];
}

/**
 * The sea's tables. Surfing and the two lower rods are the near water; the
 * Super Rod's are the far, where the big ones are and only a zoomed glass
 * finds them.
 */
export const SEA_GROUPS: readonly SeaGroup[] = [
  { band: 'near', share: 2, slots: DEEP_WATER_SLOTS.sea.surfing },
  { band: 'near', share: 1, slots: FISHING_WATER_SLOTS.sea.oldRod },
  { band: 'near', share: 2, slots: FISHING_WATER_SLOTS.sea.goodRod },
  { band: 'far', share: 1, slots: DEEP_WATER_SLOTS.sea.superRod },
];

/** Every kind out at sea, by species id, each once, in table order. */
export const SEA_KINDS: readonly string[] = [...new Set(SEA_GROUPS.flatMap((group) => group.slots.map((slot) => slot.speciesId)))];

/** The picture the glass looks over, in its own pixels: the sea's width, the sky and the horizon. */
export const PANORAMA = { width: 1200, height: 256, horizon: 96 } as const;

/** How the glass zooms: Z and the wheel step through these, a whole zoom each so every pixel is the same size at rest. */
export const ZOOM_STEPS = [1, 2, 4] as const;
export type TelescopeZoom = (typeof ZOOM_STEPS)[number];

/** A front sprite's scale in each band: a whole fraction, so the closest zoom draws the near ones at a pixel a pixel. */
export const BAND_SCALE: Readonly<Record<SeaBand, number>> = { near: 1 / 4, far: 1 / 8 };

/** The least zoom a band can be told apart at, for the glass to count it; and the far band shows at no less. */
export const BAND_ZOOM: Readonly<Record<SeaBand, TelescopeZoom>> = { near: 2, far: 4 };
/** The far band is not there at all below this zoom: specks too small to be anything. */
export const FAR_SHOWS_FROM_ZOOM: TelescopeZoom = 2;

/** How long a kind must be held in the middle of the glass to be SEEN. */
export const HOLD_TO_SEE_MS = 900;
/** How much of a body must be out of the water for it to count. */
export const SHOWN_TO_SEE = 0.3;
/** How far from the middle of the glass, in screen pixels past its body's edge, a sighting still counts. */
export const SIGHTS_SLACK = 3;

/** How many sightings a look has in each band. */
export const SIGHTINGS_PER_LOOK: Readonly<Record<SeaBand, number>> = { near: 5, far: 2 };

/** One Pokémon out at sea, for the length of a look. */
export interface SeaSighting {
  readonly id: number;
  readonly speciesId: string;
  readonly dexId: number;
  readonly band: SeaBand;
  readonly motion: SeaMotion;
  /** Where it starts across the panorama. */
  readonly x: number;
  /** How far out it is in its band, 0 the horizon and 1 the nearest water. */
  readonly depth: number;
  /** Which way it is going: 1 east, -1 west. */
  readonly heading: 1 | -1;
  /** How far into its cycle it is at the look's first moment. */
  readonly phaseMs: number;
}

/** Picks one slot of a table by its FireRed rate. */
function pickSlot(slots: readonly WildEncounterEntry[], rng: () => number): WildEncounterEntry {
  const total = slots.reduce((sum, slot) => sum + slot.weight, 0);
  let roll = rng() * total;
  for (const slot of slots) {
    roll -= slot.weight;
    if (roll < 0) return slot;
  }
  return slots[slots.length - 1];
}

function pickGroup(band: SeaBand, rng: () => number): SeaGroup {
  const groups = SEA_GROUPS.filter((group) => group.band === band);
  const total = groups.reduce((sum, group) => sum + group.share, 0);
  let roll = rng() * total;
  for (const group of groups) {
    roll -= group.share;
    if (roll < 0) return group;
  }
  return groups[groups.length - 1];
}

/** The longest any motion's cycle runs, for a sighting to start anywhere in it. */
const LONGEST_CYCLE_MS = 10_000;

/**
 * What is out there on one look: a few near and a couple far, spread across the
 * whole width so panning finds them, each kind by its table's rates.
 */
export function rollSea(rng: () => number = Math.random): readonly SeaSighting[] {
  const bands: SeaBand[] = [
    ...Array.from({ length: SIGHTINGS_PER_LOOK.near }, () => 'near' as const),
    ...Array.from({ length: SIGHTINGS_PER_LOOK.far }, () => 'far' as const),
  ];
  // Each takes a lane of the width, the lanes dealt out at random so a far one
  // can be anywhere.
  const lanes = bands.map((_band, index) => index);
  for (let index = lanes.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [lanes[index], lanes[swap]] = [lanes[swap], lanes[index]];
  }
  // The glass opens on the middle of the sea, and something is always out there:
  // the first near one has the middle lane.
  const middle = Math.floor(bands.length / 2);
  const swapWith = lanes.indexOf(middle);
  [lanes[0], lanes[swapWith]] = [lanes[swapWith], lanes[0]];
  const laneWidth = PANORAMA.width / bands.length;
  return bands.map((band, index) => {
    const slot = pickSlot(pickGroup(band, rng).slots, rng);
    const species = getSpeciesById(slot.speciesId);
    return {
      id: index,
      speciesId: slot.speciesId,
      dexId: species?.dexId ?? 0,
      band,
      motion: SEA_MOTIONS[slot.speciesId] ?? 'drift',
      x: Math.round((lanes[index] + 0.2 + rng() * 0.6) * laneWidth),
      depth: band === 'near' ? 0.3 + rng() * 0.55 : 0.05 + rng() * 0.25,
      heading: rng() < 0.5 ? -1 : 1,
      phaseMs: Math.floor(rng() * LONGEST_CYCLE_MS),
    };
  });
}

/**
 * The water's line under a sighting: the near band from a little below the
 * horizon to the foot of the glass, the far a few pixels under the horizon,
 * closer together the further out, as water in perspective is.
 */
export function waterlineOf(band: SeaBand, depth: number): number {
  if (band === 'far') {
    return Math.round(PANORAMA.horizon + 2 + depth * 6);
  }
  const reach = PANORAMA.height - PANORAMA.horizon - 44;
  return Math.round(PANORAMA.horizon + 12 + depth ** 1.5 * reach);
}

/** A splash or a ring on the water, as far into it as `t` (0 to 1). */
export interface SeaSplash {
  readonly kind: 'ring' | 'splash';
  readonly t: number;
  /** How big, in panorama pixels across at its widest. */
  readonly size: number;
}

/** Where a sighting is and how much of it shows, at one moment of a look. */
export interface SeaPose {
  readonly x: number;
  readonly waterline: number;
  /** How far its body is lifted clear above the waterline, in panorama pixels. */
  readonly lift: number;
  /** How much of its body is out of the water, 0 (under) to 1 (all of it). */
  readonly shown: number;
  /** Whether it is drawn facing east (front sprites face west). */
  readonly flip: boolean;
  readonly splash: SeaSplash | null;
  /** A rock under it, for a kind that sits on one. */
  readonly rock: boolean;
  /** A wake behind it, for a kind swimming the surface. */
  readonly wake: boolean;
}

/** How far in from either end of the sea a swimmer turns back. */
export const SEA_EDGE = 24;

/**
 * Where something that set off from `x` has got to, `distance` on east (west if
 * less than nothing), turning back at either end of the sea rather than
 * vanishing off one end and coming in at the other; and which way it is going.
 */
export function travel(x: number, distance: number): { readonly x: number; readonly heading: 1 | -1 } {
  const low = SEA_EDGE;
  const span = PANORAMA.width - SEA_EDGE * 2;
  const along = (((x - low + distance) % (span * 2)) + span * 2) % (span * 2);
  return along <= span ? { x: low + along, heading: distance >= 0 ? 1 : -1 } : { x: low + span * 2 - along, heading: distance >= 0 ? -1 : 1 };
}

const wrap = (x: number): number => travel(x, 0).x;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** How far into its cycle a sighting is at `ms` into a look, and which time round. */
function cycle(sighting: SeaSighting, ms: number, length: number): { readonly at: number; readonly round: number } {
  const total = ms + sighting.phaseMs;
  return { at: total % length, round: Math.floor(total / length) };
}

/** Pixels in the band's own scale: a far one moves and leaps half as far. */
const bandPx = (sighting: SeaSighting, px: number): number => (sighting.band === 'far' ? px / 2 : px);

export const LEAP_CYCLE_MS = 4800;
export const BOB_CYCLE_MS = 8000;
export const BREACH_CYCLE_MS = 10_000;

/** Where `sighting` is at `ms` into a look. */
export function poseAt(sighting: SeaSighting, ms: number): SeaPose {
  const waterline = waterlineOf(sighting.band, sighting.depth);
  const still = {
    x: sighting.x,
    waterline,
    lift: 0,
    shown: 0,
    flip: sighting.heading > 0,
    splash: null,
    rock: false,
    wake: false,
  };
  switch (sighting.motion) {
    case 'drift': {
      const speed = bandPx(sighting, 6) / 1000;
      const bob = Math.sin((ms + sighting.phaseMs) / 700) * 0.04;
      const swum = travel(sighting.x, sighting.heading * speed * ms);
      return { ...still, x: swum.x, flip: swum.heading > 0, shown: 0.5 + bob, wake: true };
    }
    case 'leap': {
      const { at, round } = cycle(sighting, ms, LEAP_CYCLE_MS);
      // Each leap carries it on a little: where it went in is where the next ring is.
      const went = travel(sighting.x, sighting.heading * bandPx(sighting, 10) * round);
      const x = went.x;
      if (at < 400) {
        return { ...still, x, splash: { kind: 'splash', t: at / 400, size: bandPx(sighting, 12) } };
      }
      if (at < 3600) {
        const ring = at >= 3000 ? { kind: 'ring' as const, t: (at - 3000) / 600, size: bandPx(sighting, 10) } : null;
        return { ...still, x, splash: ring };
      }
      const p = (at - 3600) / 1200;
      const leap = travel(x, went.heading * bandPx(sighting, 10) * p);
      return {
        ...still,
        x: leap.x,
        flip: leap.heading > 0,
        lift: Math.round(Math.sin(Math.PI * p) * bandPx(sighting, 16)),
        shown: clamp01(Math.min(p, 1 - p) * 5),
      };
    }
    case 'bob': {
      const { at, round } = cycle(sighting, ms, BOB_CYCLE_MS);
      const side = round % 2 === 0 ? 0 : bandPx(sighting, 10) * sighting.heading;
      const up = 0.55 + Math.sin(at / 500) * 0.05;
      const x = wrap(sighting.x + side);
      if (at < 6000) return { ...still, x, shown: up };
      if (at < 6400) return { ...still, x, shown: up * (1 - (at - 6000) / 400) };
      // Under, and up again on the other side of where it went down.
      const nextX = wrap(sighting.x + (round % 2 === 0 ? bandPx(sighting, 10) * sighting.heading : 0));
      if (at < 7600) {
        const ring = at < 6800 ? { kind: 'ring' as const, t: (at - 6400) / 400, size: bandPx(sighting, 8) } : null;
        return { ...still, x, splash: ring };
      }
      return { ...still, x: nextX, shown: 0.55 * ((at - 7600) / 400) };
    }
    case 'breach': {
      const { at } = cycle(sighting, ms, BREACH_CYCLE_MS);
      if (at < 600) return { ...still, splash: { kind: 'splash', t: at / 600, size: bandPx(sighting, 22) } };
      if (at < 7000) {
        const ring = at >= 6200 ? { kind: 'ring' as const, t: (at - 6200) / 800, size: bandPx(sighting, 18) } : null;
        return { ...still, splash: ring };
      }
      if (at < 7800) {
        const p = (at - 7000) / 800;
        return { ...still, shown: p, lift: Math.round(p * bandPx(sighting, 6)) };
      }
      if (at < 9200) {
        return { ...still, shown: 1, lift: bandPx(sighting, 6) + Math.round(Math.sin((at - 7800) / 220) * 1) };
      }
      const p = (at - 9200) / 800;
      return { ...still, shown: 1 - p, lift: Math.round((1 - p) * bandPx(sighting, 6)) };
    }
    case 'perch': {
      const step = Math.round(Math.sin((ms + sighting.phaseMs) / 900) * bandPx(sighting, 3));
      return { ...still, x: wrap(sighting.x + step), shown: 1, lift: bandPx(sighting, 3), rock: true, flip: step > 0 };
    }
    default:
      return still;
  }
}

/** Whether the glass at `zoom` can make out a sighting at all, and whether it is close enough to count. */
export function showsAt(band: SeaBand, zoom: number): boolean {
  return band === 'near' || zoom >= FAR_SHOWS_FROM_ZOOM;
}

export function closeEnoughAt(band: SeaBand, zoom: number): boolean {
  return zoom >= BAND_ZOOM[band];
}

/**
 * How long a sighting has been held in the glass: on while it is in the
 * middle, close enough and out of the water, and running back down twice as
 * fast while it is not, so a near miss is not lost at once.
 */
export function heldFor(previousMs: number, inSights: boolean, deltaMs: number): number {
  return inSights ? previousMs + deltaMs : Math.max(0, previousMs - deltaMs * 2);
}

/** The next zoom in from `zoom` (Z wraps round to the whole sea), or out (`by` -1, the wheel). */
export function nextZoom(zoom: TelescopeZoom, by: 1 | -1, wrapRound: boolean): TelescopeZoom {
  const index = ZOOM_STEPS.indexOf(zoom);
  const next = index + by;
  if (next >= ZOOM_STEPS.length) return wrapRound ? ZOOM_STEPS[0] : zoom;
  if (next < 0) return zoom;
  return ZOOM_STEPS[next];
}

/**
 * The camera's way down to the player and round behind them, `share` of the
 * way (0 the harbour as it is, 1 at the player's back): it comes in close as
 * it turns, the turn finishing a little after the zoom so it reads as coming
 * down and then round. `turn` is how far round behind them is, in radians.
 */
export const SWOOP_MS = 1100;
export const SWOOP_ZOOM = 4;

export function swoopAt(share: number, turn: number): { readonly zoom: number; readonly rotation: number } {
  const t = clamp01(share);
  const down = 1 - (1 - clamp01(t / 0.75)) ** 3;
  const round = clamp01((t - 0.15) / 0.85);
  const easedRound = round * round * (3 - 2 * round);
  return { zoom: 1 + (SWOOP_ZOOM - 1) * down, rotation: turn * easedRound };
}

/** How far round the camera comes to stand behind somebody facing `facing`, so where they face is up the screen. */
export function turnBehind(facing: 'up' | 'down' | 'left' | 'right'): number {
  switch (facing) {
    case 'down':
      return Math.PI;
    case 'left':
      return Math.PI / 2;
    case 'right':
      return -Math.PI / 2;
    default:
      return 0;
  }
}

/** The shot behind the player's head: the cut in, a beat, then the push to the eyepiece. */
export const BEHIND_IN_MS = 260;
export const BEHIND_HOLD_MS = 320;
export const BEHIND_PUSH_MS = 760;
/** How far the push goes in on the eyepiece. */
export const BEHIND_PUSH_ZOOM = 5;
/** The round of the glass opening and closing. */
export const LENS_IRIS_MS = 300;
/** The camera's way back up, once the eye leaves the glass. */
export const SWOOP_BACK_MS = 900;
