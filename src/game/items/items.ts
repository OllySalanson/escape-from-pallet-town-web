import { evolutionByStone, type Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { POKEDOLLAR_SIGN } from '../ui/gameFont';

export { POKEDOLLAR_SIGN };

export const ItemCategory = {
  Medicine: 'medicine',
  PokeBall: 'pokeball',
  /**
   * Gear a Pokemon carries into a raid. It is a pocket rather than a use: a held
   * item is never spent from the bag, it is given to one Pokemon and then rides
   * with it - into the fight, and into the wipe that can take it away.
   */
  Held: 'held',
  /**
   * The pack a raid is carried in. It is a pocket of its own rather than a
   * corner of Other because it is the one kind of item a player *wears*: one of
   * them is chosen before every raid, and that one is lost with everything in
   * it if the raid is.
   */
  Pack: 'pack',
  Misc: 'misc',
} as const;

export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

/** What a pocket is called on screen. The category values themselves are save-file slugs. */
export const ITEM_CATEGORY_LABELS: Readonly<Record<ItemCategory, string>> = {
  medicine: 'Medicine',
  pokeball: 'Poké Balls',
  held: 'Gear',
  pack: 'Packs',
  misc: 'Other',
};

/**
 * What a piece of gear does while it is being carried.
 *
 * The numbers live here, beside the item's own name and description, for the
 * same reason a Potion's 20 HP does: the catalogue is what a player is told, so
 * the catalogue is what the rule reads. How each one is *applied* is
 * `../pokemon/battle/heldItems.ts`, which is the only thing that switches on
 * these - and the one place the battle engine asks about gear at all.
 *
 * A fifth member belongs here when there is something for it to stop or start.
 * `prevent-evolution` is the obvious next one, and it is deliberately not here
 * yet: nothing in this game evolves, so an Everstone would be an item a player
 * gives away and never sees do anything.
 */
export type HeldItemEffect =
  /** Leftovers: a share of maximum HP back at the end of every turn. */
  | { readonly type: 'end-of-turn-heal'; readonly maxHpFraction: number }
  /** Focus Band: one knockout blow survived at 1 HP, once in a battle. */
  | { readonly type: 'survive-one-ko' }
  /** Life Orb: harder hits, paid for in the holder's own HP on every one. */
  | {
      readonly type: 'power-at-a-price';
      readonly damageMultiplier: number;
      readonly recoilMaxHpFraction: number;
    }
  /** Quick Claw: sometimes first, whatever the Speed says. */
  | { readonly type: 'first-strike'; readonly chance: number };

export type ItemEffect =
  | { readonly type: 'heal'; readonly amount: number }
  | { readonly type: 'cure-status'; readonly status: PrimaryStatus }
  | { readonly type: 'capture-modifier'; readonly multiplier: number }
  /**
   * Nothing to use: the item exists to be spent at Brock's Workshop, and no raid,
   * battle or bag screen may do anything with it.
   */
  | { readonly type: 'material' }
  /**
   * Money. It does nothing at all in the field, in a fight or at Brock's Workshop:
   * its only use is across Bill's counter (`../hub/trader`), which is
   * what keeps it loot rather than a score. It is found in a raid, never
   * packed, carried in the pack and destroyed with it on a wipe unless the
   * secure slot names it - the same shape as a material, and for the same
   * reason.
   */
  | { readonly type: 'currency' }
  /**
   * Evolves the Pokemon it is used on, if its line answers to this stone. The
   * stone is the item's own id rather than a field, because a second field
   * naming the same thing is a second answer waiting to disagree with the
   * first - `src/game/pokemon/evolution.ts` is the table both read.
   */
  | { readonly type: 'evolution-stone' }
  /**
   * A TM or an HM: one disc, one move, taught to a Pokemon that canon says can
   * learn it. Which move and whether the disc survives being read live in
   * `src/game/pokemon/machines.ts`, keyed by **this item's own id** - the same
   * reason the evolution stone carries no field naming its stone. A second
   * field naming the move would be a second answer waiting to disagree with the
   * learner list it is checked against.
   *
   * It is not used through `useFieldItem`: teaching can need the player to
   * choose a move to forget, which is a screen rather than a return value. See
   * `./teaching.ts`.
   */
  | { readonly type: 'machine' }
  /**
   * A pack: the squares a raid is carried in, and the whole of what one is.
   *
   * The grid is authored here beside the pack's own name for the same reason a
   * Potion's 20 HP is - how much a thing carries is what the player is told
   * about it - and it is the *only* place a pack size is written down. The
   * loadout, the raid bag, the wipe and the result screen all read it back
   * through `./packs`, so nothing can hold a second opinion about how big a
   * Ranger pack is.
   */
  | { readonly type: 'pack'; readonly grid: ItemFootprint }
  | { readonly type: 'held'; readonly held: HeldItemEffect };

/**
 * The squares one of an item takes up in a container, in chequered cells.
 *
 * It is authored beside the item's name and its effect for the same reason a
 * Potion's 20 HP is: how big a thing is is something the player is told, so it
 * belongs where everything else they are told about it lives. How a footprint
 * is *seated* is `./itemGrid`, which is the only module that knows a grid has
 * corners.
 */
export interface ItemFootprint {
  readonly width: number;
  readonly height: number;
}

export interface ItemDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly category: ItemCategory;
  /**
   * How many squares one of these takes. Nothing in the catalogue is more than
   * two squares on a side, which is what keeps the greedy packer in
   * `./itemGrid` honest and keeps a container legible at 320x240.
   *
   * The sizes are the design: a Potion is one square and a Super Potion is two,
   * so healing twice as hard costs twice the room; every material is at least
   * two and the three heaviest are four, so a good raid is the raid where the
   * pack runs out before the map does.
   */
  readonly footprint: ItemFootprint;
  /**
   * How many of this id share one square block. One for everything the game
   * ships, because a second Potion taking a second square is the whole point.
   *
   * It exists for the things that are counted in the hundreds rather than the
   * handful - the Pokedollars are the one - where one square per unit would be absurd
   * and one square for the lot is what a player expects.
   */
  readonly stackSize?: number;
  readonly description: string;
  readonly effect: ItemEffect;
}

