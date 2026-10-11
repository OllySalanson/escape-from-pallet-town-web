/**
 * FireRed's shiny sparkle, frame for frame, as data: what is on screen around a
 * shiny Pokemon at each frame after it has landed on the field.
 *
 * It is `AnimTask_ShinySparkles` (pret/pokefirered, `src/battle_anim_special.c`)
 * read rather than imitated. Two tasks start together when the Pokemon's plate
 * is shown and each waits 60 frames; then each puts a star out every fourth
 * frame, five apiece - the 16x16 wish star first, three small twinkles, then
 * the other twinkle. One task's stars circle the Pokemon at a radius of 24
 * (`SpriteCB_ShinySparkles_1`: `Sin` and `Cos` of an angle that climbs 12 of
 * the GBA's 256 a frame); the other's wait four frames out of sight 32 below
 * and left of it and then cross it to the upper right, five pixels a frame
 * (`SpriteCB_ShinySparkles_2`). `SE_SHINY` sounds as the crossing's first star
 * is put out. Phaser-free, so the choreography is tested without a renderer.
 */

/** The sparkle sheet's texture, loaded at boot. */
export const SHINY_SPARKLE_TEXTURE = 'shiny-sparkle';

/** One GBA frame. */
export const SPARKLE_FRAME_MS = 1000 / 60;

/** Frames each task waits before its first star (`data[13] < 60`). */
export const SPARKLE_WAIT_FRAMES = 60;

/** The sparkle sheet's three pictures (`ANIM_TAG_GOLD_STARS`, cut by `scripts/cut-frlg-shiny.mjs`). */
export const SPARKLE_FRAMES = {
  star: { x: 0, y: 0, width: 16, height: 16 },
  twinkle: { x: 0, y: 16, width: 8, height: 8 },
  glint: { x: 8, y: 16, width: 8, height: 8 },
} as const;

export type SparkleFrame = keyof typeof SPARKLE_FRAMES;

export interface SparkleMote {
  /** Which of the five stars of which task: stable for the star's whole life. */
  readonly id: string;
  readonly frame: SparkleFrame;
  /** GBA pixels from the Pokemon's centre. */
  readonly dx: number;
  readonly dy: number;
}

const STARS_PER_TASK = 5;
const SPAWN_EVERY = 4;
const CIRCLE_RADIUS = 24;
const CIRCLE_STEP = 12;
const CROSS_START = 32;
const CROSS_HIDDEN_FRAMES = 4;
const CROSS_STEP = 5;

/** `gSineTable`'s value at a GBA angle (256 to the turn), times `amplitude`, as `Sin` does it. */
function gbaSin(angle: number, amplitude: number): number {
  const table = Math.round(Math.sin(((angle & 0xff) * Math.PI * 2) / 256) * 256);
  return Math.floor((table * amplitude) / 256);
}

function frameOfStar(index: number): SparkleFrame {
  return index === 0 ? 'star' : index < 4 ? 'twinkle' : 'glint';
}

/** The frame, counted from the start, that a task puts its nth star out on. */
function spawnFrame(index: number): number {
  return SPARKLE_WAIT_FRAMES + index * SPAWN_EVERY;
}

/**
 * Frames a circling star is drawn for. The callback that carries it past 255
 * destroys it in the same frame, so the last angle drawn is 240.
 */
const CIRCLE_LIFE = Math.floor((255 - CIRCLE_STEP) / CIRCLE_STEP) + 1;
/** Frames a crossing star lives, hidden ones included, until it passes +32. */
const CROSS_LIFE = CROSS_HIDDEN_FRAMES + Math.ceil((CROSS_START * 2 + 1) / CROSS_STEP);

/** The frame the sound plays on: the crossing's first star (`PlaySE12WithPanning(SE_SHINY)`). */
export const SPARKLE_SOUND_FRAME = spawnFrame(0);

/** The last frame anything is drawn on, plus one: how long the sparkle lasts. */
export const SPARKLE_LENGTH_FRAMES =
  spawnFrame(STARS_PER_TASK - 1) + Math.max(CIRCLE_LIFE, CROSS_LIFE);

/** Everything drawn at a frame counted from the moment the Pokemon landed. */
export function sparkleAt(frame: number): readonly SparkleMote[] {
  const motes: SparkleMote[] = [];
  for (let index = 0; index < STARS_PER_TASK; index += 1) {
    const age = Math.floor(frame) - spawnFrame(index);
    if (age < 0) {
      continue;
    }
    const picture = frameOfStar(index);
    if (age < CIRCLE_LIFE) {
      const angle = age * CIRCLE_STEP;
      motes.push({
        id: `circle-${index}`,
        frame: picture,
        dx: gbaSin(angle, CIRCLE_RADIUS),
        dy: gbaSin(angle + 64, CIRCLE_RADIUS),
      });
    }
    if (age >= CROSS_HIDDEN_FRAMES && age < CROSS_LIFE) {
      const travelled = (age - CROSS_HIDDEN_FRAMES + 1) * CROSS_STEP;
      const dx = -CROSS_START + travelled;
      if (dx <= CROSS_START) {
        motes.push({ id: `cross-${index}`, frame: picture, dx, dy: CROSS_START - travelled });
      }
    }
  }
  return motes;
}
