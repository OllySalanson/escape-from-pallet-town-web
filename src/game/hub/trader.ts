import {
  CURRENCY_ITEM_ID,
  getItemById,
  isFoundOnly,
  SECURE_COLUMNS_PER_UPGRADE,
  type GridSize,
  type ItemId,
  type SupplyItemId,
} from '../items';
import type { Stash } from '../stash';

/**
 * The Ferryman: the trader who ties up at the base quay, and the one place
 * money in this game does anything.
 *
 * He is not the Outfitter and the two must never blur into one screen. The
 * Outfitter is the hideout - it takes banked Pokemon and materials and builds
 * something into the base that stands for good, and it hands nothing back. The
 * Ferryman is a person with a boat: he takes what you carried out of a raid and
 * gives you goods, this trip only, and he remembers whether you are worth
 * opening the hold for. One sentence: **the Outfitter builds, the Ferryman
 * deals.**
 *
 * Four constraints are the captain's ruling of 2026-09-19 and not
 * implementation detail. They are written here because this file is where all
 * four are kept or broken:
 *
 * 1. **Money is loot, never a score.** Scrip is found in a raid, lives in the
 *    pack, cannot be packed *for* one, and is destroyed with the pack on a wipe
 *    unless the secure slot names it. There is no wallet anywhere in the save -
 *    a player's money is `stash.itemCount('scrip')` and nothing else.
 * 2. **Supplies are not freely purchasable.** His stock is gated twice over: by
 *    standing, which offers nothing at all until you have proved you extract,
 *    and by a ration of a few units per raid. Both gates bind at different
 *    times - the ration stops a hoarder converting a fortune into a shelf of
 *    Potions in one sitting, and the price stops everybody else. See
 *    `TRADER_STOCK` for the arithmetic that keeps a raid's scarcity real.
 * 3. **The best things are barter only.** Gear and the evolution stone are on
 *    `TRADER_BARTERS`, paid for in found items and *never* in scrip, so no
 *    amount of money buys one. `TraderStockItem` is typed to `SupplyItemId`,
 *    which is derived from the catalogue rather than listed, so the compiler
 *    refuses a price tag on a piece of gear.
 * 4. **Sinks outweigh the faucet.** A raid finds roughly 40-70 scrip
 *    (`worldMap.ts`). His stock is an unbounded drain at 80-260 a unit, and the
 *    berth is 250 every raid a player wants one. A player cannot out-earn him.
 *
 * Everything here is a pure function over the stash and the save's own record,
 * so the rules are testable without Phaser; `HubScene` renders them and
 * `SaveManager` is the one path that spends.
 */

/** A quantity of one thing, either side of the counter. */
export interface TraderStack {
  readonly itemId: ItemId;
  readonly quantity: number;
}

export const TRADER_STANDING_IDS = ['stranger', 'regular', 'trusted', 'partner'] as const;
export type TraderStandingId = (typeof TRADER_STANDING_IDS)[number];

export interface TraderStanding {
  readonly id: TraderStandingId;
  /** What the screen calls it, in the one word a pixel-ui tag has room for. */
  readonly name: string;
  /** Standing points this tier opens at. */
  readonly points: number;
  /** What the tier is, in the Ferryman's own reading of you. */
  readonly note: string;
  /** Units of stock he will sell between one raid and the next. */
  readonly ration: number;
}

/**
 * Four tiers, and they are reached by *bringing things home* rather than by
 * playing raids: a player who deploys twenty times and extracts nothing is
 * still a stranger to him, which is the whole point of standing.
 *
 * The thresholds are set against what a save can actually bank. The authored
 * chain is four contracts (8 points) and there are four bosses (12), so a
 * player who has finished the game's authored content stands at 20 - well into
 * TRUSTED and six short of PARTNER. That last step is deliberately the only one
 * the authored content does not pay for on its own: it is bought with standing
 * contracts, or with turnover, which is to say by keeping on raiding.
 */
