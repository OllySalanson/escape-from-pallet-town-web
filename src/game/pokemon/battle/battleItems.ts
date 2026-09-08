import { ItemCategory, useFieldItem, type Bag, type ItemDefinition } from '../../items';
import type { Pokemon } from '../Pokemon';
import type { BattleState } from './battleEngine';

/**
 * Spending a medicine out of the raid bag during a fight.
 *
 * The loadout step asks the player what to carry and what to risk, and a Potion
 * that can only be drunk by walking back out to the overworld bag is not really
 * an answer to the fight it was packed for - it is raid clock spent to undo
 * damage after the danger has passed. This is the other end of that decision:
 * the supplies are usable at the moment they matter, and the price is the turn
 * they take, which the Pokemon across the field spends hitting you.
 *
 * Two rules keep it from being free healing:
 *
 * - it costs a turn, charged by the caller resolving the enemy's turn straight
 *   after a successful use; and
 * - medicine cannot revive, exactly as at base (`../../hub/treatment`), which is
 *   what keeps `RECOVERY_REVIVE_MS` in `../../hub/recovery` meaningful and keeps
 *   a faint the worst thing that can happen in a fight.
 *
 * The effect itself is `useFieldItem`, so an item does the same thing in a
 * battle, in the field and at base. Only the wording is different, because the
 * battle log names Pokemon in capitals.
 */

/** Why a Potion is not the answer to a fainted Pokemon, in battle as at base. */
export const NO_REVIVE_IN_BATTLE_NOTE = 'Medicine cannot revive a fainted POKéMON!';

export interface BattleItemUse {
  /** The battle with the healed combatant in it, unchanged on a refusal. */
  readonly state: BattleState;
  /** True only when the item did something, which is when it is spent. */
  readonly used: boolean;
  readonly message: string;
}

/** Every medicine the raid bag is actually carrying, in item-list order. */
export function usableBattleItems(bag: Bag): readonly ItemDefinition[] {
  return bag.itemsInCategory(ItemCategory.Medicine);
}

/** How many medicines are in the bag, which is what the ITEM command counts. */
export function battleItemCount(bag: Bag): number {
  return usableBattleItems(bag).reduce((total, item) => total + bag.count(item.id), 0);
}

/**
 * Uses one medicine on one party Pokemon.
 *
 * The active Pokemon's HP and status live on the combatant rather than on the
 * Pokemon while a battle is running, so healing the one that is out has to go
 * through the state: the combatant is re-read from the Pokemon the item just
 * changed, and the Pokemon is squared with the combatant first so the heal can
 * never be computed from a stale number. A benched Pokemon has no combatant, so
 * for it the Pokemon is the whole truth and the state is returned untouched.
 */
export function applyBattleItem(
  state: BattleState,
  item: ItemDefinition,
  target: Pokemon,
): BattleItemUse {
  const name = target.base.name.toUpperCase();
  const isActive = target === state.player.pokemon;
  if (isActive) {
    target.currentHp = state.player.currentHp;
    target.primaryStatus = state.player.primaryStatus;
  }

  if (target.isFainted) {
    return { state, used: false, message: NO_REVIVE_IN_BATTLE_NOTE };
  }

  const healedFrom = target.currentHp;
  const curedOf = target.primaryStatus;
  const result = useFieldItem(item, target);
  if (!result.used) {
    return { state, used: false, message: refusalMessage(item, name) };
  }

  const restored = target.currentHp - healedFrom;
  return {
    state: isActive
      ? {
          ...state,
          player: {
            ...state.player,
            currentHp: target.currentHp,
            primaryStatus: target.primaryStatus,
          },
        }
      : state,
    used: true,
    message:
      restored > 0
        ? `${name} recovered ${restored} HP!`
        : `${name} was cured of ${curedOf ?? 'its condition'}!`,
  };
}

/**
 * Why nothing happened, said before the item is spent rather than after. A
 * refused use costs neither the item nor the turn.
 */
function refusalMessage(item: ItemDefinition, name: string): string {
  switch (item.effect.type) {
    case 'heal':
      return `${name} is already at full HP!`;
    case 'cure-status':
      return `It would not have any effect on ${name}.`;
    case 'capture-modifier':
      return `A ${item.displayName.toUpperCase()} is thrown with the BALL command.`;
  }
}
