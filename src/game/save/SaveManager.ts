import { clampPendingRecoveryMs } from '../hub/recovery';
import {
  contractRestockBonus,
  contractUnlockedInsertionIds,
  FIRST_CONTRACT_ID,
  getContract,
} from '../objectives/contracts';
import { Move, Pokemon, PokemonParty, getSpeciesById, type MoveBase } from '../pokemon';
import { Bag, type BagContents } from '../items/Bag';
import type { PrimaryStatus } from '../pokemon/battle/status';
import type { GridPosition } from '../movement/gridMovement';
import {
  getStarterSpecies,
  Stash,
  type RaidCondition,
  type RaidSettlement,
  type RunResult,
  type SecureSlot,
  type StarterSpeciesId,
} from '../stash/Stash';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';

export const SAVE_KEY = 'escape-from-pallet-town.save.v1';
const SAVE_VERSION = 5;
const PRIMARY_STATUSES = new Set<PrimaryStatus>([
  'poison',
  'burn',
  'paralysis',
  'sleep',
  'freeze',
]);

export interface SavedPokemon {
  readonly speciesId: string;
  readonly level: number;
  readonly currentHp: number;
  readonly xp: number;
  readonly moves: readonly string[];
  readonly primaryStatus: PrimaryStatus | null;
}

export interface SavedStashedPokemon {
  readonly id: string;
  readonly pokemon: SavedPokemon;
}

export interface SavedStash {
  readonly pokemon: readonly SavedStashedPokemon[];
  readonly items: BagContents;
}

export interface RaidProgress {
  readonly firstContractExtracted: boolean;
  readonly unlockedInsertions: readonly string[];
  /**
   * Every contract banked for good, by id. It is the whole record of contract
   * progression: which contracts the board still offers, how many stacks the
   * secure slot protects and what base restocks are all derived from it, so
   * nothing can disagree with it.
   */
  readonly completedContracts: readonly string[];
}

/**
 * Floodplain Relay is the area every save starts with: it is where the first
 * contract lives. Every other insertion is the first contract's reward.
 */
/**
 * Extracting the first contract opens every other level at once. They are three
 * different maps rather than three doors into one, which is the whole point of
 * the unlock.
 */
export const CONTRACT_REWARD_INSERTIONS: readonly string[] =
  contractUnlockedInsertionIds([FIRST_CONTRACT_ID]);

/**
 * `south-verge` was a second insertion on the Pallet Town map whose entire
 * route was contained in the Town Square route - the same level under two
 * names. It is gone; saves that unlocked it keep Town Square instead.
 */
const RETIRED_INSERTIONS: Readonly<Record<string, string>> = { 'south-verge': 'town-square' };

export const DEFAULT_RAID_PROGRESS: RaidProgress = {
  firstContractExtracted: false,
  unlockedInsertions: ['floodplain-relay'],
  completedContracts: [],
};

export interface SaveData {
  readonly version: typeof SAVE_VERSION;
  readonly party: readonly SavedPokemon[];
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items: readonly string[];
  readonly bag: BagContents;
  readonly stash: SavedStash;
  readonly raidProgress: RaidProgress;
  readonly starterSpeciesId: StarterSpeciesId | null;
  /**
   * Raid time owed for recovery already carried out at base, subtracted from
   * the next raid's clock. Saves written before recovery existed simply have no
   * debt, so they keep loading unchanged and need no version bump.
   */
  readonly pendingRecoveryMs: number;
}

export interface RestoredGame {
  readonly party: PokemonParty;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items: readonly string[];
  readonly bag: Bag;
  readonly stash: Stash;
  readonly raidProgress: RaidProgress;
  readonly starterSpeciesId: StarterSpeciesId | null;
  readonly pendingRecoveryMs: number;
}

