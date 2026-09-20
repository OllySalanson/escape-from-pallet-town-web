import { beforeEach, describe, expect, it } from 'vitest';
import { isMaterial } from '../items';
import { OUTFITTER_UPGRADES, outfitterMaterialKinds } from '../hub/outfitter';
import { generateRunPlan, RUN_INSERTIONS, frontDoorFor } from '../run/runGeneration';
import { EXTRACTION_POINTS } from '../world/extractionPoints';
import { WORLD_GATES, gateBossIds, gatesForMap } from '../world/gates';
import { HUNTER_TIERS } from '../world/hunter';
import { stepDistances } from '../world/mapStructure';
import { createRunTrainerEncounters, withoutDefeatedBosses } from '../world/trainers';
import { trainerSightTiles } from '../world/trainerSight';
import { getWorldMap, type WorldMapId } from '../worldMap';
import { contractCarryIn, RAID_CONTRACTS, type RaidContract } from './contracts';
import {
  boardContractForMap,
  boardContracts,
  deployableMapIds,
  forgetStandingBoards,
  isStandingContractId,
  rewardPokemon,
  STANDING_BANKS_PER_PRESSURE,
  standingBoard,
  standingBoardSeed,
  standingOffers,
  standingRoundOf,
  standingTopPressure,
  type StandingBoardProgress,
} from './standingBoard';

const CHAIN = RAID_CONTRACTS.map((contract) => contract.id);
const EVERY_FRONT_DOOR = ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'];
const EVERY_BOSS = gateBossIds(WORLD_GATES);
const SEEDS = Array.from({ length: 300 }, (_, index) => Math.imul(index + 1, 0x9e3779b1) >>> 0);

const progressWith = (overrides: Partial<StandingBoardProgress> = {}): StandingBoardProgress => ({
  completedContracts: CHAIN,
  standingContractsBanked: 0,
  defeatedBosses: [],
  outfitterUpgrades: [],
  unlockedInsertions: EVERY_FRONT_DOOR,
  reachedInsertions: [],
  ...overrides,
});

/** Every gate state a board can be drawn in: all shut, each boss alone, all open. */
const GATE_STATES: readonly (readonly string[])[] = [[], ...EVERY_BOSS.map((boss) => [boss]), EVERY_BOSS];

const reaches = (grid: number[][], tile: { x: number; y: number }): boolean => (grid[tile.y]?.[tile.x] ?? -1) >= 0;

const walks = new Map<string, number[][]>();
const walkFromFrontDoor = (mapId: WorldMapId, defeatedBosses: readonly string[]): number[][] => {
  const key = `${mapId}|${defeatedBosses.join('+')}`;
  if (!walks.has(key)) {
    walks.set(key, stepDistances(getWorldMap(mapId, defeatedBosses).collision, frontDoorFor(mapId)!.position));
  }
  return walks.get(key)!;
};

const isMechanismBearing = (contract: RaidContract): boolean =>
  contract.markers.length > 1 ||
  contract.requiredExitLabel !== undefined ||
  contractCarryIn(contract).length > 0;

beforeEach(() => forgetStandingBoards());

describe('when the standing board opens', () => {
  it('offers nothing while any authored contract is still outstanding', () => {
    for (let banked = 0; banked < CHAIN.length; banked += 1) {
      const progress = progressWith({ completedContracts: CHAIN.slice(0, banked) });
      expect(standingBoard(progress)).toEqual([]);
      expect(boardContracts(progress).every((contract) => !isStandingContractId(contract.id))).toBe(true);
      expect(boardContracts(progress).length).toBeGreaterThan(0);
    }
  });

  it('takes over the board the moment the chain is banked, so it is never empty again', () => {
    for (let banked = 0; banked < 40; banked += 1) {
      const board = boardContracts(progressWith({ standingContractsBanked: banked }));
      expect(board.length).toBeGreaterThan(0);
      expect(board.every((contract) => isStandingContractId(contract.id))).toBe(true);
    }
  });
});

