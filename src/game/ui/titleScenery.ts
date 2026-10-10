/**
 * What moves on the title screen, as data and pure functions of the clock.
 *
 * The title is the living version of the front page's banner
 * (`docs/readme/hero.svg`, drawn by `tools/readme/drawArt.mjs`): Viridian City
 * drifting by at dusk, a sky's worth of sparkles over it, and every so often a
 * trainer legging it across the bottom of the screen with their partner at
 * their heel and Blue a few steps behind. Everything here answers in whole
 * pixels, because the screen is drawn one game pixel to the pixel and anything
 * that lands between two is drawn soft.
 *
 * Nothing in here touches Phaser, so the rules - the drift stays on the town,
 * the chase leaves the screen before it comes back, the shine only ever lights
 * the letters - are held by `titleScenery.test.ts` rather than eyeballed.
 */

/**
 * The town behind the title: a band of Viridian City from its ponds and rock
 * down past the gym to the main street, which runs along the foot of the band
 * so the chase has a road to run on.
 */
export const TITLE_TOWN = {
  map: 'viridian-city',
  /** First tile row of the band, and how many rows it is. 17 rows is 272 pixels, taller than any stage. */
  top: 17,
  rows: 17,
} as const;

/** One pixel of drift every this many milliseconds: 752 pixels of town in about 48 seconds, as the banner drifts. */
export const DRIFT_MS_PER_PIXEL = 64;

/**
 * How far the town has drifted, in whole pixels, out of `span` (the band's
 * width less the screen's). It walks one way and back, a pixel at a time, and
 * starts `start` pixels in so the first thing seen is the middle of town
 * rather than the forest at its edge.
 */
export function townDrift(timeMs: number, span: number, start = 0): number {
  if (span <= 0) {
    return 0;
  }
  const lap = span * 2;
  const step = (Math.floor(Math.max(0, timeMs) / DRIFT_MS_PER_PIXEL) + Math.round(start)) % lap;
  return step <= span ? step : lap - step;
}

export interface DuskBand {
  readonly y: number;
  readonly height: number;
  readonly alpha: number;
}

/** Dusk over the town, read off the banner's own gradient: heavy at the top, lightest just below the middle, settling again at the foot. */
const DUSK_STOPS = [
  [0, 0.7],
  [0.4, 0.4],
  [0.62, 0.32],
  [1, 0.58],
] as const;
/** Each band is this tall, and its alpha is held to steps of a sixtieth, so the dusk is a stepped pixel-art gradient rather than a smooth one. */
export const DUSK_BAND_HEIGHT = 2;

export function duskAlphaAt(fraction: number): number {
  const at = Math.max(0, Math.min(1, fraction));
  for (let index = 1; index < DUSK_STOPS.length; index += 1) {
    const [toAt, toAlpha] = DUSK_STOPS[index];
    const [fromAt, fromAlpha] = DUSK_STOPS[index - 1];
    if (at <= toAt) {
      const t = (at - fromAt) / (toAt - fromAt);
      return Math.round((fromAlpha + (toAlpha - fromAlpha) * t) * 60) / 60;
    }
  }
  return DUSK_STOPS[DUSK_STOPS.length - 1][1];
}

/** The dusk as bands across the whole screen, top to bottom, with no gap and no overlap. */
export function duskBands(height: number): DuskBand[] {
  const bands: DuskBand[] = [];
  for (let y = 0; y < height; y += DUSK_BAND_HEIGHT) {
    const bandHeight = Math.min(DUSK_BAND_HEIGHT, height - y);
    bands.push({ y, height: bandHeight, alpha: duskAlphaAt((y + bandHeight / 2) / height) });
  }
  return bands;
}

/**
 * The dusk also gathers at the two sides, so the eye is drawn in to the name
 * and the menu: this much more alpha at the very edge, falling to none
 * `VIGNETTE_REACH` pixels in, in the same stepped bands.
 */
export const VIGNETTE_EDGE_ALPHA = 0.4;
export const VIGNETTE_REACH = 72;

export interface VignetteBand {
  /** Pixels in from the edge. */
  readonly inset: number;
  readonly width: number;
  readonly alpha: number;
}