export interface SaveGameState {
  readonly party: PokemonParty;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items?: readonly string[];
  readonly bag?: Bag;
  readonly stash?: Stash;
  readonly raidProgress?: RaidProgress;
  readonly starterSpeciesId?: StarterSpeciesId | null;
  readonly pendingRecoveryMs?: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SaveManager {
  private readonly storage: StorageLike | null;

  public constructor(storage: StorageLike | null = getBrowserStorage()) {
    this.storage = storage;
  }

  public hasSave(): boolean {
    return this.load() !== null;
  }

  public save(state: SaveGameState): boolean {
    if (!this.storage) {
      return false;
    }

    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(serializeGame(state)));
      return true;
    } catch {
      return false;
    }
  }

  public load(): RestoredGame | null {
    if (!this.storage) {
      return null;
    }

    try {
      const rawSave = this.storage.getItem(SAVE_KEY);
      if (!rawSave) {
        return null;
      }

      return deserializeGame(JSON.parse(rawSave));
    } catch {
      return null;
    }
  }

  public clear(): void {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      // Browser storage can be unavailable or full. A failed clear must not break play.
    }
  }

  /**
   * Adds successful extraction rewards to the persisted vault. The active save
   * must exist because its world state is retained while only the stash changes.
   *
   * The settlement is what the raid itself cost - the condition every deployed
   * Pokemon came home in, and the supplies that did not come home. It is applied
   * before the rewards so a raid is never free, and it is optional only so that
   * callers with nothing to settle (tests, and any future reward-only banking)
   * stay honest rather than passing an invented one.
   */
  public bankRun(result: RunResult, settlement?: RaidSettlement): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }

    applySettlement(game.stash, settlement);
    game.stash.bankRun(result);
    // The raid this debt paid for has now resolved, so it is settled. Charging
    // on resolution rather than on deployment is what stops a player healing,
    // deploying into the shortened raid and reloading the page to shed the bill.
    return this.save({ ...game, pendingRecoveryMs: 0 });
  }

  /**
   * Banks a raid that completed a contract, and applies that contract's
   * permanent reward exactly once. The persisted `completedContracts` list makes
   * repeated extraction handling idempotent, and it is the same path for every
   * contract: the first one is not a special case, it is just the one whose
   * reward happens to be insertions.
   */
  public bankContract(
    contractId: string,
    result: RunResult,
    settlement?: RaidSettlement,
  ): { readonly saved: boolean; readonly granted: boolean } {
    const game = this.load();
    if (!game) {
      return { saved: false, granted: false };
    }

    applySettlement(game.stash, settlement);
    game.stash.bankRun(result);
    const contract = getContract(contractId);
    if (!contract || game.raidProgress.completedContracts.includes(contractId)) {
      return { saved: this.save({ ...game, pendingRecoveryMs: 0 }), granted: false };
    }

    const completedContracts = [...game.raidProgress.completedContracts, contractId];
    const raidProgress: RaidProgress = {
      firstContractExtracted:
        game.raidProgress.firstContractExtracted || contractId === FIRST_CONTRACT_ID,
      unlockedInsertions: [
        ...new Set([
          ...game.raidProgress.unlockedInsertions,
          ...(contract.reward.unlockedInsertionIds ?? []),
        ]),
      ],
      completedContracts,
    };
    for (const { itemId, quantity } of contract.reward.items) {
      game.stash.addItem(itemId, quantity);
    }
    return {
      saved: this.save({ ...game, raidProgress, pendingRecoveryMs: 0 }),
      granted: true,
    };
  }

  /** The first contract's banking path, named for the one raid that uses it. */
  public bankFirstContractRun(
    result: RunResult,
    settlement?: RaidSettlement,
  ): { readonly saved: boolean; readonly granted: boolean } {
    return this.bankContract(FIRST_CONTRACT_ID, result, settlement);
  }

  /**
   * Trades the player's sole remaining Pokemon for a fresh level-5 starter and
   * records the new species, so later wipe re-grants restore what the player
   * has just chosen rather than the species they picked on their first run.
   *
   * @returns Whether the swap was applied and persisted.
   */
  public reselectStarter(starterId: StarterSpeciesId): boolean {
    const game = this.load();
    if (
      !game ||
      !game.stash.swapStarter(
        getStarterSpecies(starterId),
        contractRestockBonus(game.raidProgress.completedContracts),
      )
    ) {
      return false;
    }

    return this.save({ ...game, starterSpeciesId: starterId });
  }

  /**
   * Persists a wipe after permanently deleting deployed assets outside the
   * secure slot. SecureSlot allows one Pokemon ID and at most two item stacks.
   *
   * Only the condition half of a settlement applies here: a secured Pokemon
   * comes home in the state the raid left it in, usually fainted, while every
   * other deployed Pokemon and the whole deployed supply are removed outright,
   * so a supply delta would only take the same items away twice.
   */
  public applyWipeLoss(
    broughtPokemonIds: readonly string[],
    broughtItems: readonly { readonly itemId: string; readonly quantity: number }[],
    secureSlot: SecureSlot = {},
    condition: readonly RaidCondition[] = [],
  ): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }

    game.stash.applyRaidCondition(condition);
    game.stash.applyWipeLoss(broughtPokemonIds, broughtItems, secureSlot);
    // A wipe must never hand the player back a run they cannot attempt: a fresh
    // starter when none survived, and supplies topped up to the minimum either
    // way, including when the secure slot saved a Pokemon but no items.
    const restockBonus = contractRestockBonus(game.raidProgress.completedContracts);
    game.stash.ensurePlayable(
      game.starterSpeciesId ? getStarterSpecies(game.starterSpeciesId) : undefined,
      restockBonus,
    );
    game.stash.restockMinimumSupplies(restockBonus);
    return this.save({ ...game, pendingRecoveryMs: 0 });
  }
}