export interface FieldItemUseResult {
  readonly used: boolean;
  readonly message: string;
}

export const ITEMS = {
  potion: {
    id: 'potion',
    displayName: 'Potion',
    category: ItemCategory.Medicine,
    footprint: { width: 1, height: 1 },
    description: 'Restores 20 HP.',
    effect: { type: 'heal', amount: 20 },
  },
  'super-potion': {
    id: 'super-potion',
    displayName: 'Super Potion',
    category: ItemCategory.Medicine,
    footprint: { width: 1, height: 2 },
    description: 'Restores 50 HP.',
    effect: { type: 'heal', amount: 50 },
  },
  antidote: {
    id: 'antidote',
    displayName: 'Antidote',
    category: ItemCategory.Medicine,
    footprint: { width: 1, height: 1 },
    description: 'Cures poison.',
    effect: { type: 'cure-status', status: PrimaryStatus.Poison },
  },
  'poke-ball': {
    id: 'poke-ball',
    displayName: 'Poké Ball',
    category: ItemCategory.PokeBall,
    footprint: { width: 1, height: 1 },
    description: 'A device for catching wild Pokemon.',
    effect: { type: 'capture-modifier', multiplier: 1 },
  },
  'great-ball': {
    id: 'great-ball',
    displayName: 'Great Ball',
    category: ItemCategory.PokeBall,
    footprint: { width: 1, height: 1 },
    description: 'A high-performance Ball with a better catch rate.',
    effect: { type: 'capture-modifier', multiplier: 1.5 },
  },
  'radio-valve': {
    id: 'radio-valve',
    displayName: 'Radio valve',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 2 },
    description: 'A glass valve pulled from a dead set. Brock wants it for the radio mast.',
    effect: { type: 'material' },
  },
  'cable-coil': {
    id: 'cable-coil',
    displayName: 'Cable coil',
    category: ItemCategory.Misc,
    footprint: { width: 2, height: 2 },
    description: 'Copper cable, still good. Brock wires the beacon and the bay with it.',
    effect: { type: 'material' },
  },
  'parts-crate': {
    id: 'parts-crate',
    displayName: 'Parts crate',
    category: ItemCategory.Misc,
    footprint: { width: 2, height: 2 },
    description: 'Hinges, bolts and hasps. Brock builds the secure lockers out of them.',
    effect: { type: 'material' },
  },
  'lamp-oil': {
    id: 'lamp-oil',
    displayName: 'Lamp oil',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 2 },
    description: 'A sealed tin of lamp oil. Brock burns it in the beacon and the ward.',
    effect: { type: 'material' },
  },
  'mooring-rope': {
    id: 'mooring-rope',
    displayName: 'Mooring rope',
    category: ItemCategory.Misc,
    footprint: { width: 2, height: 2 },
    description: 'Tarred rope off a ferry post. Brock guys the mast and lashes the second locker with it.',
    effect: { type: 'material' },
  },
  'linen-roll': {
    id: 'linen-roll',
    displayName: 'Linen roll',
    category: ItemCategory.Misc,
    footprint: { width: 2, height: 1 },
    description: 'Clean linen for beds and bandages. Brock fits the Pokemon Center and the ward with it.',
    effect: { type: 'material' },
  },
  /**
   * Money, and the whole of it. One item, one stack, a quantity - found in the
   * field, spent only at Bill's counter.
   *
   * It is deliberately in the same pocket and under the same found-only rules
   * as a material rather than in a wallet of its own: a wallet is a number that
   * survives everything, and the captain's ruling is that money is loot. In the
   * pack it can be dropped by a wipe, protected by the secure slot, and - once
   * the grid pack lands - it will cost cells like anything else.
   *
   * It is the Pokedollar because that is what these games pay in, and an amount
   * of it is always written the way they write one - `₽40`, through
   * `formatMoney` - never as a count of a thing. The id was `scrip` until the
   * captain asked for money that sounds like Pokemon (2026-09-23); a save that
   * still says `scrip` is read through `currentItemId`.
   */
  money: {
    id: 'money',
    displayName: 'Pokedollars',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    // A bundle to a square. Money has to cost room or it is a score with an
    // icon, and one square per note would be absurd - so it is counted in
    // bundles the size of Bill's berth, which is the thing a player is
    // most often saving for. A raid that finds every note on the richest map
    // carries a square of them; one that hoards four raids' worth gives up a
    // fifth of its pack to do it.
    stackSize: 250,
    description: 'League money, counted in ₽ and water-stained. Bill still takes it; out here nobody else does.',
    effect: { type: 'currency' },
  },
  /* --- The stones ---------------------------------------------------------
     The five things in the pack that are neither a supply nor a material: a
     stone is spent on a Pokemon rather than at base, and what it buys is the
     one change this game makes that nothing can take back.

     They are **the prize the maps are walked for**. Every one is rolled on its
     own odds rather than drawn from a map's pool (`world/loot.ts`), seated in
     the one district its own species lives in (`worldMap.ts`), drawn with a
     light on it and named on the raid HUD from the moment it is seen - because
     a rarity nobody can see costing them their clock is not a decision, it is
     a surprise when you open a box. And it rides home in the pack like
     everything else, so a raid that does not walk out loses it.

     The stone names no stone: the item's own id *is* the key
     `pokemon/evolution.ts` matches a rule on, exactly as a machine's id is the
     key its move is looked up by. Thirteen evolution lines among the 151 are
     live because these five exist, and `evolution.test.ts` lists them.
     --------------------------------------------------------------------- */
  'thunder-stone': {
    id: 'thunder-stone',
    displayName: 'Thunder Stone',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'A stone with a thunderbolt in it. Some Pokemon answer to it.',
    effect: { type: 'evolution-stone' },
  },
  'fire-stone': {
    id: 'fire-stone',
    displayName: 'Fire Stone',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'A stone with a flame trapped in it. Vulpix and Growlithe answer to it.',
    effect: { type: 'evolution-stone' },
  },
  'water-stone': {
    id: 'water-stone',
    displayName: 'Water Stone',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'A stone the colour of deep water. Shellder, Poliwhirl and Staryu answer to it.',
    effect: { type: 'evolution-stone' },
  },
  'leaf-stone': {
    id: 'leaf-stone',
    displayName: 'Leaf Stone',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'A stone with a leaf pattern in it. Gloom, Weepinbell and Exeggcute answer to it.',
    effect: { type: 'evolution-stone' },
  },
  'moon-stone': {
    id: 'moon-stone',
    displayName: 'Moon Stone',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'A black stone with the moon in it. Clefairy, Jigglypuff and the Nidoran lines answer to it.',
    effect: { type: 'evolution-stone' },
  },
  /**
   * The machines. Six discs, five of them used up by the reading and one - the
   * HM - that never is, which is the tutorial's own shape: one `reusable` flag,
   * not two kinds of item.
   *
   * Every id here is also a key of `MACHINES` in `../pokemon/machines.ts`, and
   * `machines.test.ts` fails a disc on either side without the other. A machine
   * is found in the field or bartered off Bill; nothing restocks one,
   * and no contract, board or wipe hands one out.
   */
  'tm09-bullet-seed': {
    id: 'tm09-bullet-seed',
    displayName: 'TM09 Bullet Seed',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'Teaches Bullet Seed: two to five seeds in one turn. Only the Bulbasaur line can read it.',
    effect: { type: 'machine' },
  },
  'tm13-ice-beam': {
    id: 'tm13-ice-beam',
    displayName: 'TM13 Ice Beam',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'Teaches Ice Beam: a beam of cold that may freeze. The only Ice move there is.',
    effect: { type: 'machine' },
  },
  'tm23-iron-tail': {
    id: 'tm23-iron-tail',
    displayName: 'TM23 Iron Tail',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'Teaches Iron Tail: heavy, inaccurate, and it often softens what it hits.',
    effect: { type: 'machine' },
  },
  'tm28-dig': {
    id: 'tm28-dig',
    displayName: 'TM28 Dig',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'Teaches Dig: a turn underground, then the hit.',
    effect: { type: 'machine' },
  },
  'tm40-aerial-ace': {
    id: 'tm40-aerial-ace',
    displayName: 'TM40 Aerial Ace',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'Teaches Aerial Ace: a sweep too fast to dodge. It never misses.',
    effect: { type: 'machine' },
  },
  // The two HMs that are a route as well as a move. Read to a Pokemon that
  // FireRed lets read them, they open the doors `world/fieldMoves.ts` authors -
  // and being reusable is what makes that safe, because a door opened by a disc
  // that could run out would be a capability a player could lose.
  'hm01-cut': {
    id: 'hm01-cut',
    displayName: 'HM01 Cut',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'Teaches Cut, and is never used up. A Pokemon that knows it can clear growth in the field.',
    effect: { type: 'machine' },
  },
  'hm03-surf': {
    id: 'hm03-surf',
    displayName: 'HM03 Surf',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'Teaches Surf, and is never used up. A Pokemon that knows it can carry you over deep water.',
    effect: { type: 'machine' },
  },
  'hm06-rock-smash': {
    id: 'hm06-rock-smash',
    displayName: 'HM06 Rock Smash',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'Teaches Rock Smash, and is never used up: a weak blow that often lowers Defense.',
    effect: { type: 'machine' },
  },
  // The gear. Four pieces, four different kinds of answer, and every
  // description is the whole rule: a player who carries one into one fight can
  // say what it did without opening a menu again.
  leftovers: {
    id: 'leftovers',
    displayName: 'Leftovers',
    category: ItemCategory.Held,
    footprint: { width: 1, height: 1 },
    description: 'The holder recovers a little HP at the end of every turn.',
    effect: { type: 'held', held: { type: 'end-of-turn-heal', maxHpFraction: 16 } },
  },
  'focus-band': {
    id: 'focus-band',
    displayName: 'Focus Band',
    category: ItemCategory.Held,
    footprint: { width: 1, height: 1 },
    description: 'Once a battle, the holder survives a knockout blow on 1 HP.',
    effect: { type: 'held', held: { type: 'survive-one-ko' } },
  },
  'life-orb': {
    id: 'life-orb',
    displayName: 'Life Orb',
    category: ItemCategory.Held,
    footprint: { width: 1, height: 1 },
    description: "The holder's hits land a third harder and cost it a tenth of its own HP.",
    effect: {
      type: 'held',
      held: { type: 'power-at-a-price', damageMultiplier: 1.3, recoilMaxHpFraction: 10 },
    },
  },
  'quick-claw': {
    id: 'quick-claw',
    displayName: 'Quick Claw',
    category: ItemCategory.Held,
    footprint: { width: 1, height: 1 },
    description: 'Sometimes the holder strikes first, whatever the Speed says.',
    effect: { type: 'held', held: { type: 'first-strike', chance: 0.25 } },
  },

  /* --- The packs -----------------------------------------------------------
     Four sizes, six squares apart, and one of them is chosen before every
     raid. A pack is not an upgrade: it is a thing you own, and a raid you do
     not walk out of takes the one you wore and everything that was in it.

     The ladder is 12, 18, 24, 30 rather than a doubling, because each step is
     exactly one more row of the picture the player already reads - a parts
     crate and two Potions, or two thirds of a Pokemon carried home - and a
     pack that doubled would make the step before it worthless.

     Every one is two squares on a side as *loot*, because that is what finding
     one in the field costs to carry out: four squares of the pack you are
     already wearing, which on the Satchel is a third of it.
     --------------------------------------------------------------------- */
  satchel: {
    id: 'satchel',
    displayName: 'Satchel',
    category: ItemCategory.Pack,
    footprint: { width: 2, height: 2 },
    description: 'Twelve squares of oilcloth. The last pack anyone wants, and the one nobody is ever without.',
    effect: { type: 'pack', grid: { width: 4, height: 3 } },
  },
  'raid-pack': {
    id: 'raid-pack',
    displayName: 'Raid pack',
    category: ItemCategory.Pack,
    footprint: { width: 2, height: 2 },
    description: 'Eighteen squares, the pack every raider learns on. Enough for the kit and a little of what you find.',
    effect: { type: 'pack', grid: { width: 6, height: 3 } },
  },
  'ranger-pack': {
    id: 'ranger-pack',
    displayName: 'Ranger pack',
    category: ItemCategory.Pack,
    footprint: { width: 2, height: 2 },
    description: 'Twenty-four squares on a canvas frame. A whole row more than the raid pack, and a whole row more to lose.',
    effect: { type: 'pack', grid: { width: 6, height: 4 } },
  },
  'hauler-frame': {
    id: 'hauler-frame',
    displayName: 'Hauler frame',
    category: ItemCategory.Pack,
    footprint: { width: 2, height: 2 },
    description: 'Thirty squares of steel and strap. Carries a fortune home, and is a fortune to go down with.',
    effect: { type: 'pack', grid: { width: 6, height: 5 } },
  },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

