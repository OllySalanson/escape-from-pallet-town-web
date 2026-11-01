import { afterEach, describe, expect, it } from 'vitest';
import { FIRST_WORDS, mapsMovedNews, spokenLines } from './firstWords';
import { retireMapsForTests } from '../world/mapRoster';

describe("Oak's first words", () => {
  it('greet the player by the name they have just given (playtest 47)', () => {
    const lines = spokenLines(FIRST_WORDS.lab, 'ROWAN');

    expect(lines[0]).toBe(`Ah, ROWAN, there you are! ${FIRST_WORDS.lab.lines[0]}`);
    expect(lines.slice(1)).toEqual(FIRST_WORDS.lab.lines.slice(1));
  });

  it('still greet a player the game has no name for', () => {
    expect(spokenLines(FIRST_WORDS.lab, null)[0]).toBe(`Ah, there you are! ${FIRST_WORDS.lab.lines[0]}`);
  });

  it('leave words with no greeting as they are written', () => {
    expect(spokenLines(FIRST_WORDS.center, 'ROWAN')).toEqual(FIRST_WORDS.center.lines);
  });

  it('says what a raid is on the way out of the lab in three boxes, and the hall in few enough to be read', () => {
    expect(FIRST_WORDS.lab.lines).toHaveLength(3);
    expect(FIRST_WORDS.lab.lines.join(' ')).toMatch(/exit/);
    expect(FIRST_WORDS.lab.lines.join(' ')).toMatch(/pack is lost/);
    expect(FIRST_WORDS.lab.lines.join(' ')).toMatch(/RAID ARENA/);
    expect(FIRST_WORDS.loadout.lines.length).toBeLessThanOrEqual(5);
  });
});

describe('telling a returning player the old maps are shut', () => {
  const record = { 'route-1': { deployed: 3 } };
  afterEach(() => retireMapsForTests([]));

  it('tells only somebody who raided a retired map, and only once', () => {
    retireMapsForTests(['route-1']);
    expect(mapsMovedNews({ raidRecord: record })).toBe(true);
    expect(mapsMovedNews({ raidRecord: record, firstWordsHeard: ['moved'] })).toBe(false);
    expect(mapsMovedNews({ raidRecord: { 'greystone-vale': { deployed: 3 } } })).toBe(false);
    expect(mapsMovedNews({})).toBe(false);
  });

  it('has nothing to tell while the map is in play', () => {
    retireMapsForTests([]);
    expect(mapsMovedNews({ raidRecord: record })).toBe(false);
  });
});
