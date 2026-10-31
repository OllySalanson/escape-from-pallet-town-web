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

/** How long after the player the partner is down, how long it takes to come down, and its bounce. */
const PARTNER_LAG_MS = 130;
const PARTNER_FALL_MS = 260;
const PARTNER_BOUNCE_MS = 170;
const PARTNER_BOUNCE_HEIGHT = 7;

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

export function arrivalPose(elapsedMs: number): ArrivalPose {
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
    crouch: sinceLanding === null || sinceLanding >= CROUCH_MS ? 0 : sinceLanding < CROUCH_MS * 0.6 ? CROUCH_DEPTH : 1,
    partnerHeight:
      partnerFall < 1
        ? Math.round(ARRIVAL_FALL_HEIGHT * (1 - partnerFall * partnerFall))
        : bouncing
          ? Math.round(Math.sin((sincePartnerDown / PARTNER_BOUNCE_MS) * Math.PI) * PARTNER_BOUNCE_HEIGHT)
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
export function dustAt(sinceLanding: number): readonly DustPuff[] {
  if (sinceLanding < 0 || sinceLanding >= DUST_MS) {
    return [];
  }
  const share = sinceLanding / DUST_MS;
  const out = 1 - (1 - share) * (1 - share);
  const size = share < 0.4 ? 3 : share < 0.75 ? 2 : 1;
  return Array.from({ length: DUST_PUFFS }, (_each, index) => {
    const angle = (index / DUST_PUFFS) * Math.PI * 2 + (index % 2) * 0.17;
    const reach = index % 3 === 0 ? 0.82 : 1;
    return {
      x: Math.round(Math.cos(angle) * DUST_REACH_ACROSS * out * reach),
      y: Math.round(Math.sin(angle) * DUST_REACH_UP * out * reach),
      size,
      light: index % 2 === 0,
    };
  });
}
