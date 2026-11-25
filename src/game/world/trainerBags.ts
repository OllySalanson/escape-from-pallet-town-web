import type { ItemId } from '../items/items';
import type { GridPosition } from '../movement/gridMovement';
import { createSeededRng, type SeededRng } from '../run/rng';
import type { WorldMapId } from '../worldMap';
import type { CharacterDesignId } from './characterDesigns';
import type { HunterRivalId } from './hunters';
import type { WorldPoi } from './pois';

/**
 * A beaten trainer drops their bag, and what is in it is what that kind of
 * trainer would have set out with.
 *
 * The captain, 25 Nov 2026: "When you kill a trainer, they should drop their
 * bag, and their bag should have some stuff in it that you can't
 * traditionally get from normal crates... if you were a Pokemon trainer, what
 * would you take?" So a hiker's rucksack has a Repel for the caves and, once in
 * a long while, a bigger pack; a fisherman's tackle box has a rod; a Rocket
 * grunt's duffel has a Lockpick in it, because that is how he got into
 * everything else. The bag is searched exactly as a cache is
 * (`cacheSearch.ts`), on the tile the trainer stood on, so taking it costs the
 * clock and the hunter's step like any search.
 *
 * The roll is the looter's usual one (Diablo's treasure classes, Tarkov's
 * bodies): a bag always holds one piece of the kit's **signature** - the
 * thing that kind of trainer never leaves without, and seldom a thing a crate
 * gives - perhaps one everyday extra beside it, and then one roll for a
 * **find** on a ladder of rarity, uncommon, rare and treasure, whose odds are
 * the trainer's standing (`FIND_ODDS`): a rookie on the first road rarely
 * carries anything worth the name, a gym leader always does. Which find in a
 * tier is the kit's own weighted table, so what a tier means is themed to the
 * trainer, and a find is never the thing already in the bag. Machines, gear
 * and the bigger pack are treasure only. A player who learns the kits learns
 * which fights are worth picking: that is the point of naming the bag's kind
 * on its caption.
 *
 * What a bag holds is drawn on its own stream, seeded by the raid and the
 * trainer (`bagSeed`), so it moves no other roll of the raid and the same
 * trainer beaten in the same raid drops the same bag however often the world
 * is rebuilt. And it is never money: money is measured off each map's own
 * loot pool (`hub/trader.test.ts`), and a bag paying it would be an unmeasured
 * second faucet - the same reason a cache never does.
 */

/** How rare a find is, commonest first. */
export type BagTier = 'basic' | 'uncommon' | 'rare' | 'treasure';

/** A find's tiers, rarest first: the order the roll asks them in. */
export const FIND_TIERS = ['treasure', 'rare', 'uncommon'] as const;
export type FindTier = (typeof FIND_TIERS)[number];

/** One row of a kit: a thing, how many of it, and how often it is the one drawn. */
export interface BagRow {
  readonly itemId: ItemId;
  /** How many: a number, or the least and most. One when absent. */
  readonly quantity?: number | readonly [number, number];
  /** Its share of its list's draws. One when absent. */
  readonly weight?: number;
}

/** What one kind of trainer sets out with. */
export interface BagKit {
  readonly id: string;
  /** What the bag is called on its caption: the trainer's name, then this. */
  readonly noun: string;
  /**
   * How often a trainer of this kind has a bag on them at all. A swimmer has
   * nowhere to put one; a hiker never leaves without his. Asked only of an
   * ordinary trainer: a boss and a hunter always carry theirs.
   */
  readonly carried: number;
  /** What this kind never leaves without: one of these is in every bag of the kind. */
  readonly signature: readonly BagRow[];
  /** The everyday extra one bag in two holds beside it. */
  readonly extras: readonly BagRow[];
  /** What a find of each tier is, for this kind. A tier it lacks falls to the one below. */
  readonly finds: Readonly<Record<FindTier, readonly BagRow[]>>;
}

/** How often a bag holds an everyday extra beside its signature piece. */
export const EXTRA_CHANCE = 0.5;

