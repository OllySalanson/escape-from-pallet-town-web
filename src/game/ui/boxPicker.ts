/**
 * The one "from your boxes" list: every picker of the player's Pokémon outside
 * a raid - YOUR TEAM on P (`scenes/TeamScene.ts`), the Game Corner's cabinets,
 * the Day-Care Man - lists from it, so no picker ever asks the player to walk
 * to where a Pokémon is kept (the overnight plan: "picked anywhere").
 *
 * Three promises, the same on every screen that uses it:
 *  - **every box**: the whole vault, never one box of it;
 *  - **best fits first**: the screen says what fits (a jumper, a bird with three
 *    heads, somebody fit to raid) and the list is ordered by that, then by level,
 *    with the order they were kept in as the last word, so nothing jumps about
 *    between one render and the next;
 *  - **the box named on each row**, so a player can see where a Pokémon lives
 *    without opening a PC.
 *
 * And a find field over it that narrows the list as it is typed, in place - the
 * rows are hidden, never redrawn, because redrawing a screen from a key in a
 * field takes the field away from under the caret.
 *
 * The ordering and the markup are pure; `wirePickerFind` is the one DOM part.
 */
import { getHeldItem } from '../items';
import type { Pokemon } from '../pokemon';
import type { StashedPokemon } from '../stash';
import { escapeAttribute } from './pixelUi';

/** What a picker needs of the vault. */
export interface PickerVault {
  listPokemon(): readonly StashedPokemon[];
  listBoxes(): readonly { readonly name: string; readonly pokemonIds: readonly string[] }[];
}

/** One of the player's Pokémon as every picker lists it. */
export interface PickerEntry {
  readonly id: string;
  readonly pokemon: Pokemon;
  /** The name of the box it is kept in. */
  readonly box: string;
  /** Where it stands in the vault, box by box: the last word in every order. */
  readonly kept: number;
}

/**
 * Every Pokémon in every box, in the order they are kept: box one first, each
 * box in its own order. A Pokémon no box names (none should be) comes last,
 * under the first box's name, rather than being left out of a picker.
 */
export function pickerEntries(vault: PickerVault): readonly PickerEntry[] {
  const byId = new Map(vault.listPokemon().map((stored) => [stored.id, stored.pokemon]));
  const boxes = vault.listBoxes();
  const entries: PickerEntry[] = [];
  const seen = new Set<string>();
  for (const box of boxes) {
    for (const id of box.pokemonIds) {
      const pokemon = byId.get(id);
      if (pokemon && !seen.has(id)) {
        seen.add(id);
        entries.push({ id, pokemon, box: box.name, kept: entries.length });
      }
    }
  }
  for (const [id, pokemon] of byId) {
    if (!seen.has(id)) {
      entries.push({ id, pokemon, box: boxes[0]?.name ?? 'Box 1', kept: entries.length });
    }
  }
  return entries;
}

/**
 * How well a Pokémon fits what a screen is choosing for: higher is better, and
 * anything at or below zero is a Pokémon that cannot do it at all.
 */
export type PickerFit = (entry: PickerEntry) => number;

/** The ordinary fit: anybody who can fight, ahead of anybody fainted. */
export const ABLE_TO_FIGHT: PickerFit = (entry) => (entry.pokemon.isFainted ? 0 : 1);

/** Best fits first, then the highest level, then the order they are kept in. */
export function pickerOrder(entries: readonly PickerEntry[], fit: PickerFit = ABLE_TO_FIGHT): readonly PickerEntry[] {
  return entries
    .map((entry) => ({ entry, fit: fit(entry) }))
    .sort((a, b) => b.fit - a.fit || b.entry.pokemon.level - a.entry.pokemon.level || a.entry.kept - b.entry.kept)
    .map(({ entry }) => entry);
}

/**
 * The words a find matches against: the nickname, the species and the gear it
 * holds, as the PC's own find (`hub/stashBrowser.ts`), and the box it is in, so
 * "box 2" finds everybody in it.
 */
export function findWords(entry: Pick<PickerEntry, 'pokemon' | 'box'>): string {
  const held = getHeldItem(entry.pokemon.heldItemId)?.displayName ?? '';
  return `${entry.pokemon.name} ${entry.pokemon.base.name} ${held} ${entry.box}`.toLowerCase();
}

/**
 * Whether a row answers a find: every word typed has to begin one of the row's
 * words, so `pika` finds PIKACHU and `box 2` finds everybody kept in Box 2. An
 * empty find answers everything.
 */