describe('a drawn board', () => {
  it('is the same board for the same seed and progress, redrawn rather than recalled', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const first = standingOffers(seed, progressWith({ standingContractsBanked: 3 }));
      forgetStandingBoards();
      const second = standingOffers(seed, progressWith({ standingContractsBanked: 3 }));
      expect(second).not.toBe(first);
      expect(second).toEqual(first);
    }
  });

  it('is a different board for a different seed', () => {
    const drawn = new Set(SEEDS.slice(0, 40).map((seed) => JSON.stringify(standingOffers(seed, progressWith()))));
    expect(drawn.size).toBeGreaterThan(30);
  });

  it('turns over when a contract is banked and at no other time', () => {
    const seeds = Array.from({ length: 40 }, (_, banked) => standingBoardSeed({ standingContractsBanked: banked }));
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(standingBoard(progressWith({ standingContractsBanked: 5 }))).toEqual(
      standingBoard(progressWith({ standingContractsBanked: 5 })),
    );
  });

  it('never offers a map the player cannot deploy to, and offers every map they can', () => {
    const partial = progressWith({ unlockedInsertions: ['floodplain-relay', 'route-1'] });
    expect(deployableMapIds(partial)).toEqual(['floodplain-relay', 'route-1']);
    for (const seed of SEEDS) {
      expect(standingOffers(seed, partial).map((contract) => contract.mapId)).toEqual([
        'floodplain-relay',
        'route-1',
      ]);
      expect(standingOffers(seed, progressWith()).map((contract) => contract.mapId)).toEqual(
        deployableMapIds(progressWith()),
      );
    }
  });

  it('counts a map reached on foot as deployable, like the lobby does', () => {
    const progress = progressWith({
      unlockedInsertions: ['floodplain-relay'],
      reachedInsertions: ['route-1-overlook'],
    });
    expect(standingBoard(progress).map((contract) => contract.mapId)).toEqual(['floodplain-relay', 'route-1']);
  });

  it('gives every contract and every stop an id of its own, carrying the round it was drawn in', () => {
    const contracts = [0, 1, 2, 3].flatMap((banked) => standingBoard(progressWith({ standingContractsBanked: banked })));
    const ids = contracts.map((contract) => contract.id);
    const markerIds = contracts.flatMap((contract) => contract.markers.map((marker) => marker.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(markerIds).size).toBe(markerIds.length);
    for (const banked of [0, 7, 23]) {
      for (const contract of standingBoard(progressWith({ standingContractsBanked: banked }))) {
        expect(standingRoundOf(contract.id)).toBe(banked);
      }
    }
    expect(standingRoundOf('survey-the-braid')).toBeUndefined();
  });

  it('does not offer four of the same contract', () => {
    for (const seed of SEEDS) {
      const names = new Set(standingOffers(seed, progressWith()).map((contract) => contract.name));
      expect(names.size).toBeGreaterThan(1);
    }
  });
});