/**
 * How good a trainer is at carrying something worth finding. A rookie on the
 * vale's first roads (every Pokemon below level 12) is most of the vale's
 * trainers and is fought most often, so most of their bags hold no find. A
 * veteran of the coast and the marsh carries better. A hunter is the raid's
 * danger, but there is one in every district and they are beaten again every
 * raid, so only the first hunter a raid beats carries at `hunter` odds and
 * every later one at a veteran's (`WorldScene.dropBag`). A gym leader is
 * fought once a save, so always carries their treasure: a once-only fight
 * that missed its prize three times in four would be a miss for the whole
 * save, never even known about. And a trainer standing on ground a walk
 * straight out could call in on is `roadside` (`RunPlan.roadsideTrainers`):
 * walking straight out pays almost nothing (`world/raidStake.ts`), so their bag
 * holds its signature piece and nothing else. On a new save's first raid
 * every ordinary trainer is a `newcomer`, whose bag always holds a find: the
 * first bags a player ever opens are what sells them on bags, the way the
 * first contract is softened for a newcomer by data.
 */
export type BagStanding = 'rookie' | 'veteran' | 'hunter' | 'boss' | 'roadside' | 'newcomer';

/** The level a trainer's best Pokemon is at from which they are a veteran. */
export const VETERAN_LEVEL = 12;

/**
 * The chance of a find of each tier, asked rarest first; whatever is left over
 * is no find at all. A treasure is the bag worth telling somebody about.
 */
export const FIND_ODDS: Readonly<Record<BagStanding, Readonly<Record<FindTier, number>>>> = {
  rookie: { treasure: 0.02, rare: 0.08, uncommon: 0.3 },
  veteran: { treasure: 0.03, rare: 0.12, uncommon: 0.4 },
  hunter: { treasure: 0.04, rare: 0.2, uncommon: 0.56 },
  boss: { treasure: 1, rare: 0, uncommon: 0 },
  roadside: { treasure: 0, rare: 0, uncommon: 0 },
  newcomer: { treasure: 0.04, rare: 0.2, uncommon: 0.76 },
};

const rows = (...list: readonly BagRow[]): readonly BagRow[] => list;

/** The everyday extra most kits share: a Potion or a Poke Ball. */
const EVERYDAY = rows({ itemId: 'potion', weight: 2 }, { itemId: 'poke-ball', quantity: [1, 2] });

/**
 * The kits, by kind of trainer. Each is a guess at one question - if you were
 * this trainer, what would you take? - kept to the catalogue the game has, and
 * to things a crate does not hand out: berries (which otherwise grow only on
 * trees), Repels and Lockpicks (otherwise only bartered for), the Ranger pack,
 * the rods, the Pickaxe, the machines the vale lays nowhere, and once in a
 * long while a piece of gear. Never TM39, which is Brock's to give, nor the
 * Hauler frame, which is Oak's for a whole Pokedex.
 */
