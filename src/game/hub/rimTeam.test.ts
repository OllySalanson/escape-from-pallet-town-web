import { describe, expect, it } from 'vitest';
import { rimTeamLine } from './rimTeam';

const mon = (name: string, level: number, currentHp = 20, maxHp = 20) => ({ name, level, currentHp, maxHp });

describe("the jump screen's TEAM line", () => {
  // Tester 3's release blocker 3 (22 Nov 2026): a new catch stayed home and a
  // hurt Squirtle jumped in, and the screen said only '1 Pokémon to your 1'.
  it('names who comes, who stays home, and who is coming hurt', () => {
    expect(rimTeamLine([mon('Squirtle', 12, 16, 21)], [mon('Psyduck', 6), mon('Pidgey', 3)])).toBe(
      'Squirtle Lv 12 at 16/21 HP comes. Psyduck and Pidgey stay home: pick who comes at THE BENCH.',
    );
  });

  it('says only who comes when nobody else is fit to', () => {
    expect(rimTeamLine([mon('Bulbasaur', 5), mon('Pidgey', 4)], [])).toBe('Bulbasaur Lv 5 and Pidgey Lv 4 come.');
  });

  it('counts the rest of a big home after three names', () => {
    const home = ['Psyduck', 'Pidgey', 'Rattata', 'Oddish', 'Zubat'].map((name) => mon(name, 5));
    expect(rimTeamLine([mon('Charmander', 9)], home)).toBe(
      'Charmander Lv 9 comes. Psyduck, Pidgey, Rattata and 2 more stay home: pick who comes at THE BENCH.',
    );
    expect(rimTeamLine([mon('Charmander', 9)], [mon('Psyduck', 6)])).toMatch(/Psyduck stays home/);
  });

  it('says who has fainted and why they stay home', () => {
    expect(rimTeamLine([mon('Charmander', 5)], [], [mon('Bulbasaur', 6, 0, 21)])).toBe(
      'Charmander Lv 5 comes. Bulbasaur has fainted and stays home: Nurse Joy can revive it.',
    );
    expect(rimTeamLine([mon('Charmander', 5)], [mon('Psyduck', 6)], [mon('Bulbasaur', 6, 0, 21), mon('Pidgey', 3, 0, 15)])).toBe(
      'Charmander Lv 5 comes. Psyduck stays home: pick who comes at THE BENCH. Bulbasaur and Pidgey have fainted and stay home: Nurse Joy can revive them.',
    );
  });

  // Break-it test, 23 Nov 2026: a Pidgey Lv 6 on the bench and a new catch at
  // home read 'Pidgey Lv 6 ... come. Pidgey stays home'.
  it('names one of two of a kind by its level too, wherever the other is', () => {
    expect(rimTeamLine([mon('Charmander', 5), mon('Pidgey', 6)], [mon('Pidgey', 4), mon('Psyduck', 6)])).toBe(
      'Charmander Lv 5 and Pidgey Lv 6 come. Pidgey Lv 4 and Psyduck stay home: pick who comes at THE BENCH.',
    );
    expect(rimTeamLine([mon('Charmander', 5)], [mon('Rattata', 3), mon('Rattata', 7)])).toBe(
      'Charmander Lv 5 comes. Rattata Lv 3 and Rattata Lv 7 stay home: pick who comes at THE BENCH.',
    );
    expect(rimTeamLine([mon('Pidgey', 6)], [], [mon('Pidgey', 4, 0, 17)])).toBe(
      'Pidgey Lv 6 comes. Pidgey Lv 4 has fainted and stays home: Nurse Joy can revive it.',
    );
  });
});