describe('every standing contract', () => {
  let drawn: { contract: RaidContract; defeatedBosses: readonly string[] }[] | undefined;
  const everyBoard = (): { contract: RaidContract; defeatedBosses: readonly string[] }[] =>
    (drawn ??= GATE_STATES.flatMap((defeatedBosses) =>
      SEEDS.flatMap((seed, index) =>
        standingOffers(seed, progressWith({ defeatedBosses, standingContractsBanked: index % 9 })).map(
          (contract) => ({ contract, defeatedBosses }),
        ),
      ),
    ));

  it('changes the shape of the raid: several stops, one exit that banks it, or a delivery', () => {
    for (const { contract } of everyBoard()) {
      expect(isMechanismBearing(contract), contract.description).toBe(true);
    }
  });

  it('can be walked: every stop from the front door, today unless it says it is behind a gate', () => {
    for (const { contract, defeatedBosses } of everyBoard()) {
      const today = walkFromFrontDoor(contract.mapId, defeatedBosses);
      const everyDoorOpen = walkFromFrontDoor(contract.mapId, EVERY_BOSS);
      for (const marker of contract.markers) {
        expect(reaches(everyDoorOpen, marker.position), contract.id).toBe(true);
        expect(reaches(today, marker.position), contract.id).toBe(contract.sealedBehind === undefined);
      }
    }
  });

  it('names an exit that exists on its map and can be walked to once its stops can', () => {
    for (const { contract, defeatedBosses } of everyBoard()) {
      if (contract.requiredExitLabel === undefined) {
        continue;
      }
      const exit = EXTRACTION_POINTS.find(
        (point) => point.mapId === contract.mapId && point.label === contract.requiredExitLabel,
      );
      expect(exit, contract.id).toBeDefined();
      const bosses = contract.sealedBehind ? EVERY_BOSS : defeatedBosses;
      expect(reaches(walkFromFrontDoor(contract.mapId, bosses), exit!.position), contract.id).toBe(true);
    }
  });

  it('never stands a stop on a tile that belongs to something else', () => {
    for (const { contract, defeatedBosses } of everyBoard()) {
      const map = getWorldMap(contract.mapId, defeatedBosses);
      const isBlocked = (tile: { x: number; y: number }): boolean => map.collision[tile.y]?.[tile.x] ?? true;
      const taken = [
        ...EXTRACTION_POINTS.filter((point) => point.mapId === map.id).map((point) => point.position),
        ...Object.values(RUN_INSERTIONS).filter((entry) => entry.mapId === map.id).map((entry) => entry.position),
        ...map.pois.map((poi) => poi.position),
        ...map.warps.map((warp) => warp.source),
        ...map.entities.map((entity) => entity.position),
        ...map.gates.flatMap((gate) => gate.tiles),
        ...withoutDefeatedBosses(createRunTrainerEncounters(), defeatedBosses)
          .filter((trainer) => trainer.mapId === map.id && trainer.fixedPosition)
          .flatMap((trainer) => [trainer.position, ...trainerSightTiles(trainer, isBlocked)]),
      ].map((tile) => `${tile.x},${tile.y}`);
      const stops = contract.markers.map((marker) => `${marker.position.x},${marker.position.y}`);
      expect(new Set(stops).size).toBe(stops.length);
      for (const stop of stops) {
        expect(taken, contract.id).not.toContain(stop);
      }
    }
  });

  it('asks for a walk rather than an errand beside the landing', () => {
    for (const { contract, defeatedBosses } of everyBoard()) {
      if (contract.sealedBehind) {
        continue;
      }
      const steps = walkFromFrontDoor(contract.mapId, defeatedBosses);
      const longest = Math.max(...steps.flat());
      for (const marker of contract.markers) {
        expect(steps[marker.position.y][marker.position.x], contract.id).toBeGreaterThanOrEqual(longest * 0.45);
      }
    }
  });

  it('pays only in what the Outfitter consumes, and always pays something', () => {
    const ladderKinds = outfitterMaterialKinds([]);
    for (const { contract } of everyBoard()) {
      expect(contract.reward.items.length + (contract.reward.pokemon?.length ?? 0)).toBeGreaterThan(0);
      for (const { itemId, quantity } of contract.reward.items) {
        // A delivery is paid back in a grade up of what it took out of the pack;
        // everything else is paid in materials, which is what the ladder costs.
        if (contractCarryIn(contract).length === 0) {
          expect(ladderKinds).toContain(itemId);
          expect(isMaterial(itemId), `${contract.id} pays ${itemId}`).toBe(true);
        }
        expect(quantity).toBeGreaterThan(0);
      }
      expect(rewardPokemon(contract.reward)).toHaveLength(contract.reward.pokemon?.length ?? 0);
      expect(contract.reward.unlockedInsertionIds).toBeUndefined();
      expect(contract.reward.secureItemStack).toBeUndefined();
    }
  });

  it('pays a delivery back in more than it took, a grade up', () => {
    const deliveries = everyBoard().filter(({ contract }) => contractCarryIn(contract).length > 0);
    expect(deliveries.length).toBeGreaterThan(0);
    for (const { contract } of deliveries) {
      const [asked] = contractCarryIn(contract);
      const [paid] = contract.reward.items;
      expect(paid.itemId).not.toBe(asked.itemId);
      expect(['super-potion', 'great-ball']).toContain(paid.itemId);
      expect(paid.quantity).toBeGreaterThanOrEqual(2);
    }
  });

  it('is carried by the raid that inserts on its map, with every stop kept clear of loot and trainers', () => {
    for (const contract of standingBoard(progressWith({ standingContractsBanked: 4 }))) {
      const insertion = frontDoorFor(contract.mapId)!;
      for (const seed of SEEDS.slice(0, 25)) {
        const plan = generateRunPlan(seed, undefined, insertion.id, contract);
        expect(plan.contract).toBe(contract);
        const occupied = [
          ...plan.loot[contract.mapId].map((loot) => loot.position),
          ...plan.trainers.filter((trainer) => trainer.mapId === contract.mapId).map((trainer) => trainer.position),
        ].map((tile) => `${tile.x},${tile.y}`);
        for (const marker of contract.markers) {
          expect(occupied).not.toContain(`${marker.position.x},${marker.position.y}`);
        }
      }
    }
  });
});