export function answersFind(words: string, find: string): boolean {
  const wanted = find.toLowerCase().split(/\s+/).filter(Boolean);
  if (wanted.length === 0) {
    return true;
  }
  const own = words.toLowerCase().split(/[\s-]+/).filter(Boolean);
  return wanted.every((word) => own.some((candidate) => candidate.startsWith(word)));
}

/** The attribute every picker row carries, which the find field reads. */
export const PICKER_FIND_ATTRIBUTE = 'data-find';

/** A picker row's find words and its box, as attributes on the row's button. */
export function pickerRowAttributes(entry: Pick<PickerEntry, 'pokemon' | 'box'>): string {
  return `${PICKER_FIND_ATTRIBUTE}="${escapeAttribute(findWords(entry))}" data-box-name="${escapeAttribute(entry.box)}"`;
}

/** The line under a picker row's name: its level, what the screen says of it, and the box it lives in. */
export function pickerRowNote(entry: Pick<PickerEntry, 'pokemon' | 'box'>, what = ''): string {
  return [`Lv ${entry.pokemon.level}`, what, entry.box].filter(Boolean).map(escapeAttribute).join(' · ');
}

/** The find field that leads a picker's list. */
export function pickerFindField(label = 'Find a Pokémon'): string {
  return `<div class="box-bar picker-find"><input class="px-window px-field" data-picker-find type="search" maxlength="16" autocomplete="off" spellcheck="false" aria-label="${escapeAttribute(label)}" placeholder="Find: a name or a box" data-help="Type to narrow the list: a name, a kind, or a box (&quot;box 2&quot;). ESC or the arrows step out."/></div>`;
}

/**
 * Narrows a picker as its find field is typed into: rows that do not answer are
 * hidden, in place, and a subheading left with nothing under it goes with them.
 * Escape empties the field and steps out of it; Up and Down step off it, as the
 * PC's own find does (`HubScene.wireBoxForm`). `step` is the overlay's own
 * cursor move. Returns what to call to apply the find again after a redraw.
 */
export function wirePickerFind(root: HTMLElement, step: (key: string) => void, remembered = ''): (find: string) => void {
  const field = root.querySelector<HTMLInputElement>('[data-picker-find]');
  const apply = (find: string): void => applyPickerFind(root, find);
  if (!field) {
    return apply;
  }
  field.value = remembered;
  apply(remembered);
  field.oninput = () => apply(field.value);
  // Key *up* is what the overlay keyboard lets through to a field.
  field.onkeyup = (event) => {
    if (event.key === 'Escape') {
      field.value = '';
      apply('');
      field.blur();
      step('ArrowDown');
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
      step(event.key === 'ArrowUp' ? 'ArrowUp' : 'ArrowDown');
    }
  };
  return apply;
}

/** Hides every row of `root` that does not answer `find`, and any heading left with nothing under it. */
export function applyPickerFind(root: ParentNode, find: string): void {
  root.querySelectorAll<HTMLElement>(`[${PICKER_FIND_ATTRIBUTE}]`).forEach((row) => {
    row.hidden = !answersFind(row.getAttribute(PICKER_FIND_ATTRIBUTE) ?? '', find);
  });
  root.querySelectorAll<HTMLElement>('.px-subheading').forEach((heading) => {
    let next = heading.nextElementSibling as HTMLElement | null;
    let any = false;
    while (next && !next.classList.contains('px-subheading')) {
      if (next.hasAttribute(PICKER_FIND_ATTRIBUTE) && !next.hidden) {
        any = true;
      }
      next = next.nextElementSibling as HTMLElement | null;
    }
    heading.hidden = find.trim() !== '' && !any;
  });
}

/** What every cabinet's list carries of a Pokémon: who, where it lives, and what its row is found by. */
export interface PickerBasics {
  readonly id: string;
  readonly name: string;
  readonly dexId: number;
  readonly shiny: boolean;
  readonly level: number;
  /** The box it is kept in, named on its row. */
  readonly box: string;
  /** What the find field matches the row against (`findWords`). */
  readonly find: string;
}

export function pickerBasics(entry: PickerEntry): PickerBasics {
  return {
    id: entry.id,
    name: entry.pokemon.name,
    dexId: entry.pokemon.base.dexId,
    shiny: entry.pokemon.shiny,
    level: entry.pokemon.level,
    box: entry.box,
    find: findWords(entry),
  };
}

/** The find and box attributes for a row built from `pickerBasics`. */
export function basicsRowAttributes(basics: Pick<PickerBasics, 'find' | 'box'>): string {
  return `${PICKER_FIND_ATTRIBUTE}="${escapeAttribute(basics.find)}" data-box-name="${escapeAttribute(basics.box)}"`;
}
