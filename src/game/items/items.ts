import { evolutionByStone, type Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';

export const ItemCategory = {
  Medicine: 'medicine',
  PokeBall: 'pokeball',
  /**
   * Gear a Pokemon carries into a raid. It is a pocket rather than a use: a held
   * item is never spent from the bag, it is given to one Pokemon and then rides
   * with it - into the fight, and into the wipe that can take it away.
   */
  Held: 'held',
  Misc: 'misc',
} as const;

export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

/** What a pocket is called on screen. The category values themselves are save-file slugs. */
export const ITEM_CATEGORY_LABELS: Readonly<Record<ItemCategory, string>> = {
  medicine: 'Medicine',
  pokeball: 'Poké Balls',
  held: 'Gear',
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
   * Nothing to use: the item exists to be spent at the Outfitter, and no raid,
   * battle or bag screen may do anything with it.
   */
  | { readonly type: 'material' }
  /**
   * Money. It does nothing at all in the field, in a fight or at the Outfitter:
   * its only use is across the Ferryman's counter (`../hub/trader`), which is
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
   * handful - the scrip is the one - where one square per unit would be absurd
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
    description: 'A glass valve pulled from a dead set. The Outfitter wants it for the radio mast.',
    effect: { type: 'material' },
  },
  'cable-coil': {
    id: 'cable-coil',
    displayName: 'Cable coil',
    category: ItemCategory.Misc,
    footprint: { width: 2, height: 2 },
    description: 'Copper cable, still good. The Outfitter wires the beacon and the bay with it.',
    effect: { type: 'material' },
  },
  'parts-crate': {
    id: 'parts-crate',
    displayName: 'Parts crate',
    category: ItemCategory.Misc,
    footprint: { width: 2, height: 2 },
    description: 'Hinges, bolts and hasps. The Outfitter builds the secure lockers out of them.',
    effect: { type: 'material' },
  },
  'lamp-oil': {
    id: 'lamp-oil',
    displayName: 'Lamp oil',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 2 },
    description: 'A sealed tin of lamp oil. The Outfitter burns it in the beacon and the ward.',
    effect: { type: 'material' },
  },
  'mooring-rope': {
    id: 'mooring-rope',
    displayName: 'Mooring rope',
    category: ItemCategory.Misc,
    footprint: { width: 2, height: 2 },
    description: 'Tarred rope off a ferry post. The Outfitter guys the mast and lashes the second locker with it.',
    effect: { type: 'material' },
  },
  'linen-roll': {
    id: 'linen-roll',
    displayName: 'Linen roll',
    category: ItemCategory.Misc,
    footprint: { width: 2, height: 1 },
    description: 'Clean linen for beds and bandages. The Outfitter fits the recovery bay and the ward with it.',
    effect: { type: 'material' },
  },
  /**
   * Money, and the whole of it. One item, one stack, a quantity - found in the
   * field, spent only at the Ferryman's counter.
   *
   * It is deliberately in the same pocket and under the same found-only rules
   * as a material rather than in a wallet of its own: a wallet is a number that
   * survives everything, and the captain's ruling is that money is loot. In the
   * pack it can be dropped by a wipe, protected by the secure slot, and - once
   * the grid pack lands - it will cost cells like anything else.
   */
  scrip: {
    id: 'scrip',
    displayName: 'Scrip',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    // A bundle to a square. Money has to cost room or it is a score with an
    // icon, and one square per note would be absurd - so it is counted in
    // bundles the size of the Ferryman's berth, which is the thing a player is
    // most often saving for. A raid that finds every note on the richest map
    // carries a square of them; one that hoards four raids' worth gives up a
    // fifth of its pack to do it.
    stackSize: 250,
    description: 'League notes, water-stained. The Ferryman still takes them; nobody else does.',
    effect: { type: 'currency' },
  },
  /**
   * The one thing in the pack that is neither a supply nor a material: it is
   * spent on a Pokemon rather than at base. It is rare field loot, it is used
   * from the raid's own Bag on a Pokemon standing beside you, and it is
   * destroyed with everything else on a wipe unless a secure slot is spent on
   * it.
   */
  'thunder-stone': {
    id: 'thunder-stone',
    displayName: 'Thunder Stone',
    category: ItemCategory.Misc,
    footprint: { width: 1, height: 1 },
    description: 'A stone with a thunderbolt in it. Some Pokemon answer to it.',
    effect: { type: 'evolution-stone' },
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
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

/**
 * The gear ids and the supply ids, derived from the catalogue rather than listed
 * beside it - a second list is a second answer waiting to disagree with this
 * one.
 *
 * `SupplyItemId` earns its keep immediately: the Outfitter's prices and the
 * standing board's payouts are typed with it, so neither can ever ask for or
 * hand out gear. Gear that a contract handed out on a loop would not be gear
 * worth protecting.
 */
export type HeldItemId = {
  [K in ItemId]: (typeof ITEMS)[K]['category'] extends typeof ItemCategory.Held ? K : never;
}[ItemId];

export type SupplyItemId = Exclude<ItemId, HeldItemId>;

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = Object.values(ITEMS);

/** Materials are the Other pocket: found in a raid, spent only at the Outfitter. */
export const MATERIAL_IDS: readonly SupplyItemId[] = ITEM_DEFINITIONS.filter(
  (item) => item.effect.type === 'material',
).map((item) => item.id as SupplyItemId);

/** Money. One item, one id, and the only thing the Ferryman's stock is priced in. */
export const CURRENCY_ITEM_ID = 'scrip';

/**
 * Everything that is found in a raid rather than packed for one: the materials
 * and the money.
 *
 * They share one rule, not two. Neither may be carried into a raid, because
 * neither does anything there; both arrive in the pack as loot; both are
 * destroyed with it on a wipe unless room was reserved for their *kind* in the
 * secure container, which is the only way squares can be set aside for
 * something that does not exist yet. Every
 * place that used to ask `isMaterial` for that reason asks this instead - and
 * `isMaterial` still means only "the Outfitter takes it", which is a different
 * question with a different answer.
 */
export const FOUND_ONLY_IDS: readonly SupplyItemId[] = ITEM_DEFINITIONS.filter(
  (item) => item.effect.type === 'material' || item.effect.type === 'currency',
).map((item) => item.id as SupplyItemId);

export function isMaterial(itemId: string): boolean {
  return getItemById(itemId)?.effect.type === 'material';
}

/**
 * An item's name for a quantity: "3 Potions", but "40 scrip".
 *
 * Money is a mass noun and every other item in the catalogue is a count noun,
 * so the rule is read off the item rather than guessed by the caller that is
 * printing it - the result screen said "Banked 40 Scrips" in a playtest, and
 * the same sentence is built in three places.
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

/** Money, by id. Nothing else in the catalogue answers to it. */
export function isCurrency(itemId: string): boolean {
  return getItemById(itemId)?.effect.type === 'currency';
}

/** Found in a raid, never packed for one: a material or money. */
export function isFoundOnly(itemId: string): boolean {
  const type = getItemById(itemId)?.effect.type;
  return type === 'material' || type === 'currency';
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
      return { used: false, message: `${item.displayName} is for the Outfitter, not the field.` };
    case 'currency':
      return { used: false, message: `${item.displayName} is only good at the Ferryman's counter.` };
    case 'evolution-stone': {
      const species = evolutionByStone(pokemon.base.id, item.id);
      const evolution = species ? pokemon.evolveInto(species) : null;
      return evolution
        ? { used: true, message: `${evolution.from.name} evolved into ${evolution.to.name}!` }
        : { used: false, message: `It will not have any effect.` };
    }
    case 'held':
      // Gear is never spent out of the bag. It is given to one Pokemon and
      // carried, which is what makes it something a raid can take away.
      return {
        used: false,
        message: `${item.displayName} is given to a Pokémon to hold.`,
      };
  }
}
