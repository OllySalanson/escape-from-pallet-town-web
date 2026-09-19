import type { PokemonBase } from '../pokemon';
import { STARTER_SPECIES, type StarterSpeciesId } from '../stash';
import { pixelPortrait, pixelTypeBadge } from './pixelUi';

/**
 * Shared by every surface that offers the three starters, so the first-run
 * briefing and the lobby swap always describe them in the same words.
 */
export const STARTER_NOTES: Readonly<Record<StarterSpeciesId, string>> = {
  bulbasaur: 'Strong special bulk',
  charmander: 'Quickest of the three',
  squirtle: 'Best physical defense',
};

export interface StarterCardOptions {
  /** Species already held, marked so a swap into it is never a surprise. */
  readonly heldSpeciesId?: string;
  /** What choosing an unselected card does, for the help bar. */
  readonly selectHelp?: string;
}

/**
 * The three starters as pixel-ui cards: the front sprite at its own size, then
 * the name, the types and the one-line note. Which card is chosen is the card's
 * own fill and the cursor, not a word at the bottom of it.
 */
export function starterCards(
  selectedId: StarterSpeciesId,
  { heldSpeciesId, selectHelp = 'Choose this starter.' }: StarterCardOptions = {},
): string {
  return STARTER_SPECIES.map((species) => {
    const selected = species.id === selectedId;
    const held = species.id === heldSpeciesId;
    const help = held ? 'Your current partner.' : selected ? 'Chosen. Confirm below.' : selectHelp;
    return `<button class="px-window px-card starter-card${selected ? ' is-selected' : ''}" data-starter="${species.id}" data-help="${help}" aria-pressed="${selected}"><span class="starter-number">No. ${String(species.dexId).padStart(3, '0')}${held ? ' · yours' : ''}</span>${pixelPortrait(species.dexId, species.name)}<strong class="px-name">${species.name}</strong><span>${pixelTypeBadge(species.primaryType)}${species.secondaryType ? pixelTypeBadge(species.secondaryType) : ''}</span><small class="px-wrap">${STARTER_NOTES[species.id]}</small></button>`;
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
