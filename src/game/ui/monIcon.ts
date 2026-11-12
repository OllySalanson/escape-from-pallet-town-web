/**
 * A Pokémon on a menu as FireRed draws one in its party and its PC: the 32x32
 * party icon (`public/assets/pokemon-icons.png`, cut by
 * `scripts/cut-frlg-pokemon-icons.mjs`), flapping between its two frames.
 *
 * The flap is the whole of FireRed's own rule, read off pret/pokefirered
 * (`src/pokemon_icon.c`'s `sMonIconAnims`, chosen by `UpdateHPBar` in
 * `src/party_menu.c` from `GetHPBarLevel` in `src/battle_interface.c`): a
 * Pokémon at full health flaps a frame every 6 ticks of 60, a green one every
 * 8, a yellow one every 14, a red one every 22, and a fainted one stands still. So how a Pokémon is doing is
 * seen from across the room, before a number is read - which is the point of
 * the menus being pictures (the captain, 2026-11-12: "progress he can see").
 * The one under the cursor also bounces, three pixels up on its second frame
 * and one down on its first (`SpriteCB_BouncePartyMonIcon`); that is the CSS
 * (`.px-mon-icon` in `src/style.css`), keyed off the control being focused.
 *
 * Phaser-free and a pure string, so the pace rule is tested without a browser.
 */
import { POKEMON_ICON_ORDER, POKEMON_ICON_SHEET } from '../pokemon/generated/pokemonIcons';
import { escapeAttribute } from './pixelUi';

/** FireRed's five icon paces, by how much health is left: ticks of 60 a frame is held, or still. */
export type MonIconPace = 'full' | 'green' | 'yellow' | 'red' | 'still';

/** Ticks of 60 each frame is held at each pace (`sMonIconAnims`); a still icon has none. */
export const MON_ICON_TICKS: Readonly<Record<Exclude<MonIconPace, 'still'>, number>> = {
  full: 6,
  green: 8,
  yellow: 14,
  red: 22,
};

/**
 * FireRed's `GetHPBarLevel` on its 48-pixel bar, integer maths and all: full
 * only when nothing is missing; otherwise the bar's pixels (`hp * 48 / max`,
 * never under one while standing) are green above 24, yellow above 9 (48 * 20 /
 * 100 in whole numbers), red under that, and still at nothing.
 */
export function monIconPace(currentHp: number, maxHp: number): MonIconPace {
  if (currentHp <= 0 || maxHp <= 0) {
    return 'still';
  }
  if (currentHp >= maxHp) {
    return 'full';
  }
  const pixels = Math.max(1, Math.floor((currentHp * 48) / maxHp));
  return pixels > 24 ? 'green' : pixels > 9 ? 'yellow' : 'red';
}

/** Where a species' first frame sits on the sheet, in frames; undefined for one with no icon. */
export function monIconCell(speciesId: string): { readonly column: number; readonly row: number } | undefined {
  const index = (POKEMON_ICON_ORDER as readonly string[]).indexOf(speciesId);
  if (index < 0) {
    return undefined;
  }
  const frame = index * POKEMON_ICON_SHEET.framesPerSpecies;
  return { column: frame % POKEMON_ICON_SHEET.columns, row: Math.floor(frame / POKEMON_ICON_SHEET.columns) };
}

export interface MonIconSubject {
  readonly name: string;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly base: { readonly id: string };
}

/**
 * The icon as markup: a span whose background is the sheet, placed on the
 * species' first frame, with its pace as a class. A species with no icon (none
 * should be) is its first letter, as the portrait's stand-in is.
 */
export function pixelMonIcon(pokemon: MonIconSubject): string {
  const cell = monIconCell(pokemon.base.id);
  const label = escapeAttribute(pokemon.name);
  if (!cell) {
    return `<span class="px-mon-icon is-missing" role="img" aria-label="${label}">${escapeAttribute(pokemon.name.slice(0, 1))}</span>`;
  }
  const pace = monIconPace(pokemon.currentHp, pokemon.maxHp);
  return `<span class="px-mon-icon is-${pace}" role="img" aria-label="${label}" style="--icon-col:${cell.column};--icon-row:${cell.row}"></span>`;
}
