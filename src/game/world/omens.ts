import type { GridPosition } from '../movement/gridMovement';
import type { SeededRng } from '../run/rng';
import type { WorldMapId } from '../worldMap';

/**
 * **Omens: one raid in three, a legend's shadow crosses the sky.**
 *
 * Greystone Vale stands FireRed's three birds, each at the far end of the
 * hardest walk on the map - Articuno past Frostreef's ice, Zapdos in the
 * turbine hall, Moltres in Ember Isle's crater - and until now a save learned
 * that any of them was there only by getting there. A player who never took
 * the boat never knew what the boat was for.
 *
 * So on one raid in three, while a bird is still uncaught, it is abroad: some
 * way into the raid its shadow crosses the screen with its cry, flying for
 * home, and from then on Oak's full list says which way it went and where
 * they say it roosts. Nothing else changes - it is not there to be fought on
 * the way, its fight is no easier, and the place it roosts is as hard to reach
 * as it was. An omen is the map saying where its best things are, to somebody
 * who has not been.
 *
 * Which raid, which bird and when are rolled on a stream of their own
 * (`OMEN_STREAM` in `runGeneration.ts`), three rolls whatever they come to,
 * so no other roll of any raid moves. Never on a new save's first raid, whose
 * first five minutes are spoken for (`hub/firstRaid.ts`), and never a bird
 * the Pokedex owns: it has come home.
 */

/** The maps an omen crosses: the ones whose roosts `OMEN_ROOSTS` names. */
const MAPS_WITH_OMENS: readonly WorldMapId[] = ['greystone-vale'];

export const hasOmens = (mapId: WorldMapId): boolean => MAPS_WITH_OMENS.includes(mapId);

/** FireRed's three birds, in Pokedex order. */
export const OMEN_BIRDS = ['articuno', 'zapdos', 'moltres'] as const;
export type OmenBird = (typeof OMEN_BIRDS)[number];

/** Where each roosts on the vale: the district it flies for, and the place as Oak says it. */
export const OMEN_ROOSTS: Readonly<Record<OmenBird, { readonly district: string; readonly roost: string }>> = {
  articuno: { district: 'FROSTREEF', roost: 'THE FROZEN LAGOON on FROSTREEF' },
  zapdos: { district: 'THE POWER STATION', roost: 'the TURBINE HALL at THE POWER STATION' },
  moltres: { district: 'EMBER ISLE', roost: 'THE CRATER on EMBER ISLE' },
};

/** One raid in this many has an omen, while a bird is still uncaught. */
export const OMEN_EVERY = 3;
/**
 * When it crosses, in milliseconds of the raid's own clock: after the landing
 * has been looked at, and well inside the shortest raid a heal can leave
 * (half the clock, `MAX_PENDING_RECOVERY_MS`).
 */
export const OMEN_EARLIEST_MS = 20_000;
export const OMEN_LATEST_MS = 90_000;
/** How long the shadow takes to cross the screen. */
export const OMEN_CROSSING_MS = 3_200;

/** This raid's omen: which bird is abroad, and when it crosses. */
export interface Omen {
  readonly speciesId: OmenBird;
  readonly atMs: number;
}

export function isOmenBird(speciesId: string): speciesId is OmenBird {
  return (OMEN_BIRDS as readonly string[]).includes(speciesId);
}

/**
 * This raid's omen, if it has one. Three rolls are always spent - whether,
 * when, and which bird - so a seed plays the same raid whatever the Pokedex
 * owns; `caught` is the legends this save has caught (`caughtLegends`).
 */
export function layOmen(caught: readonly string[], rng: Pick<SeededRng, 'int'>): Omen | undefined {
  const comes = rng.int(1, OMEN_EVERY) === 1;
  const atMs = rng.int(OMEN_EARLIEST_MS, OMEN_LATEST_MS);
  const pick = rng.int(0, 0xffff);
  const abroad = OMEN_BIRDS.filter((bird) => !caught.includes(bird));
  return comes && abroad.length > 0 ? { speciesId: abroad[pick % abroad.length], atMs } : undefined;
}

/**
 * Where the shadow is, `ms` into its crossing of a screen `width` by `height`
 * pixels, flying the way `heading` points (a tile offset from the player to
 * the roost; only its direction is read): in from beyond one edge, through
 * the middle of the screen, and out past the other. Pixels from the screen's
 * top-left corner; null before it sets off and once it has gone.
 */
export function omenShadowAt(
  ms: number,
  width: number,
  height: number,
  heading: GridPosition,
  crossingMs = OMEN_CROSSING_MS,
): { readonly x: number; readonly y: number } | null {
  if (ms < 0 || ms > crossingMs) {
    return null;
  }
  const length = Math.hypot(heading.x, heading.y);
  // A roost right overhead is flown to the east: a shadow has to cross something.
  const along = length === 0 ? { x: 1, y: 0 } : { x: heading.x / length, y: heading.y / length };
  // Far enough either side of the middle that it starts and ends off the screen whatever the heading.
  const reach = Math.hypot(width, height) / 2 + OMEN_SHADOW_PIXELS;
  const t = ms / crossingMs;
  return {
    x: Math.round(width / 2 + along.x * reach * (2 * t - 1)),
    y: Math.round(height / 2 + along.y * reach * (2 * t - 1)),
  };
}

/** How big the shadow is drawn, in pixels: a bird's 64-pixel picture, two and a half times over. */
export const OMEN_SHADOW_SCALE = 2.5;
export const OMEN_SHADOW_PIXELS = 64 * OMEN_SHADOW_SCALE;

/**
 * What Oak's full list says once the shadow has crossed, for the rest of the
 * raid: which way it went, what it was, and where they say it roosts.
 * `towards` is the compass word for the way to the roost from where the
 * player stands ("north-east"), or nothing when they are standing under it.
 */
export function omenLine(omen: Omen, towards: string | undefined): string {
  const went = towards ? `heading ${towards}` : 'and came down close by';
  return `A great shadow crossed the vale, ${went}. That cry was ${omen.speciesId.toUpperCase()}. They say it roosts in ${OMEN_ROOSTS[omen.speciesId].roost}.`;
}
