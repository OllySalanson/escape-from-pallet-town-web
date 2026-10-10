import {
  POKEMON_ICON_ORDER,
  POKEMON_ICON_SHEET,
  POKEMON_ICON_SOLES,
} from '../pokemon/generated/pokemonIcons';
import { getSpeciesById } from '../pokemon/species';

/**
 * A Pokemon standing in the world, as a map maker places one: drawn from
 * FireRed's own two-frame party icon (`scripts/cut-frlg-pokemon-icons.mjs`),
 * standing on one tile and solid as a person is, and saying its own name when
 * spoken to, the way a Pokemon in the anime does. Every species the game has
 * has an icon, and nothing that is not one of them can be placed.
 */
export type FigureSpeciesId = (typeof POKEMON_ICON_ORDER)[number];

export const POKEMON_ICON_TEXTURE = 'pokemonIcons';
export const POKEMON_ICON_PATH = POKEMON_ICON_SHEET.imagePath;
export const POKEMON_ICON_SIZE = POKEMON_ICON_SHEET.frameSize;

/** How long each of an icon's two frames is shown, as FireRed's party menu bobs them. */
export const POKEMON_ICON_FRAME_MS = 300;

export function isFigureSpecies(value: unknown): value is FigureSpeciesId {
  return typeof value === 'string' && (POKEMON_ICON_ORDER as readonly string[]).includes(value);
}

/** The sheet frames a species is drawn from: its two, in order. */
export function pokemonIconFrames(species: FigureSpeciesId): readonly [number, number] {
  const first = POKEMON_ICON_ORDER.indexOf(species) * POKEMON_ICON_SHEET.framesPerSpecies;
  return [first, first + 1];
}

/** The species' name as the game prints it. */
export function pokemonName(species: FigureSpeciesId): string {
  return getSpeciesById(species)?.name ?? species;
}

/**
 * What a Pokemon says when spoken to: its name in capitals, then the first of
 * it twice - PIKACHU: Pika pika! - which is how one sounds in the anime, and
 * which nobody reading it could mistake for a person talking.
 */
export function pokemonCry(species: FigureSpeciesId): string {
  const name = pokemonName(species);
  // The longest word of the name, so MR. MIME says Mime and not Mr.
  const word = name
    .split(/[^A-Za-z]+/)
    .reduce((longest, part) => (part.length > longest.length ? part : longest), '');
  const part = word.slice(0, 4).toLowerCase();
  return `${name.toUpperCase()}: ${part.charAt(0).toUpperCase()}${part.slice(1)} ${part}!`;
}

/**
 * How far below its tile's bottom edge an icon's frame is hung, so the lowest
 * row it draws - its feet - lands on the tile's last row, where a person's soles
 * are. Each icon sits its own height in its frame.
 */
export function pokemonSoleDrop(species: FigureSpeciesId): number {
  return POKEMON_ICON_SIZE - 1 - POKEMON_ICON_SOLES[POKEMON_ICON_ORDER.indexOf(species)];
}
