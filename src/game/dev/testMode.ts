export const TEST_MODE_QUERY = 'testmode';
export const TEST_MODE_ENV = 'VITE_EPTW_TEST_MODE';

/** Ten frames a second: a sixth of the work, and still a game a driver can poll. */
export const TEST_MODE_FPS = 10;
export const TEST_MODE_FRAME_MS = 1000 / TEST_MODE_FPS;
export const MAX_STEP_FRAME_MS = 200;

/**
 * `logic` is the cheap one and the default: Canvas renderer. `pixels` keeps
 * WebGL, for a screenshot that will be judged by eye - Phaser's Canvas renderer
 * does not draw tints, and this game's water, trees and tall grass are tints, so
 * a `logic` frame of the Floodplain shows a lawn where the river is.
 */
export type TestMode = 'off' | 'logic' | 'pixels';

const MODE_BY_VALUE: Readonly<Record<string, TestMode>> = { '1': 'logic', pixels: 'pixels' };

/**
 * Test mode is for the automated checks that drive the real game in a headless
 * browser, several of them at once on one machine. It is asked for by name and
 * by nothing else: `?testmode=1` (or `?testmode=pixels`) on a development build,
 * or a build made with `VITE_EPTW_TEST_MODE` set to the same. A production build
 * ignores the URL, and a plain `npm run dev` sets neither, so nobody plays - or
 * tests - at ten frames a second by accident.
 */
export function requestedTestMode(
  isDevelopment: boolean = import.meta.env.DEV,
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  env: string | undefined = import.meta.env[TEST_MODE_ENV] as string | undefined,
): TestMode {
  const fromEnv = MODE_BY_VALUE[env ?? ''];
  if (fromEnv) {
    return fromEnv;
  }
  const fromUrl = MODE_BY_VALUE[new URLSearchParams(search).get(TEST_MODE_QUERY) ?? ''];
  return isDevelopment && fromUrl ? fromUrl : 'off';
}

/**
 * The loop test mode runs: off `setTimeout` at ten frames a second rather than
 * off the display. Every rule of the game reads delta time, so none can tell -
 * `stepClock.ts` is what made that true of walking.
 */
export const TEST_MODE_LOOP = { target: TEST_MODE_FPS, forceSetTimeOut: true } as const;

/** The part of `Phaser.Core.TimeStep` the stepping controls drive. */
export interface SteppableLoop {
  running: boolean;
  lastTime: number;
  deltaHistory: number[];
  sleep(): void;
  wake(seamless?: boolean): void;
  resetDelta(): void;
  step(time: number): void;
}

/**
 * The stepping controls a driver finds on `window.__escapeFromPalletTownGame__`
 * in test mode. A paused loop costs nothing at all, so the cheapest check there
 * is pauses the game and pays only for the frames it asks for.
 */
export interface TestModeControls {
  /** Stops the loop. The page stays alive and every scene keeps its state. */
  pauseLoop(): void;
  /**
   * Runs `count` frames of `frameMs` game time each, synchronously, on a paused
   * loop (it pauses a running one first). Game time moves only by what is
   * stepped, so the same calls always produce the same raid.
   */
  stepFrames(count: number, frameMs?: number): void;
  /** Hands the loop back to the clock, without charging the game for the pause. */
  resumeLoop(): void;
  readonly loopPaused: boolean;
}

export function createTestModeControls(loop: SteppableLoop): TestModeControls {
  return {
    pauseLoop(): void {
      loop.sleep();
    },
    stepFrames(count: number, frameMs: number = TEST_MODE_FRAME_MS): void {
      // Phaser distrusts any frame slower than its `fps.min` of five a second and
      // substitutes a remembered one, so a longer step would not be the step asked for.
      if (!Number.isInteger(count) || count < 0 || !(frameMs > 0) || frameMs > MAX_STEP_FRAME_MS) {
        throw new RangeError(
          `stepFrames(${count}, ${frameMs}): a whole number of frames, each up to ${MAX_STEP_FRAME_MS}ms`,
        );
      }
      loop.sleep();
      // Phaser averages delta over its history; a stepped frame is exactly as
      // long as it was asked to be, so the history is told the same thing.
      loop.deltaHistory.fill(frameMs);
      for (let frame = 0; frame < count; frame += 1) {
        loop.step(loop.lastTime + frameMs);
      }
    },
    resumeLoop(): void {
      if (loop.running) {
        return;
      }
      loop.wake();
      // Stepping moved `lastTime` by game time, not wall time; without this the
      // first live frame would be handed the whole pause as one delta.
      loop.resetDelta();
    },
    get loopPaused(): boolean {
      return !loop.running;
    },
  };
}

/** Puts the stepping controls on the game handle the drivers already reach for. */
export function installTestModeControls<TGame extends { loop: SteppableLoop }>(
  game: TGame,
): TGame & TestModeControls {
  const controls = createTestModeControls(game.loop);
  return Object.defineProperties(game, Object.getOwnPropertyDescriptors(controls)) as TGame &
    TestModeControls;
}