/** Settles the raid's own cost before anything it earned is added. */
function applySettlement(stash: Stash, settlement: RaidSettlement | undefined): void {
  if (!settlement) {
    return;
  }
  stash.applyRaidCondition(settlement.condition);
  stash.applyRaidSupplies(settlement.supplies);
}

export function serializeGame(state: SaveGameState): SaveData {
  return {
    version: SAVE_VERSION,
    party: state.party.pokemon.map(serializePokemon),
    mapId: state.mapId,
    position: { ...state.position },
    items: [...(state.items ?? [])],
    bag: state.bag?.toJSON() ?? {},
    stash: serializeStash(state.stash ?? new Stash()),
    raidProgress: state.raidProgress ?? DEFAULT_RAID_PROGRESS,
    starterSpeciesId: state.starterSpeciesId ?? inferStarterSpeciesId(state.stash),
    pendingRecoveryMs: clampPendingRecoveryMs(state.pendingRecoveryMs),
  };
}

export function deserializeGame(value: unknown): RestoredGame | null {
  if (
    !isRecord(value) ||
    typeof value.version !== 'number' ||
    ![1, 2, 3, 4, SAVE_VERSION].includes(value.version)
  ) {
    return null;
  }

  const mapId = value.mapId;
  const position = value.position;
  const party = value.party;
  if (
    !isWorldMapId(mapId) ||
    !isGridPosition(position) ||
    position.x >= WORLD_MAPS[mapId].width ||
    position.y >= WORLD_MAPS[mapId].height ||
    !Array.isArray(party)
  ) {
    return null;
  }

  const pokemon: Pokemon[] = [];
  for (const savedPokemon of party) {
    const restoredPokemon = deserializePokemon(savedPokemon, value.version);
    if (!restoredPokemon) {
      return null;
    }
    pokemon.push(restoredPokemon);
  }

  const stash = deserializeStash(value.stash, value.version);
  return {
    party: new PokemonParty(pokemon),
    mapId,
    position: { ...position },
    items: stringArray(value.items),
    bag: new Bag(bagContents(value.bag)),
    stash,
    raidProgress: deserializeRaidProgress(value.raidProgress),
    starterSpeciesId: deserializeStarterSpeciesId(value.starterSpeciesId) ?? inferStarterSpeciesId(stash),
    pendingRecoveryMs: clampPendingRecoveryMs(value.pendingRecoveryMs),
  };
}

