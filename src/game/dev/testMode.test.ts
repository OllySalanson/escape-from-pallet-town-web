import { describe, expect, it } from 'vitest';
import {
  createTestModeControls,
  installTestModeControls,
  MAX_STEP_FRAME_MS,
  requestedTestMode,
  TEST_MODE_FRAME_MS,
  TEST_MODE_LOOP,
  type SteppableLoop,
} from './testMode';

describe('test mode', () => {
  it('is asked for by name on a development build, and by nothing else', () => {
    expect(requestedTestMode(true, '?testmode=1', undefined)).toBe('logic');
    expect(requestedTestMode(true, '?test-lab=1&testmode=1', undefined)).toBe('logic');
    expect(requestedTestMode(true, '', undefined)).toBe('off');
    expect(requestedTestMode(true, '?testmode=0', undefined)).toBe('off');
    expect(requestedTestMode(true, '?testmode', undefined)).toBe('off');
  });

  it('cannot be switched on from the URL of a production build', () => {
    expect(requestedTestMode(false, '?testmode=1', undefined)).toBe('off');
  });

  it('is honoured in any build made with the environment flag, and only at 1', () => {
    expect(requestedTestMode(false, '', '1')).toBe('logic');
    expect(requestedTestMode(true, '', '0')).toBe('off');
    expect(requestedTestMode(true, '', '')).toBe('off');
  });

  it('keeps WebGL for a check that will be judged by eye, under the same rules', () => {
    expect(requestedTestMode(true, '?testmode=pixels', undefined)).toBe('pixels');
    expect(requestedTestMode(false, '?testmode=pixels', undefined)).toBe('off');
    expect(requestedTestMode(false, '', 'pixels')).toBe('pixels');
  });

  it('runs the loop off a timer at ten frames a second', () => {
    expect(TEST_MODE_LOOP).toEqual({ target: 10, forceSetTimeOut: true });
  });
});

describe('stepping controls', () => {
  const fakeLoop = (): SteppableLoop & { stepped: number[]; resets: number } => {
    const loop = {
      running: true,
      lastTime: 1_000,
      deltaHistory: [16, 16, 16],
      stepped: [] as number[],
      resets: 0,
      sleep(): void {
        loop.running = false;
      },
      wake(): void {
        loop.running = true;
      },
      resetDelta(): void {
        loop.resets += 1;
      },
      step(time: number): void {
        loop.stepped.push(time - loop.lastTime);
        loop.lastTime = time;
      },
    };
    return loop;
  };

  it('moves game time only by the frames it is asked for, each exactly as long as asked', () => {
    const loop = fakeLoop();
    const controls = createTestModeControls(loop);

    controls.stepFrames(3);
    expect(loop.running).toBe(false);
    expect(controls.loopPaused).toBe(true);
    expect(loop.stepped).toEqual([TEST_MODE_FRAME_MS, TEST_MODE_FRAME_MS, TEST_MODE_FRAME_MS]);
    // Phaser averages delta over this history, so it is told the same thing.
    expect(loop.deltaHistory).toEqual([100, 100, 100]);

    controls.stepFrames(2, 1000 / 60);
    expect(loop.stepped).toHaveLength(5);
    expect(loop.stepped[4]).toBeCloseTo(1000 / 60, 6);
  });

  it('refuses a step Phaser would not honour', () => {
    const controls = createTestModeControls(fakeLoop());
    expect(() => controls.stepFrames(1, MAX_STEP_FRAME_MS + 1)).toThrow(RangeError);
    expect(() => controls.stepFrames(1.5)).toThrow(RangeError);
    expect(() => controls.stepFrames(-1)).toThrow(RangeError);
    expect(() => controls.stepFrames(1, 0)).toThrow(RangeError);
  });

  it('hands the loop back without charging the game for the pause', () => {
    const loop = fakeLoop();
    const controls = createTestModeControls(loop);

    controls.pauseLoop();
    controls.resumeLoop();
    expect(loop.running).toBe(true);
    expect(loop.resets).toBe(1);

    // Resuming a loop that is already running is not a reason to reset its clock.
    controls.resumeLoop();
    expect(loop.resets).toBe(1);
  });

  it('puts the controls on the game handle itself, live', () => {
    const game = installTestModeControls({ loop: fakeLoop() });
    expect(game.loopPaused).toBe(false);
    game.pauseLoop();
    expect(game.loopPaused).toBe(true);
  });
});
