import { getHeldItem } from '../items';
import type { Pokemon } from '../pokemon';
import type { StashedPokemon } from '../stash';
import { needsRecovery } from './recovery';

/**
 * Finding a Pokemon in a stash that has grown past one screen.
 *
 * Boxes decide where a Pokemon is kept; this decides how any list of them is
 * shown. It is pure and reads nothing but the Pokemon, so the stash, the
 * loadout and the Outfitter's payment list all order and search the same way,
 * and nothing here is saved: it is how the player is looking, not what they own.
 */

export type StashSort = 'kept' | 'species' | 'level' | 'fit';

export const STASH_SORTS: readonly StashSort[] = ['kept', 'species', 'level', 'fit'];

export const STASH_SORT_LABELS: Readonly<Record<StashSort, string>> = {
  kept: 'As kept',
  species: 'Species',
  level: 'Level',
  fit: 'Fit first',
};

/** What a sort does, said in the help bar. */
export const STASH_SORT_HELP: Readonly<Record<StashSort, string>> = {
  kept: 'The order they were banked in.',
  species: 'By Pokédex number, the higher level first within a species.',
  level: 'Highest level first.',
  fit: 'Those fit to raid first, then those that need recovery; highest level first within each.',
};

export function nextStashSort(sort: StashSort): StashSort {
  return STASH_SORTS[(STASH_SORTS.indexOf(sort) + 1) % STASH_SORTS.length];
}

const byLevel = (a: Pokemon, b: Pokemon): number => b.level - a.level;
const bySpecies = (a: Pokemon, b: Pokemon): number => a.base.dexId - b.base.dexId;

/**
 * The same Pokemon in the order a sort asks for. A stable sort with the kept
 * order as the last word, so two equal Pokemon never swap places between one
 * render and the next.
 */
export function sortPokemon(
  list: readonly StashedPokemon[],
  sort: StashSort,
): readonly StashedPokemon[] {
  if (sort === 'kept') {
    return [...list];
  }
  const compare = (a: StashedPokemon, b: StashedPokemon): number => {
    switch (sort) {
      case 'species':
        return bySpecies(a.pokemon, b.pokemon) || byLevel(a.pokemon, b.pokemon);
      case 'level':
        return byLevel(a.pokemon, b.pokemon) || bySpecies(a.pokemon, b.pokemon);
      case 'fit':
        return (
          Number(needsRecovery(a.pokemon)) - Number(needsRecovery(b.pokemon)) ||
          byLevel(a.pokemon, b.pokemon) ||
          bySpecies(a.pokemon, b.pokemon)
        );
    }
  };
  return list
    .map((stored, index) => ({ stored, index }))
    .sort((a, b) => compare(a.stored, b.stored) || a.index - b.index)
    .map(({ stored }) => stored);
}

/**
 * Whether a Pokemon answers a search: every word typed has to begin a word of
 * its species name or of the gear it holds, so `pika` finds Pikachu and `char`
 * finds Charmander and Charizard alike. Case is ignored, and an empty search
 * answers everything.
 */
export function matchesSearch(stored: StashedPokemon, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return true;
  }
  const haystack = `${stored.pokemon.base.name} ${getHeldItem(stored.pokemon.heldItemId)?.displayName ?? ''}`
    .toLowerCase()
    .split(/[\s-]+/);
  return words.every((word) => haystack.some((candidate) => candidate.startsWith(word)));
}

export function searchPokemon(
  list: readonly StashedPokemon[],
  search: string,
): readonly StashedPokemon[] {
  return list.filter((stored) => matchesSearch(stored, search));
}
