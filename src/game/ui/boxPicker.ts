/**
 * The one "from THE CHEST" list: every picker of the player's Pokémon outside
 * a raid - YOUR TEAM on P (`scenes/TeamScene.ts`), the chest's own POKéMON tab,
 * the Day-Care Man - lists from it, and the harbour's minigames order who may
 * play by it (`minigames/whoPlays.ts`), so no picker ever asks the player to
 * walk to where a Pokémon is kept (the overnight plan: "picked anywhere").
 *
 * Two promises, the same on every screen that uses it:
 *  - **every Pokémon**: the whole vault, in the order kept (there are no boxes
 *    since THE CHEST: the captain, 26 Nov 2026);
 *  - **best fits first**: the screen says what fits (a jumper, a bird with three
 *    heads, somebody fit to raid) and the list is ordered by that, then by level,
 *    with the order they were kept in as the last word, so nothing jumps about
 *    between one render and the next.
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
}

/** One of the player's Pokémon as every picker lists it. */
export interface PickerEntry {
  readonly id: string;
  readonly pokemon: Pokemon;
  /** Where it stands in the vault's kept order: the last word in every order. */
  readonly kept: number;
}

/** Every Pokémon in the vault, in the order they are kept. */
export function pickerEntries(vault: PickerVault): readonly PickerEntry[] {
  return vault.listPokemon().map(({ id, pokemon }, kept) => ({ id, pokemon, kept }));
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

/** The words a find matches against: the nickname, the species and the gear it holds. */
export function findWords(entry: Pick<PickerEntry, 'pokemon'>): string {
  const held = getHeldItem(entry.pokemon.heldItemId)?.displayName ?? '';
  return `${entry.pokemon.name} ${entry.pokemon.base.name} ${held}`.trim().toLowerCase();
}

/**
 * Whether a row answers a find: every word typed has to begin one of the row's
 * words, so `pika` finds PIKACHU and `oran` whoever holds an Oran Berry. An
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

/** A picker row's find words, as an attribute on the row's button. */
export function pickerRowAttributes(entry: Pick<PickerEntry, 'pokemon'>): string {
  return `${PICKER_FIND_ATTRIBUTE}="${escapeAttribute(findWords(entry))}"`;
}

/** The line under a picker row's name: its level, and what the screen says of it. */
export function pickerRowNote(entry: Pick<PickerEntry, 'pokemon'>, what = ''): string {
  return [`Lv ${entry.pokemon.level}`, what].filter(Boolean).map(escapeAttribute).join(' · ');
}

/**
 * A row's kind, said under its name only when the name is a nickname: a
 * Pokémon called PIDGEY read 'PIDGEY / Lv 6 · PIDGEY' in THE BATTLE ARENA's
 * pickers (break-it test, 23 Nov 2026).
 */
export function kindIfNicknamed(pokemon: { readonly name: string; readonly base: { readonly name: string } }): string {
  return pokemon.name.toUpperCase() === pokemon.base.name.toUpperCase() ? '' : pokemon.base.name.toUpperCase();
}

/** The find field that leads a picker's list. */
export function pickerFindField(label = 'Find a Pokémon'): string {
  return `<div class="box-bar picker-find"><input class="px-window px-field" data-picker-find type="search" maxlength="16" autocomplete="off" spellcheck="false" aria-label="${escapeAttribute(label)}" placeholder="Find: a name" data-help="Type to narrow the list: a name, a kind, or what one holds. ESC or the arrows step out."/></div>`;
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
