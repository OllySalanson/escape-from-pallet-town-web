import { escapeAttribute } from './pixelUi';

/**
 * How the two places that sell something say what it is, what it costs and why
 * you cannot have it - Brock's ladder and Bill's counter.
 *
 * It exists because of one fault, and the fault is worth writing down: a rung's
 * subtitle used to be its *price* while it was unbought and its *effect* once it
 * was built. So the one moment a player needs to know what a thing does - while
 * deciding whether to buy it - was precisely the moment it was hidden, and the
 * screen only explained the purchase after the money was gone. The captain
 * bought Secure locker I without knowing what it was.
 *
 * Two rules follow, and everything here is one or the other.
 *
 * - **What a thing does is its identity, and identity does not change when you
 *   pay for it.** So the row's own line is always the effect, before and after,
 *   and the price is never written in its place. Nothing is ever traded for
 *   anything: a screen that has to choose between two facts is a screen that is
 *   too small, and since the menus were given the window (`display/menuStage.ts`)
 *   they are not.
 * - **A price is only useful next to what you actually hold.** "2× Parts crate"
 *   is a number; "2× Parts crate, 1 spare at base" is a decision. The price is
 *   therefore two columns wherever there is room for two, and what stands
 *   between the player and the deal - a locked rung, a spent ration, a standing
 *   he has not reached - is said in the same breath rather than left to be
 *   worked out.
 *
 * The row keeps the price in a column of its own on the right, which is what a
 * shop shelf has always done: the thing on the left, the price on the right,
 * and the eye runs down one column or the other. The whole picture - the longer
 * promise, the price against the vault, and the gate - is the `.px-detail` pane
 * under the list, the same one the contract board and the stash use, so it
 * follows the cursor and is never a second screen.
 *
 * Phaser-free and pure strings, so the wording and the structure are tested
 * without a browser; `HubScene` decides what the numbers are and renders these.
 */

/** One line of a price: what it asks for, and what the base holds towards it. */
export interface ShopPricePart {
  /** The ask, worded the way the game words a price: "2 Pokémon", "2× Parts crate". */
  readonly ask: string;
  /**
   * What is held towards it, in the words that half is counted in - "1 spare at
   * base", "260 in the vault". Left out where the question does not arise, as
   * on something already bought.
   */
  readonly held?: string;
  /** True while the vault cannot cover this part: drawn in the ink a risk is in. */
  readonly short?: boolean;
  /** The item's own 16x16 icon, already marked up by `ui/icons`. */
  readonly icon?: string;
}

/**
 * A row's price, in a column of its own on the right of the row.
 *
 * One line a part, so a price of two materials is two short lines rather than
 * one long one that pushes the name off the row - and a part this vault cannot
 * cover is red, which is the one thing about a price that a player scanning a
 * list wants at a glance.
 */
export function shopPriceColumn(parts: readonly ShopPricePart[]): string {
  return `<span class="px-price">${parts
    .map((part) => `<small${part.short ? ' class="cost-short"' : ''}>${part.ask}</small>`)
    .join('')}</span>`;
}

/** The price column of something already bought, in the words for that. */
export function shopPaidColumn(label: string): string {
  return `<span class="px-price is-paid"><small>${label}</small></span>`;
}

export interface ShopDetailOptions {
  /** The id its row carries as `data-shows`, so the cursor swaps this pane in. */
  readonly id: string;
  /** One of a list's panes is open at a time; the rest are drawn hidden. */
  readonly shown: boolean;
  /** What it does, in one line. Said whether or not it has been bought. */
  readonly effect: string;
  /** The same promise in full. */
  readonly detail: string;
  /** The heading over the price block: "Price", "You hand over", "What it cost". */
  readonly priceLabel: string;
  readonly price: readonly ShopPricePart[];
  /** What still stands between the player and this, in one sentence. */
  readonly blocked?: string;
  /** A quiet line under the price: what a bought thing is now, what a ration is. */
  readonly note?: string;
}

/**
 * The whole picture of the pointed-at row: what it does, what it costs against
 * what is held, and what is stopping it.
 *
 * Two blocks side by side where the screen is wide enough for two and stacked
 * where it is not, exactly as the stash's detail pane behaves - and capped and
 * scrolling rather than growing with whatever the cursor is on, because a pane
 * that changed height would move the list every time the cursor moved.
 */
export function shopDetailPane(options: ShopDetailOptions): string {
  const price = options.price
    .map(
      (part) =>
        // The icon slot is drawn whether or not there is an icon: a price of
        // one Pokemon and two materials reads as a column only if all three
        // asks start on the same pixel.
        `<div${part.short ? ' class="is-short"' : ''}><dt>${
          part.icon ?? '<span class="shop-price-nib" aria-hidden="true"></span>'
        }<span>${part.ask}</span></dt>${part.held === undefined ? '<dd></dd>' : `<dd>${part.held}</dd>`}</div>`,
    )
    .join('');
  // A span, not a `small`: `.pixel-ui small` is soft ink at a weight the
  // cascade gives to every `small` on these screens, so a warning written in
  // one came out grey - which is the opposite of what it is for.
  const blocked = options.blocked
    ? `<span class="px-wrap px-warning">${options.blocked}</span>`
    : '';
  const note = options.note ? `<small class="px-wrap px-note">${options.note}</small>` : '';
  return `<div class="px-detail px-scroll shop-detail" data-shown-by="${escapeAttribute(options.id)}"${
    options.shown ? '' : ' hidden'
  }><div class="shop-detail-body"><div class="shop-does"><small class="px-label">What it does</small><strong class="px-wrap">${
    options.effect
  }</strong><small class="px-wrap px-note">${options.detail}</small></div><div class="shop-price"><small class="px-label">${
    options.priceLabel
  }</small><dl class="shop-price-list">${price}</dl>${blocked}${note}</div></div></div>`;
}

/**
 * A price part against what the vault holds, worded once so the two screens
 * cannot drift into saying the same fact two ways.
 *
 * `held` is the number counted the way that half is *spendable* rather than the
 * raw total - Brock's spare supplies are what is above the wipe kit,
 * and its Pokemon are what may be released - because a price beside a number
 * the player cannot actually spend is worse than no number at all.
 */
export function pricePart(
  ask: string,
  held: number,
  needed: number,
  heldNote: string,
  icon?: string,
): ShopPricePart {
  return {
    ask,
    held: `${held} ${heldNote}`,
    short: held < needed,
    ...(icon === undefined ? {} : { icon }),
  };
}
