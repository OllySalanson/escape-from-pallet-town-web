import { describe, expect, it } from 'vitest';
import { BREATH_LISTENS_AFTER_MS, MOST_WORDS, RAIDS_NAMED_IN_FULL, betOf, breathMs, climbAt, railStamps, stakeWords, wordsUpAt, type AtRisk } from './heldBreath';

const team: AtRisk = {
  pokemon: [
    { name: 'Pidgeotto', level: 17 },
    { name: 'Charmeleon', level: 19 },
  ],
  pack: 'Ranger pack',
  packIsBetter: true,
  items: ['Potion ×2', 'Super Potion ×2'],
};

describe('the held breath', () => {
  it('names everything at risk on a team\'s first raids, whoever is most at stake first', () => {
    for (let raids = 1; raids <= RAIDS_NAMED_IN_FULL; raids += 1) {
      expect(stakeWords(team, raids)).toEqual(['AT RISK', 'CHARMELEON', 'PIDGEOTTO', 'RANGER PACK', 'POTION ×2', 'SUPER POTION ×2']);
    }
  });

  it('after that says only what would hurt, so it never drags at raid two hundred', () => {
    expect(stakeWords(team, RAIDS_NAMED_IN_FULL + 1)).toEqual(['AT RISK', 'CHARMELEON']);
    expect(stakeWords(team, 200)).toEqual(['AT RISK', 'CHARMELEON']);
    expect(stakeWords({ ...team, pokemon: [] }, 200)).toEqual(['AT RISK', 'RANGER PACK']);
  });

  it('after that has nothing to say of the pack everybody is issued, or of a stack of Potions', () => {
    const everyday: AtRisk = { pokemon: [], pack: 'Raid pack', packIsBetter: false, items: ['Potion ×3'] };
    expect(stakeWords(everyday, RAIDS_NAMED_IN_FULL)).toEqual(['AT RISK', 'RAID PACK', 'POTION ×3']);
    expect(stakeWords(everyday, RAIDS_NAMED_IN_FULL + 1)).toEqual([]);
    expect(stakeWords(everyday, 200)).toEqual([]);
  });

  it('says so when there is nothing to lose, only on a team\'s first raids', () => {
    const nothing: AtRisk = { pokemon: [], pack: null, packIsBetter: false, items: [] };
    expect(stakeWords(nothing, 1)).toEqual(['NOTHING TO LOSE']);
    expect(stakeWords(nothing, 200)).toEqual([]);
  });

  it('never asks the screen to hold more than it can', () => {
    const items = Array.from({ length: 12 }, (_each, index) => `Thing ${index}`);
    expect(stakeWords({ ...team, items }, 1)).toHaveLength(MOST_WORDS);
  });

  it('says what the words are: AT RISK over them, and what is SAFE under them', () => {
    expect(railStamps({ ...team, safe: ['Pidgey', 'Rattata', 'Oddish'] }, 1)).toEqual([
      { text: 'AT RISK', kind: 'risk' },
      { text: 'CHARMELEON', kind: 'risk' },
      { text: 'PIDGEOTTO', kind: 'risk' },
      { text: 'RANGER PACK', kind: 'risk' },
      { text: 'POTION ×2', kind: 'risk' },
      { text: 'SAFE: PIDGEY, RATTATA', kind: 'safe' },
    ]);
    expect(railStamps({ pokemon: [], pack: null, packIsBetter: false, items: [], safe: ['Pidgey'] }, 1)).toEqual([
      { text: 'NOTHING TO LOSE', kind: 'risk' },
      { text: 'SAFE: PIDGEY', kind: 'safe' },
    ]);
  });

  it('never asks more of the screen with a heading and a SAFE line than it did without', () => {
    const items = Array.from({ length: 12 }, (_each, index) => `Thing ${index}`);
    expect(railStamps({ ...team, items, safe: ['Pidgey'] }, 1)).toHaveLength(MOST_WORDS);
  });

  it('stops for nothing when nothing is worth stopping for, heading and all', () => {
    expect(railStamps({ pokemon: [], pack: 'Raid pack', packIsBetter: false, items: ['Potion ×3'], safe: ['Pidgey'] }, 200)).toEqual([]);
  });

  it('names a partner at risk, first, whoever else is going over', () => {
    const risked: AtRisk = {
      pokemon: [
        { name: 'Pidgeotto', level: 30 },
        { name: 'Charmander', level: 9, partner: true },
      ],
      pack: null,
      packIsBetter: false,
      items: [],
    };
    expect(stakeWords(risked, 1)[1]).toBe('YOUR PARTNER CHARMANDER');
    expect(stakeWords(risked, 200)).toEqual(['AT RISK', 'YOUR PARTNER CHARMANDER']);
  });

  it('tells the house how big a bet it is', () => {
    const none: AtRisk = { pokemon: [], pack: null, packIsBetter: false, items: [] };
    expect(betOf(none)).toBe('nothing');
    expect(betOf({ ...none, pack: 'Raid pack', items: ['Potion ×3'] })).toBe('some');
    expect(betOf({ ...none, pokemon: [{ name: 'Pidgey', level: 3 }] })).toBe('some');
    expect(betOf({ ...none, pokemon: [{ name: 'Bulbasaur', level: 5, partner: true }] })).toBe('big');
    expect(betOf({ ...none, pack: 'Ranger pack', packIsBetter: true })).toBe('big');
    expect(betOf({ ...none, pokemon: [{ name: 'Pidgey', level: 3 }, { name: 'Rattata', level: 3 }] })).toBe('big');
  });

  it('holds about a beat at raid two hundred, a little more for a new team, and every word gets its time', () => {
    expect(breathMs(1)).toBeLessThan(1000);
    expect(breathMs(MOST_WORDS)).toBeLessThan(2000);
    expect(BREATH_LISTENS_AFTER_MS).toBeLessThan(breathMs(1));
    for (const words of [1, 3, MOST_WORDS]) {
      expect(wordsUpAt(0, words).count).toBe(0);
      expect(wordsUpAt(breathMs(words) - 1, words).count).toBe(words);
      let last = 0;
      for (let ms = 0; ms < breathMs(words); ms += 10) {
        const { count, newestMs } = wordsUpAt(ms, words);
        expect(count - last).toBeLessThanOrEqual(1);
        expect(newestMs).toBeGreaterThanOrEqual(0);
        last = count;
      }
    }
  });

  it('climbs towards the fence and up, whichever way the fence is, in whole pixels', () => {
    expect(climbAt(0, { x: 0, y: -1 }).y === 0 && climbAt(0, { x: 0, y: -1 }).x === 0).toBe(true);
    expect(climbAt(1000, { x: 0, y: -1 }).y).toBeLessThan(-8);
    expect(climbAt(1000, { x: 1, y: 0 }).x).toBeGreaterThan(8);
    expect(climbAt(1000, { x: 1, y: 0 }).y).toBeLessThan(0);
    for (let ms = 0; ms < 200; ms += 7) {
      const at = climbAt(ms, { x: 0, y: 1 });
      expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true);
    }
  });
});
