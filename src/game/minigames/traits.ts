import { GENERATED_SPECIES, type GeneratedSpecies } from '../pokemon/generated/speciesCatalogue';
import { pokemonCargoCells } from '../pokemon/pokemonCargo';
import { PokemonType } from '../pokemon/PokemonType';

/**
 * What the promenade's outdoor games read off a Pokémon (the harbour arenas
 * plan, section 3.1, rule 2): facts the game already holds, never a number
 * typed for a game. Its kind's types and base stats, every ability FireRed's
 * species table gives the kind (`abilityIds`: the battle plays one, but a
 * Meowth's Pickup and a Grimer's Stench are FireRed's field rules, and these
 * games are the field), its size in the pack's own measure - four squares, six
 * or nine (`pokemon/pokemonCargo.ts`) - and the moves this one knows.
 *
 * Phaser-free: the games are played headless by their tests and measuring
 * tools, on the same traits the scene hands them.
 */
export interface PokemonTraits {
  readonly species: string;
  readonly dexId: number;
  /** The kind's name, as FireRed prints it. */
  readonly kind: string;
  readonly types: readonly PokemonType[];
  readonly hp: number;
  readonly speed: number;
  /** Every FireRed ability slot the kind has. */
  readonly abilities: readonly string[];
  /** Four, six or nine squares. */
  readonly squares: number;
  /** The moves this one knows, by id (`dig`, `surf`). */
  readonly moves: readonly string[];
}

const BY_ID = new Map<string, GeneratedSpecies>(GENERATED_SPECIES.map((species) => [species.id, species]));

/** A move's id as the catalogue keys it, from the name a Pokémon carries (`Rock Smash` is `rock-smash`). */
export function moveId(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** A kind's traits, knowing the given moves; undefined for a kind not in the 151. */
export function traitsOf(species: string, moves: readonly string[] = []): PokemonTraits | undefined {
  const found = BY_ID.get(species);
  if (!found) return undefined;
  return {
    species: found.id,
    dexId: found.dexId,
    kind: found.name.toUpperCase(),
    types: found.types,
    hp: found.baseStats.hp,
    speed: found.baseStats.speed,
    abilities: found.abilityIds,
    squares: pokemonCargoCells(found.id),
    moves: moves.map(moveId),
  };
}

/** A kind's traits, for the tables and tests that name one: throws for a kind not in the 151. */
export function traits(species: string, moves: readonly string[] = []): PokemonTraits {
  const found = traitsOf(species, moves);
  if (!found) throw new Error(`no species '${species}'`);
  return found;
}

export const hasType = (pokemon: PokemonTraits, type: PokemonType): boolean => pokemon.types.includes(type);
export const hasAbility = (pokemon: PokemonTraits, ability: string): boolean => pokemon.abilities.includes(ability);
export const knows = (pokemon: PokemonTraits, move: string): boolean => pokemon.moves.includes(move);

/** A small seeded roll, apart from every other stream in the game. */
export function roller(seed: number): () => number {
  let state = (seed * 2654435761 + 0x6d2b79f5) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** A number for a day, the player's own date: the same field, the same going, for everybody that day. */
export function daySeed(day: string): number {
  let hash = 2166136261;
  for (const character of day) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return hash >>> 0;
}

export { PokemonType };
