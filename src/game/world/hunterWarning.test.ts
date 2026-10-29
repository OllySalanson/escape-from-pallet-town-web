import { describe, expect, it } from 'vitest';
import {
  HUNTER_GLOW_DEPTH_PX,
  HUNTER_WARNING_ARRIVAL_MS,
  HUNTER_WARNING_DISTANCE,
  HUNTER_WARNING_HEARTBEAT_MS,
  HUNTER_WARNING_PULSE_MS,
  HUNTER_WARNING_TRAIL_STRONGEST,
  hunterWarningStrength,
  trailStrength,
  type HunterWarningInput,
} from './hunterWarning';
import { HUNTER_ALERT_DISTANCE } from '../scenes/raidHud';

const QUIET: HunterWarningInput = { nowMs: 10_000, arrivedAtMs: null, stepsAway: null, lostYou: false, reducedMotion: false };

/** The strength at every frame of `durationMs` from `fromMs`, at 60fps. */
function frames(input: Omit<HunterWarningInput, 'nowMs'>, fromMs: number, durationMs: number): number[] {
  const out: number[] = [];
  for (let at = fromMs; at < fromMs + durationMs; at += 1000 / 60) {
    out.push(hunterWarningStrength({ ...input, nowMs: at }));
  }
  return out;
}

describe('the hunter warning at the screen edge', () => {
  it('is dark while nothing is hunting the player', () => {
    expect(hunterWarningStrength(QUIET)).toBe(0);
    expect(hunterWarningStrength({ ...QUIET, stepsAway: HUNTER_WARNING_DISTANCE + 1 })).toBe(0);
  });

  it('pulses three times as the hunter arrives, then goes quiet if it is not close', () => {
    const arriving = { ...QUIET, arrivedAtMs: 1_000 };
    // Full at the top of each pulse, nothing between them.
    for (let pulse = 0; pulse < 3; pulse += 1) {
      const start = 1_000 + pulse * HUNTER_WARNING_PULSE_MS;
      expect(hunterWarningStrength({ ...arriving, nowMs: start + HUNTER_WARNING_PULSE_MS / 2 })).toBeCloseTo(1);
      expect(hunterWarningStrength({ ...arriving, nowMs: start })).toBe(0);
    }
    expect(hunterWarningStrength({ ...arriving, nowMs: 1_000 + HUNTER_WARNING_ARRIVAL_MS + 100 })).toBe(0);
  });

  it('beats slowly while the hunter is close, harder the closer it is', () => {
    const peak = (stepsAway: number) =>
      Math.max(...frames({ ...QUIET, stepsAway }, 0, HUNTER_WARNING_HEARTBEAT_MS));
    expect(peak(1)).toBeCloseTo(HUNTER_WARNING_TRAIL_STRONGEST, 1);
    expect(peak(1)).toBeGreaterThan(peak(4));
    expect(peak(4)).toBeGreaterThan(peak(HUNTER_WARNING_DISTANCE));
    expect(peak(HUNTER_WARNING_DISTANCE)).toBeGreaterThan(0);
    // A beat is a pulse and a rest: some of every beat is dark.
    expect(Math.min(...frames({ ...QUIET, stepsAway: 1 }, 0, HUNTER_WARNING_HEARTBEAT_MS))).toBe(0);
  });

  it('starts glowing at the distance the hunter chip appears at', () => {
    expect(HUNTER_WARNING_DISTANCE).toBe(HUNTER_ALERT_DISTANCE);
  });

  it('goes quiet when the hunter has lost the player, however close it is', () => {
    expect(frames({ ...QUIET, stepsAway: 2, lostYou: true }, 0, HUNTER_WARNING_HEARTBEAT_MS * 2)).toEqual(
      frames({ ...QUIET }, 0, HUNTER_WARNING_HEARTBEAT_MS * 2),
    );
  });

  it('never flashes under reduced motion: the border is held, and steps only with distance', () => {
    const still = { ...QUIET, reducedMotion: true, arrivedAtMs: 0 };
    const arrival = frames(still, 0, HUNTER_WARNING_ARRIVAL_MS - 20);
    expect(new Set(arrival)).toEqual(new Set([1]));
    const trailing = frames({ ...still, arrivedAtMs: null, stepsAway: 3 }, 0, HUNTER_WARNING_HEARTBEAT_MS * 3);
    expect(new Set(trailing)).toEqual(new Set([trailStrength(3)]));
  });

  it('never reaches far into the screen', () => {
    // Eight game pixels of a 320x240 screen at the least: a rim, never a wash.
    expect(HUNTER_GLOW_DEPTH_PX).toBeLessThanOrEqual(8);
  });
});