export const BAG_KITS = {
  rucksack: {
    id: 'rucksack',
    noun: 'RUCKSACK',
    carried: 0.9,
    signature: rows({ itemId: 'repel', weight: 3 }, { itemId: 'oran-berry', weight: 2 }, { itemId: 'rawst-berry' }),
    extras: EVERYDAY,
    finds: {
      uncommon: rows({ itemId: 'super-potion', weight: 3 }, { itemId: 'lamp-oil', weight: 2 }, { itemId: 'repel', quantity: 2 }),
      rare: rows({ itemId: 'pickaxe' }),
      treasure: rows({ itemId: 'ranger-pack' }),
    },
  },
  knapsack: {
    id: 'knapsack',
    noun: 'KNAPSACK',
    carried: 0.8,
    signature: rows({ itemId: 'oran-berry', weight: 3 }, { itemId: 'cheri-berry' }, { itemId: 'repel' }),
    extras: EVERYDAY,
    finds: {
      uncommon: rows({ itemId: 'super-potion', weight: 2 }, { itemId: 'repel' }, { itemId: 'sitrus-berry' }, { itemId: 'old-rod' }),
      rare: rows({ itemId: 'raid-pack' }, { itemId: 'pickaxe' }),
      treasure: rows({ itemId: 'ranger-pack', weight: 2 }, { itemId: 'tm09-bullet-seed' }),
    },
  },
  basket: {
    id: 'basket',
    noun: 'PICNIC BASKET',
    carried: 0.85,
    signature: rows(
      { itemId: 'oran-berry', quantity: [1, 2], weight: 3 },
      { itemId: 'pecha-berry', weight: 2 },
      { itemId: 'cheri-berry' },
    ),
    extras: rows({ itemId: 'potion' }),
    finds: {
      uncommon: rows({ itemId: 'sitrus-berry', weight: 3 }, { itemId: 'chesto-berry' }, { itemId: 'aspear-berry' }),
      rare: rows({ itemId: 'sitrus-berry', quantity: 2, weight: 2 }, { itemId: 'pretty-flowers' }),
      // A cushion to sit on the grass with. Not the Pika Cushion: it is the
      // first thing the pit hands back (`base/pitCoins.ts`), and that moment
      // is the pit's.
      treasure: rows({ itemId: 'fire-cushion' }),
    },
  },
  tin: {
    id: 'tin',
    noun: 'COLLECTING TIN',
    carried: 0.8,
    signature: rows({ itemId: 'poke-ball', quantity: [1, 3], weight: 2 }, { itemId: 'pecha-berry' }),
    extras: rows({ itemId: 'antidote' }),
    finds: {
      uncommon: rows({ itemId: 'great-ball', weight: 3 }, { itemId: 'repel' }),
      rare: rows({ itemId: 'repel', quantity: 2 }, { itemId: 'pecha-berry', quantity: 2 }),
      treasure: rows({ itemId: 'miracle-seed', weight: 2 }, { itemId: 'tm09-bullet-seed' }),
    },
  },
  tackle: {
    id: 'tackle',
    noun: 'TACKLE BOX',
    carried: 0.9,
    signature: rows({ itemId: 'poke-ball', quantity: [1, 2], weight: 2 }, { itemId: 'oran-berry' }),
    extras: rows({ itemId: 'potion' }),
    finds: {
      uncommon: rows({ itemId: 'old-rod', weight: 2 }, { itemId: 'super-potion' }, { itemId: 'mooring-rope' }),
      rare: rows({ itemId: 'good-rod' }),
      treasure: rows({ itemId: 'tm18-rain-dance' }),
    },
  },
  beach: {
    id: 'beach',
    noun: 'BEACH BAG',
    carried: 0.45,
    signature: rows({ itemId: 'oran-berry', weight: 2 }, { itemId: 'pecha-berry' }),
    extras: rows({ itemId: 'potion' }),
    finds: {
      uncommon: rows({ itemId: 'super-potion', weight: 2 }, { itemId: 'sitrus-berry' }),
      rare: rows({ itemId: 'sitrus-berry', quantity: 2 }),
      treasure: rows({ itemId: 'water-cushion' }),
    },
  },
  seaBag: {
    id: 'seaBag',
    noun: 'SEA BAG',
    carried: 0.85,
    signature: rows({ itemId: 'lamp-oil' }, { itemId: 'mooring-rope' }),
    extras: EVERYDAY,
    finds: {
      uncommon: rows({ itemId: 'lockpick', weight: 2 }, { itemId: 'super-potion', weight: 2 }, { itemId: 'old-rod' }),
      rare: rows({ itemId: 'lockpick', quantity: 2 }),
      treasure: rows({ itemId: 'tm18-rain-dance' }),
    },
  },
  duffel: {
    id: 'duffel',
    noun: 'DUFFEL',
    carried: 0.85,
    signature: rows({ itemId: 'poke-ball', quantity: [1, 2] }),
    extras: rows({ itemId: 'potion' }),
    finds: {
      uncommon: rows({ itemId: 'lockpick', weight: 3 }, { itemId: 'great-ball', weight: 2 }, { itemId: 'super-potion', weight: 2 }),
      rare: rows({ itemId: 'lockpick', quantity: 2 }),
      treasure: rows({ itemId: 'smoke-ball' }),
    },
  },
  toolBag: {
    id: 'toolBag',
    noun: 'TOOL BAG',
    carried: 0.9,
    signature: rows({ itemId: 'cable-coil' }),
    extras: rows({ itemId: 'potion' }),
    finds: {
      uncommon: rows({ itemId: 'parts-crate', weight: 2 }, { itemId: 'radio-valve' }, { itemId: 'super-potion' }),
      rare: rows({ itemId: 'pickaxe', weight: 3 }, { itemId: 'lockpick', quantity: 2 }),
      treasure: rows({ itemId: 'ranger-pack' }),
    },
  },
  kitBag: {
    id: 'kitBag',
    noun: 'KIT BAG',
    carried: 0.8,
    signature: rows({ itemId: 'super-potion' }, { itemId: 'cheri-berry' }),
    extras: rows({ itemId: 'potion', quantity: [1, 2] }),
    finds: {
      uncommon: rows({ itemId: 'sitrus-berry', weight: 2 }, { itemId: 'super-potion' }),
      rare: rows({ itemId: 'sitrus-berry', quantity: 2 }),
      treasure: rows({ itemId: 'focus-band' }),
    },
  },
  sampleCase: {
    id: 'sampleCase',
    noun: 'SAMPLE CASE',
    carried: 0.9,
    signature: rows({ itemId: 'repel', weight: 2 }, { itemId: 'antidote' }),
    extras: rows({ itemId: 'great-ball' }),
    finds: {
      uncommon: rows({ itemId: 'radio-valve', weight: 2 }, { itemId: 'great-ball', quantity: 2, weight: 2 }, { itemId: 'repel', quantity: 2 }),
      rare: rows({ itemId: 'lockpick', quantity: 2 }, { itemId: 'chesto-berry', quantity: 2 }),
      treasure: rows({ itemId: 'tm40-aerial-ace' }, { itemId: 'tm23-iron-tail' }, { itemId: 'tm13-ice-beam' }),
    },
  },
  gigBag: {
    id: 'gigBag',
    noun: 'GIG BAG',
    carried: 0.75,
    signature: rows({ itemId: 'cable-coil' }),
    extras: rows({ itemId: 'potion' }),
    finds: {
      uncommon: rows({ itemId: 'radio-valve', weight: 2 }, { itemId: 'super-potion' }),
      rare: rows({ itemId: 'lockpick', quantity: 2 }, { itemId: 'repel', quantity: 2 }),
      treasure: rows({ itemId: 'quick-claw' }),
    },
  },
  ledger: {
    id: 'ledger',
    noun: 'LEDGER BAG',
    carried: 0.8,
    signature: rows({ itemId: 'linen-roll' }),
    extras: rows({ itemId: 'potion' }),
    finds: {
      uncommon: rows({ itemId: 'lockpick', weight: 2 }, { itemId: 'super-potion' }),
      rare: rows({ itemId: 'lockpick', quantity: 2 }),
      // A gentleman's trophy, carried for nobody's reason but his own. Not
      // the Glass Ornament or the Silver Shield, which are LINNET's race's to
      // give (`races.ts`).
      treasure: rows({ itemId: 'gold-shield' }),
    },
  },
  bag: {
    id: 'bag',
    noun: 'BAG',
    carried: 0.8,
    signature: rows({ itemId: 'oran-berry' }, { itemId: 'repel' }),
    extras: EVERYDAY,
    finds: {
      uncommon: rows({ itemId: 'super-potion' }, { itemId: 'great-ball' }),
      rare: rows({ itemId: 'repel', quantity: 2 }, { itemId: 'lockpick', quantity: 2 }),
      treasure: rows({ itemId: 'ranger-pack' }),
    },
  },
  // The gym leaders' own: fought once a save, so always a find.
  mistysBag: {
    id: 'mistysBag',
    noun: 'BEACH BAG',
    carried: 1,
    signature: rows({ itemId: 'super-potion', quantity: 2 }),
    extras: rows({ itemId: 'oran-berry' }),
    finds: {
      uncommon: rows({ itemId: 'sitrus-berry', quantity: 2 }),
      rare: rows({ itemId: 'sitrus-berry', quantity: 3 }),
      treasure: rows({ itemId: 'tm18-rain-dance', weight: 2 }, { itemId: 'water-cushion' }),
    },
  },
  kogasPouch: {
    id: 'kogasPouch',
    noun: 'NINJA POUCH',
    carried: 1,
    signature: rows({ itemId: 'super-potion', quantity: 2 }),
    extras: rows({ itemId: 'antidote', quantity: 2 }),
    finds: {
      uncommon: rows({ itemId: 'pecha-berry', quantity: 2 }),
      rare: rows({ itemId: 'repel', quantity: 2 }),
      treasure: rows({ itemId: 'smoke-ball', weight: 2 }, { itemId: 'tm40-aerial-ace' }),
    },
  },
} as const satisfies Readonly<Record<string, BagKit>>;