/**
 * The gear ids and the supply ids, derived from the catalogue rather than listed
 * beside it - a second list is a second answer waiting to disagree with this
 * one.
 *
 * `SupplyItemId` earns its keep immediately: Brock's prices and the
 * standing board's payouts are typed with it, so neither can ever ask for or
 * hand out gear. Gear that a contract handed out on a loop would not be gear
 * worth protecting.
 */
export type HeldItemId = {
  [K in ItemId]: (typeof ITEMS)[K]['category'] extends typeof ItemCategory.Held ? K : never;
}[ItemId];

export type PackItemId = {
  [K in ItemId]: (typeof ITEMS)[K]['category'] extends typeof ItemCategory.Pack ? K : never;
}[ItemId];

/**
 * Everything that is neither gear nor a pack: what may be packed, priced,
 * bartered for or handed out by something that repeats.
 *
 * A pack is excluded for exactly the reason gear is. Gear must be carried out
 * of a raid to be owned, and a pack must be *survived* to be kept; either one
 * handed out on a loop by a contract, the standing board or Brock would
 * stop being the thing the loop is about.
 */
export type SupplyItemId = Exclude<ItemId, HeldItemId | PackItemId>;

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = Object.values(ITEMS);

/** Materials are the Other pocket: found in a raid, spent only at Brock's Workshop’s Workshop. */
export const MATERIAL_IDS: readonly SupplyItemId[] = ITEM_DEFINITIONS.filter(
  (item) => item.effect.type === 'material',
).map((item) => item.id as SupplyItemId);

