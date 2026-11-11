import type { DeploymentFlow } from '../hub/deploymentFlow';
import { FIRST_WORDS, hasHeard } from '../hub/firstWords';
import { getItemById, ItemCategory } from '../items';
import { meetsStanding, TRADER_STOCK, type TraderProgress } from '../hub/trader';

/** How many clean landings in a row before anybody remarks on it. */
export const STREAK_WORTH_SAYING = 3;

/**
 * What THE RAID ARENA's marshal says when spoken to. A newcomer is told what the
 * room is, once (`hub/firstWords.ts`); after that she says the one thing that is
 * wrong with the raid being got ready, if anything is, because she can see the
 * bench and the rack from where she stands.
 */
export function marshalLines(
  heard: readonly string[] | undefined,
  flow: DeploymentFlow,
  {
    bill,
    cleanLandings = 0,
    boutRival,
  }: {
    /** The record Bill reads, because she only sends you to him if he would sell you a ball. */
    readonly bill: TraderProgress;
    readonly cleanLandings?: number;
    /** Who is on the far floor, until this save has been across to them. */
    readonly boutRival?: string;
  },
): readonly string[] {
  if (!hasHeard(heard, 'loadout')) {
    return FIRST_WORDS.loadout.lines;
  }
  const notReady = flow.notReady;
  if (notReady !== undefined) {
    return [notReady];
  }
  if (!flow.packsABall) {
    if (flow.ballAtBase) {
      return ['No Poké Balls on your rack. You will not catch anything like that.'];
    }
    // Bill keeps his balls back from a stranger, so sending a newcomer to him
    // was sending them to a refusal (the first-hour bug hunt, 11 Nov 2026).
    return billSellsBalls(bill)
      ? ['You have no Poké Balls at all. Bill sells them, on the quay.']
      : ['You have no Poké Balls at all, and Bill sells none to a stranger.', 'Pick them up out there, and bank a few jobs until he trusts you.'];
  }
  if (flow.securedPokemon.length === 0 && flow.securedItems.length === 0) {
    const partner = flow.partnerOnRaid;
    return [
      partner === undefined
        ? 'Your locker is empty. Lose this raid and you lose the lot.'
        : `Your locker is empty. Lose this raid and only ${partner.pokemon.name} comes home.`,
    ];
  }
  if (cleanLandings >= STREAK_WORTH_SAYING) {
    return [`You look ready. ${cleanLandings} clean landings running, and the stands are counting.`];
  }
  if (boutRival) {
    return [`You look ready. ${boutRival} is on the far floor, if you want a bout first.`];
  }
  return ['You look ready. Pick a spot on the rim. A telescope east and west shows it all.'];
}

/** Whether Bill would sell this save a ball of any kind today. */
function billSellsBalls(bill: TraderProgress): boolean {
  return TRADER_STOCK.some((stock) => getItemById(stock.itemId)?.category === ItemCategory.PokeBall && meetsStanding(bill, stock.standing));
}