function deserializeRaidProgress(value: unknown): RaidProgress {
  if (!isRecord(value)) {
    return DEFAULT_RAID_PROGRESS;
  }

  const unlockedInsertions = (
    Array.isArray(value.unlockedInsertions)
      ? value.unlockedInsertions.filter((insertion): insertion is string => typeof insertion === 'string')
      : DEFAULT_RAID_PROGRESS.unlockedInsertions
  ).map((insertion) => RETIRED_INSERTIONS[insertion] ?? insertion);
  const savedContracts = Array.isArray(value.completedContracts)
    ? value.completedContracts.filter((id): id is string => typeof id === 'string')
    : [];
  // A save written before contracts were a list still records the first one as
  // a flag, so a player who banked it keeps its reward and is offered the next
  // contract rather than being asked to recover the field kit twice.
  const firstContractExtracted =
    value.firstContractExtracted === true || savedContracts.includes(FIRST_CONTRACT_ID);
  const completedContracts = [
    ...new Set([...(firstContractExtracted ? [FIRST_CONTRACT_ID] : []), ...savedContracts]),
  ];
  return {
    firstContractExtracted,
    completedContracts,
    // The starting area is never lost, so a save written before Floodplain Relay
    // became the first raid still opens on an insertion the player can use, and
    // a save that already banked the contract gets every level the contract now
    // pays out rather than only the ones that existed when it was written.
    unlockedInsertions: [
      ...new Set([
        'floodplain-relay',
        ...unlockedInsertions,
        ...(firstContractExtracted ? CONTRACT_REWARD_INSERTIONS : []),
      ]),
    ],
  };
}

function serializePokemon(pokemon: Pokemon): SavedPokemon {
  return {
    speciesId: pokemon.base.id,
    level: pokemon.level,
    currentHp: pokemon.currentHp,
    // XP is not yet represented by the Pokemon class. This preserves the field
    // for the rewards layer that will add it without coupling save code to it.
    xp: getPokemonXp(pokemon),
    moves: pokemon.moves.map((move) => move.base.name),
    primaryStatus: pokemon.primaryStatus,
  };
}

function deserializePokemon(value: unknown, saveVersion = SAVE_VERSION): Pokemon | null {
  if (!isRecord(value) || typeof value.speciesId !== 'string' || !isPositiveInteger(value.level)) {
    return null;
  }

  const species = getSpeciesById(value.speciesId);
  if (!species) {
    return null;
  }

  const pokemon = new Pokemon(species, value.level);
  pokemon.currentHp = clampInteger(value.currentHp, 0, pokemon.maxHp, pokemon.maxHp);
  pokemon.primaryStatus = isPrimaryStatus(value.primaryStatus) ? value.primaryStatus : null;

  if (Array.isArray(value.moves)) {
    const movesByName = new Map(species.learnset.map((entry) => [entry.move.name, entry.move]));
    const savedMoves = value.moves
      .filter((move): move is string => typeof move === 'string')
      .map((name) => movesByName.get(name))
      .filter((move): move is NonNullable<typeof move> => move !== undefined)
      .slice(0, 4);
    reconcileLegacyBulbasaurMoves(species.id, savedMoves, saveVersion);
    if (savedMoves.length > 0) {
      pokemon.moves.splice(0, pokemon.moves.length, ...savedMoves.map((move) => new Move(move)));
    }
  }

  setPokemonXp(pokemon, clampInteger(value.xp, 0, Number.MAX_SAFE_INTEGER, 0));
  return pokemon;
}

function serializeStash(stash: Stash): SavedStash {
  return {
    pokemon: stash.listPokemon().map(({ id, pokemon }) => ({ id, pokemon: serializePokemon(pokemon) })),
    items: stash.listItems(),
  };
}