export type BagKitId = keyof typeof BAG_KITS;

/**
 * Which kit a trainer of each look carries. The look is the trainer's kind in
 * this game - a map file names a trainer's figure and nothing else about what
 * they do - so it is what says a hiker is a hiker. A look not named here
 * carries the plain `bag`.
 */
export const KIT_FOR_DESIGN: Readonly<Partial<Record<CharacterDesignId, BagKitId>>> = {
  hiker: 'rucksack',
  'bald-man': 'rucksack',
  'heavy-man': 'rucksack',
  'old-man': 'rucksack',
  camper: 'knapsack',
  'straw-hat': 'knapsack',
  boy: 'knapsack',
  youngster: 'knapsack',
  'little-boy': 'knapsack',
  cooltrainer: 'knapsack',
  'cooltrainer-woman': 'knapsack',
  picnicker: 'basket',
  lass: 'basket',
  woman: 'basket',
  beauty: 'basket',
  'old-woman': 'basket',
  'little-girl': 'basket',
  'tuber-boy': 'beach',
  'tuber-girl': 'beach',
  'bug-catcher': 'tin',
  fisherman: 'tackle',
  swimmer: 'beach',
  'swimmer-woman': 'beach',
  sailor: 'seaBag',
  captain: 'seaBag',
  'rocket-grunt': 'duffel',
  'rocket-grunt-woman': 'duffel',
  worker: 'toolBag',
  'worker-woman': 'toolBag',
  'black-belt': 'kitBag',
  scientist: 'sampleCase',
  'poke-maniac': 'sampleCase',
  rocker: 'gigBag',
  clerk: 'ledger',
  gentleman: 'ledger',
  'rich-boy': 'ledger',
  misty: 'mistysBag',
  koga: 'kogasPouch',
};

