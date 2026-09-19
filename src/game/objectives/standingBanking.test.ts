import { describe, expect, it } from 'vitest';
import { buildContractBoard, contractBoardRow } from '../hub/contractBoard';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { DEFAULT_RAID_PROGRESS, SAVE_KEY, SaveManager, type StorageLike } from '../save/SaveManager';
import { createStartingStash } from '../stash';
import { RAID_CONTRACTS, type RaidContract } from './contracts';
import { standingBoard, standingTopPressure } from './standingBoard';

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

const CHAIN = RAID_CONTRACTS.map((contract) => contract.id);
const NOTHING_CARRIED = { pokemon: [], items: [] };

function seedSave(
  storage: StorageLike,
  standingContractsBanked = 0,
  completedContracts: readonly string[] = CHAIN,
): SaveManager {
  const saves = new SaveManager(storage);
  saves.save({
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 7, y: 6 },
    bag: new Bag(),
    stash: createStartingStash(),
    raidProgress: {
      ...DEFAULT_RAID_PROGRESS,
      firstContractExtracted: completedContracts.length > 0,
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      completedContracts: [...completedContracts],
      standingContractsBanked,
    },
  });
  return saves;
}

const paysPokemon = (contract: RaidContract): boolean => (contract.reward.pokemon?.length ?? 0) > 0;

describe('banking a standing contract', () => {
  it('pays its supplies and its Pokemon into the vault and turns the board over', () => {
    // Round two is the first board that prices a contract in hunter, so it is
    // the first that pays in Pokemon on open ground.
    const saves = seedSave(new MemoryStorage(), 2);
    const before = saves.load()!;
    const contract = standingBoard(before.raidProgress).find(paysPokemon)!;
    expect(contract).toBeDefined();

    expect(saves.bankContract(contract, NOTHING_CARRIED)).toEqual({ saved: true, granted: true });

    const after = saves.load()!;
    expect(after.raidProgress.standingContractsBanked).toBe(3);
    for (const { itemId, quantity } of contract.reward.items) {
      expect(after.stash.itemCount(itemId)).toBe(before.stash.itemCount(itemId) + quantity);
    }
    const arrived = after.stash.listPokemon().slice(before.stash.listPokemon().length);
    expect(arrived.map(({ pokemon }) => [pokemon.base.id, pokemon.level])).toEqual(
      contract.reward.pokemon!.map(({ speciesId, level }) => [speciesId, level]),
    );
    expect(arrived.every(({ pokemon }) => !pokemon.isFainted)).toBe(true);
    // The authored chain is a different list and is not touched.
    expect(after.raidProgress.completedContracts).toEqual(CHAIN);
    expect(standingBoard(after.raidProgress).map(({ id }) => id)).not.toContain(contract.id);
  });

  it('pays once: the same contract handed in again is a raid banked and nothing more', () => {
    const saves = seedSave(new MemoryStorage());
    const [contract] = standingBoard(saves.load()!.raidProgress);
    saves.bankContract(contract, NOTHING_CARRIED);
    const afterFirst = saves.load()!;

    expect(saves.bankContract(contract, NOTHING_CARRIED)).toEqual({ saved: true, granted: false });
    expect(saves.load()!.stash.listItems()).toEqual(afterFirst.stash.listItems());
    expect(saves.load()!.raidProgress.standingContractsBanked).toBe(1);
  });

  it('refuses a contract from a round the save is not on, and one offered before the chain is banked', () => {
    const ahead = standingBoard({ ...seedSave(new MemoryStorage(), 5).load()!.raidProgress })[0];
    const saves = seedSave(new MemoryStorage(), 1);
    expect(saves.bankContract(ahead, NOTHING_CARRIED).granted).toBe(false);

    const early = seedSave(new MemoryStorage(), 0, CHAIN.slice(0, 2));
    const [offered] = standingBoard({ ...early.load()!.raidProgress, completedContracts: CHAIN });
    expect(early.bankContract(offered, NOTHING_CARRIED).granted).toBe(false);
    expect(early.load()!.raidProgress.standingContractsBanked).toBe(0);
  });

  it('still pays a sealed-district contract after the raid beat the boss it was drawn behind', () => {
    // The contract is finished by winning the fight that opens its gate, and that
    // win is written to the save before the raid extracts - so by banking time
    // the board this contract came from no longer exists.
    const round = Array.from({ length: 40 }, (_, banked) => banked).find((banked) =>
      standingBoard({ ...DEFAULT_RAID_PROGRESS, completedContracts: CHAIN, unlockedInsertions: ['route-1'], standingContractsBanked: banked })
        .some((contract) => contract.sealedBehind),
    )!;
    const saves = seedSave(new MemoryStorage(), round);
    const contract = standingBoard(saves.load()!.raidProgress).find((candidate) => candidate.sealedBehind)!;

    expect(saves.recordDefeatedBosses(['overlook-warden'])).toEqual(['overlook-warden']);
    expect(standingBoard(saves.load()!.raidProgress).some((candidate) => candidate.sealedBehind)).toBe(false);

    expect(saves.bankContract(contract, NOTHING_CARRIED).granted).toBe(true);
    expect(saves.load()!.raidProgress.standingContractsBanked).toBe(round + 1);
  });

  it('never stores a contract: the save keeps the count and nothing else about the board', () => {
    const storage = new MemoryStorage();
    const saves = seedSave(storage, 3);
    saves.bankContract(standingBoard(saves.load()!.raidProgress)[0], NOTHING_CARRIED);
    const written = JSON.parse(storage.getItem(SAVE_KEY)!) as { raidProgress: Record<string, unknown> };
    expect(written.raidProgress.standingContractsBanked).toBe(4);
    expect(JSON.stringify(written.raidProgress)).not.toContain('standing-');
  });

  it('reads a save written before the standing board, or a damaged count, as none banked', () => {
    for (const value of [undefined, -2, 1.5, 'seven', null]) {
      const storage = new MemoryStorage();
      seedSave(storage, 0);
      const written = JSON.parse(storage.getItem(SAVE_KEY)!) as { raidProgress: Record<string, unknown> };
      written.raidProgress.standingContractsBanked = value;
      storage.setItem(SAVE_KEY, JSON.stringify(written));
      expect(new SaveManager(storage).load()!.raidProgress.standingContractsBanked).toBe(0);
    }
  });
});

