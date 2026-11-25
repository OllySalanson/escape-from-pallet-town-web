import { describe, expect, it } from 'vitest';
import { houseSeason, skyNote, skyTurns, windowLight, windowLines } from './homeClock';

const at = (month: number, hour: number) => new Date(2026, month, 15, hour, 30);

describe("THE BOLTHOLE by the player's clock", () => {
  it('lights the window for the hour it is', () => {
    expect([3, 4].map((hour) => windowLight(at(5, hour)))).toEqual(['night', 'night']);
    expect([5, 6].map((hour) => windowLight(at(5, hour)))).toEqual(['dusk', 'dusk']);
    expect([7, 12, 17].map((hour) => windowLight(at(5, hour)))).toEqual(['day', 'day', 'day']);
    expect([18, 20].map((hour) => windowLight(at(5, hour)))).toEqual(['dusk', 'dusk']);
    expect([21, 23, 0].map((hour) => windowLight(at(5, hour)))).toEqual(['night', 'night', 'night']);
  });

  it('says something different out of the window for each light', () => {
    const said = [12, 19, 23].map((hour) => windowLines(at(5, hour)).join(' '));
    expect(new Set(said).size).toBe(3);
  });

  it('dresses the house for October and December, and for nothing else', () => {
    expect(houseSeason(at(9, 12))).toBe('october');
    expect(houseSeason(at(11, 12))).toBe('december');
    for (const month of [0, 1, 2, 3, 4, 5, 6, 7, 8, 10]) {
      expect([month, houseSeason(at(month, 12))]).toEqual([month, null]);
    }
  });
});

describe("the rim's word on a raid's sky", () => {
  it('says the sky is the player\'s own clock, and when it next turns', () => {
    expect(skyNote(at(5, 12))).toBe('day, by your own clock. Dusk comes at 6 pm, full dark at 9 pm');
    expect(skyNote(at(5, 19))).toBe('dusk, by your own clock. Full dark comes at 9 pm');
    expect(skyNote(at(5, 6))).toBe('dawn, by your own clock. Day comes at 7 am');
    expect(skyNote(at(5, 23))).toBe('night, by your own clock, until 5 am');
  });

  it('says it short beside the sky on the rim card, at the same hours', () => {
    expect([12, 19, 6, 23].map((hour) => skyTurns(at(5, hour)))).toEqual(['DUSK 6PM', 'DARK 9PM', 'DAY 7AM', 'TILL 5AM']);
  });
});