export function vignetteBands(): VignetteBand[] {
  const bands: VignetteBand[] = [];
  for (let inset = 0; inset < VIGNETTE_REACH; inset += DUSK_BAND_HEIGHT) {
    const t = 1 - (inset + DUSK_BAND_HEIGHT / 2) / VIGNETTE_REACH;
    bands.push({ inset, width: DUSK_BAND_HEIGHT, alpha: Math.round(VIGNETTE_EDGE_ALPHA * t * t * 60) / 60 });
  }
  return bands;
}

/**
 * A sparkle: off, a dot, a cross, a star, a cross, a dot, off. Each one has
 * its own period and phase, and turns up somewhere new every time it is off.
 */
export const SPARKLE_FRAMES = [0, 1, 2, 3, 3, 2, 1, 0] as const;
export type SparkleSize = 0 | 1 | 2 | 3;
/** How long each frame of a sparkle lasts. */
export const SPARKLE_FRAME_MS = 100;

export interface SparkleState {
  /** 0 is not drawn. */
  readonly size: SparkleSize;
  /** Which appearance this is, so a sparkle can be re-seated each time it goes out. */
  readonly cycle: number;
}

export function sparkleAt(timeMs: number, periodMs: number, phaseMs: number): SparkleState {
  const local = Math.max(0, timeMs + phaseMs);
  const cycle = Math.floor(local / periodMs);
  const frame = Math.floor((local - cycle * periodMs) / SPARKLE_FRAME_MS);
  const size = frame < SPARKLE_FRAMES.length ? SPARKLE_FRAMES[frame] : 0;
  return { size: size, cycle };
}

/** The pixels of a sparkle of `size`, relative to its centre. */
export function sparklePixels(size: SparkleSize): ReadonlyArray<readonly [number, number]> {
  if (size === 0) {
    return [];
  }
  const pixels: Array<readonly [number, number]> = [[0, 0]];
  for (let reach = 1; reach < size; reach += 1) {
    pixels.push([reach, 0], [-reach, 0], [0, reach], [0, -reach]);
  }
  if (size === 3) {
    // A star has a glint on each diagonal as well, one step out.
    pixels.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
  }
  return pixels;
}

/**
 * A deterministic shuffle of a number into [0, 1), so that where a sparkle
 * turns up is a function of which sparkle it is and which time it is - the
 * scene stays a pure function of the clock, and a screenshot can be taken
 * again.
 */
export function hash01(...parts: number[]): number {
  let value = 2166136261;
  for (const part of parts) {
    value ^= Math.floor(part) & 0xffff;
    value = Math.imul(value, 16777619);
    value ^= Math.floor(part / 65536) & 0xffff;
    value = Math.imul(value, 16777619);
  }
  value ^= value >>> 13;
  value = Math.imul(value, 0x5bd1e995);
  value ^= value >>> 15;
  return (value >>> 0) / 4294967296;
}

/**
 * The chase. Every `CHASE_PERIOD_MS` a trainer in a red cap runs across the
 * foot of the screen, in a lane of its own under the menu (`CHASE_LANE`), their partner at their heel, and Blue after them with a
 * "!" over his head - the banner's joke, played out. It runs left to right and
 * then right to left on the next lap, so it is never the same twice running.
 */
export const CHASE_PERIOD_MS = 15_000;
/**
 * The pixels the chase keeps to itself at the foot of the screen: a figure is
 * about 20 tall and stands three rows up, and Blue's "!" rides above that.
 * The menu is laid out in the screen less this, and its own bottom margin
 * keeps the hint clear of the mark.
 */
export const CHASE_LANE = 26;
/** When in each lap the trainer comes on. */
export const CHASE_START_MS = 2_500;
/** Pixels a second: a little quicker than a walk, which is a tile in 150ms. */
export const CHASE_SPEED = 120;
/** How far behind the trainer each follower runs, in pixels. */
export const PARTNER_GAP = 18;
export const RIVAL_GAP = 58;
/** Room off each edge of the screen, so a figure comes on and goes off whole. */
const CHASE_MARGIN = 24;