export const TRADER_STANDINGS: readonly TraderStanding[] = [
  {
    id: 'stranger',
    name: 'Stranger',
    points: 0,
    note: 'He will take your scrip and sell you nothing.',
    ration: 0,
  },
  {
    id: 'regular',
    name: 'Regular',
    points: 6,
    note: 'One thing off the deck a trip, and the first of the barters.',
    ration: 1,
  },
  {
    id: 'trusted',
    name: 'Trusted',
    points: 14,
    note: 'Two a trip, the good medicine, and most of the hold.',
    ration: 2,
  },
  {
    id: 'partner',
    name: 'Partner',
    points: 26,
    note: 'Three a trip, and nothing on the boat is held back.',
    ration: 3,
  },
];

/** What a banked contract is worth to him. Extraction is the whole measure. */
export const STANDING_PER_CONTRACT = 2;
/** What a beaten boss is worth. More than a contract: a door you opened stays open. */
export const STANDING_PER_BOSS = 3;
/** Scrip across his counter for one point of standing. Turnover, not balance. */
export const STANDING_PER_SCRIP = 200;

/**
 * The part of the save the Ferryman reads. Every field is a record of something
 * that happened, never an effect: which tier the player stands at, what is on
 * the shelf and what the ration is are all derived from these four numbers, so
 * a save can no more disagree with his standing than it can with the secure
 * slot (`../objectives/contracts`).
 */
export interface TraderProgress {
  readonly completedContracts: readonly string[];
  readonly standingContractsBanked: number;
  readonly defeatedBosses: readonly string[];
  /** Scrip that has crossed his counter, ever. Turnover is what he remembers. */
  readonly traderScripSpent: number;
  /** Barters taken that may only be taken once, by barter id. */
  readonly traderBarters: readonly string[];
}

export function traderStandingPoints(progress: TraderProgress): number {
  return (
    STANDING_PER_CONTRACT * (progress.completedContracts.length + progress.standingContractsBanked) +
    STANDING_PER_BOSS * progress.defeatedBosses.length +
    Math.floor(Math.max(0, progress.traderScripSpent) / STANDING_PER_SCRIP)
  );
}

/** The highest tier this save's points reach. Always one; STRANGER opens at zero. */
export function traderStanding(progress: TraderProgress): TraderStanding {
  const points = traderStandingPoints(progress);
  return [...TRADER_STANDINGS].reverse().find((tier) => points >= tier.points) ?? TRADER_STANDINGS[0];
}

/** The tier above, and how far off it is. Undefined at the top of the ladder. */
export function nextTraderStanding(
  progress: TraderProgress,
): { readonly tier: TraderStanding; readonly pointsShort: number } | undefined {
  const points = traderStandingPoints(progress);
  const tier = TRADER_STANDINGS.find((candidate) => candidate.points > points);
  return tier === undefined ? undefined : { tier, pointsShort: tier.points - points };
}

function standingRank(id: TraderStandingId): number {
  return TRADER_STANDINGS.findIndex((tier) => tier.id === id);
}

/** Whether this save stands at or above a tier a deal asks for. */
export function meetsStanding(progress: TraderProgress, required: TraderStandingId): boolean {
  return standingRank(traderStanding(progress).id) >= standingRank(required);
}

export function getTraderStanding(id: TraderStandingId): TraderStanding {
  return TRADER_STANDINGS[standingRank(id)];
}

/**
 * The shelf. Supplies only, and typed to `SupplyItemId` so the compiler refuses
 * a piece of gear here - gear is barter, and a shelf that repeats every raid is
 * exactly the faucet that would undo it.
 *
 * The prices are the second gate, and they are set against the faucet rather
 * than against what the item feels worth. A raid brings home roughly 40-70
 * scrip, so a Potion at 120 is about two raids of scavenging and a Super Potion
 * at 260 is four. A raid is measured at three Potions of consumption, so even a
 * player who spends every note he finds is replacing well under half of what a
 * raid drinks: the Ferryman is a backstop on a bad week, never a supply line.
 * That is what keeps scarcity real with money in the game.
 */