/** Money. One item, one id, and the only thing Bill's stock is priced in. */
export const CURRENCY_ITEM_ID = 'money';

/** An amount of money as these games print one: `₽40`, never "40 Pokedollars". */
export function formatMoney(amount: number): string {
  return `${POKEDOLLAR_SIGN}${amount}`;
}

/**
 * Ids a save may still carry for an item that has since been renamed.
 *
 * A save is wire format, so renaming an item is a migration rather than an
 * edit: every place the loader reads an item id asks `currentItemId` first,
 * and a save written before the rename keeps what it held.
 */
export const RETIRED_ITEM_IDS: Readonly<Record<string, ItemId>> = {
  scrip: 'money',
};

/** The id an item goes by now, for an id read out of a save. */
export function currentItemId(itemId: string): string {
  return Object.hasOwn(RETIRED_ITEM_IDS, itemId) ? RETIRED_ITEM_IDS[itemId] : itemId;
}

/** Every pack in the catalogue, smallest first. What one holds is `./packs`. */
export const PACK_ITEM_IDS: readonly PackItemId[] = ITEM_DEFINITIONS.filter(
  (item) => item.effect.type === 'pack',
).map((item) => item.id as PackItemId);

export function isPack(itemId: string): boolean {
  return getItemById(itemId)?.effect.type === 'pack';
}

