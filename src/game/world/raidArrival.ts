/**
 * Landing in a raid from THE RAID ARENA's pit, as a pure function of the time
 * since the raid opened: under the same cloud the jump came down through
 * (`base/arenaDive.ts`), which clears first, so what comes next is seen - the
 * player dropping in from the top of the screen on to the tile the raid starts
 * from, a thump, a ring of dust, and their partner a moment after with a bounce.
 * It moves nobody: the figure's tile is the landing from the first frame, this is
 * only where it is drawn. The world spends this time on itself, so the raid clock
 * is not charged for it. Nobody on the map turns or marks it: a "!" is the
 * language of being hunted, and this is not that.
 *
 * A ring closes on the tile as the ground comes up, and the interact key pressed
 * as it shuts sticks the landing. That is all it does: it buys no step and no
 * second of the raid, and a miss, or never pressing, is a landing like any other.
 */

/** How long the cloud takes to clear. */
export const ARRIVAL_CLOUD_MS = 420;
/** When the figure starts to fall, how long it takes, and how far above the tile it starts. */
export const ARRIVAL_FALL_FROM_MS = 300;
export const ARRIVAL_FALL_MS = 340;
export const ARRIVAL_FALL_HEIGHT = 150;
/** How long it stays down on landing before the raid is the player's. */
export const ARRIVAL_SETTLE_MS = 320;
export const ARRIVAL_MS = ARRIVAL_FALL_FROM_MS + ARRIVAL_FALL_MS + ARRIVAL_SETTLE_MS;
/** When the figure touches down. */
export const TOUCH_DOWN_MS = ARRIVAL_FALL_FROM_MS + ARRIVAL_FALL_MS;

/** When the ring shows, how wide it starts and ends, and how long either side of touching down counts as clean. */
const RING_FROM_MS = 100;
const RING_WIDEST = 42;
const RING_NARROWEST = 7;
const CLEAN_EARLY_MS = 120;
const CLEAN_LATE_MS = 90;

/** Whether the key pressed at this moment sticks the landing. A figure gets one press. */
export function isCleanLanding(pressedAtMs: number): boolean {
  return pressedAtMs >= TOUCH_DOWN_MS - CLEAN_EARLY_MS && pressedAtMs <= TOUCH_DOWN_MS + CLEAN_LATE_MS;
}

export interface LandingRing {
  /** How wide it is across, in whole pixels; it is flattened by this game's slant as the dust is. */
  readonly across: number;
  /** Whether a press now would stick it. */
  readonly ripe: boolean;
}

/** The ring closing on the tile, or null when it is not showing. */
export function landingRing(elapsedMs: number): LandingRing | null {
  if (elapsedMs < RING_FROM_MS || elapsedMs > TOUCH_DOWN_MS) {
    return null;
  }
  const closed = (elapsedMs - RING_FROM_MS) / (TOUCH_DOWN_MS - RING_FROM_MS);
  return {
    across: Math.round(RING_WIDEST + (RING_NARROWEST - RING_WIDEST) * closed),
    ripe: isCleanLanding(elapsedMs),
  };
}

/** How many raids the ring's key is named for, to somebody who has never stuck a landing. */
const RING_KEY_NAMED_FOR_RAIDS = 5;

/** Whether the ring says which key it wants: it is pride, not a chore to be nagged about for ever. */
export function ringNamesItsKey(raidsDeployed: number, bestLandingRun: number): boolean {
  return bestLandingRun === 0 && raidsDeployed <= RING_KEY_NAMED_FOR_RAIDS;
}

/** What the board says of a clean landing. */
export function cleanLandingLine(streak: number): string {
  return streak >= 2 ? `CLEAN LANDING x${streak}` : 'CLEAN LANDING';
}

/** How long after the player the partner is down, how long it takes to come down, and its bounce. */
const PARTNER_LAG_MS = 130;
const PARTNER_FALL_MS = 260;
const PARTNER_BOUNCE_MS = 170;
const PARTNER_BOUNCE_HEIGHT = 7;
/** How much higher the partner bounces for a clean one, and how much further the dust goes. */
const CLEAN_BOUNCE = 1.7;
const CLEAN_DUST = 1.45;

/** How long the player stays crouched from the impact, and how far down that is, in whole pixels. */
const CROUCH_MS = 170;
const CROUCH_DEPTH = 2;

