import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { Bag } from '../items';
import { getContract } from '../objectives/contracts';
import { WorldScene } from './WorldScene';

/**
 * The raid's opening box. A delivery contract the pack cannot supply used to
 * open on the shortfall *instead of* the briefing, so the raid never said where
 * the drop was or what to press (playtest 47): the briefing comes first, the
 * warning after it.
 */
function openingBoxes(potions: number): string[] {
  const contract = getContract('wardens-resupply')!;
  const bag = new Bag();
  if (potions > 0) {
    bag.add('potion', potions);
  }
  const shown: string[][] = [];
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    bag,
    runSession: { plan: { contract }, firstDeploymentBriefingShown: false },
    dialogBox: {
      showMessage: (text: string) => shown.push([text]),
      showMessages: (texts: string[]) => shown.push([...texts]),
    },
  });
  (scene as unknown as { showFirstDeploymentBriefing(): void }).showFirstDeploymentBriefing();
  expect(shown).toHaveLength(1);
  return shown[0];
}

describe('the opening briefing', () => {
  it('keeps the briefing and adds the shortfall after it (playtest 47)', () => {
    const contract = getContract('wardens-resupply')!;
    const boxes = openingBoxes(1);
    expect(boxes[0]).toBe(contract.deploymentBriefing);
    expect(boxes[1]).toContain('still short 1 Potion');
    expect(boxes).toHaveLength(2);
  });

  it('is only the briefing when the pack holds the drop', () => {
    const contract = getContract('wardens-resupply')!;
    expect(openingBoxes(2)).toEqual([contract.deploymentBriefing]);
  });
});
