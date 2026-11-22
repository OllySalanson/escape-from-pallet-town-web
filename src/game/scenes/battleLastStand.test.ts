import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { BattleScene } from './BattleScene';

/**
 * AI playtests of 22 Nov 2026: wiped by MISTY's double battle, SQUIRTLE fell
 * first and ODDISH last, and the wipe screen said 'SQUIRTLE FAINTED. The last of
 * 2 still standing.' It named the first slot rather than the last to fall.
 */
describe('the one still standing when a fight is lost', () => {
  const squirtle = { name: 'Squirtle' };
  const oddish = { name: 'Oddish' };
  const scene = (events: readonly unknown[]) => {
    const battle = Object.create(BattleScene.prototype) as BattleScene;
    Object.assign(battle as object, {
      state: { player: { pokemon: squirtle }, playerPartner: { pokemon: oddish } },
      fightTurns: [events],
    });
    return battle as unknown as { lastToFall(): unknown };
  };

  it('is the last of the player side to faint, whichever slot it stood in', () => {
    const lost = scene([
      { type: 'fainted', user: 'player', slot: 0, name: 'Squirtle' },
      { type: 'fainted', user: 'enemy', slot: 1, name: 'Horsea' },
      { type: 'fainted', user: 'player', slot: 1, name: 'Oddish' },
    ]);

    expect(lost.lastToFall()).toBe(oddish);
  });

  it('is the one out, when nothing fainted in the lines', () => {
    expect(scene([]).lastToFall()).toBe(squirtle);
  });
});
