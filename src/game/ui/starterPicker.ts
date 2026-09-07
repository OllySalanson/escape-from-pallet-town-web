import type { PokemonBase } from '../pokemon';
import { STARTER_SPECIES, type StarterSpeciesId } from '../stash';
import { pokemonAvatar, typeBadge } from './MenuOverlay';

/**
 * Shared by every surface that offers the three starters, so the first-run
 * briefing and the lobby swap always describe them in the same words.
 */
export const STARTER_NOTES: Readonly<Record<StarterSpeciesId, string>> = {
  bulbasaur: 'Grass / Poison · strong special bulk',
  charmander: 'Fire · the quickest of the three',
  squirtle: 'Water · strongest physical defense',
};

export interface StarterCardOptions {
  /** Species already held, marked so a swap into it is never a surprise. */
  readonly heldSpeciesId?: string;
  /** Wording for the call to action on an unselected card. */
  readonly selectLabel?: string;
}

export function starterCards(
  selectedId: StarterSpeciesId,
  { heldSpeciesId, selectLabel = 'Select →' }: StarterCardOptions = {},
): string {
  return STARTER_SPECIES.map((species) => {
    const selected = species.id === selectedId;
    const held = species.id === heldSpeciesId;
    return `<button class="starter-card ${selected ? 'selected' : ''}" data-starter="${species.id}" aria-pressed="${selected}">${pokemonAvatar(species.dexId, species.name)}<div><span class="eyebrow">No. ${String(species.dexId).padStart(3, '0')}${held ? ' · Current partner' : ''}</span><h2>${species.name}</h2><p>${STARTER_NOTES[species.id]}</p><div>${typeBadge(species.primaryType)}${species.secondaryType ? typeBadge(species.secondaryType) : ''}</div></div><b>${selected ? 'Selected' : selectLabel}</b></button>`;
  }).join('');
}

/** Describes exactly what a fresh copy of a starter arrives with. */
export function starterLoadoutSummary(species: PokemonBase): string {
  const moves = species.learnset
    .filter(({ level }) => level <= 5)
    .map(({ move }) => move.name)
    .join(', ');
  return `Level 5 · ${moves}`;
}
