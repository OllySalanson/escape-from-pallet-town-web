import { describe, expect, it } from 'vitest';
import { getCharacterDesign } from './characterDesigns';
import { FIRST_HUNTER_RIVAL, HUNTER_RIVALS, hunterRival, rivalForRaid } from './hunters';

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
    for (const beat of ['arrival', 'getaway', 'defeat', 'personality'] as const) {
      const lines = HUNTER_RIVALS.map((rival) => rival[beat]);
      expect(new Set(lines).size).toBe(HUNTER_RIVALS.length);
      lines.forEach((line) => expect(line.trim()).not.toBe(''));
    }
    for (const rival of HUNTER_RIVALS) {
      expect(rival.caught).toHaveLength(2);
      // The arrival names who it is, because that box is the only place the
      // player is told who is hunting them once the raid has started.
      expect(rival.arrival.startsWith(rival.name)).toBe(true);
    }
  });
});
