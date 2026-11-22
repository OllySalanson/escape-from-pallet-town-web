import { describe, expect, it } from 'vitest';
import { rimTeamLine } from './rimTeam';

const mon = (name: string, level: number, currentHp = 20, maxHp = 20) => ({ name, level, currentHp, maxHp });

describe("the jump screen's TEAM line", () => {
  // Tester 3's release blocker 3 (22 Nov 2026): a new catch stayed home and a
  // hurt Squirtle jumped in, and the screen said only '1 Pokémon to your 1'.
  it('names who comes, who stays home, and who is coming hurt', () => {
    expect(rimTeamLine([mon('Squirtle', 12, 16, 21)], [mon('Psyduck', 6), mon('Pidgey', 3)])).toBe(
      'Squirtle Lv 12 at 16/21 HP comes. Psyduck and Pidgey stay home: THE BENCH chooses.',
    );
  });

  it('says only who comes when nobody else is fit to', () => {
    expect(rimTeamLine([mon('Bulbasaur', 5), mon('Pidgey', 4)], [])).toBe('Bulbasaur Lv 5 and Pidgey Lv 4 come.');
  });

  it('counts the rest of a big home after three names', () => {
    const home = ['Psyduck', 'Pidgey', 'Rattata', 'Oddish', 'Zubat'].map((name) => mon(name, 5));
    expect(rimTeamLine([mon('Charmander', 9)], home)).toBe(
      'Charmander Lv 9 comes. Psyduck, Pidgey, Rattata and 2 more stay home: THE BENCH chooses.',
    );
    expect(rimTeamLine([mon('Charmander', 9)], [mon('Psyduck', 6)])).toMatch(/Psyduck stays home/);
  });
});
