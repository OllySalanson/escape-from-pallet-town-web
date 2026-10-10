import { describe, expect, it } from 'vitest';
import { hunterForecastLine } from './hunterForecast';

const facts = { spawned: false, defeated: false, rivalName: 'MISTY', msUntilSpawn: 42_500 };

describe("the ranger station's hunter forecast", () => {
  it('counts down to an arrival that is still to come', () => {
    expect(hunterForecastLine(facts)).toContain('in about 43s');
  });

  it('says the hunter is here once it is', () => {
    expect(hunterForecastLine({ ...facts, spawned: true, msUntilSpawn: -5_000 })).toContain('active in this area');
  });

  it('says the trail is gone once the hunter is beaten, never a countdown (playtest 45)', () => {
    const line = hunterForecastLine({ ...facts, spawned: true, defeated: true, msUntilSpawn: -60_000 });
    expect(line).toBe('HUNTER FORECAST: MISTY is beaten. Nobody else is on your trail this raid.');
    expect(line).not.toMatch(/\d+s\b/);
  });

  it('never reads nought seconds while an arrival that is due waits for its moment', () => {
    for (const msUntilSpawn of [0, -1, -90_000]) {
      const line = hunterForecastLine({ ...facts, msUntilSpawn });
      expect(line).not.toContain('0s');
      expect(line).toContain('any moment now');
    }
  });
});
