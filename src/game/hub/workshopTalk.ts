import { itemAmountsFor } from '../items';
import { workshopOffers, type WorkshopOffer, type WorkshopVault } from './workshop';

/**
 * Brock in his workshop: what he says about a bay with chalk in it, in the
 * room's own dialogue box, and YES or NOT NOW.
 *
 * A rung used to be three presses into a dark blue list with the room thrown
 * away (the menu playtest of 31 Oct, row 3). Every bay already stood in the room
 * bare until it was paid for, so he has chalked out what goes in each: walk up,
 * and he says what it does and what it takes. He is blunt, and he builds; he
 * does not deal (`trader.ts`).
 *
 * A rung spends materials for good, so its question opens on NOT NOW, as the
 * ladder's own confirm opens on KEEP THEM: the key that finished his last line
 * is still under the player's finger.
 */

export interface BrockQuote {
  /** What he says first. */
  readonly lines: readonly string[];
  /** What he asks, with YES and NOT NOW under it. Absent when there is nothing to answer. */
  readonly question?: string;
  /** The rung YES builds. */
  readonly upgradeId?: string;
}

/** Said over a question that takes one row of the box (`errands.test.ts`). */
export const BUILD_QUESTION = 'Build it? That is for good.';

/** What he says to NOT NOW. */
export const NOT_BUILT_LINE = 'Suit yourself. The chalk will keep.';

/** What he says with the whole ladder standing. */
export const LADDER_BUILT_LINE = 'That is the whole base built. There is nothing left for me to chalk.';

/** What he says when the save would not take it. */
export const BUILD_NOT_SAVED_LINE = 'It would not save, so I have not touched your materials.';

/** His word on a rung once it is up, with the thing standing behind him. */
export function builtLine(name: string): string {
  return `${name} is in. It stands for good.`;
}

/** What he says about one rung that is still chalk. */
export function brockQuote(offer: WorkshopOffer): BrockQuote {
  const { upgrade } = offer;
  const what = `${upgrade.name}. ${upgrade.effect}`;
  if (offer.state === 'built') {
    return { lines: [builtLine(upgrade.name)] };
  }
  if (offer.state === 'locked') {
    return { lines: [what, `It goes in after ${offer.requires?.name ?? 'the one before it'}. One thing at a time.`] };
  }
  const price = itemAmountsFor(upgrade.cost.supplies);
  if (!offer.affordable) {
    return {
      lines: [
        what,
        offer.suppliesShort.length > 0
          ? `That takes ${price}. You are short ${itemAmountsFor(offer.suppliesShort)}.`
          : `That takes ${price}, and you have none of it to spare.`,
      ],
    };
  }
  return { lines: [what, `That takes ${price}. You have it.`], question: BUILD_QUESTION, upgradeId: upgrade.id };
}

/** What he says about the bay it stands for, against this vault. */
export function brockQuoteFor(vault: WorkshopVault, builtIds: readonly string[], upgradeId: string): BrockQuote {
  const offer = workshopOffers(vault, builtIds).find((each) => each.upgrade.id === upgradeId);
  return offer ? brockQuote(offer) : { lines: [] };
}

/**
 * The key on the mat: the next thing he would build. What this vault can pay for
 * before what it cannot, because a player who has walked in with the goods should
 * be one YES from spending them; whatever is still chalk after that is said from
 * the bay it is in.
 */
export function brockFromTheMat(vault: WorkshopVault, builtIds: readonly string[]): BrockQuote {
  const offers = workshopOffers(vault, builtIds);
  const next = offers.find((offer) => offer.affordable) ?? offers.find((offer) => offer.state === 'open');
  return next ? brockQuote(next) : { lines: [LADDER_BUILT_LINE] };
}
