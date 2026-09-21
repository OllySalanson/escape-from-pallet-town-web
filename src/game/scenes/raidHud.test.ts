import { describe, expect, it } from 'vitest';
import { hunterIntelFor } from '../world/hunter';
import {
  HUNTER_ALERT_DISTANCE,
  PLACE_PLATE_MS,
  hunterChipView,
  hunterIntelLine,
  prizeChipView,
  openRaidCue,
  placePlateLine,
  weatherChipLine,
} from './raidHud';
import { WeatherId } from '../pokemon/battle/weather';

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
      detail: 'LV9 x2, LV12 x3 IN 0:50',
    });
  });

  it('names the fourth team the ladder grew, and then the enrage', () => {
    // The mast reads the ladder rather than a list of its own, so the rung that
    // arrived with evolution is announced by it without a change here.
    expect(hunterIntelFor(200_000, 300_000, false).next).toEqual({
      level: 15,
      teamSize: 4,
      inMs: 40_000,
    });
  });

  it('counts down to the enrage once the last scheduled team has landed', () => {
    const intel = hunterIntelFor(250_000, 300_000, false);

    expect(intel.next).toEqual({ level: 19, teamSize: 4, inMs: 50_000 });
    expect(hunterIntelLine(intel)).toBe('LV19 x4 IN 0:50');
  });

  it('reports the enrage next on a raid recovery has shortened past a later team', () => {
    // Booked recovery can halve the clock, and then the level-12 team never starts.
    const intel = hunterIntelFor(130_000, 150_000, false);

    expect(intel.level).toBe(9);
    expect(intel.next).toEqual({ level: 19, teamSize: 4, inMs: 20_000 });
  });

  it('has nothing further to announce once the raid is enraged', () => {
    const intel = hunterIntelFor(300_000, 300_000, true);

    expect(intel).toEqual({ level: 19, teamSize: 4, next: null });
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

describe('the arrival plate', () => {
  it('names a place while arriving in it is news, and then gets out of the way', () => {
    expect(placePlateLine('OLD TOWN', PLACE_PLATE_MS)).toBe('OLD TOWN');
    expect(placePlateLine('OLD TOWN', 1)).toBe('OLD TOWN');
    expect(placePlateLine('OLD TOWN', 0)).toBeNull();
  });

  it('says nothing on a map that names no districts', () => {
    expect(placePlateLine(null, PLACE_PLATE_MS)).toBeNull();
  });

  it('is up long enough to read and short enough not to be furniture', () => {
    expect(PLACE_PLATE_MS).toBeGreaterThanOrEqual(2_000);
    expect(PLACE_PLATE_MS).toBeLessThanOrEqual(5_000);
  });
});

describe('the weather chip', () => {
  it('names the weather and nothing else', () => {
    expect(weatherChipLine(WeatherId.Rain)).toBe('RAIN');
    expect(weatherChipLine(WeatherId.HarshSunlight)).toBe('HARSH SUN');
    expect(weatherChipLine(WeatherId.Sandstorm)).toBe('SANDSTORM');
  });

  it('shows nothing where a place has no weather, which is most places', () => {
    expect(weatherChipLine(null)).toBeNull();
  });

  it('stays short enough to be a chip rather than a panel', () => {
    for (const weather of Object.values(WeatherId)) {
      expect(weatherChipLine(weather)!.length).toBeLessThanOrEqual('EXTRACT WITH YOUR HAUL'.length);
    }
  });
});

/**
 * The prize chip: the caption's memory, and the thing that makes leaving hard.
 *
 * A caption stops speaking the moment its subject scrolls off, which is exactly
 * the wrong moment for this one - the whole of greed is knowing a thing is back
 * there while the clock runs. The chip is what keeps asking.
 */
describe('the prize chip', () => {
  it('names the find and says which way and how far', () => {
    expect(prizeChipView({ name: 'Fire Stone', direction: 'SE', distance: 34 })).toEqual({
      label: 'FIRE STONE',
      detail: 'SE 34',
    });
  });

  it('shows nothing until something rare has actually been seen', () => {
    // Which is most raids: a prize is rolled on its own odds, and a HUD that
    // named every rarity at 0:00 would hand over what a vast map is built to
    // make you go and find.
    expect(prizeChipView(null)).toBeNull();
  });

  it('stays a chip rather than a panel, even for the longest name there is', () => {
    const longest = 'HM06 ROCK SMASH';
    const view = prizeChipView({ name: longest, direction: 'NW', distance: 128 })!;
    expect(view.label.length).toBeLessThanOrEqual('EXTRACT WITH YOUR HAUL'.length);
    expect(view.detail.length).toBeLessThanOrEqual(view.label.length);
  });
});
