/**
 * How strongly the screen's edges glow red because the hunter is on the
 * player's tail - a pure function of time, so the rule is tested without
 * Phaser and `ui/HunterEdgeGlow.ts` only draws the number it is handed.
 *
 * Why a glow and not a box. The hunter used to arrive with its rival's line in
 * a dialogue box, which stopped the player dead at the one moment they most
 * want to be moving, and could land over a crate they were halfway through
 * searching (the captain, 2026-10-29: "some sort of subtle red flash that
 * indicates to you that there is a hunter on your tail, even if you're
 * searching a crate"). The glow says the same thing without taking a key or a
 * frame from anybody: it sits at the screen's edges, never over the middle
 * where the player and the action are, and it rides over a search panel as it
 * rides over the map.
 *
 * Two parts. **The arrival** is three quick pulses as the hunter comes on to
 * the map (the arrival sting plays with the first). **The trail** is a slow
 * heartbeat for as long as the hunter is close and still hunting, stronger the
 * closer it is - the same distance the hunter chip appears at, so the chip and
 * the glow agree about when there is something to look at. A hunter that has
 * lost the player (the flee window) or that is off the scent under a roof does
 * not glow: the edges going quiet is how the player knows the getaway worked.
 *
 * **Reduced motion** gets a border that does not flash: the same edges held
 * steady while the warning is true, at a strength that steps with distance
 * rather than beating.
 */

/** One pulse of the arrival, up and back down. */
export const HUNTER_WARNING_PULSE_MS = 600;
/** How many pulses the arrival is. */
export const HUNTER_WARNING_ARRIVAL_PULSES = 3;
/** How long the arrival lasts. */
export const HUNTER_WARNING_ARRIVAL_MS = HUNTER_WARNING_PULSE_MS * HUNTER_WARNING_ARRIVAL_PULSES;
/** One beat of the trail: a pulse, then a rest as long again and a bit. */
export const HUNTER_WARNING_HEARTBEAT_MS = 1_400;
/** Steps at which the trail starts to glow; the hunter chip's own distance. */
export const HUNTER_WARNING_DISTANCE = 8;
/** The trail's strength with the hunter at the far edge of that distance, and beside you. */
export const HUNTER_WARNING_TRAIL_FAINTEST = 0.3;
export const HUNTER_WARNING_TRAIL_STRONGEST = 0.75;

export interface HunterWarningInput {
  /** The time now, on the same clock as `arrivedAtMs`. */
  readonly nowMs: number;
  /** When the hunter last came on to the map (or came back for the enrage), or null. */
  readonly arrivedAtMs: number | null;
  /** Walking steps to the hunter, or null when it is not on this map. */
  readonly stepsAway: number | null;
  /** True while the hunter has lost the player: the flee window, or off the scent under a roof. */
  readonly lostYou: boolean;
  readonly reducedMotion: boolean;
}

/** 0 to 1 and back to 0 across one pulse, a triangle so every frame is a whole step of it. */
function pulse(phaseMs: number): number {
  const half = HUNTER_WARNING_PULSE_MS / 2;
  const at = ((phaseMs % HUNTER_WARNING_PULSE_MS) + HUNTER_WARNING_PULSE_MS) % HUNTER_WARNING_PULSE_MS;
  return at < half ? at / half : (HUNTER_WARNING_PULSE_MS - at) / half;
}

/** How strong the trail is at `stepsAway`, or 0 when the hunter is not close. */
export function trailStrength(stepsAway: number | null): number {
  if (stepsAway === null || stepsAway > HUNTER_WARNING_DISTANCE) {
    return 0;
  }
  const closeness = 1 - (Math.max(1, stepsAway) - 1) / (HUNTER_WARNING_DISTANCE - 1);
  return HUNTER_WARNING_TRAIL_FAINTEST + (HUNTER_WARNING_TRAIL_STRONGEST - HUNTER_WARNING_TRAIL_FAINTEST) * closeness;
}

/** How strongly the edges glow now, 0 (not at all) to 1. */
export function hunterWarningStrength(input: HunterWarningInput): number {
  const sinceArrival = input.arrivedAtMs === null ? null : input.nowMs - input.arrivedAtMs;
  const arriving = sinceArrival !== null && sinceArrival >= 0 && sinceArrival < HUNTER_WARNING_ARRIVAL_MS;
  const trail = input.lostYou ? 0 : trailStrength(input.stepsAway);

  if (input.reducedMotion) {
    // Held, never beating: the arrival is the strong border for as long as its
    // pulses would have run, and the trail the border its distance gives.
    return Math.max(arriving ? 1 : 0, trail);
  }
  const arrival = arriving ? pulse(sinceArrival) : 0;
  const beat = (((input.nowMs % HUNTER_WARNING_HEARTBEAT_MS) + HUNTER_WARNING_HEARTBEAT_MS) % HUNTER_WARNING_HEARTBEAT_MS);
  const heartbeat = beat < HUNTER_WARNING_PULSE_MS ? trail * pulse(beat) : 0;
  return Math.max(arrival, heartbeat);
}

/**
 * The glow's bands from the screen's edge inwards: each `HUNTER_GLOW_BAND_PX`
 * game pixels wide and fading, so the edge reads as a soft red rim in whole
 * pixels rather than a line across the map. Multiplied by the strength.
 */
export const HUNTER_GLOW_BAND_PX = 2;
export const HUNTER_GLOW_BAND_ALPHAS: readonly number[] = [0.75, 0.5, 0.28, 0.12];
/** How far into the screen the glow ever reaches, in game pixels. */
export const HUNTER_GLOW_DEPTH_PX = HUNTER_GLOW_BAND_PX * HUNTER_GLOW_BAND_ALPHAS.length;
