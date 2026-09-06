import { Move, Pokemon, PokemonParty, getSpeciesById } from '../pokemon';
import type { PrimaryStatus } from '../pokemon/battle/status';
import type { GridPosition } from '../movement/gridMovement';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';

export const SAVE_KEY = 'escape-from-pallet-town.save.v1';
const SAVE_VERSION = 1;
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

export interface SavedStash {
  /**
   * Persistent extraction rewards. Active-run Pokemon and items stay outside this
   * object until a later meta-layer banks them here.
   */
  readonly pokemon: readonly SavedPokemon[];
  readonly items: readonly string[];
}

export interface SaveData {
  readonly version: typeof SAVE_VERSION;
  readonly party: readonly SavedPokemon[];
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items: readonly string[];
  readonly stash: SavedStash;
}

export interface RestoredGame {
  readonly party: PokemonParty;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items: readonly string[];
  readonly stash: SavedStash;
}

export interface SaveGameState {
  readonly party: PokemonParty;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly items?: readonly string[];
  readonly stash?: Partial<SavedStash>;
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
}

export function serializeGame(state: SaveGameState): SaveData {
  return {
    version: SAVE_VERSION,
    party: state.party.pokemon.map(serializePokemon),
    mapId: state.mapId,
    position: { ...state.position },
    items: [...(state.items ?? [])],
    stash: {
      pokemon: [...(state.stash?.pokemon ?? [])],
      items: [...(state.stash?.items ?? [])],
    },
  };
}

export function deserializeGame(value: unknown): RestoredGame | null {
  if (!isRecord(value) || value.version !== SAVE_VERSION) {
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
    const restoredPokemon = deserializePokemon(savedPokemon);
    if (!restoredPokemon) {
      return null;
    }
    pokemon.push(restoredPokemon);
  }

  return {
    party: new PokemonParty(pokemon),
    mapId,
    position: { ...position },
    items: stringArray(value.items),
    stash: deserializeStash(value.stash),
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

function deserializePokemon(value: unknown): Pokemon | null {
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
    if (savedMoves.length > 0) {
      pokemon.moves.splice(0, pokemon.moves.length, ...savedMoves.map((move) => new Move(move)));
    }
  }

  setPokemonXp(pokemon, clampInteger(value.xp, 0, Number.MAX_SAFE_INTEGER, 0));
  return pokemon;
}

function deserializeStash(value: unknown): SavedStash {
  if (!isRecord(value)) {
    return { pokemon: [], items: [] };
  }

  return {
    pokemon: Array.isArray(value.pokemon)
      ? value.pokemon
          .map((entry) => serializePokemonIfValid(entry))
          .filter((entry): entry is SavedPokemon => entry !== null)
      : [],
    items: stringArray(value.items),
  };
}

function serializePokemonIfValid(value: unknown): SavedPokemon | null {
  const pokemon = deserializePokemon(value);
  return pokemon ? serializePokemon(pokemon) : null;
}

function getPokemonXp(pokemon: Pokemon): number {
  const value = (pokemon as unknown as { xp?: unknown }).xp;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function setPokemonXp(pokemon: Pokemon, xp: number): void {
  const experiencePokemon = pokemon as unknown as { xp?: number };
  if ('xp' in experiencePokemon) {
    experiencePokemon.xp = xp;
  }
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
