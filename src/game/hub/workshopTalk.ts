import { itemAmountsFor } from '../items';
import { workshopOffers, type WorkshopOffer, type WorkshopVault } from './workshop';

/**
 * Brock in his workshop: what he says about the next build, in the room's own
 * dialogue box, before his workshop screen opens on it.
 *
 * He used to ask YES or NOT NOW in that box and build on YES, which skipped the
 * workshop screen the owner had chosen builds to be made on (the owner, 26 Nov
 * 2026: "he asked me if I wanted to build something, so I clicked yes and it
 * said the radio mast is now in ... that screen didn't come up"). Nothing is
 * built from a dialogue box now: every way in - the mat, a chalked bay, the
 * plans on his wall - opens the screen, and the screen is where a build is
 * chosen and paid for (`HubScene.workshopView`). He is blunt, and he builds; he
 * does not deal (`trader.ts`).
 */

export interface BrockQuote {
  /** What he says. */
  readonly lines: readonly string[];
  /** The build his screen opens on, once he has said it. Absent when there is nothing left to build. */
  readonly upgradeId?: string;
}

/** What he says with the whole ladder standing. */
export const LADDER_BUILT_LINE = 'That is the whole base built. There is nothing left for me to chalk.';

/** His word on a rung once it is up, with the thing standing behind him. */
export function builtLine(name: string): string {
  return `${name} is in, and it's staying.`;
}

/** What he says about one build, built or still chalk. */
export function brockQuote(offer: WorkshopOffer): BrockQuote {
  const { upgrade } = offer;
  const what = `${upgrade.name}. ${upgrade.effect}`;
  if (offer.state === 'built') {
    return { lines: [builtLine(upgrade.name)], upgradeId: upgrade.id };
  }
  if (offer.state === 'locked') {
    return { lines: [what, `It goes in after ${offer.requires?.name ?? 'the one before it'}. One thing at a time.`], upgradeId: upgrade.id };
  }
  const price = itemAmountsFor(upgrade.cost.supplies);
  if (!offer.affordable) {
    return {
      lines: [
        what,
        // Short of all of it, the shortfall is the price read back: where the
        // materials come from is the useful thing to say (the harbour critic
        // tour, 26 Nov 2026). Caches and the ground lay them, and the
        // standing board pays in them (`workshopMaterialKinds`).
        offer.suppliesShort.length === 0
          ? `That takes ${price}, and you have none of it to spare.`
          : itemAmountsFor(offer.suppliesShort) === price
            ? `That takes ${price}. Raids turn them up, and Oak's jobs pay in them.`
            : `That takes ${price}. You are short ${itemAmountsFor(offer.suppliesShort)}.`,
      ],
      upgradeId: upgrade.id,
    };
  }
  return { lines: [what, `That takes ${price}, and you've got it.`], upgradeId: upgrade.id };
}

/** What he says about the bay it stands for, against this vault. */
export function brockQuoteFor(vault: WorkshopVault, builtIds: readonly string[], upgradeId: string): BrockQuote {
  const offer = workshopOffers(vault, builtIds).find((each) => each.upgrade.id === upgradeId);
  return offer ? brockQuote(offer) : { lines: [] };
}

/**
 * The key on the mat: the next thing he would build. What this vault can pay for
 * before what it cannot, because a player who has walked in with the goods should
 * find the screen open on what they can build; whatever is still chalk after that
 * is one step along the screen's row.
 */
export function brockFromTheMat(vault: WorkshopVault, builtIds: readonly string[]): BrockQuote {
  const offers = workshopOffers(vault, builtIds);
  const next = offers.find((offer) => offer.affordable) ?? offers.find((offer) => offer.state === 'open');
  return next ? brockQuote(next) : { lines: [LADDER_BUILT_LINE] };
}