/**
 * The five hunters' own bags. A hunter does this for a living, so their
 * signature is a raider's medicine and their treasure is each one's piece of
 * gear or machine - a long shot, and the first hunter a raid beats is the
 * only one carrying at a hunter's odds.
 */
export const HUNTER_KITS: Readonly<Record<HunterRivalId, BagKit>> = {
  blue: {
    id: 'blue',
    noun: 'RAID PACK',
    carried: 1,
    signature: rows({ itemId: 'great-ball', quantity: [1, 2] }),
    extras: rows({ itemId: 'super-potion' }, { itemId: 'potion', quantity: 2 }),
    finds: {
      uncommon: rows({ itemId: 'sitrus-berry', weight: 2 }, { itemId: 'repel' }),
      rare: rows({ itemId: 'lockpick', quantity: 2 }, { itemId: 'repel', quantity: 2 }),
      treasure: rows({ itemId: 'quick-claw', weight: 2 }, { itemId: 'tm40-aerial-ace' }),
    },
  },
  lorelei: {
    id: 'lorelei',
    noun: 'TRAVEL CASE',
    carried: 1,
    signature: rows({ itemId: 'aspear-berry' }),
    extras: rows({ itemId: 'super-potion' }, { itemId: 'great-ball' }),
    finds: {
      uncommon: rows({ itemId: 'sitrus-berry', weight: 2 }, { itemId: 'chesto-berry' }),
      rare: rows({ itemId: 'sitrus-berry', quantity: 2 }),
      treasure: rows({ itemId: 'never-melt-ice', weight: 2 }, { itemId: 'tm13-ice-beam' }),
    },
  },
  bruno: {
    id: 'bruno',
    noun: 'KIT BAG',
    carried: 1,
    signature: rows({ itemId: 'super-potion' }),
    extras: rows({ itemId: 'potion', quantity: 2 }, { itemId: 'cheri-berry' }),
    finds: {
      uncommon: rows({ itemId: 'sitrus-berry', weight: 2 }, { itemId: 'cheri-berry', quantity: 2 }),
      rare: rows({ itemId: 'pickaxe' }),
      treasure: rows({ itemId: 'focus-band' }),
    },
  },
  agatha: {
    id: 'agatha',
    noun: 'CARPET BAG',
    carried: 1,
    signature: rows({ itemId: 'chesto-berry' }),
    extras: rows({ itemId: 'super-potion' }, { itemId: 'antidote' }),
    finds: {
      uncommon: rows({ itemId: 'repel', quantity: 2 }, { itemId: 'pecha-berry' }),
      rare: rows({ itemId: 'lockpick', quantity: 2 }),
      treasure: rows({ itemId: 'spell-tag', weight: 2 }, { itemId: 'smoke-ball' }),
    },
  },
  lance: {
    id: 'lance',
    noun: 'CAPE POCKET',
    carried: 1,
    signature: rows({ itemId: 'super-potion' }),
    extras: rows({ itemId: 'great-ball' }),
    finds: {
      uncommon: rows({ itemId: 'sitrus-berry', weight: 2 }, { itemId: 'great-ball', quantity: 2 }),
      rare: rows({ itemId: 'sitrus-berry', quantity: 2 }, { itemId: 'repel', quantity: 2 }),
      treasure: rows({ itemId: 'life-orb' }, { itemId: 'charcoal' }, { itemId: 'tm23-iron-tail' }),
    },
  },
};

