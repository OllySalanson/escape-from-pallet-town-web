import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { BULBASAUR, Pokemon, PokemonParty } from '../pokemon';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
import { DEFAULT_RAID_PROGRESS, SaveManager, type StorageLike } from '../save/SaveManager';
import { createStartingStash, MINIMUM_SUPPLIES, Stash } from '../stash';
import { EXTRACTION_POINTS } from '../world/extractionPoints';
import { stepDistances } from '../world/mapStructure';
import { createRunTrainerEncounters } from '../world/trainers';
import { getWorldMap } from '../worldMap';
import {
  availableContracts,
  contractCarryIn,
  contractForMap,
  FIRST_CONTRACT_ID,
  isContractBankable,
  missingCarryIn,
  RAID_CONTRACTS,
  secureItemStackLimit,
  securePokemonLimit,
  type RaidContract,
} from './contracts';
import { objectivesForContract } from './RunObjectives';

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
  public removeItem(key: string): void {
    this.entries.delete(key);
  }
}

const LATER_CONTRACTS = RAID_CONTRACTS.filter((contract) => contract.id !== FIRST_CONTRACT_ID);

function insertionFor(contract: RaidContract): RunInsertionId {
  return Object.values(RUN_INSERTIONS).find((insertion) => insertion.mapId === contract.mapId)!.id;
}

/** A save with everything before this contract already banked. */
function seedSave(storage: StorageLike, completedContracts: readonly string[], stash = createStartingStash()): SaveManager {
  const saves = new SaveManager(storage);
  saves.save({
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 7, y: 9 },
    bag: new Bag(),
    stash,
    raidProgress: {
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: completedContracts.includes(FIRST_CONTRACT_ID),
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      completedContracts: [...completedContracts],
      outfitterUpgrades: [],
    },
  });
  return saves;
}

/** Everything banked except the one under test, so it is the contract on offer. */
function prerequisitesFor(contract: RaidContract): string[] {
  return RAID_CONTRACTS.filter(
    (candidate) => candidate.id !== contract.id && candidate.mapId !== contract.mapId,
  )
    .filter((candidate) => contract.unlockedBy === undefined || candidate.id === contract.unlockedBy
      || candidate.id === FIRST_CONTRACT_ID)
    .map((candidate) => candidate.id);
}

describe('the contract board', () => {
  it('offers one contract at a time until its prerequisite is banked', () => {
    expect(availableContracts([]).map(({ id }) => id)).toEqual([FIRST_CONTRACT_ID]);
    expect(availableContracts([FIRST_CONTRACT_ID]).map(({ id }) => id)).toEqual(['survey-the-braid']);
    // The survey opens two, so the board is a choice from here rather than a queue.
    expect(availableContracts([FIRST_CONTRACT_ID, 'survey-the-braid']).map(({ id }) => id)).toEqual([
      'cordon-ledger',
      'wardens-resupply',
    ]);
    expect(availableContracts(RAID_CONTRACTS.map(({ id }) => id))).toEqual([]);
  });

  it('gives every contract its own map, so choosing an insertion is choosing a contract', () => {
    const mapIds = RAID_CONTRACTS.map((contract) => contract.mapId);
    expect(new Set(mapIds).size).toBe(mapIds.length);
    expect(contractForMap('route-1', [FIRST_CONTRACT_ID])?.id).toBe('survey-the-braid');
    // A banked contract never comes back, so its reward cannot be farmed.
    expect(contractForMap('floodplain-relay', [FIRST_CONTRACT_ID])).toBeUndefined();
  });
});