function deserializeStash(value: unknown, saveVersion: number): Stash {
  if (!isRecord(value)) {
    return new Stash();
  }

  if (saveVersion === 1) {
    const pokemon = Array.isArray(value.pokemon)
      ? value.pokemon
          .map((entry, index) => {
            const restored = deserializePokemon(entry, saveVersion);
            return restored ? { id: `legacy-${index + 1}`, pokemon: restored } : null;
          })
          .filter((entry): entry is { id: string; pokemon: Pokemon } => entry !== null)
      : [];
    return new Stash({ pokemon, items: stringArrayToBagContents(value.items) });
  }

  const pokemon = Array.isArray(value.pokemon)
    ? value.pokemon
        .map((entry) => deserializeStashedPokemon(entry, saveVersion))
        .filter((entry): entry is { id: string; pokemon: Pokemon } => entry !== null)
    : [];
  return new Stash({ pokemon, items: bagContents(value.items) });
}

function deserializeStashedPokemon(
  value: unknown,
  saveVersion: number,
): { id: string; pokemon: Pokemon } | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }
  const pokemon = deserializePokemon(value.pokemon, saveVersion);
  return pokemon ? { id: value.id, pokemon } : null;
}

/**
 * Version 4 and earlier could persist Bulbasaur without its required level-1
 * Tackle. Add only that omitted move, leaving all legitimate saved moves and
 * any full custom moveset untouched.
 */
function reconcileLegacyBulbasaurMoves(
  speciesId: string,
  moves: MoveBase[],
  saveVersion: number,
): void {
  if (saveVersion >= SAVE_VERSION || speciesId !== 'bulbasaur' || moves.length >= 4) {
    return;
  }

  const tackle = getSpeciesById('bulbasaur')?.learnset.find(
    ({ level, move }) => level === 1 && move.name === 'Tackle',
  )?.move;
  if (tackle && !moves.some((move) => move.name === tackle.name)) {
    moves.unshift(tackle);
  }
}

function deserializeStarterSpeciesId(value: unknown): StarterSpeciesId | null {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' && isStarterSpeciesId(value) ? value : null;
}

function inferStarterSpeciesId(stash: Stash | undefined): StarterSpeciesId | null {
  const speciesId = stash?.listPokemon().find(({ pokemon }) => isStarterSpeciesId(pokemon.base.id))?.pokemon.base.id;
  return speciesId && isStarterSpeciesId(speciesId) ? speciesId : null;
}

function isStarterSpeciesId(value: string): value is StarterSpeciesId {
  return value === 'bulbasaur' || value === 'charmander' || value === 'squirtle';
}

function getPokemonXp(pokemon: Pokemon): number {
  const value = pokemon.experience;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function setPokemonXp(pokemon: Pokemon, xp: number): void {
  pokemon.experience = xp;
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWorldMapId(value: unknown): value is WorldMapId {
  return typeof value === 'string' && value in WORLD_MAPS;
}

function isGridPosition(value: unknown): value is GridPosition {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.x) &&
    isNonNegativeInteger(value.y)
  );
}

function isPrimaryStatus(value: unknown): value is PrimaryStatus | null {
  return value === null || (typeof value === 'string' && PRIMARY_STATUSES.has(value as PrimaryStatus));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function bagContents(value: unknown): BagContents {
  if (!isRecord(value)) {
    return {};
  }

  const contents: Record<string, number> = {};
  for (const [itemId, quantity] of Object.entries(value)) {
    if (typeof quantity === 'number' && Number.isInteger(quantity) && quantity > 0) {
      contents[itemId] = quantity;
    }
  }
  return contents;
}

function stringArrayToBagContents(value: unknown): BagContents {
  const contents: Record<string, number> = {};
  for (const itemId of stringArray(value)) {
    contents[itemId] = (contents[itemId] ?? 0) + 1;
  }
  return contents;
}
