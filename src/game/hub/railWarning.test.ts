import { describe, expect, it } from 'vitest';
import { railWarning, type RailMember } from './railWarning';

const member = (name: string, currentHp: number, maxHp: number, primaryStatus: string | null = null): RailMember => ({
  name,
  currentHp,
  maxHp,
  primaryStatus,
});

describe('what the rail says of a hurt team', () => {
  it('says nothing of a team that is fit', () => {
    expect(railWarning([member('Squirtle', 17, 17)], false)).toBeNull();
    expect(railWarning([member('Squirtle', 9, 17)], false)).toBeNull();
    expect(railWarning([], false)).toBeNull();
  });

  it('stops the player who came home at 1 HP, burned, with nothing packed', () => {
    expect(railWarning([member('Squirtle', 1, 17, 'burn')], false)).toEqual({
      line: 'Squirtle is at 1/17 and burned, with no medicine packed. Nurse Joy can help.',
      stops: true,
    });
  });

  it('does not say nothing is packed when something is', () => {
    expect(railWarning([member('Squirtle', 1, 17)], true)?.line).toBe('Squirtle is at 1/17. Nurse Joy can help.');
  });

  it('names a status at full health, and leaves the cursor on JUMP IN for it', () => {
    expect(railWarning([member('Pidgey', 15, 15, 'poison')], true)).toEqual({
      line: 'Pidgey is poisoned. Nurse Joy can help.',
      stops: false,
    });
  });

  it('names one hurt Pokémon on a fit team, and does not stop the team', () => {
    const warning = railWarning([member('Charmeleon', 40, 40), member('Pidgey', 2, 15)], true);
    expect(warning?.line).toBe('Pidgey is at 2/15. Nurse Joy can help.');
    expect(warning?.stops).toBe(false);
  });

  it('counts anybody past the second, because the card has only so many lines', () => {
    const warning = railWarning([member('A', 1, 20), member('B', 1, 20), member('C', 1, 20), member('D', 1, 20)], true);
    expect(warning?.line).toBe('A is at 1/20, and B is at 1/20; 2 more are hurt. Nurse Joy can help.');
    expect(warning?.stops).toBe(true);
  });
});
