import { Move, Pokemon, PokemonParty, getSpeciesById, type MoveBase } from '../pokemon';
import { Bag, type BagContents } from '../items/Bag';
import type { PrimaryStatus } from '../pokemon/battle/status';
import type { GridPosition } from '../movement/gridMovement';
import {
  getStarterSpecies,
  Stash,
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
}

export const DEFAULT_RAID_PROGRESS: RaidProgress = {
  firstContractExtracted: false,
  unlockedInsertions: ['town-square'],
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
   */
  public bankRun(result: RunResult): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }

    game.stash.bankRun(result);
    return this.save(game);
  }

  /**
   * Banks the recovered field kit's raid and applies its permanent reward once.
   * The persisted completion flag makes repeated extraction handling idempotent.
   */
  public bankFirstContractRun(result: RunResult): { readonly saved: boolean; readonly granted: boolean } {
    const game = this.load();
    if (!game) {
      return { saved: false, granted: false };
    }

    game.stash.bankRun(result);
    if (game.raidProgress.firstContractExtracted) {
      return { saved: this.save(game), granted: false };
    }

    const raidProgress: RaidProgress = {
      firstContractExtracted: true,
      unlockedInsertions: [...new Set([...game.raidProgress.unlockedInsertions, 'south-verge'])],
    };
    game.stash.addItem('super-potion', 1);
    return {
      saved: this.save({ ...game, raidProgress }),
      granted: true,
    };
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
    if (!game || !game.stash.swapStarter(getStarterSpecies(starterId))) {
      return false;
    }

    return this.save({ ...game, starterSpeciesId: starterId });
  }

  /**
   * Persists a wipe after permanently deleting deployed assets outside the
   * secure slot. SecureSlot allows one Pokemon ID and at most two item stacks.
   */
  public applyWipeLoss(
    broughtPokemonIds: readonly string[],
    broughtItems: readonly { readonly itemId: string; readonly quantity: number }[],
    secureSlot: SecureSlot = {},
  ): boolean {
    const game = this.load();
    if (!game) {
      return false;
    }

    game.stash.applyWipeLoss(broughtPokemonIds, broughtItems, secureSlot);
    // A wipe must never hand the player back a run they cannot attempt: a fresh
    // starter when none survived, and supplies topped up to the minimum either
    // way, including when the secure slot saved a Pokemon but no items.
    game.stash.ensurePlayable(game.starterSpeciesId ? getStarterSpecies(game.starterSpeciesId) : undefined);
    game.stash.restockMinimumSupplies();
    return this.save(game);
  }
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
  };
}

function deserializeRaidProgress(value: unknown): RaidProgress {
  if (!isRecord(value)) {
    return DEFAULT_RAID_PROGRESS;
  }

  const unlockedInsertions = Array.isArray(value.unlockedInsertions)
    ? value.unlockedInsertions.filter((insertion): insertion is string => typeof insertion === 'string')
    : DEFAULT_RAID_PROGRESS.unlockedInsertions;
  return {
    firstContractExtracted: value.firstContractExtracted === true,
    unlockedInsertions: unlockedInsertions.includes('town-square')
      ? [...new Set(unlockedInsertions)]
      : ['town-square', ...unlockedInsertions],
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
