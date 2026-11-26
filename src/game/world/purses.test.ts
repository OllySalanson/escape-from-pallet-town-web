import { describe, expect, it } from 'vitest';
import { trainersOn } from './mapTrainers';
import { pursesOn } from './purses';

/**
 * The fresh critic, 26 Nov 2026: a win that paid nothing could not tell a
 * player which fights still pay. THE MAP marks the ones that do, where the
 * player has been.
 */
describe('the trainers THE MAP marks as still paying', () => {
  const vale = trainersOn('greystone-vale');
  const ordinary = vale.filter((encounter) => encounter.bossId === undefined);
  const everywhere = (): boolean => true;

  it('marks every ordinary trainer nobody has been paid by, and never a boss', () => {
    const marks = pursesOn('greystone-vale', [], everywhere);
    expect(marks.map((mark) => mark.name).sort()).toEqual(ordinary.map((encounter) => encounter.trainer.name).sort());
    expect(vale.some((encounter) => encounter.bossId !== undefined)).toBe(true);
  });

  it('leaves off a trainer who has paid', () => {
    const [first] = ordinary;
    const marks = pursesOn('greystone-vale', [first.trainer.id], everywhere);
    expect(marks).toHaveLength(ordinary.length - 1);
    expect(marks.some((mark) => mark.tile.x === first.position.x && mark.tile.y === first.position.y && mark.name === first.trainer.name)).toBe(false);
  });

  it('marks only a trainer the player has walked beside', () => {
    const [first] = ordinary;
    const beside = (tile: { x: number; y: number }): boolean => tile.x === first.position.x + 1 && tile.y === first.position.y;
    const marks = pursesOn('greystone-vale', [], beside);
    expect(marks.map((mark) => mark.name)).toContain(first.trainer.name);
    expect(pursesOn('greystone-vale', [], () => false)).toEqual([]);
  });
});