describe.each(LATER_CONTRACTS.map((contract) => [contract.id, contract] as const))(
  'the %s contract',
  (_id, contract) => {
    it('is started by deploying to its own insertion, and only there', () => {
      const insertionId = insertionFor(contract);
      expect(generateRunPlan(11, undefined, insertionId, contract).contract?.id).toBe(contract.id);
      const elsewhere = Object.values(RUN_INSERTIONS).find(
        (insertion) => insertion.mapId !== contract.mapId,
      )!.id;
      expect(generateRunPlan(11, undefined, elsewhere, contract).contract).toBeUndefined();
    });

    it('is completed by making every stop, and banked once and for good', () => {
      const storage = new MemoryStorage();
      const saves = seedSave(storage, prerequisitesFor(contract));
      const manager = new RunManager();
      manager.startRun(
        { party: [new Pokemon(BULBASAUR, 5)], items: [] },
        { mapId: contract.mapId, durationMs: 60_000 },
      );

      const objective = objectivesForContract(contract)[0];
      expect(objective.progress(manager.snapshot()).complete).toBe(false);
      for (const marker of contract.markers) {
        manager.registerContractStep(marker.id);
      }
      expect(objective.progress(manager.snapshot()).complete).toBe(true);

      const exitLabel = contract.requiredExitLabel ?? 'SOUTH GATE';
      expect(isContractBankable(contract, manager.snapshot(), exitLabel)).toBe(true);
      manager.resolveEscape();

      const result = { pokemon: [], items: [] };
      expect(saves.bankContract(contract.id, result)).toEqual({ saved: true, granted: true });
      expect(saves.load()!.raidProgress.completedContracts).toContain(contract.id);
      // The reward is paid exactly once however many times the raid is banked.
      const afterFirst = saves.load()!.stash.listItems();
      expect(saves.bankContract(contract.id, result)).toEqual({ saved: true, granted: false });
      expect(saves.load()!.stash.listItems()).toEqual(afterFirst);
    });

    it('survives a reload with its reward intact', () => {
      const storage = new MemoryStorage();
      const saves = seedSave(storage, prerequisitesFor(contract));
      saves.bankContract(contract.id, { pokemon: [], items: [] });

      const reloaded = new SaveManager(storage).load()!;
      expect(reloaded.raidProgress.completedContracts).toContain(contract.id);
      expect(availableContracts(reloaded.raidProgress.completedContracts).map(({ id }) => id))
        .not.toContain(contract.id);
      for (const { itemId, quantity } of contract.reward.items) {
        expect(reloaded.stash.itemCount(itemId)).toBeGreaterThanOrEqual(quantity);
      }
    });

    it('is still in progress after a raid it did not finish', () => {
      const manager = new RunManager();
      manager.startRun(
        { party: [new Pokemon(BULBASAUR, 5)], items: [] },
        { mapId: contract.mapId, durationMs: 60_000 },
      );
      manager.registerContractStep(contract.markers[0].id);
      expect(isContractBankable(contract, manager.snapshot(), 'SOUTH GATE')).toBe(
        contract.markers.length === 1 && contract.requiredExitLabel === undefined,
      );
    });

    /**
     * A delivery has to be packable out of the kit a wiped player is handed, or
     * one bad raid locks the contract out until they find the items in the field.
     */
    it('never asks for supplies a wiped player cannot restock at base', () => {
      const stash = new Stash();
      stash.ensurePlayable();
      stash.restockMinimumSupplies();
      for (const { itemId, quantity } of contractCarryIn(contract)) {
        expect(`${contract.id} needs ${quantity}× ${itemId}, base restocks ${stash.itemCount(itemId)}`)
          .toBe(`${contract.id} needs ${quantity}× ${itemId}, base restocks ${stash.itemCount(itemId)}`);
        expect(stash.itemCount(itemId)).toBeGreaterThanOrEqual(quantity);
      }
    });

    it('refuses a delivery the player did not pack, and takes it when they did', () => {
      const required = contractCarryIn(contract);
      if (required.length === 0) {
        expect(missingCarryIn(required, () => 0)).toEqual([]);
        return;
      }
      // Short by one is still short, and the message has to be able to say by how much.
      expect(missingCarryIn(required, (itemId) => (required.find((stack) => stack.itemId === itemId)!.quantity - 1)))
        .toEqual(required.map(({ itemId }) => ({ itemId, quantity: 1 })));
      expect(missingCarryIn(required, () => 99)).toEqual([]);
    });
  },
);

