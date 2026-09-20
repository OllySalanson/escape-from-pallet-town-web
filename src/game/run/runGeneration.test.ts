import { describe, expect, it } from 'vitest';
import { isExtractionAvailable, type ExtractionPoint } from '../world/extractionPoints';
import { gateBossIds, gateKeys, gatesForMap, WORLD_GATES, type BossGate } from '../world/gates';
import { getWorldMap, WORLD_MAPS, type WorldMapId } from '../worldMap';
import type { GridPosition } from '../movement/gridMovement';
import { RunManager } from './RunManager';
import { createActiveRunSession } from './RunSession';
import { FIRST_CONTRACT, RAID_CONTRACTS } from '../objectives';
import {
  availableInsertionIds,
  frontDoorFor,
  BEACON_EXIT_LABEL,
  generateRunPlan,
  insertionAt,
  isDropInPoint,
  RUN_GENERATION_BOUNDS,
  RUN_INSERTIONS,
  type RunInsertionId,
} from './runGeneration';

const seeds = [1, 27, 999_999];
const insertionIds = Object.keys(RUN_INSERTIONS) as RunInsertionId[];
/** The roadmap found the vanishing-exit defect by sampling this many runs. */
const SAMPLED_RUNS = 500;
/** Every gate on every map open: the most of the world a raid could walk. */
const EVERY_BOSS = gateBossIds(WORLD_GATES);

/**
 * Every tile a player can walk to from a starting tile, following warps between
 * maps. Signs block movement exactly as they do in WorldScene; trainers do not,
 * because a trainer standing in a corridor can be defeated and walked past.
 */