export interface ArrivalPose {
  /** How far above its tile the figure is drawn. */
  readonly height: number;
  /** How much of the cloud is left, 0 to 1, in the whole steps a GBA's blend has. */
  readonly cloud: number;
  /** Whether it has touched down. */
  readonly landed: boolean;
  /** How far below its place the figure is drawn, taking the impact in its knees. */
  readonly crouch: number;
  /** How far above its own tile the partner is drawn, bouncing as it lands. */
  readonly partnerHeight: number;
  /** Whether the partner has touched down yet. */
  readonly partnerLanded: boolean;
  /** How long since the player touched down, or null if they have not. */
  readonly sinceLanding: number | null;
}

export function arrivalPose(elapsedMs: number, clean = false): ArrivalPose {
  const fall = Math.max(0, Math.min(1, (elapsedMs - ARRIVAL_FALL_FROM_MS) / ARRIVAL_FALL_MS));
  const cleared = Math.max(0, Math.min(1, elapsedMs / ARRIVAL_CLOUD_MS));
  const landed = fall >= 1;
  const sinceLanding = landed ? elapsedMs - ARRIVAL_FALL_FROM_MS - ARRIVAL_FALL_MS : null;
  const partnerFrom = ARRIVAL_FALL_FROM_MS + ARRIVAL_FALL_MS + PARTNER_LAG_MS - PARTNER_FALL_MS;
  const partnerFall = Math.max(0, Math.min(1, (elapsedMs - partnerFrom) / PARTNER_FALL_MS));
  const sincePartnerDown = elapsedMs - partnerFrom - PARTNER_FALL_MS;
  const bouncing = sincePartnerDown >= 0 && sincePartnerDown < PARTNER_BOUNCE_MS;
  return {
    height: Math.round(ARRIVAL_FALL_HEIGHT * (1 - fall * fall)),
    cloud: Math.ceil((1 - cleared) * 6) / 6,
    landed,
    // A stuck landing is taken standing.
    crouch: clean || sinceLanding === null || sinceLanding >= CROUCH_MS ? 0 : sinceLanding < CROUCH_MS * 0.6 ? CROUCH_DEPTH : 1,
    partnerHeight:
      partnerFall < 1
        ? Math.round(ARRIVAL_FALL_HEIGHT * (1 - partnerFall * partnerFall))
        : bouncing
          ? Math.round(Math.sin((sincePartnerDown / PARTNER_BOUNCE_MS) * Math.PI) * PARTNER_BOUNCE_HEIGHT * (clean ? CLEAN_BOUNCE : 1))
          : 0,
    partnerLanded: partnerFall >= 1,
    sinceLanding,
  };
}

/** How long the dust from a landing hangs, how many puffs, and how far they go. */
export const DUST_MS = 320;
const DUST_PUFFS = 14;
const DUST_REACH_ACROSS = 30;
const DUST_REACH_UP = 13;

export interface DustPuff {
  /** From where the figure touched down, in whole pixels. */
  readonly x: number;
  readonly y: number;
  /** A square of this many pixels: it thins as it goes rather than fading. */
  readonly size: number;
  /** Whether it is one of the lighter ones. */
  readonly light: boolean;
}

/** The ring of dust thrown out by a landing, flattened by this game's slant. Nothing once it has settled. */
export function dustAt(sinceLanding: number, clean = false): readonly DustPuff[] {
  if (sinceLanding < 0 || sinceLanding >= DUST_MS) {
    return [];
  }
  const share = sinceLanding / DUST_MS;
  const out = 1 - (1 - share) * (1 - share);
  const size = share < 0.4 ? 3 : share < 0.75 ? 2 : 1;
  return Array.from({ length: DUST_PUFFS }, (_each, index) => {
    const angle = (index / DUST_PUFFS) * Math.PI * 2 + (index % 2) * 0.17;
    const reach = (index % 3 === 0 ? 0.82 : 1) * (clean ? CLEAN_DUST : 1);
    return {
      x: Math.round(Math.cos(angle) * DUST_REACH_ACROSS * out * reach),
      y: Math.round(Math.sin(angle) * DUST_REACH_UP * out * reach),
      size,
      light: index % 2 === 0,
    };
  });
}