describe('the cordon ledger only banks through its own exit', () => {
  const ledger = RAID_CONTRACTS.find(({ id }) => id === 'cordon-ledger')!;

  it('refuses the always-open gate even with the ledger in hand', () => {
    const manager = new RunManager();
    manager.startRun(
      { party: [new Pokemon(BULBASAUR, 5)], items: [] },
      { mapId: 'pallet-town', durationMs: 60_000 },
    );
    manager.registerContractStep(ledger.markers[0].id);

    expect(isContractBankable(ledger, manager.snapshot(), 'SOUTH GATE')).toBe(false);
    expect(isContractBankable(ledger, manager.snapshot(), 'MILL STAIR')).toBe(false);
    expect(isContractBankable(ledger, manager.snapshot(), 'WEST CULVERT')).toBe(true);
  });
});

describe('what a banked contract buys', () => {
  it('stacks the Outfitter\'s locker on top of the ledger\'s, from the two lists alone', () => {
    const ledger = [FIRST_CONTRACT_ID, 'survey-the-braid', 'cordon-ledger'];

    expect(secureItemStackLimit([], ['secure-locker-1'])).toBe(3);
    expect(secureItemStackLimit(ledger, ['secure-locker-1'])).toBe(4);
    // The second locker protects a Pokemon, not another stack.
    expect(secureItemStackLimit(ledger, ['secure-locker-1', 'secure-locker-2'])).toBe(4);
    expect(securePokemonLimit([])).toBe(1);
    expect(securePokemonLimit(['secure-locker-1'])).toBe(1);
    expect(securePokemonLimit(['secure-locker-1', 'secure-locker-2'])).toBe(2);
  });

  it('enlarges the secure slot when the cordon ledger is banked, and the raid honours it', () => {
    expect(secureItemStackLimit([], [])).toBe(2);
    expect(secureItemStackLimit([FIRST_CONTRACT_ID, 'survey-the-braid'], [])).toBe(2);
    expect(secureItemStackLimit([FIRST_CONTRACT_ID, 'survey-the-braid', 'cordon-ledger'], [])).toBe(3);

    const party = [new Pokemon(BULBASAUR, 5)];
    const items = [
      { itemId: 'potion', quantity: 1 },
      { itemId: 'poke-ball', quantity: 1 },
      { itemId: 'antidote', quantity: 1 },
    ] as const;
    const threeStacks = { items: [...items] };
    expect(() =>
      new RunManager().startRun({ party, items: [...items] }, { mapId: 'pallet-town', durationMs: 1 }, threeStacks),
    ).toThrow(/at most 2 item stacks/);
    expect(() =>
      new RunManager().startRun(
        { party, items: [...items] },
        { mapId: 'pallet-town', durationMs: 1, secureItemStackLimit: 3 },
        threeStacks,
      ),
    ).not.toThrow();
  });

  /**
   * The warden's contract used to raise the kit base restocks after a wipe, so
   * banking it made Great Balls and a Super Potion refill themselves for good.
   * A contract pays once; the last resort is the same kit for every save.
   */
  it('restocks a wipe to the same kit whatever contracts are banked', () => {
    const wipedWith = (completed: readonly string[]) => {
      const storage = new MemoryStorage();
      const saves = seedSave(storage, completed, new Stash());
      saves.applyWipeLoss([], []);
      return saves.load()!.stash.listItems();
    };
    expect(wipedWith(RAID_CONTRACTS.map(({ id }) => id))).toEqual(wipedWith([]));
    expect(wipedWith([])).toEqual(MINIMUM_SUPPLIES);
  });
});

