import { describe, expect, it } from 'vitest';
import { getCharacterDesign } from './characterDesigns';
import { caughtLines, FIRST_HUNTER_RIVAL, HUNTER_RIVALS, hunterRival, rivalForRaid, storedRivalId } from './hunters';
import { valeGyms } from './valeQuarters';

describe('the five hunters', () => {
  it('opens with Blue, as the captain asked', () => {
    expect(FIRST_HUNTER_RIVAL).toBe('blue');
    expect(HUNTER_RIVALS[0].id).toBe('blue');
    expect(rivalForRaid(0)).toBe('blue');
  });

  it('takes turns, one raid each, and comes back round to Blue', () => {
    const turns = Array.from({ length: 11 }, (_, raid) => rivalForRaid(raid));
    expect(turns.slice(0, 5)).toEqual(HUNTER_RIVALS.map((rival) => rival.id));
    expect(turns[5]).toBe('blue');
    expect(turns[10]).toBe('blue');
    expect(new Set(turns.slice(0, 5)).size).toBe(5);
  });

  it('is five different people, each drawn as themselves', () => {
    expect(HUNTER_RIVALS).toHaveLength(5);
    expect(new Set(HUNTER_RIVALS.map((rival) => rival.name)).size).toBe(5);
    for (const rival of HUNTER_RIVALS) {
      // A named design: the person the game draws under that name, never a
      // class of trainer dressed as one.
      expect(getCharacterDesign(rival.design).kind).toBe('named');
      expect(hunterRival(rival.id)).toBe(rival);
    }
  });

  /**
   * "Keep all mechanics of how they fight the same for now." Nothing on a rival
   * can reach a fight but its temperament, and every shipped one is ordinary -
   * the harder hunter is a later, deliberate addition.
   */
  it('fights the same whoever it is: every shipped rival is ordinary', () => {
    for (const rival of HUNTER_RIVALS) {
      expect(rival.temperament).toBe('ordinary');
    }
  });

  it('gives every rival their own words for every beat', () => {
    for (const beat of ['getaway', 'defeat', 'personality'] as const) {
      const lines = HUNTER_RIVALS.map((rival) => rival[beat]);
      expect(new Set(lines).size).toBe(HUNTER_RIVALS.length);
      lines.forEach((line) => expect(line.trim()).not.toBe(''));
    }
    for (const rival of HUNTER_RIVALS) {
      expect(rival.caught).toHaveLength(2);
      // Both lines are theirs, said in their own name.
      rival.caught.forEach((line) => expect(line.startsWith(`${rival.name}: "`)).toBe(true));
    }
    expect(new Set(HUNTER_RIVALS.map((rival) => rival.caught[0])).size).toBe(HUNTER_RIVALS.length);
  });

  /**
   * The captain, 2026-10-29: "when he catches you it should say whatever you
   * found loser it's mine". The catch is the only time a rival speaks before
   * the fight now that the arrival is a glow, so its first line gloats about
   * the pack - in each rival's own voice, never one sentence five times.
   */
  it('gloats about your loot as they catch you', () => {
    for (const rival of HUNTER_RIVALS) {
      expect(rival.caught[0]).toMatch(/found|pack|loot|gathered/i);
      expect(rival.caught[0]).toMatch(/mine|take/i);
    }
  });

  /**
   * Past 0:00 every hunter comes stronger. Said in the caught lines, a hunter
   * beaten earlier in the raid came back with twice the level and the same
   * words, and nothing said why (the overnight retest, 23 Nov 2026).
   */
  it('says the clock ran out when they catch you after 0:00, in their own voice', () => {
    for (const rival of HUNTER_RIVALS) {
      expect(rival.lateCaught).toHaveLength(2);
      rival.lateCaught.forEach((line) => expect(line.startsWith(`${rival.name}: "`)).toBe(true));
      expect(rival.lateCaught.join(' ')).toMatch(/time|clock|too long|lingered|frost set in/i);
      expect(rival.lateCaught.filter((line) => rival.caught.includes(line))).toEqual([]);
      expect(caughtLines(rival, false)).toBe(rival.caught);
      expect(caughtLines(rival, true)).toBe(rival.lateCaught);
    }
    expect(new Set(HUNTER_RIVALS.map((rival) => rival.lateCaught[0])).size).toBe(HUNTER_RIVALS.length);
  });
});

describe('a hunter is never a gym leader', () => {
  /**
   * 13 of 19 first-time players in the 22 Nov 2026 playtest beat a Lv 2
   * "MISTY" on their first raid and took the real one at Cerulean Gym for
   * somebody already beaten. No hunter shares a name with anybody who leads a
   * gym, in the vale or in Kanto, so the next gym is never one of them.
   */
  it('shares a name with no gym leader', () => {
    const leaders = [
      ...valeGyms().map((gym) => gym.leader.toUpperCase()),
      ...['BROCK', 'MISTY', 'LT. SURGE', 'ERIKA', 'KOGA', 'SABRINA', 'BLAINE', 'GIOVANNI'],
    ];
    for (const rival of HUNTER_RIVALS) {
      expect(leaders).not.toContain(rival.name);
      for (const line of [...rival.caught, ...rival.lateCaught, rival.getaway, rival.defeat, ...Object.values(rival.hall)]) {
        expect(leaders.filter((leader) => line.includes(leader)), line).toEqual([]);
      }
    }
  });

  it('reads a save that names a hunter by the name they had before', () => {
    expect(storedRivalId('misty')).toBe('lorelei');
    expect(storedRivalId('lt-surge')).toBe('bruno');
    expect(storedRivalId('koga')).toBe('agatha');
    expect(storedRivalId('sabrina')).toBe('lance');
    for (const rival of HUNTER_RIVALS) {
      expect(storedRivalId(rival.id)).toBe(rival.id);
    }
    expect(storedRivalId('giovanni')).toBeUndefined();
    expect(storedRivalId(7)).toBeUndefined();
  });
});