export interface TraderStockItem {
  readonly itemId: SupplyItemId;
  readonly price: number;
  readonly standing: TraderStandingId;
}

export const TRADER_STOCK: readonly TraderStockItem[] = [
  { itemId: 'poke-ball', price: 90, standing: 'regular' },
  { itemId: 'potion', price: 120, standing: 'regular' },
  { itemId: 'antidote', price: 80, standing: 'trusted' },
  { itemId: 'super-potion', price: 260, standing: 'trusted' },
  { itemId: 'great-ball', price: 220, standing: 'partner' },
];

/**
 * The barter table: found goods in, the things money cannot buy out.
 *
 * Every price here is materials, and never scrip, which is the captain's third
 * constraint kept literally - there is no sum that buys a Life Orb. It also
 * puts the barter table and the Outfitter ladder in competition for the same
 * six materials, which is the point: a parts crate is a locker or it is a Focus
 * Band, and a raid only finds one or two.
 *
 * Gear is `once` because a boss already hands each piece over exactly once per
 * save (`../world/trainers`). The barter is the *second* copy - what arms a
 * second Pokemon - so it never undercuts the fight, and it cannot become a
 * faucet the way a repeating board reward would. The stone repeats, because
 * evolution is a reward the game wants to keep paying and the material price is
 * the brake.
 */
export interface TraderBarter {
  readonly id: string;
  readonly name: string;
  /** What it is, in the one pane the list has for the deal in hand. */
  readonly detail: string;
  /** One of the shared 16x16 icons in `../ui/icons`, by file name. */
  readonly icon: string;
  readonly gives: TraderStack;
  /** Found items handed over. Never scrip: these are the things money cannot buy. */
  readonly takes: readonly TraderStack[];
  readonly standing: TraderStandingId;
  /** Offered once per save, because a second one would be a gear faucet. */
  readonly once: boolean;
}

export const TRADER_BARTERS: readonly TraderBarter[] = [
  {
    id: 'barter-quick-claw',
    name: 'Quick Claw',
    detail:
      'A second Quick Claw, off the boat rather than off a boss. Sometimes the holder strikes first, whatever the Speed says.',
    icon: 'quick-claw',
    gives: { itemId: 'quick-claw', quantity: 1 },
    takes: [
      { itemId: 'parts-crate', quantity: 2 },
      { itemId: 'cable-coil', quantity: 1 },
    ],
    standing: 'regular',
    once: true,
  },
  {
    id: 'barter-focus-band',
    name: 'Focus Band',
    detail:
      'A second Focus Band. Once a battle, the holder survives a knockout blow on 1 HP - the piece that most often decides whether a party comes home.',
    icon: 'focus-band',
    gives: { itemId: 'focus-band', quantity: 1 },
    takes: [
      { itemId: 'parts-crate', quantity: 3 },
      { itemId: 'mooring-rope', quantity: 1 },
    ],
    standing: 'trusted',
    once: true,
  },
  {
    id: 'barter-leftovers',
    name: 'Leftovers',
    detail:
      'A second set of Leftovers. The holder recovers a little HP at the end of every turn, which is the nearest thing to a Potion a raid does not have to carry.',
    icon: 'leftovers',
    gives: { itemId: 'leftovers', quantity: 1 },
    takes: [
      { itemId: 'linen-roll', quantity: 2 },
      { itemId: 'lamp-oil', quantity: 1 },
      { itemId: 'mooring-rope', quantity: 1 },
    ],
    standing: 'trusted',
    once: true,
  },
  {
    id: 'barter-thunder-stone',
    name: 'Thunder Stone',
    detail:
      'A stone with a thunderbolt in it. The only one outside Viridian Forest, and the only deal on the boat he will make twice.',
    icon: 'thunder-stone',
    gives: { itemId: 'thunder-stone', quantity: 1 },
    takes: [
      { itemId: 'radio-valve', quantity: 2 },
      { itemId: 'cable-coil', quantity: 2 },
      { itemId: 'lamp-oil', quantity: 1 },
    ],
    standing: 'trusted',
    once: false,
  },
  {
    id: 'barter-hm06',
    name: 'HM06 Rock Smash',
    detail:
      'The one machine that is never used up. It teaches a weak blow that lowers Defense half the time, and eleven of the seventeen can read it - including every starter.',
    icon: 'hm06-rock-smash',
    gives: { itemId: 'hm06-rock-smash', quantity: 1 },
    takes: [
      { itemId: 'parts-crate', quantity: 1 },
      { itemId: 'cable-coil', quantity: 1 },
      { itemId: 'radio-valve', quantity: 1 },
    ],
    standing: 'regular',
    // Once, and once is enough: an HM survives being read, so a second copy
    // would buy nothing. That is what lets the *reusable* machine be the one
    // deal on the boat - a TM would be a machine faucet, and the five of those
    // are found in the field or not at all.
    once: true,
  },
  {
    id: 'barter-life-orb',
    name: 'Life Orb',
    detail:
      "A second Life Orb, and the last thing he brings up. The holder's hits land a third harder and cost it a tenth of its own HP.",
    icon: 'life-orb',
    gives: { itemId: 'life-orb', quantity: 1 },
    takes: [
      { itemId: 'radio-valve', quantity: 2 },
      { itemId: 'parts-crate', quantity: 2 },
      { itemId: 'lamp-oil', quantity: 2 },
    ],
    standing: 'partner',
    once: true,
  },
];