function walkableFrom(
  mapId: WorldMapId,
  position: GridPosition,
  defeatedBosses: readonly string[] = [],
): ReadonlySet<string> {
  const visited = new Set<string>();
  const pending: { mapId: WorldMapId; position: GridPosition }[] = [{ mapId, position }];
  while (pending.length > 0) {
    const { mapId: currentMapId, position: tile } = pending.pop()!;
    const map = getWorldMap(currentMapId, defeatedBosses);
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

  it('adds the Outfitter beacon as one late exit on the landing of every map', () => {
    for (const insertionId of insertionIds) {
      const insertion = RUN_INSERTIONS[insertionId];
      const plain = generateRunPlan(27, undefined, insertionId);
      const plan = generateRunPlan(27, undefined, insertionId, undefined, undefined, [], { beaconUnlockAtMs: 150_000 });
      const beacons = plan.extractionPoints.filter((point) => point.label === BEACON_EXIT_LABEL);

      expect(plain.extractionPoints.some((point) => point.label === BEACON_EXIT_LABEL)).toBe(false);
      expect(beacons).toHaveLength(1);
      expect(beacons[0]).toMatchObject({ mapId: insertion.mapId, position: insertion.position });
      // It opens late and on the clock alone: nothing in the raid can open it early.
      expect(isExtractionAvailable(beacons[0], 149_999, new Set())).toBe(false);
      expect(isExtractionAvailable(beacons[0], 150_000, new Set())).toBe(true);
      // The beacon is extra. It takes no authored exit's place and spends no
      // randomness, so the same seed is the same raid with or without it.
      expect(plan.extractionPoints.filter((point) => point.label !== BEACON_EXIT_LABEL))
        .toEqual(plain.extractionPoints);
      expect({ ...plan, extractionPoints: [] }).toEqual({ ...plain, extractionPoints: [] });
    }
  });

  it('never stacks the beacon on a tile that is already an exit or a contract stop', () => {
    for (const insertionId of insertionIds) {
      const insertion = RUN_INSERTIONS[insertionId];
      const plan = generateRunPlan(1, undefined, insertionId, undefined, undefined, [], { beaconUnlockAtMs: 1 });
      const onLanding = plan.extractionPoints.filter(
        (point) =>
          point.mapId === insertion.mapId &&
          point.position.x === insertion.position.x &&
          point.position.y === insertion.position.y,
      );
      expect(onLanding).toHaveLength(1);
      for (const contract of RAID_CONTRACTS.filter(({ mapId }) => mapId === insertion.mapId)) {
        for (const marker of contract.markers) {
          expect(marker.position).not.toEqual(insertion.position);
        }
      }
    }
  });

  it('gives sessions a reproducible runtime stream derived from the plan seed', () => {
    const plan = generateRunPlan(12345);
    const first = createActiveRunSession(new RunManager(), {}, {}, [], [], undefined, plan);
    const second = createActiveRunSession(new RunManager(), {}, {}, [], [], undefined, plan);

    expect(first.seed).toBe(plan.seed);
    expect([first.rng!.next(), first.rng!.next()]).toEqual([second.rng!.next(), second.rng!.next()]);
  });

  /**
   * Field loot is a faucet, and a faucet on the same tiles every raid is a
   * route the player memorises once and walks for ever. The authored table is
   * only the pool: each raid draws which of it is live and where it lies, so
   * what is on the ground has to be found again. Held here because the design
   * review of the supply economy read the authored table and took it for what
   * the player sees.
   */
  it.each(insertionIds)('never lays the same loot on the same tiles raid after raid: %s', (insertionId) => {
    {
      const mapId = RUN_INSERTIONS[insertionId].mapId;
      // Only the ordinary pool: a piece with its own `chance` is rolled
      // separately and so is neither part of the half-the-pool floor nor able
      // to crowd a supply out of it.
      const pool = WORLD_MAPS[mapId].loot.filter((item) => item.chance === undefined);
      const rare = WORLD_MAPS[mapId].loot.filter((item) => item.chance !== undefined);
      const rareSeen = new Map<string, number>();
      const layouts = new Map<string, number>();
      const liveCounts = new Set<number>();
      for (let seed = 0; seed < SAMPLED_RUNS; seed += 1) {
        const loot = generateRunPlan(seed, undefined, insertionId).loot[mapId];
        const rareIds = new Set(rare.map(({ id }) => id));
        loot
          .filter((item) => rareIds.has(item.id))
          .forEach((item) => rareSeen.set(item.id, (rareSeen.get(item.id) ?? 0) + 1));
        liveCounts.add(loot.filter((item) => !rareIds.has(item.id)).length);
        // Only the map's own pool is ever drawn from, each entry at most once.
        expect(new Set(loot.map((item) => item.id)).size).toBe(loot.length);
        loot.forEach((item) =>
          expect(WORLD_MAPS[mapId].loot.map(({ id }) => id)).toContain(item.id),
        );
        const layout = loot.map((item) => `${item.id}@${tileKey(item.position)}`).sort().join('|');
        layouts.set(layout, (layouts.get(layout) ?? 0) + 1);
      }
      // How much is live varies, from half the pool to all of it...
      expect([...liveCounts].sort((a, b) => a - b)).toEqual(
        Array.from(
          { length: pool.length - Math.ceil(pool.length / 2) + 1 },
          (_, index) => Math.ceil(pool.length / 2) + index,
        ),
      );
      // ...a rare piece is neither guaranteed nor a formality: it lies on the
      // ground about as often as it is authored to and never every raid.
      for (const item of rare) {
        const share = (rareSeen.get(item.id) ?? 0) / SAMPLED_RUNS;
        expect(
          `${item.id}: ${share > 0 && share < item.chance! * 2 ? 'within twice its rate' : share}`,
        ).toBe(`${item.id}: within twice its rate`);
      }
      // ...and no one layout is what a player can expect to find twice.
      const commonest = Math.max(...layouts.values());
      expect(`${insertionId}: commonest layout in ${commonest} of ${SAMPLED_RUNS} raids`).toBe(
        `${insertionId}: commonest layout in ${Math.min(commonest, SAMPLED_RUNS / 50)} of ${SAMPLED_RUNS} raids`,
      );
    }
  // Sixty seconds rather than the default thirty: this samples five hundred
  // raids on four maps, two of which are 64x72, and `generateLoot` shuffles
  // every walkable tile of every map for each of them. It ran at about twenty
  // seconds alone and timed out under a loaded four-worker suite, which is the
  // second test in this repo to meet that wall (see `hunterFlee.test.ts`).
  }, 60_000);

  it('keeps generated loot, trainers, and extraction points on valid tiles', () => {
    for (const seed of seeds) {
      const plan = generateRunPlan(seed, undefined, 'floodplain-relay', FIRST_CONTRACT);
      expectValidTile(plan.insertion.mapId, plan.insertion.position);
      plan.contract!.markers.forEach((marker) => expectValidTile(plan.contract!.mapId, marker.position));
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
   *
   * A boss-held gate makes "walkable" a question with two answers. An exit behind
   * a shut gate is still offered - the boss can be beaten and the door walked
   * through in this same raid, and an exit seen across a fence is the reason to
   * try - so every offered exit is held to the map with its doors open. The exit
   * promised open from the first second is held to the map as it stands.
   */
  it.each(insertionIds)('never generates a run with one exit, and every offered exit can be walked to: %s', (insertionId) => {
    {
      const insertion = RUN_INSERTIONS[insertionId];
      const walkable = walkableFrom(insertion.mapId, insertion.position, EVERY_BOSS);
      const walkableNow = walkableFrom(insertion.mapId, insertion.position);
      for (let seed = 1; seed <= SAMPLED_RUNS; seed += 1) {
        const { extractionPoints } = generateRunPlan(seed, undefined, insertionId);

        expect(extractionPoints.length).toBeGreaterThanOrEqual(2);
        for (const point of extractionPoints) {
          expect(walkable.has(`${point.mapId}:${tileKey(point.position)}`)).toBe(true);
        }
        expect(
          extractionPoints.some(
            (point) =>
              isOpenAtStart(point) && walkableNow.has(`${point.mapId}:${tileKey(point.position)}`),
          ),
        ).toBe(true);
        expect(extractionPoints.some((point) => !isOpenAtStart(point))).toBe(true);
      }
    }
  });

  /**
   * The promise of an exit open from the first second is kept by forcing one
   * open - but only where the map has not already authored one. It used to
   * force the first exit with no authored requirement regardless, which on
   * three maps out of four is the timed one: the Mill Stair, the Route Outpost
   * and the Forest Clearing read EXTRACT OPEN at 0:00 on every seed, under town
   * signs that say they open later, and a playtest driver told to wait for one
   * never waited.
   */
  it('leaves a timed exit timed wherever the map already has one that is always open', () => {
    const timed: Readonly<Record<string, string>> = {
      'town-square': 'MILL STAIR',
      'route-1': 'ROUTE OUTPOST',
      'viridian-forest': 'FOREST CLEARING',
    };
    for (const [insertionId, label] of Object.entries(timed)) {
      for (let seed = 1; seed <= SAMPLED_RUNS; seed += 1) {
        const { extractionPoints } = generateRunPlan(seed, undefined, insertionId as RunInsertionId);
        const exit = extractionPoints.find((point) => point.label === label)!;
        expect(`${label} seed ${seed}: ${isOpenAtStart(exit) ? 'open at the start' : 'timed'}`).toBe(
          `${label} seed ${seed}: timed`,
        );
      }
    }
  });

  it('puts the first contract and its map on a raid the default insertion can complete', () => {
    const plan = generateRunPlan(2024, undefined, 'floodplain-relay', FIRST_CONTRACT);
    const walkable = walkableFrom(plan.insertion.mapId, plan.insertion.position);

    expect(plan.insertion.id).toBe('floodplain-relay');
    expect(plan.contract?.mapId).toBe('floodplain-relay');
    for (const marker of plan.contract!.markers) {
      expect(walkable.has(`${plan.contract!.mapId}:${tileKey(marker.position)}`)).toBe(true);
    }
    // The Floodplain has doors now, so "every landmark from the front door" is
    // no longer one question. The ranger station opens the home bank's own exit
    // and has to be walkable today; the supply vault is behind two bosses and
    // must *not* be, or the doors seal nothing; and with every door open no
    // landmark may be left walled off for good.
    const reached = (from: ReadonlySet<string>, id: string): boolean => {
      const poi = WORLD_MAPS['floodplain-relay'].pois.find((candidate) => candidate.id === id)!;
      return from.has(`floodplain-relay:${tileKey(poi.position)}`);
    };
    expect(reached(walkable, 'floodplain-ranger-radio')).toBe(true);
    expect(reached(walkable, 'floodplain-supply-vault')).toBe(false);

    // Every door, not every boss: one of this map's is a field-move door, and
    // "with every door open" has to mean the same thing to it.
    const everyDoorOpen = walkableFrom(
      plan.insertion.mapId,
      plan.insertion.position,
      gateKeys(gatesForMap('floodplain-relay')),
    );
    for (const poi of WORLD_MAPS['floodplain-relay'].pois) {
      expect(`${poi.label} reachable with every door open: ${reached(everyDoorOpen, poi.id)}`).toBe(
        `${poi.label} reachable with every door open: true`,
      );
    }
  });

  it('refuses to attach a contract to a raid that starts on another map', () => {
    expect(generateRunPlan(7, undefined, 'town-square', FIRST_CONTRACT).contract).toBeUndefined();
    expect(generateRunPlan(7, undefined, 'floodplain-relay', FIRST_CONTRACT).contract).toBeDefined();
  });

  /**
   * Every contract, on its own map, from its own insertion. A contract whose
   * marker the generator rolled a supply crate onto would be unreachable in
   * exactly the raid it is the point of.
   */
  it('carries every contract on its own map and reserves each of its stops', () => {
    for (const contract of RAID_CONTRACTS) {
      const insertionId = Object.values(RUN_INSERTIONS).find(
        (insertion) => insertion.mapId === contract.mapId,
      )!.id;
      for (const seed of seeds) {
        const plan = generateRunPlan(seed, undefined, insertionId, contract);
        expect(plan.contract?.id).toBe(contract.id);
        const walkable = walkableFrom(plan.insertion.mapId, plan.insertion.position);
        const taken = new Set([
          ...plan.loot[contract.mapId].map((item) => tileKey(item.position)),
          ...plan.trainers.filter((t) => t.mapId === contract.mapId).map((t) => tileKey(t.position)),
        ]);
        for (const marker of contract.markers) {
          expect(`${contract.id} ${marker.id}: ${walkable.has(`${contract.mapId}:${tileKey(marker.position)}`) ? 'reachable' : 'unreachable'}, ${taken.has(tileKey(marker.position)) ? 'occupied' : 'clear'}`)
            .toBe(`${contract.id} ${marker.id}: reachable, clear`);
        }
      }
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

  /**
   * A shut gate cuts the insertion's own map in two, so "on this map" stopped
   * meaning "somewhere this raid can walk". Loot rolled behind a door the player
   * has not opened is loot the raid was promised and cannot have.
   */
  describe('with a boss-held gate on the map', () => {
    // The proving-ground boss gate, whose key is the boss's own id.
    const gate = WORLD_GATES[0] as BossGate;
    const gatedInsertions = insertionIds.filter(
      (id) => RUN_INSERTIONS[id].mapId === gate.mapId,
    );

    it('only ever rolls loot this raid can walk to, whichever side of the gate it starts', () => {
      for (const insertionId of gatedInsertions) {
        const insertion = RUN_INSERTIONS[insertionId];
        for (const defeatedBosses of [[], [gate.bossId]]) {
          const walkable = walkableFrom(insertion.mapId, insertion.position, defeatedBosses);
          for (let seed = 1; seed <= 100; seed += 1) {
            const plan = generateRunPlan(seed, undefined, insertionId, undefined, undefined, defeatedBosses);
            for (const loot of plan.loot[insertion.mapId]) {
              expect(
                `${insertionId} seed ${seed}: loot at ${tileKey(loot.position)} ${walkable.has(`${insertion.mapId}:${tileKey(loot.position)}`) ? 'reachable' : 'sealed off'}`,
              ).toBe(`${insertionId} seed ${seed}: loot at ${tileKey(loot.position)} reachable`);
            }
          }
        }
      }
    });

    it('promises an exit that is open at once on this side of the gate', () => {
      for (const insertionId of gatedInsertions) {
        const insertion = RUN_INSERTIONS[insertionId];
        const walkable = walkableFrom(insertion.mapId, insertion.position);
        for (let seed = 1; seed <= 100; seed += 1) {
          const { extractionPoints } = generateRunPlan(seed, undefined, insertionId);
          const open = extractionPoints.filter(
            (point) =>
              isOpenAtStart(point) && walkable.has(`${point.mapId}:${tileKey(point.position)}`),
          );
          expect(open.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('lists the exits on this side of the gate first, so the field guide never names a sealed one', () => {
      // Only a raid sealed behind the gate sees the difference: every exit but
      // the Overlook's own is on the far side of the fence.
      const sealed = RUN_INSERTIONS['route-1-overlook'];
      const walkable = walkableFrom(sealed.mapId, sealed.position);
      const { extractionPoints } = generateRunPlan(3, undefined, 'route-1-overlook');
      const reachableFlags = extractionPoints
        .filter((point) => point.mapId === sealed.mapId)
        .map((point) => walkable.has(`${point.mapId}:${tileKey(point.position)}`));
      expect(reachableFlags[0]).toBe(true);
      expect(reachableFlags).toEqual([...reachableFlags].sort((a, b) => Number(b) - Number(a)));
      // With the gate open nothing is sealed, and the authored order stands.
      const open = generateRunPlan(3, undefined, 'route-1-overlook', undefined, undefined, [gate.bossId]);
      const authored = generateRunPlan(3, undefined, 'route-1', undefined, undefined, [gate.bossId]);
      expect(open.extractionPoints.map((point) => point.label))
        .toEqual(authored.extractionPoints.map((point) => point.label));
    });

    it('never rolls a cache onto a drop-in point, so reaching one is never spoken over', () => {
      for (const insertionId of insertionIds) {
        for (let seed = 1; seed <= 100; seed += 1) {
          const plan = generateRunPlan(seed, undefined, insertionId, undefined, undefined, EVERY_BOSS);
          for (const dropIn of Object.values(RUN_INSERTIONS)) {
            expect(plan.loot[dropIn.mapId].map((loot) => tileKey(loot.position)))
              .not.toContain(tileKey(dropIn.position));
          }
        }
      }
    });

    it('sends a boss into the raid until they are beaten, and never again', () => {
      const fresh = generateRunPlan(7, undefined, 'route-1');
      expect(fresh.defeatedBosses).toEqual([]);
      expect(fresh.trainers.some((trainer) => trainer.bossId === gate.bossId)).toBe(true);

      const after = generateRunPlan(7, undefined, 'route-1', undefined, undefined, [gate.bossId]);
      expect(after.defeatedBosses).toEqual([gate.bossId]);
      expect(after.trainers.some((trainer) => trainer.bossId === gate.bossId)).toBe(false);
      // Everyone who is not a boss is still there.
      expect(after.trainers.length).toBe(fresh.trainers.length - 1);
    });
  });

  describe('drop-in points', () => {
    it('offers what contracts unlocked plus what the player has walked to, in authored order', () => {
      expect(
        availableInsertionIds({ unlockedInsertions: ['floodplain-relay'], reachedInsertions: [] }),
      ).toEqual(['floodplain-relay']);
      expect(
        availableInsertionIds({
          unlockedInsertions: ['viridian-forest', 'floodplain-relay'],
          reachedInsertions: ['route-1-overlook', 'an-insertion-that-was-retired'],
        }),
      ).toEqual(['floodplain-relay', 'route-1-overlook', 'viridian-forest']);
    });

    it('gives every map exactly one front door, and calls every other insertion a drop-in', () => {
      for (const mapId of Object.keys(WORLD_MAPS) as WorldMapId[]) {
        const onMap = Object.values(RUN_INSERTIONS).filter((insertion) => insertion.mapId === mapId);
        expect(frontDoorFor(mapId)).toBe(onMap[0]);
        expect(onMap.filter((insertion) => !isDropInPoint(insertion))).toEqual([onMap[0]]);
      }
      expect(isDropInPoint(RUN_INSERTIONS['route-1-overlook'])).toBe(true);
    });

    it('finds the insertion a tile belongs to, and nothing on any other tile', () => {
      const overlook = RUN_INSERTIONS['route-1-overlook'];
      expect(insertionAt('route-1', overlook.position)).toBe(overlook);
      expect(insertionAt('pallet-town', overlook.position)).toBeUndefined();
      expect(insertionAt('route-1', { x: overlook.position.x, y: overlook.position.y + 1 }))
        .toBeUndefined();
    });

    it('never puts two insertions on one tile', () => {
      const tiles = Object.values(RUN_INSERTIONS).map(
        (insertion) => `${insertion.mapId}:${tileKey(insertion.position)}`,
      );
      expect(new Set(tiles).size).toBe(tiles.length);
    });
  });
});
