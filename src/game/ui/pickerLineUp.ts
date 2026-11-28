import { publicAssetUrl } from '../publicAssetUrl';
import { pokemonSpritePath } from '../pokemon/pokemonSprites';
import { frontPicSeat } from '../scenes/battlePresentation';
import type { PickerBasics } from './boxPicker';
import { pixelMonIconForDex } from './monIcon';
import { escapeAttribute } from './pixelUi';

/**
 * Who is going in, standing over the list they were chosen from.
 *
 * A cabinet's screen was a list and nothing else: three lines of names in a
 * pane as tall as the window, 86% of it plain white and the emptiest screen in
 * the game (the menu study of 26 Nov 2026 and the stock-take of 27 Nov,
 * `docs/screens/wood-floor/`). The captain, 12 Nov 2026: a menu shows things
 * rather than listing them. So the ones chosen stand in a line as big as they
 * stand in a fight, each on its own shadow, with a sunk square kept for every
 * place still free - which is also how many more may go in, said without a
 * count - and every row of the list under them carries its Pokémon's icon.
 * The line stands in the list's own window, under its heading; a line of one
 * stands beside the list rather than over it, and a small room has no line at
 * all and is the list it was (`.px-window.has-lineup` in `style.css`).
 *
 * Used by the three Game Corner cabinets and THE PROMENADE's games, which all
 * list through `ui/boxPicker.ts`.
 */
export interface LineUpOptions {
  /** How many may go in; a place is drawn for each. */
  readonly places: number;
  /** What one of them is doing, for a reader who cannot see the line: "jumping". */
  readonly doing: string;
}

/** A sentence naming everyone in a list: "PIKACHU", "PIKACHU and SQUIRTLE", "A, B and C". */
function named(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The line-up's strip, for the head of the list's own window: everyone chosen, then a place for each still free. */
export function pickerLineUp(chosen: readonly PickerBasics[], options: LineUpOptions): string {
  const free = Math.max(0, options.places - chosen.length);
  const standing = chosen.map((each) => {
    const seat = frontPicSeat(each.dexId);
    return `<span class="lineup-place" style="--drop: ${seat.drop}"><img src="${publicAssetUrl(pokemonSpritePath('front', each.dexId, each.shiny))}" alt="" /><span class="lineup-name">${escapeAttribute(each.name)}</span></span>`;
  });
  const places = [...standing, ...Array.from({ length: free }, () => '<span class="lineup-place is-free"></span>')].join('');
  const who = chosen.length === 0 ? `Nobody is ${options.doing} yet` : `${named(chosen.map((each) => each.name))} ${chosen.length === 1 ? 'is' : 'are'} ${options.doing}`;
  const room = free === 0 ? '' : `; ${free} ${free === 1 ? 'place' : 'places'} free`;
  return `<div class="lineup-places" role="img" aria-label="${escapeAttribute(`${who}${room}`)}">${places}</div>`;
}

/**
 * The class a window that holds a line-up and its list carries: a line of one
 * stands beside the list rather than over it (`.px-window.has-lineup` in `style.css`).
 */
export function lineUpWindowClass(places: number): string {
  return `has-lineup${places === 1 ? ' is-one' : ''}`;
}

/** The icon a row of the list carries at its head: the Pokémon it is, flapping as a party icon does. */
export function pickerRowIcon(basics: Pick<PickerBasics, 'dexId' | 'name'>): string {
  return pixelMonIconForDex(basics.dexId, basics.name);
}