/**
 * A berth in his hold for one raid: one more column of the secure container,
 * this trip only.
 *
 * This is the heavy scrip drain, and it is the clearest statement of what the
 * Ferryman is. The Outfitter *builds* a secure locker and it stands for every
 * raid afterwards; the Ferryman *rents* you the same two squares for the trip
 * and they are gone when the raid resolves, filled or not. Renting is how a
 * player protects a haul before they can afford to build, and it never makes
 * the locker rungs pointless: at 250 a raid, the first locker pays for itself
 * in three trips.
 *
 * It is not a supply, so it does not touch the second constraint, and it is not
 * one of the things money may never buy, so it does not touch the third.
 */
export const TRADER_BERTH_PRICE = 250;
export const TRADER_BERTH_STANDING: TraderStandingId = 'regular';

/** How much money this save has. There is no wallet: money is what is in the vault. */
export function scripHeld(stash: Stash): number {
  return stash.itemCount(CURRENCY_ITEM_ID);
}

/** What the counter is looking at: one save's vault and its record with him. */
export interface TraderCounter {
  readonly stash: Stash;
  readonly progress: TraderProgress;
  /** Units of stock already bought since the last raid resolved. */
  readonly rationUsed: number;
  /** Whether a berth is already paid for on the coming raid. */
  readonly berthPaid: boolean;
}

/** Units of stock still on this raid's ration. Never negative. */
export function rationLeft(counter: TraderCounter): number {
  return Math.max(0, traderStanding(counter.progress).ration - Math.max(0, counter.rationUsed));
}

export type TraderRefusal =
  | 'unknown-deal'
  | 'standing-short'
  | 'ration-spent'
  | 'scrip-short'
  | 'goods-short'
  | 'already-taken'
  | 'already-paid';

export interface TraderOffer {
  /** Undefined when the deal can be struck exactly as it stands. */
  readonly refusal?: TraderRefusal;
  /** The refusal in the one line the row and the status bar both print. */
  readonly message?: string;
}

export interface TraderStockOffer extends TraderOffer {
  readonly item: TraderStockItem;
}

export interface TraderBarterOffer extends TraderOffer {
  readonly barter: TraderBarter;
}

function refuse(refusal: TraderRefusal, message: string): TraderOffer {
  return { refusal, message };
}

function standingRefusal(required: TraderStandingId): TraderOffer {
  return refuse('standing-short', `He keeps that back until you are ${getTraderStanding(required).name.toLowerCase()}.`);
}

