import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { generateRunPlan } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { linesSpoken, type WorldEntity } from '../world/npcs';
import { bossEncounters, createRunTrainerEncounters, type RunTrainerEncounter } from '../world/trainers';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from '../world/valeQuarters';
import { WorldScene } from './WorldScene';

/**
 * The gyms playtest of 14 Nov 2026: beat MISTY, walk to Fuchsia Gym in the
 * same raid, and KOGA was not there - a raid's trainers were fixed at deploy,
 * without him - while the Gym Guide told the new holder of the CASCADE BADGE
 * to come back with it. Koga is in the raid from the start now and stands once
 * the badge is won, and the guides' words follow the badges.
 */

const VALE = getWorldMap('greystone-vale');
const STRAND = 'greystone-vale-the-strand';
const bossTrainer = (bossId: string): RunTrainerEncounter =>
  bossEncounters(createRunTrainerEncounters()).find((boss) => boss.bossId === bossId)!;

type Scene = {
  settleBossProgress(savedGame: undefined): unknown;
  trainersForCurrentMap(): readonly RunTrainerEncounter[];
};

/** A raid on the vale deployed with `beatenBefore`, which has won the fights in `wonThisRaid`. */
function raid(beatenBefore: readonly string[], wonThisRaid: readonly string[]): Scene {
  const plan = generateRunPlan(1, undefined, STRAND, undefined, undefined, [...beatenBefore]);
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: VALE,
    defeatedTrainerIds: new Set(wonThisRaid.map((bossId) => bossTrainer(bossId).trainer.id)),
    knownInsertionIds: new Set<string>(),
    unclaimedBossGear: [],
    runSession: { plan, bag: { add: vi.fn() } },
  });
  const typed = scene as unknown as Scene;
  typed.settleBossProgress(undefined);
  return typed;
}

const kogaStands = (scene: Scene): boolean =>
  scene.trainersForCurrentMap().some((trainer) => trainer.bossId === KOGA_BOSS_ID);

describe('KOGA after MISTY, in the same raid', () => {
  it('is in the raid from the start, his tile held, and stands only once the CASCADE BADGE is won', () => {
    const plan = generateRunPlan(1, undefined, STRAND);
    expect(plan.trainers.some((trainer) => trainer.bossId === KOGA_BOSS_ID)).toBe(true);
    expect(kogaStands(raid([], []))).toBe(false);
  });

  it('is at the head of his hall straight after Misty is beaten in this raid', () => {
    expect(kogaStands(raid([], [MISTY_BOSS_ID]))).toBe(true);
  });

  it('stands for a save that came in holding the badge, and is gone once beaten', () => {
    expect(kogaStands(raid([MISTY_BOSS_ID], []))).toBe(true);
    expect(kogaStands(raid([MISTY_BOSS_ID], [KOGA_BOSS_ID]))).toBe(false);
    expect(kogaStands(raid([MISTY_BOSS_ID, KOGA_BOSS_ID], []))).toBe(false);
  });
});

describe('the Gym Guides say what is true for the badges held', () => {
  /** The Gym Guide whose first words name the leader of his gym. */
  const guideIn = (leader: string): WorldEntity => {
    const guides = VALE.entities.filter(
      (entity) => entity.design === 'gym-guide' && entity.dialogLines[0]?.includes(`${leader} holds`),
    );
    expect(guides, `${leader}'s gym guide`).toHaveLength(1);
    return guides[0];
  };

  it("Fuchsia Gym's guide: come back with the badge, then he will fight you, then the Marsh is open", () => {
    const guide = guideIn('KOGA');
    expect(linesSpoken(guide, []).join(' ')).toContain('Until then, look around!');
    const holding = linesSpoken(guide, [MISTY_BOSS_ID]).join(' ');
    expect(holding).toContain('KOGA will fight you');
    expect(holding).not.toContain('Until then');
    const after = linesSpoken(guide, [MISTY_BOSS_ID, KOGA_BOSS_ID]).join(' ');
    expect(after).toContain('You beat KOGA!');
    expect(after).not.toContain('will fight you');
  });

  it("Cerulean Gym's guide: beat her, then she is beaten and Koga is next", () => {
    const guide = guideIn('MISTY');
    expect(linesSpoken(guide, []).join(' ')).toContain('Beat her and both ways open');
    const after = linesSpoken(guide, [MISTY_BOSS_ID]).join(' ');
    expect(after).toContain('You beat MISTY!');
    expect(after).toContain('KOGA will fight you now');
  });

  it('names only bosses the game has', () => {
    const bosses = new Set(bossEncounters(createRunTrainerEncounters()).map((boss) => boss.bossId));
    const named = VALE.entities.flatMap((entity) => (entity.afterBeating ?? []).map((stage) => stage.boss));
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((boss) => !bosses.has(boss))).toEqual([]);
  });
});
