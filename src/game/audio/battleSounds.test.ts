import { describe, expect, it } from 'vitest';
import { MoveCategory } from '../pokemon/MoveBase';
import type { BattleEvent } from '../pokemon/battle/battleEngine';
import { battleOpeningMessages } from '../pokemon/battle/battleFlow';
import { battleEventCry, battleEventSound, battleNote, openingLineSounds } from './battleSounds';

const used = (extra: Partial<Extract<BattleEvent, { type: 'used-move' }>>): BattleEvent => ({
  type: 'used-move',
  user: 'player',
  name: 'Bulbasaur',
  move: 'Tackle',
  ...extra,
});

describe('battleEventSound', () => {
  it('sounds a hit when it lands, by the kind of move that landed', () => {
    expect(battleEventSound(used({ damage: 6, category: MoveCategory.Physical, target: 'enemy' }))).toEqual({
      name: 'hitPhysical',
      at: 'impact',
    });
    expect(battleEventSound(used({ damage: 6, category: MoveCategory.Special, target: 'enemy' }))).toEqual({
      name: 'hitSpecial',
      at: 'impact',
    });
  });

  it('gives a status move its own sound, with its line', () => {
    expect(battleEventSound(used({ damage: 0, category: MoveCategory.Status, target: 'enemy' }))).toEqual({
      name: 'statusMove',
      at: 'line',
    });
  });

  it('leaves a missed move to the miss that follows it', () => {
    expect(battleEventSound(used({}))).toBeNull();
    expect(battleEventSound({ type: 'missed', user: 'player', name: 'Charmander' })?.name).toBe('miss');
  });

  it('tells the three effectiveness lines apart', () => {
    const name = (multiplier: number) => battleEventSound({ type: 'effectiveness', multiplier })?.name;
    expect(name(2)).toBe('superEffective');
    expect(name(0.5)).toBe('notVeryEffective');
    expect(name(0)).toBe('noEffect');
  });

  it('tells a stat rising from a stat falling', () => {
    const name = (stages: number) =>
      battleEventSound({ type: 'stat-stage-changed', user: 'enemy', name: 'Rattata', stat: 'attack', stages })
        ?.name;
    expect(name(1)).toBe('statUp');
    expect(name(-1)).toBe('statDown');
  });

  it('walks a catch through throw, shake, and either ending', () => {
    expect(battleEventSound({ type: 'ball-thrown', name: 'Pidgey' })?.name).toBe('ballThrow');
    expect(battleEventSound({ type: 'catch-shake', count: 1 })?.name).toBe('ballShake');
    expect(battleEventSound({ type: 'broke-free', name: 'Pidgey' })?.name).toBe('ballBreak');
    expect(battleEventSound({ type: 'caught', name: 'Pidgey' })?.name).toBe('catchSuccess');
  });

  it('only ever defers a sound for a move that does damage', () => {
    const events: BattleEvent[] = [
      { type: 'missed', user: 'enemy', name: 'Pidgey' },
      { type: 'critical-hit' },
      { type: 'enemy-sent-out', trainer: 'MAYA', name: 'Pidgey' },
      { type: 'no-pp', user: 'player', move: 'Tackle' },
    ];
    for (const event of events) {
      expect(battleEventSound(event)?.at).toBe('line');
    }
  });
});

describe('battleNote', () => {
  it('carries a sound only when one was written', () => {
    expect(battleNote('Come back!')).toEqual({ message: 'Come back!' });
    expect(battleNote({ message: 'Grew to Lv 6!', sound: 'levelUp' })).toEqual({
      message: 'Grew to Lv 6!',
      sound: 'levelUp',
    });
  });
});

describe('battleEventCry', () => {
  it('cries for a Pokemon sent out, fainting or caught, and for nothing else', () => {
    expect(battleEventCry({ type: 'enemy-sent-out', trainer: 'MAYA', name: 'Pidgey', slot: 1 })).toEqual({
      name: 'cry',
      side: 'enemy',
      slot: 1,
    });
    expect(battleEventCry({ type: 'fainted', user: 'player', name: 'Charmander' })).toEqual({
      name: 'faintCry',
      side: 'player',
      slot: 0,
    });
    expect(battleEventCry({ type: 'caught', name: 'Pidgey' })).toEqual({ name: 'cry', side: 'enemy', slot: 0 });
    for (const event of [
      { type: 'ball-thrown', name: 'Pidgey' },
      { type: 'broke-free', name: 'Pidgey' },
      { type: 'critical-hit' },
      { type: 'missed', user: 'enemy', name: 'Pidgey' },
    ] as const) {
      expect(battleEventCry(event), event.type).toBeNull();
    }
  });

  it('lets the faint cry be the faint, rather than a run of tones on top of it', () => {
    expect(battleEventSound({ type: 'fainted', user: 'enemy', name: 'Pidgey' })).toBeNull();
  });

  it('keeps the fanfare on the catch, which the cry then follows', () => {
    expect(battleEventSound({ type: 'caught', name: 'Pidgey' })?.name).toBe('catchSuccess');
  });
});

describe('openingLineSounds', () => {
  it('cries the wild Pokemon as it appears', () => {
    expect(openingLineSounds(undefined, [4], [16])).toEqual([{ cries: [{ name: 'cry', species: 16 }] }]);
  });

  it("pops the ball and cries the player's Pokemon on the opening Go line (playtest 28, S2)", () => {
    expect(openingLineSounds('RAIDER MAYA', [4], [19])).toEqual([
      // A single battle never names what the trainer sent out, so its Pokemon
      // cries on the challenge line, after the sting that opens the fight.
      { cries: [{ name: 'cry', species: 19 }] },
      { sound: 'sendOut', cries: [{ name: 'cry', species: 4 }] },
    ]);
  });

  it('lines up with the double battle opening, where both sides name both Pokemon', () => {
    const lines = battleOpeningMessages('WARDEN HOLT', ['Charmander', 'Pidgey'], ['Butterfree', 'Squirtle']);
    const sounds = openingLineSounds('WARDEN HOLT', [4, 16], [12, 7]);
    expect(sounds).toHaveLength(lines.length);
    expect(sounds).toEqual([
      { cries: [] },
      {
        sound: 'sendOut',
        cries: [
          { name: 'cry', species: 12 },
          { name: 'cry', species: 7 },
        ],
      },
      {
        sound: 'sendOut',
        cries: [
          { name: 'cry', species: 4 },
          { name: 'cry', species: 16 },
        ],
      },
    ]);
  });

  it('has a sound for every opening line, in a fight of either kind', () => {
    expect(openingLineSounds(undefined, [4], [16])).toHaveLength(battleOpeningMessages(undefined, ['A'], ['B']).length);
    expect(openingLineSounds('MAYA', [4], [16])).toHaveLength(battleOpeningMessages('MAYA', ['A'], ['B']).length);
  });
});
