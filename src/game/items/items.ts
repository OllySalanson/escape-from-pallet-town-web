import { evolutionByStone, type Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';

export const ItemCategory = {
  Medicine: 'medicine',
  PokeBall: 'pokeball',
  Misc: 'misc',
} as const;

export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

/** What a pocket is called on screen. The category values themselves are save-file slugs. */
export const ITEM_CATEGORY_LABELS: Readonly<Record<ItemCategory, string>> = {
  medicine: 'Medicine',
  pokeball: 'Poké Balls',
  misc: 'Other',
};

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
   * Evolves the Pokemon it is used on, if its line answers to this stone. The
   * stone is the item's own id rather than a field, because a second field
   * naming the same thing is a second answer waiting to disagree with the
   * first - `src/game/pokemon/evolution.ts` is the table both read.
   */
  | { readonly type: 'evolution-stone' };

export interface ItemDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly category: ItemCategory;
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
    description: 'Restores 20 HP.',
    effect: { type: 'heal', amount: 20 },
  },
  'super-potion': {
    id: 'super-potion',
    displayName: 'Super Potion',
    category: ItemCategory.Medicine,
    description: 'Restores 50 HP.',
    effect: { type: 'heal', amount: 50 },
  },
  antidote: {
    id: 'antidote',
    displayName: 'Antidote',
    category: ItemCategory.Medicine,
    description: 'Cures poison.',
    effect: { type: 'cure-status', status: PrimaryStatus.Poison },
  },
  'poke-ball': {
    id: 'poke-ball',
    displayName: 'Poké Ball',
    category: ItemCategory.PokeBall,
    description: 'A device for catching wild Pokemon.',
    effect: { type: 'capture-modifier', multiplier: 1 },
  },
  'great-ball': {
    id: 'great-ball',
    displayName: 'Great Ball',
    category: ItemCategory.PokeBall,
    description: 'A high-performance Ball with a better catch rate.',
    effect: { type: 'capture-modifier', multiplier: 1.5 },
  },
  'radio-valve': {
    id: 'radio-valve',
    displayName: 'Radio valve',
    category: ItemCategory.Misc,
    description: 'A glass valve pulled from a dead set. The Outfitter wants it for the radio mast.',
    effect: { type: 'material' },
  },
  'cable-coil': {
    id: 'cable-coil',
    displayName: 'Cable coil',
    category: ItemCategory.Misc,
    description: 'Copper cable, still good. The Outfitter wires the beacon and the bay with it.',
    effect: { type: 'material' },
  },
  'parts-crate': {
    id: 'parts-crate',
    displayName: 'Parts crate',
    category: ItemCategory.Misc,
    description: 'Hinges, bolts and hasps. The Outfitter builds the secure lockers out of them.',
    effect: { type: 'material' },
  },
  'lamp-oil': {
    id: 'lamp-oil',
    displayName: 'Lamp oil',
    category: ItemCategory.Misc,
    description: 'A sealed tin of lamp oil. The Outfitter burns it in the beacon and the ward.',
    effect: { type: 'material' },
  },
  'mooring-rope': {
    id: 'mooring-rope',
    displayName: 'Mooring rope',
    category: ItemCategory.Misc,
    description: 'Tarred rope off a ferry post. The Outfitter guys the mast and lashes the second locker with it.',
    effect: { type: 'material' },
  },
  'linen-roll': {
    id: 'linen-roll',
    displayName: 'Linen roll',
    category: ItemCategory.Misc,
    description: 'Clean linen for beds and bandages. The Outfitter fits the recovery bay and the ward with it.',
    effect: { type: 'material' },
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
    description: 'A stone with a thunderbolt in it. Some Pokemon answer to it.',
    effect: { type: 'evolution-stone' },
  },
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = Object.values(ITEMS);

/** Materials are the Other pocket: found in a raid, spent only at the Outfitter. */
export const MATERIAL_IDS: readonly ItemId[] = ITEM_DEFINITIONS.filter(
  (item) => item.effect.type === 'material',
).map((item) => item.id as ItemId);

/**
 * How much of one material a secure-slot stack protects. A material is found in
 * the raid rather than brought, so the slot cannot be sized by a loadout: it
 * names the kind, and whatever of that kind is still in the pack when a raid
 * is lost comes home. The pack caps it, never this number.
 */
export const SECURED_MATERIAL_QUANTITY = 99;

export function isMaterial(itemId: string): boolean {
  return getItemById(itemId)?.effect.type === 'material';
}

export function getItemById(id: string): ItemDefinition | undefined {
  return ITEMS[id as ItemId];
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
    case 'evolution-stone': {
      const species = evolutionByStone(pokemon.base.id, item.id);
      const evolution = species ? pokemon.evolveInto(species) : null;
      return evolution
        ? { used: true, message: `${evolution.from.name} evolved into ${evolution.to.name}!` }
        : { used: false, message: `It will not have any effect.` };
    }
  }
}