describe('saves written before contracts were a list', () => {
  it('keeps a banked first contract banked, and offers the next one', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'escape-from-pallet-town.save.v1',
      JSON.stringify({
        version: 5,
        party: [],
        mapId: 'pallet-town',
        position: { x: 7, y: 6 },
        items: [],
        bag: {},
        stash: { pokemon: [], items: {} },
        raidProgress: { firstContractExtracted: true, unlockedInsertions: ['floodplain-relay'] },
        starterSpeciesId: 'bulbasaur',
        pendingRecoveryMs: 0,
      }),
    );

    const loaded = new SaveManager(storage).load()!;
    expect(loaded.raidProgress.completedContracts).toEqual([FIRST_CONTRACT_ID]);
    expect(availableContracts(loaded.raidProgress.completedContracts).map(({ id }) => id))
      .toEqual(['survey-the-braid']);
  });

  it('leaves a player mid-first-contract exactly where they were', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'escape-from-pallet-town.save.v1',
      JSON.stringify({
        version: 4,
        party: [],
        mapId: 'pallet-town',
        position: { x: 7, y: 6 },
        items: [],
        bag: {},
        stash: { pokemon: [], items: {} },
        raidProgress: { firstContractExtracted: false, unlockedInsertions: ['floodplain-relay'] },
      }),
    );

    const loaded = new SaveManager(storage).load()!;
    expect(loaded.raidProgress.completedContracts).toEqual([]);
    expect(availableContracts(loaded.raidProgress.completedContracts).map(({ id }) => id))
      .toEqual([FIRST_CONTRACT_ID]);
    expect(
      secureItemStackLimit(
        loaded.raidProgress.completedContracts,
        loaded.raidProgress.outfitterUpgrades,
      ),
    ).toBe(2);
  });
});

describe('what makes each contract a contract rather than a waypoint', () => {
  /**
   * The point of the whole set: no two of them ask the same thing. If two
   * contracts differ only in where their marker sits, one of them is a
   * waypoint with a name.
   */
  it('gives every contract a different demand', () => {
    const shapes = RAID_CONTRACTS.map((contract) => ({
      id: contract.id,
      stops: contract.markers.length,
      gatedExit: contract.requiredExitLabel !== undefined,
      delivery: contractCarryIn(contract).length > 0,
    }));
    expect(shapes).toEqual([
      { id: FIRST_CONTRACT_ID, stops: 1, gatedExit: false, delivery: false },
      { id: 'survey-the-braid', stops: 3, gatedExit: false, delivery: false },
      { id: 'cordon-ledger', stops: 1, gatedExit: true, delivery: false },
      { id: 'wardens-resupply', stops: 1, gatedExit: false, delivery: true },
    ]);
  });

  it('every contract pays something permanent, and no two pay the same thing', () => {
    for (const contract of RAID_CONTRACTS) {
      const { reward } = contract;
      const pays =
        reward.items.length > 0 ||
        reward.unlockedInsertionIds !== undefined ||
        reward.secureItemStack === true ||
        // The survey pays in access: it is what puts the last two on the board.
        RAID_CONTRACTS.some((later) => later.unlockedBy === contract.id);
      expect(`${contract.id} pays: ${pays}`).toBe(`${contract.id} pays: true`);
      expect(reward.summary.length).toBeGreaterThan(0);
    }
  });

  it('names an exit that actually exists wherever a contract gates one', () => {
    const gated = RAID_CONTRACTS.filter((contract) => contract.requiredExitLabel);
    expect(gated.length).toBeGreaterThan(0);
    for (const contract of gated) {
      const plan = generateRunPlan(3, undefined, insertionFor(contract), contract);
      expect(
        plan.extractionPoints.some(
          (point) => point.mapId === contract.mapId && point.label === contract.requiredExitLabel,
        ),
      ).toBe(true);
    }
  });

  it('leaves a raid on a gated contract with a way out that is not the gated exit', () => {
    // Failing a contract must never be the same thing as being trapped.
    for (const contract of RAID_CONTRACTS.filter((entry) => entry.requiredExitLabel)) {
      const plan = generateRunPlan(3, undefined, insertionFor(contract), contract);
      const others = plan.extractionPoints.filter(
        (point) => point.mapId === contract.mapId && point.label !== contract.requiredExitLabel,
      );
      expect(others.some((point) => point.requirement?.kind === 'always')).toBe(true);
    }
  });

  it('hands the session objectives that match the contract it carries', () => {
    for (const contract of RAID_CONTRACTS) {
      const plan = generateRunPlan(5, undefined, insertionFor(contract), contract);
      const session = createActiveRunSession(
        new RunManager(),
        {},
        {},
        [],
        [],
        objectivesForContract(plan.contract!),
        plan,
      );
      expect(session.objectives.map(({ id }) => id)).toEqual([contract.id]);
    }
  });
});

