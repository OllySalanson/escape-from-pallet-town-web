import { formatMoney, getItemById, itemAmountsFor } from '../items';
import {
  TRADER_BERTH_PRICE,
  barterShortfall,
  checkBerth,
  barterDetail,
  checkBarter,
  checkPurchase,
  moneyHeld,
  rationLeft,
  type TraderCounter,
} from './trader';

/**
 * Bill in his cottage: what he says about a thing on his shelves, in the room's
 * own dialogue box, and YES or NOT NOW.
 *
 * His counter was a dark blue screen of two lists and a pane per row (the menu
 * playtest of 31 Oct, row 2). Everything on it is a thing he owns, so it stands on
 * his shelves (`base/billGoods.ts`): walk up to it and he names the deal, in his
 * own voice, with the rules `trader.ts` already holds him to. Nothing is worked
 * out here that `trader.ts` does not decide; this is only how he says it.
 *
 * Every deal opens on NOT NOW, as `HubScene.armedDeal`'s do: found goods, money
 * and the trip's ration are all spent for good, and the key that read his last
 * line away is still under the finger. A Potion opened on YES, so a double
 * press on his price bought it (the midgame bug hunt of 11 Nov 2026).
 */

/** Something on his shelves: a deal `trader.ts` knows. */
export type BillGood =
  | { readonly kind: 'stock'; readonly itemId: string }
  | { readonly kind: 'barter'; readonly barterId: string }
  | { readonly kind: 'berth' };

export interface BillQuote {
  /** What he says first. */
  readonly lines: readonly string[];
  /** What he asks, with YES and NOT NOW under it. Absent when there is no deal to strike. */
  readonly question?: string;
  /** Whether the question opens on NOT NOW, because YES cannot be taken back. */
  readonly spendsForGood?: boolean;
}

/**
 * The one thing under a sheet (`base/billGoods.ts`, `coveredGood`): he does not
 * say what it is, nor what it waits for.
 */
export const UNDER_THE_SHEET_LINE = 'Ah, not that one. Not yet!';

/** What he says to NOT NOW. */
export const NOT_DEALT_LINE = "It'll be here. Most things are.";

/** What he says when the save would not take it. */
export const DEAL_NOT_SAVED_LINE = "It wouldn't save, so the deal's off and you've lost nothing.";

/**
 * The question on the mat, straight after his greeting (`hub/keeperGreetings.ts`):
 * his whole list is the PC's. How he reads the player and what they would need
 * to do for more used to come first, three boxes of tiers and points (the
 * harbour audit, 27 Nov 2026); now his list is only what he sells, and the
 * next thing he will bring out is under a sheet on his shelf.
 */
export const SEE_THE_LIST_QUESTION = 'See my whole list?';

/** What he says about one thing on his shelves, against this counter. */
export function billQuote(counter: TraderCounter, good: BillGood): BillQuote {
  if (good.kind === 'stock') {
    return stockQuote(counter, good.itemId);
  }
  return good.kind === 'barter' ? barterQuote(counter, good.barterId) : berthQuote(counter);
}

function stockQuote(counter: TraderCounter, itemId: string): BillQuote {
  const offer = checkPurchase(counter, itemId);
  const item = getItemById(itemId);
  if (!offer || !item) {
    return { lines: [] };
  }
  const name = item.displayName;
  const what = `${name}. ${item.description}`;
  const price = formatMoney(offer.item.price);
  switch (offer.refusal) {
    case 'standing-short':
      return { lines: [UNDER_THE_SHEET_LINE] };
    case 'ration-spent':
      return {
        lines: [what, `${price}, but that's your lot till you raid again.`],
      };
    case 'money-short':
      return { lines: [what, `${price}, and you have ${formatMoney(moneyHeld(counter.stash))}.`] };
    default:
      return {
        lines: [
          what,
          offer.item.rationed
            ? `${price}, and ${rationLeft(counter)} more for you till you raid.`
            : `${price} each, and as many as you can pay for.`,
        ],
        question: `Buy one for ${price}?`,
        spendsForGood: true,
      };
  }
}

function barterQuote(counter: TraderCounter, barterId: string): BillQuote {
  const offer = checkBarter(counter, barterId);
  if (!offer) {
    return { lines: [] };
  }
  const { barter } = offer;
  const item = getItemById(barter.gives.itemId);
  const what = `${barter.name}. ${item?.description ?? barterDetail(barter)}`;
  const takes = itemAmountsFor(barter.takes);
  switch (offer.refusal) {
    case 'already-taken':
      return { lines: [`I only had the one ${barter.name}, and you have it. That gap is yours.`] };
    case 'standing-short':
      return { lines: [UNDER_THE_SHEET_LINE] };
    case 'goods-short':
      return {
        lines: [what, `I want ${takes}. You are short ${itemAmountsFor(barterShortfall(counter.stash, barter))}.`],
      };
    default:
      return {
        lines: [what, `I want ${takes}. Money won't buy this one.`],
        question: barter.takes.reduce((total, stack) => total + stack.quantity, 0) === 1 ? 'Hand it over, for good?' : 'Hand them over, for good?',
        spendsForGood: true,
      };
  }
}

function berthQuote(counter: TraderCounter): BillQuote {
  const offer = checkBerth(counter);
  const price = formatMoney(TRADER_BERTH_PRICE);
  const what = 'A shelf of mine at the Arena: two more squares in THE LOCKER, this raid only.';
  switch (offer.refusal) {
    case 'already-paid':
      return { lines: ["Your shelf's paid for. It's yours till the raid's over."] };
    case 'standing-short':
      return { lines: [UNDER_THE_SHEET_LINE] };
    case 'money-short':
      return { lines: [what, `${price}, and you have ${formatMoney(moneyHeld(counter.stash))}.`] };
    default:
      return {
        lines: [what, `${price}, used or not. BROCK will build you one for good.`],
        question: `Pay ${price} for one raid?`,
        spendsForGood: true,
      };
  }
}

/** Said once a deal is struck: `SaveManager`'s own message is written for a status bar. */
export function dealtLine(good: BillGood): string {
  if (good.kind === 'stock') {
    return "Yours. It's in YOUR THINGS.";
  }
  return good.kind === 'barter'
    ? "Done! It's in YOUR THINGS, and what you gave me goes on my shelves."
    : 'Paid. The extra column is yours for the coming raid.';
}
