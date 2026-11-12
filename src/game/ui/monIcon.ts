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
import { getHeldItem } from '../items';
import { itemIcon } from './icons';
import { escapeAttribute, pixelHpBar, pixelPokemonName } from './pixelUi';

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

/** The bar under a party slot's name, in game pixels: what is left of the slot beside its level. */
export const PARTY_SLOT_BAR = 32;

export interface PartySlotSubject extends MonIconSubject {
  readonly level: number;
  readonly shiny: boolean;
  readonly isFainted: boolean;
  readonly heldItemId: string | null;
}

export interface PartySlotOptions {
  /** The first sent out: its slot is gold, as FireRed's lead slot stands apart. */
  readonly lead?: boolean;
  /** Picked up to be moved to another slot. */
  readonly holding?: boolean;
  /** The button's wiring and words: `data-*`, `aria-label`, `data-help`, already escaped. */
  readonly attributes: string;
  /**
   * A third line, for a slot that answers a question about itself: ABLE or NOT
   * ABLE for a stone, the HP a Potion is for - FireRed's party when an item is
   * being used.
   */
  readonly note?: string;
}

/**
 * One of a party's six, as FireRed's party menu draws a slot: the icon at its
 * pace with what it holds on its corner, the name, and the level beside a bar.
 * YOUR TEAM's six and the raid's PARTY are the same slot, so the two cannot
 * drift.
 */
export function pixelPartySlot(pokemon: PartySlotSubject, options: PartySlotOptions): string {
  const classes = [
    'px-party-slot',
    ...(options.lead ? ['is-lead'] : []),
    ...(options.holding ? ['is-holding'] : []),
    ...(pokemon.isFainted ? ['is-fainted'] : []),
    ...(options.note === undefined ? [] : ['has-note']),
  ].join(' ');
  const held = getHeldItem(pokemon.heldItemId);
  const gear = held ? `<span class="px-slot-gear">${itemIcon(held.id, `holding ${held.displayName}`)}</span>` : '';
  return `<button class="${classes}" ${options.attributes}>${pixelMonIcon(pokemon)}${gear}<span class="px-party-slot-words">${pixelPokemonName(pokemon)}<span class="px-party-slot-line"><span class="px-mon-level">Lv${pokemon.level}</span>${pixelHpBar(pokemon.currentHp, pokemon.maxHp, PARTY_SLOT_BAR)}</span>${options.note === undefined ? '' : `<span class="px-tag">${escapeAttribute(options.note)}</span>`}</span></button>`;
}

/** A slot with nobody in it: a dim Poké Ball, so a party of three is three of six. */
export function pixelEmptyPartySlot(): string {
  return `<span class="px-party-slot is-empty" aria-hidden="true">${itemIcon('poke-ball')}</span>`;
}

/** The bar under a tile's icon, beside a two-figure level. */
export const MON_TILE_BAR = 18;

export interface MonTileSubject extends MonIconSubject {
  readonly level: number;
  readonly isFainted: boolean;
}

/**
 * One Pokémon in a grid of them, as FireRed's PC box draws one, with the two
 * facts a Pokémon is picked by under it: its level and a short bar. YOUR TEAM's
 * boxes and Bill's PC are the same tile.
 */
export function pixelMonTile(
  pokemon: MonTileSubject,
  options: {
    readonly classes?: readonly string[];
    readonly attributes: string;
    /**
     * What stands under the icon instead of the level and bar, when the tile
     * has something more pressing to say: the raid time NURSE JOY's treatment
     * of a hurt one costs, in Bill's PC at the Center, where ENTER pays it.
     */
    readonly line?: string;
  },
): string {
  const classes = ['px-mon-tile', ...(pokemon.isFainted ? ['is-fainted'] : []), ...(options.classes ?? [])].join(' ');
  const line = options.line ?? `<span class="px-mon-level">${pokemon.level}</span>${pixelHpBar(pokemon.currentHp, pokemon.maxHp, MON_TILE_BAR)}`;
  return `<button class="${classes}" ${options.attributes}>${pixelMonIcon(pokemon)}<span class="px-mon-tile-line">${line}</span></button>`;
}

/**
 * One kind of thing in a grid of them: its icon at twice its size and how many
 * on its corner, as HeartGold's bag stands them. The raid's pack and Bill's PC
 * are the same tile; what it is, is the help bar's and the pane's to say.
 */
export function pixelItemTile(item: { readonly id: string; readonly displayName: string }, count: string, attributes: string, classes: readonly string[] = []): string {
  return `<button class="${['px-item-tile', ...classes].join(' ')}" ${attributes} aria-label="${escapeAttribute(`${item.displayName} ${count}`)}">${itemIcon(item.id, item.displayName)}<span class="px-item-tile-count">${escapeAttribute(count)}</span></button>`;
}

/**
 * A Pokémon's icon by its national dex number, for a screen that carries the
 * number rather than the Pokémon (the raid's result): the icon sheet is in dex
 * order, so the number is its place on it. Full health flaps at full pace.
 */
export function pixelMonIconForDex(dexId: number, name: string, currentHp = 1, maxHp = 1): string {
  const speciesId = POKEMON_ICON_ORDER[dexId - 1] ?? '';
  return pixelMonIcon({ name, currentHp, maxHp, base: { id: speciesId } });
}