/** Every shelf item, in price order, judged against this counter. */
export function traderStockOffers(counter: TraderCounter): readonly TraderStockOffer[] {
  return TRADER_STOCK.map((item) => ({ item, ...judgePurchase(counter, item) }));
}

function judgePurchase(counter: TraderCounter, item: TraderStockItem, quantity = 1): TraderOffer {
  if (!meetsStanding(counter.progress, item.standing)) {
    return standingRefusal(item.standing);
  }
  if (quantity > rationLeft(counter) && rationLeft(counter) > 0) {
    return refuse('ration-spent', `He has ${rationLeft(counter)} left to sell you this trip, not ${quantity}.`);
  }
  if (rationLeft(counter) <= 0) {
    const ration = traderStanding(counter.progress).ration;
    return refuse(
      'ration-spent',
      ration === 0
        ? 'He is selling you nothing this trip.'
        : `He sells ${ration} ${ration === 1 ? 'thing' : 'things'} a trip, and this trip is spent. Raid, and come back.`,
    );
  }
  if (scripHeld(counter.stash) < item.price * quantity) {
    return refuse('scrip-short', `${item.price * quantity} scrip, and you have ${scripHeld(counter.stash)}.`);
  }
  return {};
}

/** Whether this purchase may be made exactly as it stands. */
export function checkPurchase(
  counter: TraderCounter,
  itemId: string,
  quantity = 1,
): TraderStockOffer | undefined {
  const item = TRADER_STOCK.find((candidate) => candidate.itemId === itemId);
  return item === undefined || !Number.isInteger(quantity) || quantity < 1
    ? undefined
    : { item, ...judgePurchase(counter, item, quantity) };
}

/**
 * The most of a shelf item this counter will sell right now: what is left of
 * the ration or what the purse covers, whichever is smaller - the ceiling a
 * count selector on the shelf stops at. Zero when standing shuts the item.
 */
export function traderStockLimit(counter: TraderCounter, item: TraderStockItem): number {
  if (!meetsStanding(counter.progress, item.standing)) {
    return 0;
  }
  return Math.max(0, Math.min(rationLeft(counter), Math.floor(scripHeld(counter.stash) / item.price)));
}

/**
 * Which of the two things is the shorter, said for the shelf's plus: a selector
 * stopped at three by the purse and one stopped at three by the ration are
 * different sentences.
 */
export function traderStockLimitReason(counter: TraderCounter, item: TraderStockItem): string {
  const ration = rationLeft(counter);
  const affordable = Math.floor(scripHeld(counter.stash) / item.price);
  return affordable <= ration
    ? `${affordable} is what your ${scripHeld(counter.stash)} scrip covers at ${item.price} each.`
    : `${ration} left on this trip's ration.`;
}

/** Every barter, in the order he brings them up, judged against this counter. */
export function traderBarterOffers(counter: TraderCounter): readonly TraderBarterOffer[] {
  return TRADER_BARTERS.map((barter) => ({ barter, ...judgeBarter(counter, barter) }));
}

function judgeBarter(counter: TraderCounter, barter: TraderBarter, quantity = 1): TraderOffer {
  if (barter.once && quantity > 1) {
    return refuse('already-taken', `He only has the one ${barter.name}.`);
  }
  if (barter.once && counter.progress.traderBarters.includes(barter.id)) {
    return refuse('already-taken', `He only had the one ${barter.name}.`);
  }
  if (!meetsStanding(counter.progress, barter.standing)) {
    return standingRefusal(barter.standing);
  }
  const short = barterShortfall(counter.stash, barter, quantity);
  if (short.length > 0) {
    return refuse('goods-short', `Still short ${formatTraderStacks(short)}.`);
  }
  return {};
}

/** What a barter still needs, given what the vault holds. Empty when it is covered. */
export function barterShortfall(stash: Stash, barter: TraderBarter, times = 1): readonly TraderStack[] {
  return barter.takes
    .map(({ itemId, quantity }) => ({ itemId, quantity: quantity * times - stash.itemCount(itemId) }))
    .filter(({ quantity }) => quantity > 0);
}

