import { ITEM_DEFINITIONS, ItemCategory, useFieldItem, type ItemDefinition } from '../items';
import type { Pokemon } from '../pokemon';
import type { Stash, StashedPokemon } from '../stash';

/**
 * Treating a hurt Pokemon at base with a medicine out of the stash.
 *
 * This is the other half of making raid damage real. Damage that survives a
 * raid has to be answerable before the next one, and the recovery bay's price -
 * raid time - is not always the price a player wants to pay. A Potion is the
 * alternative, and its cost is itself: a Potion spent at base is a Potion that
 * is not in the bag when a fight goes wrong. That is a real trade rather than
 * free healing, and it adds no currency, shop or stock of any kind.
 *
 * The two systems stay distinct because only one of them can revive. A Potion
 * heals; it cannot bring a fainted Pokemon back, which is what keeps
 * `RECOVERY_REVIVE_MS` in `./recovery` meaningful and keeps a faint the worst
 * outcome of a fight. There is no Revive item in the game, so nothing in the
 * stash should be able to act as one.
 *
 * Everything here is a pure function over the stash so the wording and the
 * arithmetic are testable without Phaser; `HubScene` only renders it.
 */

/** Why the recovery bay, not an item, is the answer for a fainted Pokemon. */
export const FAINTED_TREATMENT_NOTE =
  'Fainted. Medicine cannot revive - only the recovery bay can, for raid time.';

/** One medicine in the stash, described against one Pokemon before it is used. */
export interface TreatmentOption {
  readonly itemId: string;
  readonly displayName: string;
  /** How many the stash holds, so spending one is visibly spending one. */
  readonly held: number;
  /** Exactly what this item would do to this Pokemon, in one short phrase. */
  readonly effect: string;
  readonly usable: boolean;
}

export interface TreatmentResult {
  readonly used: boolean;
  readonly message: string;
}

/** Whether an item could ever be used on a Pokemon outside a battle. */
function isMedicine(item: ItemDefinition): boolean {
  return item.category === ItemCategory.Medicine;
}

/**
 * Every medicine the stash holds, described against this Pokemon.
 *
 * Options are listed even when they would do nothing, with the reason in their
 * effect line, so the player can see why a Potion is greyed out rather than
 * spending one to find out.
 */
export function treatmentOptions(stash: Stash, pokemon: Pokemon): readonly TreatmentOption[] {
  return ITEM_DEFINITIONS.filter(isMedicine)
    .filter((item) => stash.itemCount(item.id) > 0)
    .map((item) => ({
      itemId: item.id,
      displayName: item.displayName,
      held: stash.itemCount(item.id),
      ...describeEffect(item, pokemon),
    }));
}

function describeEffect(
  item: ItemDefinition,
  pokemon: Pokemon,
): { readonly effect: string; readonly usable: boolean } {
  if (pokemon.isFainted) {
    return { effect: 'Cannot be used on a fainted Pokémon', usable: false };
  }

  switch (item.effect.type) {
    case 'heal': {
      const restored = Math.min(item.effect.amount, pokemon.maxHp - pokemon.currentHp);
      return restored > 0
        ? {
          effect: `Restores ${restored} HP · ${pokemon.currentHp}/${pokemon.maxHp} → ${
            pokemon.currentHp + restored
          }/${pokemon.maxHp}`,
          usable: true,
        }
        : { effect: 'Already at full HP', usable: false };
    }
    case 'cure-status':
      return pokemon.primaryStatus === item.effect.status
        ? { effect: `Cures ${item.effect.status}`, usable: true }
        : { effect: `Nothing to cure`, usable: false };
    case 'capture-modifier':
      return { effect: 'Battle use only', usable: false };
  }
}

/**
 * Spends one medicine out of the stash on a stashed Pokemon.
 *
 * The item leaves the vault only when it actually did something, so a refused
 * treatment costs nothing and a successful one costs exactly one item. Nothing
 * is ever created: this only moves HP up and one item count down.
 */
export function treatWithItem(stash: Stash, pokemonId: string, itemId: string): TreatmentResult {
  const stored: StashedPokemon | undefined = stash
    .listPokemon()
    .find((entry) => entry.id === pokemonId);
  if (!stored) {
    return { used: false, message: 'That Pokémon is not at base.' };
  }
  if (stash.itemCount(itemId) <= 0) {
    return { used: false, message: 'There are none of those left at base.' };
  }

  const item = ITEM_DEFINITIONS.find((definition) => definition.id === itemId);
  if (!item || !isMedicine(item)) {
    return { used: false, message: 'That is not something you can treat with.' };
  }
  if (stored.pokemon.isFainted) {
    return { used: false, message: FAINTED_TREATMENT_NOTE };
  }

  const result = useFieldItem(item, stored.pokemon);
  if (!result.used) {
    return result;
  }

  stash.removeItem(itemId, 1);
  const remaining = stash.itemCount(itemId);
  return {
    used: true,
    message: `${result.message} ${
      remaining === 0 ? `No ${item.displayName} left at base.` : `${remaining} ${item.displayName}${remaining === 1 ? '' : 's'} left at base.`
    }`,
  };
}