export interface ChaseState {
  readonly running: boolean;
  /** 1 runs to the right, -1 to the left. */
  readonly heading: 1 | -1;
  /** Centres, in whole pixels. */
  readonly trainerX: number;
  readonly partnerX: number;
  readonly rivalX: number;
}

export function chaseRunMs(width: number): number {
  return Math.ceil(((width + CHASE_MARGIN * 2 + RIVAL_GAP) / CHASE_SPEED) * 1000);
}

export function chaseAt(timeMs: number, width: number): ChaseState {
  const lap = Math.floor(Math.max(0, timeMs) / CHASE_PERIOD_MS);
  const heading: 1 | -1 = lap % 2 === 0 ? 1 : -1;
  const into = Math.max(0, timeMs) - lap * CHASE_PERIOD_MS - CHASE_START_MS;
  const running = into >= 0 && into < chaseRunMs(width);
  const travelled = Math.floor((Math.max(0, into) * CHASE_SPEED) / 1000);
  const trainerX = heading === 1 ? -CHASE_MARGIN + travelled : width + CHASE_MARGIN - travelled;
  return {
    running,
    heading,
    trainerX,
    partnerX: trainerX - heading * PARTNER_GAP,
    rivalX: trainerX - heading * RIVAL_GAP,
  };
}

/**
 * The shine: every `SHINE_PERIOD_MS` a slanted band of light crosses the
 * name, one column a step. Answers the column the band's foot is on, or null
 * while there is no shine.
 */
export const SHINE_PERIOD_MS = 6_000;
export const SHINE_START_MS = 1_200;
export const SHINE_MS_PER_PIXEL = 4;
/** The band leans one pixel to the right for every this many pixels it rises. */
export const SHINE_LEAN = 2;
export const SHINE_WIDTH = 5;

export function shineColumn(timeMs: number, logoWidth: number, logoHeight: number): number | null {
  const into = (Math.max(0, timeMs) % SHINE_PERIOD_MS) - SHINE_START_MS;
  if (into < 0) {
    return null;
  }
  // The band starts with its top just off the left edge and ends with its foot just off the right.
  const travel = logoWidth + Math.ceil(logoHeight / SHINE_LEAN) + SHINE_WIDTH;
  const column = Math.floor(into / SHINE_MS_PER_PIXEL) - Math.ceil(logoHeight / SHINE_LEAN) - SHINE_WIDTH;
  return column + Math.ceil(logoHeight / SHINE_LEAN) + SHINE_WIDTH < travel ? column : null;
}

/**
 * How brightly pixel (x, y) of a logo `height` tall is lit by a shine whose
 * foot is on `column`: 1 in the band's heart, a half on the pixel either side
 * of it, which is what keeps a band of white from looking cut out of paper.
 */
export function shineStrength(column: number, x: number, y: number, height: number): 0 | 0.5 | 1 {
  const from = column + Math.floor((height - 1 - y) / SHINE_LEAN);
  if (x >= from && x < from + SHINE_WIDTH) {
    return 1;
  }
  return x === from - 1 || x === from + SHINE_WIDTH ? 0.5 : 0;
}

/** When the shine has crossed the whole name. */
export function shineEndMs(logoWidth: number, logoHeight: number): number {
  return SHINE_START_MS + (logoWidth + Math.ceil(logoHeight / SHINE_LEAN) + SHINE_WIDTH) * SHINE_MS_PER_PIXEL;
}

/**
 * The glint the shine leaves behind: a star that opens and closes on the last
 * letter's shoulder once the band has gone by.
 */
export function logoGlint(timeMs: number, logoWidth: number, logoHeight: number): SparkleSize {
  const into = (Math.max(0, timeMs) % SHINE_PERIOD_MS) - shineEndMs(logoWidth, logoHeight) + 120;
  if (into < 0) {
    return 0;
  }
  const frame = Math.floor(into / SPARKLE_FRAME_MS);
  return (frame < SPARKLE_FRAMES.length ? SPARKLE_FRAMES[frame] : 0);
}

/** The menu cursor nudges a pixel towards the choice and back, as a handheld's does. */
export function cursorNudge(timeMs: number): 0 | 1 {
  return Math.floor(Math.max(0, timeMs) / 320) % 2 === 0 ? 0 : 1;
}
