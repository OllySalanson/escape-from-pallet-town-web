import { STEP_DURATION_MS } from '../movement/stepClock';
import { CHARACTER_HEAD_PIXEL_Y } from '../playerFrames';
import type { MapFileAreaKind } from './mapFile';

/**
 * The Bicycle: FireRed's own, ridden in a raid.
 *
 * It is the rarest thing a raid can carry - a find at long odds on two maps,
 * or the dearest deal on Bill's table - and it is a bet. Riding doubles how
 * fast the player covers ground, which in a game whose currency is the raid
 * clock is the biggest single thing a raid can be given; and it is three
 * squares by two in the pack (`items.ts`), the only thing in the catalogue
 * wider than two, so it is a third of a Raid pack, half a Satchel, and wider
 * than the secure container every save starts with. Carried, it crowds out
 * the haul; lost on a wipe, it is gone like anything else in the pack.
 *
 * What it does not change is any price a *step* pays. A ridden tile is one
 * step exactly as a walked one is: the hunter is step-locked and takes its one
 * step for it, tall grass rolls once for it, a trainer's watch is crossed by
 * it, the survey lights the same disc. The raid clock is charged for time, as
 * it always has been, so a tile ridden costs half the clock of a tile walked -
 * which is the whole of what the Bicycle buys - and the hunter's idle step,
 * which only counts time stood still, never sees a rider at all.
 *
 * FireRed's own `DoWildEncounterRateTest` takes the encounter rate down to
 * 80% on a bike. That is deliberately not followed: a roll is the price of a
 * step here, and the clock and the hunter are already balanced on it.
 */

/** The item id, so nothing types the string twice. */
export const BICYCLE_ITEM_ID = 'bicycle';

/** How many times faster a ridden tile is than a walked one. */
export const BIKE_SPEED = 2;

/** One ridden tile, in game time. */
export const BIKE_STEP_DURATION_MS = STEP_DURATION_MS / BIKE_SPEED;

/** The texture the ridden figure is drawn from (`public/assets/player-bike.png`). */
export const BIKE_TEXTURE = 'player-bike';
export const BIKE_ASSET_PATH = 'assets/player-bike.png';

/**
 * The ridden frames are 32 pixels square, because a bicycle side on is two
 * tiles long; the sheet is laid out as the walking designs are, four columns.
 */
export const BIKE_FRAME_SIZE = 32;
export const BIKE_SHEET_COLUMNS = 4;

/**
 * Where a 32-wide frame is anchored so it stands centred on its 16-wide tile:
 * a quarter of the way in. The rows already match - the cut lifts the wheels
 * onto the walkers' sole line (`scripts/cut-frlg-bicycle.mjs`).
 */
export const BIKE_ORIGIN_X = (BIKE_FRAME_SIZE - 16) / 2 / BIKE_FRAME_SIZE;

/**
 * How much lower the rider's head is than a walker's, so the player's head
 * chevron sits on the rider as it sits on the walker: the hair starts on row 7
 * of the ridden frame facing down, against row 5 on foot.
 */
export const BIKE_HEAD_DROP = 7 - CHARACTER_HEAD_PIXEL_Y;

/** The pedalling cycle runs twice the walk's ten frames a second, for twice the pace. */
export const BIKE_FRAME_RATE = 10 * BIKE_SPEED;

/** Where the player is, as far as riding cares: out of doors, or one kind of inside. */
export type RidePlace = 'outdoors' | MapFileAreaKind;

/**
 * Whether the Bicycle may be ridden here: FireRed's `allow_cycling`, which
 * every route and town has, and every cave and tunnel too - Mt. Moon, Rock
 * Tunnel and the Underground Path all allow it - while every house, shop and
 * gatehouse does not. A map maker's inside of kind `inside`, and every room a
 * shipped building has, is the one place that is no. Tall grass is ridden
 * through in FireRed (its long grass, which forbids it, is Hoenn's and has no
 * Kanto tile), so it is here too.
 */
export function mayRideIn(place: RidePlace): boolean {
  return place !== 'inside';
}

/**
 * FireRed's own words for the bag: the Bicycle's action reads USE on foot and
 * WALK once ridden (`gOtherText_Use`, `gOtherText_Walk` in `src/strings.c`),
 * and Professor Oak's refusal where it may not be used
 * (`gText_OakForbidsUseOfItemHere`), less the player's name, which this game
 * does not ask for.
 */
export const BIKE_WORDS = {
  use: 'USE',
  walk: 'WALK',
  notHere: "OAK: This isn't the time to use that!",
} as const;

/** What pressing the Bicycle in the pack comes to. */
export type BikeToggle =
  | { readonly kind: 'mount' }
  | { readonly kind: 'dismount' }
  | { readonly kind: 'refused'; readonly message: string };

export interface RideState {
  /** Whether the player is riding now. */
  readonly riding: boolean;
  /** Whether a Bicycle is in the pack. */
  readonly carried: boolean;
  readonly place: RidePlace;
}

/**
 * The pack's USE or WALK on the Bicycle. Getting off is always allowed - this
 * game has no Cycling Road to forbid it - and getting on is FireRed's rule.
 */
export function toggleBike(state: RideState): BikeToggle {
  if (state.riding) {
    return { kind: 'dismount' };
  }
  if (!state.carried) {
    return { kind: 'refused', message: 'There is no Bicycle in the pack.' };
  }
  if (!mayRideIn(state.place)) {
    return { kind: 'refused', message: BIKE_WORDS.notHere };
  }
  return { kind: 'mount' };
}

/**
 * Whether a rider stays on. Going through a door into a room puts the player
 * on foot, as a FireRed warp into a map with no cycling does, and they stay
 * on foot when they come out; and a Bicycle that has left the pack - dropped
 * to make room for a catch, put down on the pack screen - is not ridden.
 */
export function stillRiding(state: RideState): boolean {
  return state.riding && state.carried && mayRideIn(state.place);
}

/** The action the pack offers on the Bicycle, in FireRed's word for it. */
export function bikeAction(riding: boolean): string {
  return riding ? BIKE_WORDS.walk : BIKE_WORDS.use;
}

/**
 * What a step takes in game time: a walked tile, a ridden one, or - in an
 * explorer run only - the held-shift run, whichever is quickest.
 */
export function stepDurationFor(riding: boolean, runDivisor: number | null): number {
  const pace = riding ? BIKE_SPEED : 1;
  return STEP_DURATION_MS / Math.max(pace, runDivisor ?? 1);
}