describe('the sealed district', () => {
  const gatedMaps = [...new Set(WORLD_GATES.map((gate) => gate.mapId))];

  it('is pointed at while its gate is shut: the board names the door and who holds it', () => {
    for (const mapId of gatedMaps) {
      const sealed = SEEDS.map((seed) => standingOffers(seed, progressWith()).find((c) => c.mapId === mapId)!).filter(
        (contract) => contract.sealedBehind !== undefined,
      );
      // Often enough to be found, never so often it is all that map offers.
      expect(sealed.length).toBeGreaterThan(SEEDS.length * 0.3);
      expect(sealed.length).toBeLessThan(SEEDS.length * 0.7);
      for (const contract of sealed) {
        const gate = gatesForMap(mapId).find((candidate) => candidate.label === contract.sealedBehind!.gateLabel);
        expect(gate).toBeDefined();
        const boss = createRunTrainerEncounters().find((trainer) => trainer.bossId === gate!.bossId);
        expect(contract.sealedBehind!.bossName).toBe(boss!.trainer.name);
        expect(contract.briefing.join(' ')).toContain(gate!.label);
        expect(contract.briefing.join(' ')).toContain(boss!.trainer.name);
        expect(contract.deploymentBriefing).toContain(gate!.label);
      }
    }
  });

  it('can be banked in the raid that opens the door: past the gate the stop and its exit join the map', () => {
    for (const seed of SEEDS) {
      for (const contract of standingOffers(seed, progressWith()).filter((c) => c.sealedBehind)) {
        const gate = gatesForMap(contract.mapId).find((c) => c.label === contract.sealedBehind!.gateLabel)!;
        const opened = walkFromFrontDoor(contract.mapId, [gate.bossId!]);
        for (const marker of contract.markers) {
          expect(reaches(opened, marker.position)).toBe(true);
        }
        // The boss is reachable today, or the door could never be opened.
        const boss = createRunTrainerEncounters().find((trainer) => trainer.bossId === gate.bossId)!;
        const today = walkFromFrontDoor(contract.mapId, []);
        const besideBoss = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) =>
          reaches(today, { x: boss.position.x + dx, y: boss.position.y + dy }),
        );
        expect(besideBoss).toBe(true);
      }
    }
  });

  it('is never offered once the boss is beaten, because nothing is sealed any more', () => {
    for (const mapId of gatedMaps) {
      const defeatedBosses = gateBossIds(gatesForMap(mapId));
      for (const seed of SEEDS) {
        const contract = standingOffers(seed, progressWith({ defeatedBosses })).find((c) => c.mapId === mapId)!;
        expect(contract.sealedBehind).toBeUndefined();
      }
    }
  });

  it('pays a Pokemon, because it cost a fight that could not be declined', () => {
    for (const seed of SEEDS) {
      for (const contract of standingOffers(seed, progressWith()).filter((c) => c.sealedBehind)) {
        expect(rewardPokemon(contract.reward)).toHaveLength(1);
      }
    }
  });
});

