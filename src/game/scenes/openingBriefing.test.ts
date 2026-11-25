import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { BASE_STAGE_HEIGHT } from '../display/stage';
import { Bag } from '../items';
import { getContract } from '../objectives/contracts';
import { FIRST_RAID_BRIEFING } from '../hub/firstRaid';
import { WorldScene } from './WorldScene';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { FIRST_CATCH_LANDING_LINES } from '../world/firstCatch';

/**
 * The raid's opening box. A delivery contract the pack cannot supply used to
 * open on the shortfall *instead of* the briefing, so the raid never said where
 * the drop was or what to press (playtest 47): the briefing comes first, the
 * warning after it.
 */
function openBriefing(
  potions: number,
  playerScreenRow = 6,
  plan: object = { contract: getContract('wardens-resupply')! },
  currentMap?: object,
): { shown: string[][]; seatedAt: number[] } {
  const bag = new Bag();
  if (potions > 0) {
    bag.add('potion', potions);
  }
  const shown: string[][] = [];
  const seatedAt: number[] = [];
  const player = { x: 12, y: 70 };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    bag,
    currentTile: player,
    runSession: { plan, firstDeploymentBriefingShown: false },
    currentMap,
    idleFigures: [],
    // The first frame: `startFollow` has set the scroll, and the worldView is
    // still whatever it was before the camera was first drawn.
    cameras: {
      main: { scrollX: 0, scrollY: (player.y - playerScreenRow) * 16, worldView: { left: 0, top: 0 } },
    },
    scale: { height: BASE_STAGE_HEIGHT },
    dialogBox: {
      x: 8,
      setY: (y: number) => seatedAt.push(y),
      showMessage: (text: string) => shown.push([text]),
      showMessages: (texts: string[]) => shown.push([...texts]),
    },
  });
  (scene as unknown as { showFirstDeploymentBriefing(): void }).showFirstDeploymentBriefing();
  return { shown, seatedAt };
}

function openingBoxes(potions: number): string[] {
  const { shown } = openBriefing(potions);
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

  it('stands clear of a player the camera cannot centre, so they are seen while it is read', () => {
    // THE STRAND lands three tiles from Pallet Town's bottom edge: the camera
    // stops at the edge and the player stands in the bottom of the screen,
    // under where the box is drawn.
    const nearTheFoot = openBriefing(2, 12).seatedAt;
    expect(nearTheFoot.at(-1)).toBeLessThan(BASE_STAGE_HEIGHT / 2);
    // In the middle of the screen the box stays where every line is said.
    const centred = openBriefing(2, 6).seatedAt;
    expect(centred.at(-1) ?? BASE_STAGE_HEIGHT).toBeGreaterThan(BASE_STAGE_HEIGHT / 2);
  });
});

describe("a new save's first raid", () => {
  it('is told what a raid is as it lands, in two short boxes, where there is no catch to begin with', () => {
    // The 22 Nov 2026 AI playtest: the first jump said nothing of the job, the
    // clock or the risk, and the second raid's briefing was the first word.
    const { shown } = openBriefing(0, 6, { stagedChase: true });
    expect(shown).toEqual([[...FIRST_RAID_BRIEFING]]);
    expect(FIRST_RAID_BRIEFING).toHaveLength(2);
    for (const line of FIRST_RAID_BRIEFING) {
      expect(line.length).toBeLessThanOrEqual(120);
    }
    expect(FIRST_RAID_BRIEFING.join(' ')).toMatch(/gold arrow/);
    expect(FIRST_RAID_BRIEFING.join(' ')).toMatch(/clock/);
    expect(FIRST_RAID_BRIEFING.join(' ')).toMatch(/pack is lost/);
  });

  it("opens on the catch where the landing has the square's Pidgey: one box, the one thing to do", () => {
    const vale = getWorldMap('greystone-vale');
    const insertion = RUN_INSERTIONS['greystone-vale'];
    const { shown } = openBriefing(0, 6, { stagedChase: true, insertion }, vale);
    expect(shown).toEqual([[...FIRST_CATCH_LANDING_LINES]]);
  });

  it('says nothing on a later raid without a job', () => {
    expect(openBriefing(0, 6, {}).shown).toEqual([]);
  });
});