/**
 * Everything that is found in a raid rather than packed for one: the materials,
 * the money, and a spare pack.
 *
 * They share one rule, not three. None may be carried *into* a raid - a
 * material and a note do nothing there, and you are already wearing a pack, so
 * a second one in the loadout is only a thing to lose. All of them arrive in
 * the pack as loot; all of them are destroyed with it on a wipe unless room was
 * reserved for their *kind* in the secure container, which is the only way
 * squares can be set aside for something that does not exist yet. Every
 * place that used to ask `isMaterial` for that reason asks this instead - and
 * `isMaterial` still means only "Brock takes it", which is a different
 * question with a different answer.
 *
 * The pack you are *wearing* is not in this list and is not in the bag at all:
 * it is the bag. See `./packs`.
 */
export const FOUND_ONLY_IDS: readonly ItemId[] = ITEM_DEFINITIONS.filter(
  (item) =>
    item.effect.type === 'material' || item.effect.type === 'currency' || item.effect.type === 'pack',
).map((item) => item.id as ItemId);

export function isMaterial(itemId: string): boolean {
  return getItemById(itemId)?.effect.type === 'material';
}

/** A TM or an HM, by id. What it teaches is `../pokemon/machines.ts`. */
export function isMachine(itemId: string): boolean {
  return getItemById(itemId)?.effect.type === 'machine';
}

