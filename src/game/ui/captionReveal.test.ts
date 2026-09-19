import { describe, expect, it } from 'vitest';
import {
  CAPTION_LOOK_MS,
  CAPTION_NEAR_STEPS,
  EXIT_CALL_MS,
  advanceLookMs,
  captionSpeaks,
  isLooking,
  stepsToNearest,
  type CaptionAudience,
  type CaptionSpeech,
} from './captionReveal';
import { RAID_CLOCK_URGENT_MS } from '../scenes/raidHud';
import { RAID_DURATION_MS } from '../run/raidClock';

const AT = { x: 20, y: 20 };

const audience = (overrides: Partial<CaptionAudience> = {}): CaptionAudience => ({
  player: AT,
  looking: false,
  raidRemainingMs: RAID_DURATION_MS,
  ...overrides,
});

const name = (tiles: CaptionSpeech['tiles']): CaptionSpeech => ({ voice: 'name', tiles });
const exit = (tiles: CaptionSpeech['tiles'], open: boolean): CaptionSpeech => ({
  voice: 'exit',
  tiles,
  open,
});

describe('whether a map caption speaks at all', () => {
  it('names a thing the player has walked up to, and nothing further off', () => {
    const near = { x: AT.x + CAPTION_NEAR_STEPS, y: AT.y };
    const far = { x: AT.x + CAPTION_NEAR_STEPS + 1, y: AT.y };

    expect(captionSpeaks(name([near]), audience())).toBe(true);
    expect(captionSpeaks(name([far]), audience())).toBe(false);
  });

  it('counts the reach in walking steps, so a diagonal is as far as the walk to it', () => {
    // Three across and three down is six steps, not three: the square reach
    // this replaced named three things at once on Route 1's station apron.
    const diagonal = { x: AT.x + 3, y: AT.y - 3 };

    expect(stepsToNearest(AT, [diagonal])).toBe(6);
    expect(captionSpeaks(name([diagonal]), audience())).toBe(false);
    expect(captionSpeaks(name([{ x: AT.x + 3, y: AT.y - 2 }]), audience())).toBe(true);
  });

  it('speaks as soon as any one of the tiles it is about is near', () => {
    const doors = [
      { x: AT.x + 40, y: AT.y },
      { x: AT.x + 2, y: AT.y + 1 },
    ];

    expect(captionSpeaks(name(doors), audience())).toBe(true);
  });

  it('says every name on the screen while the look is held, and none after it', () => {
    const far = name([{ x: AT.x + 20, y: AT.y + 9 }]);

    expect(captionSpeaks(far, audience({ looking: true }))).toBe(true);
    expect(captionSpeaks(far, audience({ looking: false }))).toBe(false);
  });

  it('never silences a warning, at any distance: a step into it is decided from across the map', () => {
    const watch: CaptionSpeech = { voice: 'warning', tiles: [{ x: AT.x + 25, y: AT.y + 14 }] };

    expect(captionSpeaks(watch, audience())).toBe(true);
  });

  it('calls an open exit once the clock goes red, and never calls a sealed one', () => {
    const far = [{ x: AT.x + 20, y: AT.y }];

    expect(captionSpeaks(exit(far, true), audience({ raidRemainingMs: EXIT_CALL_MS }))).toBe(true);
    expect(captionSpeaks(exit(far, true), audience({ raidRemainingMs: EXIT_CALL_MS + 1 }))).toBe(
      false,
    );
    expect(captionSpeaks(exit(far, false), audience({ raidRemainingMs: 1 }))).toBe(false);
  });

  it('calls at the same second the clock turns red, because it is the same fact', () => {
    expect(EXIT_CALL_MS).toBe(RAID_CLOCK_URGENT_MS);
  });

  it('still names a sealed exit the player is standing beside, red clock or not', () => {
    const here = [{ x: AT.x + 1, y: AT.y }];

    expect(captionSpeaks(exit(here, false), audience())).toBe(true);
  });
});

describe('the look', () => {
  it('lasts a glance on a tap, so one frame of writing is never the whole answer', () => {
    const opened = advanceLookMs(0, true, 16);

    expect(opened).toBe(CAPTION_LOOK_MS);
    expect(isLooking(opened, false)).toBe(true);
  });

  it('runs out when the key is let go, even on a frame as long as test mode\'s', () => {
    let remaining = advanceLookMs(0, true, 100);
    for (let frame = 0; frame < Math.ceil(CAPTION_LOOK_MS / 100); frame += 1) {
      remaining = advanceLookMs(remaining, false, 100);
    }

    expect(remaining).toBe(0);
    expect(isLooking(remaining, false)).toBe(false);
  });

  it('stays open for as long as the key is held, however long that is', () => {
    let remaining = advanceLookMs(0, true, 100);
    for (let frame = 0; frame < 200; frame += 1) {
      remaining = advanceLookMs(remaining, false, 100);
    }

    expect(isLooking(remaining, true)).toBe(true);
  });
});
