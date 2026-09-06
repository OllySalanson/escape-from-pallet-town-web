import type { Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';

export const ItemCategory = {
  Medicine: 'medicine',
  PokeBall: 'pokeball',
  Misc: 'misc',
} as const;

export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

export type ItemEffect =
  | { readonly type: 'heal'; readonly amount: number }
  | { readonly type: 'cure-status'; readonly status: PrimaryStatus }
  | { readonly type: 'capture-modifier'; readonly multiplier: number };

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
    displayName: 'Poke Ball',
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
} as const satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEMS;

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = Object.values(ITEMS);

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
  }
}
