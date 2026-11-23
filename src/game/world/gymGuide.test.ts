import { describe, expect, it } from 'vitest';
import { gymDoorGuide } from './gymGuide';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from './valeQuarters';
import vale from './maps/greystoneVale.json';

/**
 * Each gym's door sign says how strong to be first, worked out from the team
 * inside (the 20 Nov AI playtest walked into both blind, #20, #124).
 */
describe('the level guide at a gym door', () => {
  it('words the team from the team itself: how many, their levels, two at once, and the lead to match', () => {
    expect(gymDoorGuide(MISTY_BOSS_ID)).toBe('MISTY: three Pokémon, Lv 10 to 12, two out at once. Bring two at Lv 12 or more.');
    // KOGA's KOFFING Self-Destructs, and took a lone partner and the raid with it.
    expect(gymDoorGuide(KOGA_BOSS_ID)).toBe(
      'KOGA: three Pokémon, Lv 17 to 20, two out at once. Bring two at Lv 20 or more. KOFFING knows SELF-DESTRUCT!',
    );
  });

  it.each([
    ['CERULEAN GYM', MISTY_BOSS_ID],
    ['FUCHSIA GYM', KOGA_BOSS_ID],
  ])('stands on the %s door sign, as the team stands today', (gym, bossId) => {
    const sign = vale.signs.find((candidate) => candidate.lines[0] === gym && !('area' in candidate));
    expect(sign?.lines).toContain(gymDoorGuide(bossId));
  });
});
