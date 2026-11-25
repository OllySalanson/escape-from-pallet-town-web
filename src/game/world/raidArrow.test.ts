import { describe, expect, it } from 'vitest';
import { RAID_CLOCK_URGENT_MS } from '../scenes/raidHud';
import { ARROW_RETURNS_MS, raidArrowPhase } from './raidArrow';

describe('when the raid arrow is drawn', () => {
  it('guides the first raid the whole way, enraged or not', () => {
    expect(raidArrowPhase({ firstRaid: true, remainingMs: 290_000, enraged: false })).toBe('guide');
    expect(raidArrowPhase({ firstRaid: true, remainingMs: 10_000, enraged: false })).toBe('guide');
    expect(raidArrowPhase({ firstRaid: true, remainingMs: 0, enraged: true })).toBe('guide');
  });

  it('stays away on every later raid until the last thirty seconds', () => {
    expect(raidArrowPhase({ firstRaid: false, remainingMs: 290_000, enraged: false })).toBe('off');
    expect(raidArrowPhase({ firstRaid: false, remainingMs: 30_001, enraged: false })).toBe('off');
  });

  it('comes back for the way out at thirty seconds, and through the enrage', () => {
    expect(raidArrowPhase({ firstRaid: false, remainingMs: 30_000, enraged: false })).toBe('way-out');
    expect(raidArrowPhase({ firstRaid: false, remainingMs: 1, enraged: false })).toBe('way-out');
    expect(raidArrowPhase({ firstRaid: false, remainingMs: 0, enraged: true })).toBe('way-out');
  });

  it('comes back on the frame the clock turns red and stings', () => {
    expect(ARROW_RETURNS_MS).toBe(RAID_CLOCK_URGENT_MS);
  });
});