/**
 * The comments over the contracts argue from walking distances, and a number in
 * a comment is held by nothing: the ones written for the maps before these were
 * still there, word for word, after every map had been redrawn under them. Each
 * map's own route test holds most of them (`world/palletTown.test.ts` and its
 * neighbours); these are the two that argument rests on which those do not ask.
 */
describe('what the contracts cost on foot', () => {
  type Tile = { readonly x: number; readonly y: number };
  const trainerTile = (id: string): Tile =>
    createRunTrainerEncounters().find((encounter) => encounter.trainer.id === id)!.position;
  const exitTile = (mapId: RaidContract['mapId'], label: string): Tile =>
    EXTRACTION_POINTS.find((point) => point.mapId === mapId && point.label === label)!.position;
  /** Walking steps with these trainers still standing: a trainer blocks their own tile. */
  const steps = (mapId: RaidContract['mapId'], from: Tile, to: Tile, standing: readonly string[]): number =>
    stepDistances(
      getWorldMap(mapId).collision,
      from,
      new Set(standing.map(trainerTile).map((tile) => `${tile.x},${tile.y}`)),
    )[to.y][to.x];
  const orders = <T,>(items: readonly T[]): T[][] =>
    items.length <= 1
      ? [[...items]]
      : items.flatMap((item, index) =>
          orders([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
        );

  it('makes the braid survey twice a straight run, and June worth a quarter of it', () => {
    const survey = RAID_CONTRACTS.find((contract) => contract.id === 'survey-the-braid')!;
    const head = RUN_INSERTIONS['route-1'].position;
    const gates = [exitTile('route-1', 'WEST GATE'), exitTile('route-1', 'ROUTE OUTPOST')];
    const stakes = survey.markers.map((marker) => marker.position);
    // The shortest walk from the Route Head over all three stakes, in whichever
    // order is best, and out by whichever gate is nearer at the end of it.
    const surveyWalk = (standing: readonly string[]): number =>
      Math.min(
        ...orders(stakes).flatMap((order) =>
          gates.map((gate) =>
            [head, ...order, gate].reduce(
              (total, tile, index, walk) => (index === 0 ? 0 : total + steps('route-1', walk[index - 1], tile, standing)),
              0,
            ),
          ),
        ),
      );
    const wren = 'overlook-warden-wren';

    expect({
      straightRun: gates.map((gate) => steps('route-1', head, gate, ['route-lass-june', wren])),
      juneStanding: surveyWalk(['route-lass-june', wren]),
      juneBeaten: surveyWalk([wren]),
    }).toEqual({ straightRun: [43, 43], juneStanding: 87, juneBeaten: 65 });
  });

  it('puts the shut culvert nearer the ledger than the open gate', () => {
    const ledger = RAID_CONTRACTS.find((contract) => contract.id === 'cordon-ledger')!.markers[0].position;
    const lee = ['grass-scout-lee'];

    expect({
      toTheCulvert: steps('pallet-town', ledger, exitTile('pallet-town', 'WEST CULVERT'), lee),
      toTheSouthGate: steps('pallet-town', ledger, exitTile('pallet-town', 'SOUTH GATE'), lee),
    }).toEqual({ toTheCulvert: 22, toTheSouthGate: 29 });
  });
});
