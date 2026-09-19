import { describe, expect, it } from 'vitest';
import { hunterIntelFor } from '../world/hunter';
import { HUNTER_ALERT_DISTANCE, hunterChipView, hunterIntelLine,
  openRaidCue,
} from './raidHud';

const FAR = { searching: false, distance: null, direction: 'N' } as const;

describe('the hunter chip', () => {
  it('says nothing about a distant hunter on a raid from a base with no radio mast', () => {
    expect(hunterChipView(FAR)).toBeNull();
    expect(hunterChipView({ ...FAR, distance: HUNTER_ALERT_DISTANCE + 1 })).toBeNull();
  });

  it('warns which way a near hunter is, exactly as it did before the mast existed', () => {
    expect(hunterChipView({ ...FAR, distance: 5, direction: 'NW' })).toEqual({
      label: 'HUNTER NW 5',
      tone: 'closing',
    });
    expect(hunterChipView({ ...FAR, searching: true, searchRemainingMs: 8_200 })).toEqual({
      label: 'HUNTER LOST YOU 9s',
      tone: 'lost-you',
    });
  });
});

describe('the radio mast', () => {
  it('names the team that is coming and when the next one lands', () => {
    const intel = hunterIntelFor(75_000, 300_000, false);

    expect(intel).toEqual({ level: 6, teamSize: 1, next: { level: 9, teamSize: 2, inMs: 45_000 } });
    expect(hunterChipView({ ...FAR, intel })).toEqual({
      label: 'HUNTER LV6 x1',
      tone: 'intel',
      detail: 'LV9 x2 IN 0:45',
    });
  });

  it('rides under a contact warning instead of replacing it', () => {
    const intel = hunterIntelFor(130_000, 300_000, false);

    expect(hunterChipView({ ...FAR, distance: 3, direction: 'E', intel })).toEqual({
      label: 'HUNTER E 3',
      tone: 'closing',
      detail: 'LV9 x2, LV12 x3 IN 1:50',
    });
  });

  it('counts down to the enrage once the last scheduled team has landed', () => {
    const intel = hunterIntelFor(250_000, 300_000, false);

    expect(intel.next).toEqual({ level: 15, teamSize: 3, inMs: 50_000 });
    expect(hunterIntelLine(intel)).toBe('LV15 x3 IN 0:50');
  });

  it('reports the enrage next on a raid recovery has shortened past a later team', () => {
    // Booked recovery can halve the clock, and then the level-12 team never starts.
    const intel = hunterIntelFor(130_000, 150_000, false);

    expect(intel.level).toBe(9);
    expect(intel.next).toEqual({ level: 15, teamSize: 3, inMs: 20_000 });
  });

  it('has nothing further to announce once the raid is enraged', () => {
    const intel = hunterIntelFor(300_000, 300_000, true);

    expect(intel).toEqual({ level: 15, teamSize: 3, next: null });
    expect(hunterIntelLine(intel)).toBe('FINAL TEAM');
  });

  it('reports the team a shifted tuning will actually field', () => {
    const tuning = { spawnDelayMs: 60_000, aggressionStepsPerPlayerStep: 1, teamTierOffset: 1 };
    const intel = hunterIntelFor(0, 300_000, false, tuning);

    expect(intel.level).toBe(9);
    expect(intel.next).toEqual({ level: 12, teamSize: 3, inMs: 120_000 });
  });
});

describe('the cue with no objective left', () => {
  it('only tells the player to extract a haul they are actually carrying', () => {
    expect(openRaidCue({ items: 0, pokemon: 0 })).toBe('FIND LOOT, THEN EXTRACT');
    expect(openRaidCue({ items: 1, pokemon: 0 })).toBe('EXTRACT WITH YOUR HAUL');
    expect(openRaidCue({ items: 0, pokemon: 1 })).toBe('EXTRACT WITH YOUR HAUL');
  });
});
