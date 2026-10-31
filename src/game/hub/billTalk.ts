import { formatMoney, getItemById, itemAmountsFor } from '../items';
import {
  TRADER_BERTH_PRICE,
  TRADER_BERTH_STANDING,
  barterShortfall,
  checkBerth,
  checkBarter,
  checkPurchase,
  getTraderStanding,
  meetsStanding,
  moneyHeld,
  nextTraderStanding,
  rationLeft,
  traderStanding,
  type TraderCounter,
  type TraderStandingId,
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
 * A Potion for money is an ordinary purchase, already rationed, so YES is under
 * the cursor. A barter and a berth are spent for good, so they open on NOT NOW,
 * as `HubScene.armedDeal`'s do.
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

/** Why a thing is under a sheet: his own word on what the player has not earned. */
function keptBack(name: string, required: TraderStandingId): string {
  return `Under the sheet? ${name}. I keep it back until you are ${getTraderStanding(required).name.toLowerCase()}.`;
}

/**
 * How he reads the player, by tier: `TRADER_STANDINGS`'s note, said to their face
 * rather than about them.
 */
const READS_YOU: Readonly<Record<TraderStandingId, string>> = {
  stranger: 'I do not know you. Bring things home from a raid and I might.',
  regular: 'You keep coming home. One thing off the deck a trip, and the first of the barters.',
  trusted: 'I trust you. Two a trip, the good medicine, and most of the hold.',
  partner: 'Partner! Three a trip, and nothing on the boat is held back.',
};

/** What he says to NOT NOW. */
export const NOT_DEALT_LINE = 'It will be here. Most things are.';

/** What he says when the save would not take it. */
export const DEAL_NOT_SAVED_LINE = 'It would not save, so the deal is off and you have lost nothing.';

/** The question on the mat: his whole list is the PC's. */
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
      return { lines: [keptBack(name, offer.item.standing)] };
    case 'ration-spent':
      return {
        lines: [what, `${price}, but that is your lot this trip. Raid, and come back.`],
      };
    case 'money-short':
      return { lines: [what, `${price}, and you have ${formatMoney(moneyHeld(counter.stash))}.`] };
    default:
      return {
        lines: [what, `${price}, and ${rationLeft(counter)} left for you this trip.`],
        question: `Buy one for ${price}?`,
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
  const what = `${barter.name}. ${item?.description ?? barter.detail}`;
  const takes = itemAmountsFor(barter.takes);
  switch (offer.refusal) {
    case 'already-taken':
      return { lines: [`I only had the one ${barter.name}, and you have it. That gap is yours.`] };
    case 'standing-short':
      return { lines: [keptBack(barter.name, barter.standing)] };
    case 'goods-short':
      return {
        lines: [what, `I want ${takes}. You are short ${itemAmountsFor(barterShortfall(counter.stash, barter))}.`],
      };
    default:
      return {
        lines: [what, `I want ${takes}. Money does not buy this.`],
        question: 'Hand them over, for good?',
        spendsForGood: true,
      };
  }
}

function berthQuote(counter: TraderCounter): BillQuote {
  const offer = checkBerth(counter);
  const price = formatMoney(TRADER_BERTH_PRICE);
  const what = 'A berth in my hold: one more column of your secure container, this raid only.';
  switch (offer.refusal) {
    case 'already-paid':
      return { lines: ['Your berth is paid for. It is yours until the raid is over.'] };
    case 'standing-short':
      return { lines: [keptBack('A berth in the hold', TRADER_BERTH_STANDING)] };
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

/**
 * The key on the mat: how he reads the player and what is left this trip, then
 * whether they want his whole list. Whatever is on the shelves is said from the
 * shelf.
 */
export function billFromTheMat(counter: TraderCounter): BillQuote {
  const tier = traderStanding(counter.progress);
  const left = rationLeft(counter);
  const next = nextTraderStanding(counter.progress);
  const trip =
    tier.ration === 0
      ? `You have ${formatMoney(moneyHeld(counter.stash))}, and I am selling you nothing yet.`
      : `You have ${formatMoney(moneyHeld(counter.stash))}, and ${left} of ${tier.ration} left off the deck this trip.`;
  return {
    lines: [
      READS_YOU[tier.id],
      trip,
      ...(next && !meetsStanding(counter.progress, 'trusted')
        ? ['Bank a contract, beat a boss or spend with me, and I show you more.']
        : []),
    ],
    question: SEE_THE_LIST_QUESTION,
  };
}

/** Said once a deal is struck: `SaveManager`'s own message is written for a status bar. */
export function dealtLine(good: BillGood): string {
  if (good.kind === 'stock') {
    return 'Yours. It is in your vault.';
  }
  return good.kind === 'barter'
    ? 'Done! It is in your vault, and what you gave me goes on my shelves.'
    : 'Paid. The extra column is yours for the coming raid.';
}
