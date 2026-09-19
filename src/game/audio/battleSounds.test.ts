import { describe, expect, it } from 'vitest';
import { MoveCategory } from '../pokemon/MoveBase';
import type { BattleEvent } from '../pokemon/battle/battleEngine';
import { battleEventSound, battleNote } from './battleSounds';

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
    expect(battleEventSound({ type: 'missed', user: 'player' })?.name).toBe('miss');
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
      { type: 'fainted', user: 'enemy', name: 'Pidgey' },
      { type: 'critical-hit' },
      { type: 'enemy-sent-out', name: 'Pidgey' },
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