/** Every machine in the catalogue, in catalogue order. */
export const MACHINE_ITEM_IDS: readonly SupplyItemId[] = ITEM_DEFINITIONS.filter(
  (item) => item.effect.type === 'machine',
).map((item) => item.id as SupplyItemId);

/** An evolution stone, by id. Which line it answers is `../pokemon/evolution.ts`. */
export function isEvolutionStone(itemId: string): boolean {
  return getItemById(itemId)?.effect.type === 'evolution-stone';
}

/** Every stone in the catalogue, in catalogue order. */
export const EVOLUTION_STONE_IDS: readonly SupplyItemId[] = ITEM_DEFINITIONS.filter(
  (item) => item.effect.type === 'evolution-stone',
).map((item) => item.id as SupplyItemId);

/**
 * An item's name for a quantity: "3 Potions", but "Pokedollars".
 *
 * Money is a mass noun and every other item in the catalogue is a count noun,
 * so the rule is read off the item rather than guessed by the caller that is
 * printing it - the result screen said "Banked 40 Scrips" in a playtest, and
 * the same sentence is built in three places. An *amount* of money is not a
 * name at all: see `itemAmountFor`.
 */
export function itemNameFor(itemId: string, quantity: number): string {
  const item = getItemById(itemId);
  if (!item) {
    return itemId;
  }
  return item.effect.type === 'currency' || quantity === 1
    ? item.displayName
    : `${item.displayName}s`;
}

/**
 * A quantity of an item as a sentence says it: "3 Potions", "1 Potion", and
 * for money the amount itself, "₽40".
 */
export function itemAmountFor(itemId: string, quantity: number): string {
  return isCurrency(itemId) ? formatMoney(quantity) : `${quantity} ${itemNameFor(itemId, quantity)}`;
}