describe('the lobby’s contract board', () => {
  it('lists the authored chain exactly as it did, until the chain is banked', () => {
    const board = buildContractBoard({ ...DEFAULT_RAID_PROGRESS, completedContracts: [CHAIN[0], CHAIN[1]] });
    expect(board).toMatchObject({ heading: 'Contract board', note: '2 open · rewards require extraction' });
    expect(board.rows.map((row) => [row.name, row.asks])).toEqual([
      ['Cordon ledger', 'Banks only through WEST CULVERT'],
      ['Warden’s resupply', 'Pack 2× Potion'],
    ]);
  });

  it('becomes the standing board after it, says what turns it over, and leads with the most hunter', () => {
    const progress = seedSave(new MemoryStorage(), 3).load()!.raidProgress;
    const board = buildContractBoard(progress);
    expect(board).toMatchObject({
      heading: 'Standing board',
      note: '4 open · 3 banked · turns over when you bank one',
    });
    expect(board.rows).toHaveLength(4);
    expect(board.rows[0].hunterPressure).toBe(standingTopPressure(3));
    expect(board.rows.map((row) => row.hunterPressure)).toEqual(
      [...board.rows.map((row) => row.hunterPressure)].sort((a, b) => b - a),
    );
    expect(board.rows.map((row) => row.contractId).sort()).toEqual(
      standingBoard(progress).map((contract) => contract.id).sort(),
    );
  });

  it('puts everything a contract costs in one line: the door, the exit, the pack and the hunter', () => {
    const row = contractBoardRow({
      ...RAID_CONTRACTS[3],
      requiredExitLabel: 'OVERLOOK STILE',
      hunterPressure: 2,
      sealedBehind: { gateLabel: 'OVERLOOK GATE', bossName: 'WARDEN WREN' },
    });
    expect(row.asks).toBe(
      'Behind OVERLOOK GATE, held by WARDEN WREN · Banks only through OVERLOOK STILE · Pack 2× Potion · Hunter +2 tiers',
    );
    expect(row.reward).toBe(RAID_CONTRACTS[3].reward.summary);
    expect(contractBoardRow(RAID_CONTRACTS[0]).asks).toBe('');
  });
});
