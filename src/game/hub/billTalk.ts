import { formatMoney, getItemById, itemAmountsFor } from '../items';
import {
  TRADER_BERTH_PRICE,
  STANDING_PER_CONTRACT,
  STANDING_PER_BOSS,
  POKEDOLLARS_PER_STANDING,
  TRADER_BERTH_STANDING,
  barterShortfall,
  checkBerth,
  checkBarter,
  checkPurchase,
  standingWithArticle,
  meetsStanding,
  moneyHeld,
  nextTraderStanding,
  rationLeft,
  traderStanding,
  traderStandingPoints,
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

/** Why a thing is under a sheet: his own word on what the player has not earned. */
function keptBack(name: string, required: TraderStandingId): string {
  return `Under the sheet? ${name}. I keep it back until you are ${standingWithArticle(required)}.`;
}

/**
 * How he reads the player, by tier: `TRADER_STANDINGS`'s note, said to their face
 * rather than about them.
 */
const READS_YOU: Readonly<Record<TraderStandingId, string>> = {
  // Not "bring things home": a raid's haul earns no standing (`traderStandingPoints`),
  // and a player who banked twenty hauls on that word was still a stranger to him.
  // No count here: the next line says how many jobs, and 'Bank a job and I
  // might' over 'Bank 3 jobs' read as two rules (AI playtest, 22 Nov 2026).
  stranger: "I don't know you yet.",
  regular: "You keep coming home. I'll sell you one other thing a raid, and the first of the barters.",
  trusted: 'I trust you. Two other things a raid, the good medicine, and most of the hold.',
  partner: 'Partner! Three other things a raid, and nothing on the boat is held back.',
};

/**
 * How he reads a stranger who has made a start: jobs banked but not yet enough.
 * "I do not know you" to somebody who has banked two of Oak's jobs reads as if
 * he had not counted them (the overnight playtest of 20 Nov 2026).
 */
export const STRANGER_STARTED = "I've heard of you. Not enough yet.";

/**
 * How a stranger gets on his books, counted. It is said as jobs, the one quick
 * way in a newcomer has (`STANDING_PER_CONTRACT`), with a beaten boss as the
 * other: Potions and Poke Balls bought count too, but slowly
 * (`POKEDOLLARS_PER_STANDING`).
 */
export function strangerWayIn(pointsShort: number, started = false): string {
  const jobs = Math.ceil(pointsShort / STANDING_PER_CONTRACT);
  const more = started ? ' more' : '';
  // In the list's own unit too: its header counts points ('0 POINTS · 6 MORE FOR
  // REGULAR'), and a friend could not tell whether 3 jobs was 6 points or a
  // second rule (AI playtest, 23 Nov 2026).
  return `Bank ${jobs}${more} ${jobs === 1 ? 'job' : 'jobs'} off Oak's board - ${STANDING_PER_CONTRACT} points apiece on my list - or beat a boss, and I'll sell you more.`;
}

/**
 * How a regular gets further on his books, counted: 'beat a boss and I show
 * you more' was said to a player who had just beaten MISTY and found every
 * locked row still locked, because a boss is three points and the next tier
 * was five away (AI playtest, 22 Nov 2026). So he says how far, and what each
 * thing is worth to him.
 */
export function standingWayOn(pointsShort: number): string {
  return `${pointsShort} more ${pointsShort === 1 ? 'point' : 'points'} and I'll show you more. A job's worth ${STANDING_PER_CONTRACT}, a boss ${STANDING_PER_BOSS}, and every ${formatMoney(POKEDOLLARS_PER_STANDING)} you spend with me 1.`;
}

/** What he says to NOT NOW. */
export const NOT_DEALT_LINE = "It'll be here. Most things are.";

/** What he says when the save would not take it. */
export const DEAL_NOT_SAVED_LINE = "It wouldn't save, so the deal's off and you've lost nothing.";

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
        lines: [what, `I want ${takes}. Money won't buy this one.`],
        question: 'Hand them over, for good?',
        spendsForGood: true,
      };
  }
}

function berthQuote(counter: TraderCounter): BillQuote {
  const offer = checkBerth(counter);
  const price = formatMoney(TRADER_BERTH_PRICE);
  const what = 'A shelf of mine at the Arena: one more column of THE LOCKER, this raid only.';
  switch (offer.refusal) {
    case 'already-paid':
      return { lines: ["Your shelf's paid for. It's yours till the raid's over."] };
    case 'standing-short':
      return { lines: [keptBack('A locker shelf', TRADER_BERTH_STANDING)] };
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
  const started = tier.id === 'stranger' && traderStandingPoints(counter.progress) > 0;
  const trip =
    tier.ration === 0
      ? `You have ${formatMoney(moneyHeld(counter.stash))}. Potions and Poké Balls I sell anybody, the rest once I know you.`
      : // A raid, not a trip or the deck: 'one thing off the deck a trip' was read
        // twice and still not understood (AI playtest, 22 Nov 2026).
        `You have ${formatMoney(moneyHeld(counter.stash))}. ${
          left === 0
            ? 'Potions and Poké Balls any time. The rest waits till you raid again.'
            : `Potions and Poké Balls any time, and ${left} other ${left === 1 ? 'thing' : 'things'} till you raid again.`
        }`;
  return {
    lines: [
      started ? STRANGER_STARTED : READS_YOU[tier.id],
      trip,
      ...(next && tier.ration === 0
        ? [strangerWayIn(next.pointsShort, started)]
        : next && !meetsStanding(counter.progress, 'trusted')
          ? [standingWayOn(next.pointsShort)]
          : []),
    ],
    question: SEE_THE_LIST_QUESTION,
  };
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