describe('escalation', () => {
  it('rises a hunter tier for every few contracts banked and stops at the top of the hunter ladder', () => {
    expect(standingTopPressure(0)).toBe(0);
    expect(standingTopPressure(STANDING_BANKS_PER_PRESSURE - 1)).toBe(0);
    expect(standingTopPressure(STANDING_BANKS_PER_PRESSURE)).toBe(1);
    expect(standingTopPressure(STANDING_BANKS_PER_PRESSURE * 2)).toBe(2);
    expect(standingTopPressure(10_000)).toBe(HUNTER_TIERS.length - 1);
    expect(standingTopPressure(-3)).toBe(0);
  });

  it('puts the top pressure on exactly one contract and steps the rest of the board down to a safe raid', () => {
    for (let banked = 0; banked < 12; banked += 1) {
      const top = standingTopPressure(banked);
      const pressures = standingBoard(progressWith({ standingContractsBanked: banked }))
        .map((contract) => contract.hunterPressure ?? 0)
        .sort((a, b) => b - a);
      expect(pressures).toEqual([top, Math.max(0, top - 1), Math.max(0, top - 2), 0]);
    }
  });

  it('pays more for more hunter: a share larger per tier, and a Pokemon on top', () => {
    const paid = (contract: RaidContract): number => contract.reward.items[0].quantity;
    for (const seed of SEEDS.slice(0, 60)) {
      const calm = standingOffers(seed, progressWith({ standingContractsBanked: 0 }));
      for (const banked of [STANDING_BANKS_PER_PRESSURE, STANDING_BANKS_PER_PRESSURE * 2]) {
        const raised = standingOffers(seed, progressWith({ standingContractsBanked: banked }));
        raised.forEach((contract, index) => {
          const pressure = contract.hunterPressure ?? 0;
          // Same seed, same stream: the contract is the same one, priced higher.
          expect(contract.markers.map((m) => m.position)).toEqual(calm[index].markers.map((m) => m.position));
          expect(paid(contract)).toBe(paid(calm[index]) + pressure);
          if (pressure > 0) {
            expect(rewardPokemon(contract.reward)).toHaveLength(1);
          }
        });
      }
    }
  });
});

describe('what it pays in', () => {
  it('prefers the materials the unbuilt rungs still cost', () => {
    const allButMast = OUTFITTER_UPGRADES.filter((upgrade) => upgrade.id !== 'radio-mast').map((upgrade) => upgrade.id);
    expect(outfitterMaterialKinds(allButMast)).toEqual(['radio-valve', 'mooring-rope']);
    for (const seed of SEEDS.slice(0, 60)) {
      for (const contract of standingOffers(seed, progressWith({ outfitterUpgrades: allButMast }))) {
        if (contractCarryIn(contract).length === 0) {
          expect(['radio-valve', 'mooring-rope']).toContain(contract.reward.items[0].itemId);
        }
      }
    }
  });

  it('still pays once the whole ladder stands, in supplies because nothing wants a material any more', () => {
    const everything = OUTFITTER_UPGRADES.map((upgrade) => upgrade.id);
    expect(outfitterMaterialKinds(everything).length).toBeGreaterThan(1);
    expect(outfitterMaterialKinds(everything).some((itemId) => isMaterial(itemId))).toBe(false);
    expect(standingBoard(progressWith({ outfitterUpgrades: everything })).length).toBe(4);
  });
});

describe('boardContractForMap', () => {
  it('is the authored contract while the chain runs and the standing one after it', () => {
    expect(boardContractForMap('route-1', progressWith({ completedContracts: [CHAIN[0]] }))?.id).toBe(
      'survey-the-braid',
    );
    const standing = boardContractForMap('route-1', progressWith({ standingContractsBanked: 2 }));
    expect(standing?.id).toBe('standing-2-route-1');
    expect(standing?.mapId).toBe('route-1');
  });
});