/** Who dropped a bag, as the roll needs them. */
export interface BagOwner {
  /** The trainer's id, or the hunter's: one bag a raid per owner. */
  readonly id: string;
  readonly name: string;
  readonly kit: BagKit;
  readonly standing: BagStanding;
}

/** A bag lying where its owner fell: searched as a cache is, for the rest of the raid. */
export interface TrainerBag {
  /** Its cache id (`WorldPoi.id`), which is what its search is kept under. */
  readonly id: string;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly label: string;
  readonly reward: readonly BagPiece[];
  /** The best tier in it, for the moment it drops. */
  readonly best: BagTier;
}

/** The kit a trainer of this look carries. */
export function kitFor(design: CharacterDesignId | undefined): BagKit {
  return BAG_KITS[(design && KIT_FOR_DESIGN[design]) ?? 'bag'];
}

/** A trainer's standing, read off the best Pokemon they field. */
export function standingOf(levels: readonly number[], boss: boolean): BagStanding {
  if (boss) {
    return 'boss';
  }
  return Math.max(0, ...levels) >= VETERAN_LEVEL ? 'veteran' : 'rookie';
}

/** A bag's cache id, from its owner's. */
export const bagIdFor = (ownerId: string): string => `bag:${ownerId}`;

/** Whether a cache id is a dropped bag's. */
export const isBagId = (poiId: string): boolean => poiId.startsWith('bag:');

/** Whether a bag id is a hunter's: a pack hunter's id is `hunter:` and its ground (`hunterPack.ts`). */
export const isHunterBagId = (bagId: string): boolean => bagId.startsWith(bagIdFor('hunter:'));

/**
 * The caption's last line on a bag with a rare find or a treasure in it. A
 * looter marks its good drops where they fall, so the decision - stop and
 * search with the hunter coming, or walk on - is made knowing there is
 * something worth stopping for, though not what.
 */
export const BAG_GLINT_LINE = 'SOMETHING GLINTS INSIDE';

/** How long the mark over a trainer worth the fight waits between bobs: often enough to be seen walking past. */
export const TRAINER_GLINT_EVERY_MS = 1400;
/** How far the mark bobs, in pixels. */
export const TRAINER_GLINT_BOB = 2;

/** How long after the world comes back from the fight a bag is seen to fall: once its fade has cleared. */
export const BAG_DROP_DELAY_MS = 350;

/** Said after a win over a trainer who had no bag on them. */
export function travellingLightLine(name: string): string {
  return `${name} was travelling light: no bag to search.`;
}

/**
 * The stream a bag is rolled on: the raid's seed mixed with its owner's id
 * (FNV-1a over the id), so each owner's bag is its own and none moves another
 * roll of the raid.
 */
