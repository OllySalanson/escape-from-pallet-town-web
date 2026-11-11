import { describe, expect, it } from 'vitest';
import { getCharacterDesign } from './characterDesigns';
import { FIRST_HUNTER_RIVAL, HUNTER_RIVALS, hunterRival, ownGymRooms, rivalForRaid, rivalsStoodDown } from './hunters';
import { getWorldMap } from '../worldMap';
import { KOGA_BOSS_ID, MISTY_BOSS_ID, valeGyms } from './valeQuarters';

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
});

describe('a gym leader beaten in the raid', () => {
  it('is a rival, for every gym, so beating any of them can stand one down', () => {
    for (const gym of valeGyms()) {
      expect(HUNTER_RIVALS.map((rival) => rival.id)).toContain(gym.rival);
      expect(rivalsStoodDown([gym.bossId])).toEqual([gym.rival]);
    }
  });

  it('stands down only for the gyms won in this raid, and for nothing else beaten', () => {
    expect(rivalsStoodDown([])).toEqual([]);
    expect(rivalsStoodDown(['vale-coast-fisherman-hal'])).toEqual([]);
    expect(rivalsStoodDown([KOGA_BOSS_ID])).toEqual(['koga']);
    expect(rivalsStoodDown(new Set([MISTY_BOSS_ID, KOGA_BOSS_ID]))).toEqual(['misty', 'koga']);
  });
});

describe('a gym leader hunting', () => {
  it('keeps out of their own gym room, found by the name the vale gives it, for every gym', () => {
    const vale = getWorldMap('greystone-vale');
    const rooms = ownGymRooms(vale.areas);
    expect([...rooms.keys()]).toEqual(valeGyms().map((gym) => gym.rival));
    for (const gym of valeGyms()) {
      const room = vale.areas!.find((area) => area.name === gym.building)!;
      expect(rooms.get(gym.rival as (typeof HUNTER_RIVALS)[number]['id']), gym.building).toEqual(room.rect);
    }
  });

  it('keeps nobody out of anywhere on a map without the gyms', () => {
    expect(ownGymRooms(undefined).size).toBe(0);
    expect(ownGymRooms(getWorldMap('route-1').areas).size).toBe(0);
  });
});