/**
 * How many of an item a row holds, in the tag beside its name: "×3", and for
 * money the amount, "₽40", because a count of Pokedollars is a sum.
 */
export function itemCountTag(itemId: string, quantity: number): string {
  return isCurrency(itemId) ? formatMoney(quantity) : `×${quantity}`;
}

/** Money, by id. Nothing else in the catalogue answers to it. */
export function isCurrency(itemId: string): boolean {
  return getItemById(itemId)?.effect.type === 'currency';
}

/** Found in a raid, never packed for one: a material, money, or a spare pack. */
export function isFoundOnly(itemId: string): boolean {
  const type = getItemById(itemId)?.effect.type;
  return type === 'material' || type === 'currency' || type === 'pack';
}

/** Every piece of gear, in catalogue order: what a give menu offers. */
export const HELD_ITEM_DEFINITIONS: readonly ItemDefinition[] = ITEM_DEFINITIONS.filter(
  (item) => item.category === ItemCategory.Held,
);

export function getItemById(id: string): ItemDefinition | undefined {
  return ITEMS[id as ItemId];
}

export function isHeldItemId(id: string | null | undefined): id is HeldItemId {
  return typeof id === 'string' && getItemById(id)?.category === ItemCategory.Held;
}

/** The gear a Pokemon is holding, or undefined for nothing and for a stale id. */
export function getHeldItem(id: string | null | undefined): ItemDefinition | undefined {
  return isHeldItemId(id) ? getItemById(id) : undefined;
}

/**
 * What the gear does, for the one module that applies it. Undefined for a
 * Pokemon holding nothing, so a caller never has to know what an empty slot is.
 */
export function heldItemEffect(id: string | null | undefined): HeldItemEffect | undefined {
  const effect = getHeldItem(id)?.effect;
  return effect?.type === 'held' ? effect.held : undefined;
}

/** The name the battle screen and the party screen both print for a piece of gear. */
export function heldItemName(id: string | null | undefined): string | undefined {
  return getHeldItem(id)?.displayName;
}

export function useFieldItem(item: ItemDefinition, pokemon: Pokemon): FieldItemUseResult {
  switch (item.effect.type) {
    case 'heal': {
      const healed = pokemon.heal(item.effect.amount);
      return healed > 0
        ? { used: true, message: `${pokemon.base.name} recovered ${healed} HP!` }
        : { used: false, message: `${pokemon.base.name}'s HP is already full.` };
    }
    case 'cure-status':
      if (pokemon.primaryStatus !== item.effect.status) {
        return { used: false, message: `It will not have any effect.` };
      }
      pokemon.primaryStatus = null;
      return { used: true, message: `${pokemon.base.name} was cured of poison!` };
    case 'capture-modifier':
      return { used: false, message: `${item.displayName} can only be used in battle.` };
    case 'material':
      return { used: false, message: `${item.displayName} is for Brock’s Workshop, not the field.` };
    case 'currency':
      return { used: false, message: `${item.displayName} is only good at Bill's counter.` };
    case 'machine':
      // A machine is never spent here. Teaching can need a move chosen to be
      // forgotten, which is a screen rather than a return value, so `./teaching`
      // owns the whole of it and the bag asks that first. This line is the
      // answer for the two screens that only ever offer medicine - the battle's
      // ITEM command and the base treatment bench - if either is ever pointed
      // at a disc.
      return { used: false, message: `${item.displayName} is read to a Pokémon from the bag.` };
    case 'evolution-stone': {
      const species = evolutionByStone(pokemon.base.id, item.id);
      const evolution = species ? pokemon.evolveInto(species) : null;
      return evolution
        ? { used: true, message: `${evolution.from.name} evolved into ${evolution.to.name}!` }
        : { used: false, message: `It will not have any effect.` };
    }
    case 'pack':
      // A spare pack found in the field is cargo, nothing more. Which one is
      // worn is chosen at base, before the raid it is risked on.
      return {
        used: false,
        message: `${item.displayName} is chosen at base, before you deploy.`,
      };
    case 'held':
      // Gear is never spent out of the bag. It is given to one Pokemon and
      // carried, which is what makes it something a raid can take away.
      return {
        used: false,
        message: `${item.displayName} is given to a Pokémon to hold.`,
      };
  }
}