export function bagSeed(raidSeed: number, ownerId: string): number {
  let hash = 0x811c9dc5 ^ (raidSeed >>> 0);
  for (let index = 0; index < ownerId.length; index += 1) {
    hash ^= ownerId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function quantityOf(row: BagRow, rng: SeededRng): number {
  const { quantity = 1 } = row;
  return typeof quantity === 'number' ? quantity : rng.int(quantity[0], quantity[1]);
}

function weighted(list: readonly BagRow[], rng: SeededRng): BagRow {
  const total = list.reduce((sum, row) => sum + (row.weight ?? 1), 0);
  let at = rng.next() * total;
  for (const row of list) {
    at -= row.weight ?? 1;
    if (at < 0) {
      return row;
    }
  }
  return list[list.length - 1];
}

/** The tier of the find this bag rolls, or null for none. */
export function rollFindTier(standing: BagStanding, rng: SeededRng): FindTier | null {
  const roll = rng.next();
  let at = 0;
  for (const tier of FIND_TIERS) {
    at += FIND_ODDS[standing][tier];
    if (roll < at) {
      return tier;
    }
  }
  return null;
}

/** One piece of a bag: a thing, how many, and the tier of find it is, if it is the find. */
export interface BagPiece {
  readonly itemId: ItemId;
  readonly quantity: number;
  /** Set on the bag's find, so its search can say what it is. */
  readonly find?: FindTier;
}

/**
 * What one owner's bag holds, or null when they had none on them. The
 * signature piece comes first, then any extra, and the find last, so a search
 * turns up the everyday things and then, if there is one, the thing worth
 * waiting for.
 */
export function rollBagContents(
  owner: BagOwner,
  raidSeed: number,
): { readonly reward: readonly BagPiece[]; readonly best: BagTier } | null {
  const rng = createSeededRng(bagSeed(raidSeed, owner.id));
  // A boss and a hunter always carry theirs, and so does every trainer on a
  // new save's first raid: "travelling light" is no way to meet bags.
  const carried = owner.standing === 'boss' || owner.standing === 'hunter' || owner.standing === 'newcomer' ? 1 : owner.kit.carried;
  if (!rng.chance(carried)) {
    return null;
  }
  const signature = weighted(owner.kit.signature, rng);
  const reward: BagPiece[] = [{ itemId: signature.itemId, quantity: quantityOf(signature, rng) }];
  if (rng.chance(EXTRA_CHANCE) && owner.standing !== 'roadside') {
    const extras = owner.kit.extras.filter((row) => row.itemId !== signature.itemId);
    if (extras.length > 0) {
      const extra = weighted(extras, rng);
      reward.push({ itemId: extra.itemId, quantity: quantityOf(extra, rng) });
    }
  }
  const tier = rollFindTier(owner.standing, rng);
  // A find is never a thing already in the bag - "Super Potion, Super Potion
  // x2" reads as a mistake and hides the find - and a kit with nothing left
  // at the tier rolled finds the best it has below it.
  const fresh = (tierRows: readonly BagRow[]) => tierRows.filter((row) => !reward.some((piece) => piece.itemId === row.itemId));
  const found =
    tier === null
      ? undefined
      : FIND_TIERS.slice(FIND_TIERS.indexOf(tier)).find((candidate) => fresh(owner.kit.finds[candidate]).length > 0);
  if (!found) {
    return { reward, best: 'basic' };
  }
  const row = weighted(fresh(owner.kit.finds[found]), rng);
  return { reward: [...reward, { itemId: row.itemId, quantity: quantityOf(row, rng), find: found }], best: found };
}

/** The name a bag's caption gives it: "HIKER PELL'S RUCKSACK". */
export function bagLabel(owner: Pick<BagOwner, 'name' | 'kit'>): string {
  return `${owner.name}'S ${owner.kit.noun}`;
}

/** A dropped bag as the cache it is searched as. */
export function bagAsPoi(bag: TrainerBag): WorldPoi {
  return {
    id: bag.id,
    mapId: bag.mapId,
    position: bag.position,
    label: bag.label,
    description: `${bag.label}, dropped where its owner was beaten.`,
    reward: bag.reward,
  };
}
