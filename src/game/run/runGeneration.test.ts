import { describe, expect, it } from 'vitest';
import { isExtractionAvailable, type ExtractionPoint } from '../world/extractionPoints';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';
import type { GridPosition } from '../movement/gridMovement';
import { RunManager } from './RunManager';
import { createActiveRunSession } from './RunSession';
import {
  generateRunPlan,
  RUN_GENERATION_BOUNDS,
  RUN_INSERTIONS,
  type RunInsertionId,
} from './runGeneration';

const seeds = [1, 27, 999_999];
const insertionIds = Object.keys(RUN_INSERTIONS) as RunInsertionId[];
/** The roadmap found the vanishing-exit defect by sampling this many runs. */
const SAMPLED_RUNS = 500;

/**
 * Every tile a player can walk to from a starting tile, following warps between
 * maps. Signs block movement exactly as they do in WorldScene; trainers do not,
 * because a trainer standing in a corridor can be defeated and walked past.
 */
function walkableFrom(mapId: WorldMapId, position: GridPosition): ReadonlySet<string> {
  const visited = new Set<string>();
  const pending: { mapId: WorldMapId; position: GridPosition }[] = [{ mapId, position }];
  while (pending.length > 0) {
    const { mapId: currentMapId, position: tile } = pending.pop()!;
    const map = WORLD_MAPS[currentMapId];
    const key = `${currentMapId}:${tileKey(tile)}`;
    if (
      visited.has(key) ||
      tile.x < 0 ||
      tile.y < 0 ||
      tile.x >= map.width ||
      tile.y >= map.height ||
      map.collision[tile.y][tile.x] ||
      map.entities.some((entity) => entity.position.x === tile.x && entity.position.y === tile.y)
    ) {
      continue;
    }
    visited.add(key);
    const warp = map.warps.find((candidate) => candidate.source.x === tile.x && candidate.source.y === tile.y);
    if (warp) {
      pending.push({ mapId: warp.destinationMapId, position: warp.destination });
    }
    for (const step of [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ]) {
      pending.push({ mapId: currentMapId, position: step });
    }
  }
  return visited;
}

function isOpenAtStart(point: ExtractionPoint): boolean {
  return isExtractionAvailable(point, 0, new Set());
}

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

  it('always supplies encounters and an exit that is open the second a raid starts', () => {
    for (const insertionId of insertionIds) {
      for (const seed of seeds) {
        const plan = generateRunPlan(seed, undefined, insertionId);
        expect(Object.values(plan.encounters).some((table) => table.entries.length > 0)).toBe(true);
        expect(plan.extractionPoints.filter(isOpenAtStart).length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  /**
   * Randomised exit *existence* used to leave 89 of 500 town-square runs with a
   * single gate, which is the opposite of the several-exits-under-different-
   * conditions the product direction promises. The guarantee is now structural:
   * two or more exits, all of them walkable from the insertion, at least one
   * open immediately and at least one that has to be earned or waited for.
   */
  it('never generates a run with one exit, and every offered exit can be walked to', () => {
    for (const insertionId of insertionIds) {
      const insertion = RUN_INSERTIONS[insertionId];
      const walkable = walkableFrom(insertion.mapId, insertion.position);
      for (let seed = 1; seed <= SAMPLED_RUNS; seed += 1) {
        const { extractionPoints } = generateRunPlan(seed, undefined, insertionId);

        expect(extractionPoints.length).toBeGreaterThanOrEqual(2);
        for (const point of extractionPoints) {
          expect(walkable.has(`${point.mapId}:${tileKey(point.position)}`)).toBe(true);
        }
        expect(extractionPoints.some(isOpenAtStart)).toBe(true);
        expect(extractionPoints.some((point) => !isOpenAtStart(point))).toBe(true);
      }
    }
  });

  it('puts the first contract and its map on a raid the default insertion can complete', () => {
    const plan = generateRunPlan(2024);
    const walkable = walkableFrom(plan.insertion.mapId, plan.insertion.position);

    expect(plan.insertion.id).toBe('floodplain-relay');
    expect(plan.contract?.mapId).toBe('floodplain-relay');
    expect(walkable.has(`${plan.contract!.mapId}:${tileKey(plan.contract!.position)}`)).toBe(true);
    for (const poi of WORLD_MAPS['floodplain-relay'].pois) {
      expect(walkable.has(`floodplain-relay:${tileKey(poi.position)}`)).toBe(true);
    }
  });

  it('refuses to attach the first contract to a raid that starts on another map', () => {
    expect(generateRunPlan(7, undefined, 'town-square', true).contract).toBeUndefined();
    expect(generateRunPlan(7, undefined, 'floodplain-relay', true).contract).toBeDefined();
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
