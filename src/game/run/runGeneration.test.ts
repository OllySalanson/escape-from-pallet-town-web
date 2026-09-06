import { describe, expect, it } from 'vitest';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';
import { RunManager } from './RunManager';
import { createActiveRunSession } from './RunSession';
import {
  generateRunPlan,
  RUN_GENERATION_BOUNDS,
} from './runGeneration';

const seeds = [1, 27, 999_999];

function tileKey(position: { x: number; y: number }): string {
  return `${position.x},${position.y}`;
}

function expectValidTile(mapId: WorldMapId, position: { x: number; y: number }): void {
  const map = WORLD_MAPS[mapId];
  const warps = new Set(map.warps.map((warp) => tileKey(warp.source)));
  expect(position.x).toBeGreaterThanOrEqual(0);
  expect(position.y).toBeGreaterThanOrEqual(0);
  expect(position.x).toBeLessThan(map.width);
  expect(position.y).toBeLessThan(map.height);
  expect(map.collision[position.y][position.x]).toBe(false);
  expect(warps.has(tileKey(position))).toBe(false);
}

describe('run generation', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    expect(generateRunPlan(12345)).toEqual(generateRunPlan(12345));
    expect(generateRunPlan(12345)).not.toEqual(generateRunPlan(54321));
  });

  it('gives sessions a reproducible runtime stream derived from the plan seed', () => {
    const plan = generateRunPlan(12345);
    const first = createActiveRunSession(new RunManager(), {}, {}, [], [], undefined, plan);
    const second = createActiveRunSession(new RunManager(), {}, {}, [], [], undefined, plan);

    expect(first.seed).toBe(plan.seed);
    expect([first.rng!.next(), first.rng!.next()]).toEqual([second.rng!.next(), second.rng!.next()]);
  });

  it('keeps generated loot, trainers, and extraction points on valid tiles', () => {
    for (const seed of seeds) {
      const plan = generateRunPlan(seed);
      expectValidTile(plan.insertion.mapId, plan.insertion.position);
      expectValidTile(plan.contract!.mapId, plan.contract!.position);
      for (const [mapId, loot] of Object.entries(plan.loot) as [WorldMapId, typeof plan.loot[WorldMapId]][]) {
        loot.forEach((item) => expectValidTile(mapId, item.position));
      }
      plan.trainers.forEach((trainer) => expectValidTile(trainer.mapId, trainer.position));
      plan.extractionPoints.forEach((point) => expectValidTile(point.mapId, point.position));
      expect(plan.trainers.map((trainer) => `${trainer.mapId}:${tileKey(trainer.position)}`)).not.toContain(
        `${plan.insertion.mapId}:${tileKey(plan.insertion.position)}`,
      );
      expect(plan.loot[plan.insertion.mapId].map((loot) => tileKey(loot.position))).not.toContain(
        tileKey(plan.insertion.position),
      );
    }
  });

  it('always supplies encounters and an immediately reachable starting exit', () => {
    for (const seed of seeds) {
      const plan = generateRunPlan(seed);
      expect(Object.values(plan.encounters).some((table) => table.entries.length > 0)).toBe(true);
      expect(plan.extractionPoints).toContainEqual(
        expect.objectContaining({ mapId: 'pallet-town', unlockAtMs: 0 }),
      );
    }
  });

  it('keeps encounter, extraction, and hunter values within configured bounds', () => {
    for (const seed of seeds) {
      const plan = generateRunPlan(seed);
      for (const [mapId, table] of Object.entries(plan.encounters) as [WorldMapId, NonNullable<typeof plan.encounters[WorldMapId]>][]) {
        const baseTable = WORLD_MAPS[mapId].encounters;
        if (!baseTable) {
          throw new Error(`Missing base encounters for ${mapId}.`);
        }
        const baseEntries = baseTable.entries;
        expect(table.stepEncounterRate).toBeGreaterThanOrEqual(RUN_GENERATION_BOUNDS.encounterRateMinimum);
        expect(table.stepEncounterRate).toBeLessThanOrEqual(RUN_GENERATION_BOUNDS.encounterRateMaximum);
        table.entries.forEach((entry, index) => {
          const base = baseEntries[index];
          expect(Math.abs(entry.minLevel - base.minLevel)).toBeLessThanOrEqual(RUN_GENERATION_BOUNDS.encounterLevelVariance);
          expect(Math.abs(entry.maxLevel - base.maxLevel)).toBeLessThanOrEqual(RUN_GENERATION_BOUNDS.encounterLevelVariance);
          expect(entry.minLevel).toBeGreaterThanOrEqual(1);
        });
      }
      plan.extractionPoints.forEach((point) => {
        expect(point.unlockAtMs).toBeGreaterThanOrEqual(RUN_GENERATION_BOUNDS.extractionUnlockMinimumMs);
        expect(point.unlockAtMs).toBeLessThanOrEqual(RUN_GENERATION_BOUNDS.extractionUnlockMaximumMs);
      });
      expect(plan.hunter.spawnDelayMs).toBeGreaterThanOrEqual(RUN_GENERATION_BOUNDS.hunterSpawnDelayMinimumMs);
      expect(plan.hunter.spawnDelayMs).toBeLessThanOrEqual(RUN_GENERATION_BOUNDS.hunterSpawnDelayMaximumMs);
      expect(plan.hunter.aggressionStepsPerPlayerStep).toBeGreaterThanOrEqual(RUN_GENERATION_BOUNDS.hunterAggressionMinimum);
      expect(plan.hunter.aggressionStepsPerPlayerStep).toBeLessThanOrEqual(RUN_GENERATION_BOUNDS.hunterAggressionMaximum);
      expect(plan.hunter.teamTierOffset).toBeGreaterThanOrEqual(RUN_GENERATION_BOUNDS.hunterTeamTierMinimum);
      expect(plan.hunter.teamTierOffset).toBeLessThanOrEqual(RUN_GENERATION_BOUNDS.hunterTeamTierMaximum);
    }
  });
});