export function checkBarter(
  counter: TraderCounter,
  barterId: string,
  quantity = 1,
): TraderBarterOffer | undefined {
  const barter = TRADER_BARTERS.find((candidate) => candidate.id === barterId);
  return barter === undefined || !Number.isInteger(quantity) || quantity < 1
    ? undefined
    : { barter, ...judgeBarter(counter, barter, quantity) };
}

/**
 * How many times over this barter can be struck now: as many as the vault's
 * goods cover for one that repeats, one for a barter offered once, none while
 * it is shut. The ceiling a count selector on the table stops at.
 */
export function traderBarterLimit(counter: TraderCounter, barter: TraderBarter): number {
  if (!meetsStanding(counter.progress, barter.standing)) {
    return 0;
  }
  if (barter.once && counter.progress.traderBarters.includes(barter.id)) {
    return 0;
  }
  const covered = Math.min(
    ...barter.takes.map(({ itemId, quantity }) => Math.floor(counter.stash.itemCount(itemId) / quantity)),
  );
  return barter.once ? Math.min(1, covered) : covered;
}

/** Whether a berth may be taken for the coming raid. */
export function checkBerth(counter: TraderCounter): TraderOffer {
  if (counter.berthPaid) {
    return refuse('already-paid', 'Your berth is already paid for this trip.');
  }
  if (!meetsStanding(counter.progress, TRADER_BERTH_STANDING)) {
    return standingRefusal(TRADER_BERTH_STANDING);
  }
  if (scripHeld(counter.stash) < TRADER_BERTH_PRICE) {
    return refuse('scrip-short', `${TRADER_BERTH_PRICE} scrip, and you have ${scripHeld(counter.stash)}.`);
  }
  return {};
}

/**
 * Columns a paid berth adds to the secure container, for one raid.
 *
 * It is a function rather than a constant so `secureGrid` reads the same shape
 * from the rented half as it does from the banked ones, and so this file stays
 * the only place that knows a berth is worth exactly one column.
 */
export function berthSecureColumns(berthPaid: boolean): number {
  return berthPaid ? 1 : 0;
}

/**
 * How many squares a berth is worth on a container of this shape - what the row
 * offering it says, so the number on screen is the number the grid grows by
 * rather than one typed beside it.
 */
export function berthSquares(container: GridSize): number {
  return berthSecureColumns(true) * SECURE_COLUMNS_PER_UPGRADE * container.height;
}

/** "2× Parts crate, 1× Cable coil", the way every price on the boat is said. */
export function formatTraderStacks(stacks: readonly TraderStack[]): string {
  return stacks
    .map(({ itemId, quantity }) => `${quantity}× ${getItemById(itemId)?.displayName ?? itemId}`)
    .join(', ');
}

/**
 * Every found-only kind a deal on the boat still wants, once each.
 *
 * It is the barter table's answer to `outfitterMaterialKinds`, and it exists so
 * a reviewer can see in one call that the two sinks pull on the same six
 * materials - which is the whole reason the barter table is a real cost and not
 * a second shelf.
 */
export function traderWantedMaterials(progress: TraderProgress): readonly string[] {
  return [
    ...new Set(
      TRADER_BARTERS.filter((barter) => !(barter.once && progress.traderBarters.includes(barter.id)))
        .flatMap((barter) => barter.takes.map(({ itemId }) => itemId))
        .filter((itemId) => isFoundOnly(itemId)),
    ),
  ];
}


/**
 * A count read back out of a save: a whole number of units or nothing.
 *
 * Shared by the ration and the turnover so a corrupt or absent field reads the
 * same way in both - as "none", which is the only default that cannot hand the
 * player something they did not pay for.
 */
export function clampTraderCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

/** Barter ids a save records, once each, and only ones still on the table. */
export function clampTraderBarters(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === 'string' && TRADER_BARTERS.some((barter) => barter.id === id),
          ),
        ),
      ]
    : [];
}
