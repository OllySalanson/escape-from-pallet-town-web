import { heldItemEffect, heldItemName, type HeldItemEffect } from '../../items';
import type { PokemonType } from '../PokemonType';
import type { PrimaryStatus } from './status';
import type { RandomSource } from './damage';

/**
 * What a piece of gear does in a fight, in one place.
 *
 * The engine asks these questions and nothing else: it never switches on an item
 * id and never reads the catalogue directly, so adding a fifth piece of gear is a
 * row in `../../items/items.ts` plus one function here. Every one of them is pure
 * and takes the holder's numbers rather than a Pokemon, which is what lets
 * `heldItems.test.ts` hold the rules without a battle.
 *
 * Where the item lives is the one decision worth writing down. The *identity* of
 * the gear is read straight through to the Pokemon (`Pokemon.heldItemId`), never
 * copied onto the `BattleCombatant`: a combatant is a snapshot taken when its
 * Pokemon was sent out, and a snapshot that drifts from the live Pokemon is the
 * whole class of bug `refreshCombatantAfterLevelUp` exists to undo. What the
 * combatant owns instead is the one thing that belongs to the fight rather than
 * to the Pokemon - whether a Focus Band has already been spent this battle -
 * exactly as it owns PP, sleep turns and stat stages.
 */

/** A holder, as every rule below reads one. */
export interface GearHolder {
  readonly heldItemId: string | null;
  readonly maxHp: number;
}

export function gearEffect(holder: GearHolder): HeldItemEffect | undefined {
  return heldItemEffect(holder.heldItemId);
}

/** The gear's name in capitals, as the battle log names everything. */
export function gearLabel(heldItemId: string | null): string {
  return (heldItemName(heldItemId) ?? '').toUpperCase();
}

/**
 * Leftovers: the HP the holder gets back at the end of its own turn.
 *
 * Charged at the same point burn and poison are charged, which is what makes it
 * read as their mirror: a share of maximum HP, at least one so the smallest
 * Pokemon still sees it happen, and zero for a holder that is already full or
 * carrying something else.
 */
export function endOfTurnHeal(holder: GearHolder, currentHp: number): number {
  const effect = gearEffect(holder);
  if (effect?.type !== 'end-of-turn-heal' || currentHp <= 0 || currentHp >= holder.maxHp) {
    return 0;
  }
  return Math.min(
    holder.maxHp - currentHp,
    Math.max(1, Math.floor(holder.maxHp / effect.maxHpFraction)),
  );
}

/**
 * Focus Band: whether this blow is the one it takes for the holder.
 *
 * It only ever answers yes to a hit that would knock the holder out, from above
 * 1 HP, and only while the band has not already been spent this battle - so it
 * is a save, never a wall, and a Pokemon walked into a fight on 1 HP is not
 * quietly immortal.
 */
export function survivesKnockout(
  holder: GearHolder,
  currentHp: number,
  damage: number,
  alreadySpent: boolean,
): boolean {
  return (
    gearEffect(holder)?.type === 'survive-one-ko' &&
    !alreadySpent &&
    currentHp > 1 &&
    damage >= currentHp
  );
}

/**
 * What the holder's damage is multiplied by: a Life Orb's on every hit, and a
 * Miracle Seed's (and its kind's) on a move of its type - FireRed raises the
 * attacking stat by the item's percent, which is the same multiplier on the
 * damage. One for everything else.
 */
export function attackMultiplier(holder: GearHolder, moveType?: PokemonType): number {
  const effect = gearEffect(holder);
  if (effect?.type === 'power-at-a-price') {
    return effect.damageMultiplier;
  }
  if (effect?.type === 'type-power' && moveType === effect.moveType) {
    return (100 + effect.powerPercent) / 100;
  }
  return 1;
}

/**
 * Life Orb: what landing that hit costs the holder.
 *
 * Paid on every hit that actually did damage, and it can take the holder down -
 * that is the price, and the description says it out loud. At early levels the
 * tenth is two HP, so it only ever finishes a Pokemon that was already down to
 * the last of it.
 */
export function attackRecoil(holder: GearHolder, damageDealt: number): number {
  const effect = gearEffect(holder);
  if (effect?.type !== 'power-at-a-price' || damageDealt <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor(holder.maxHp / effect.recoilMaxHpFraction));
}

/**
 * Quick Claw: whether the holder goes first this turn whatever the Speed says.
 *
 * Rolled once per holder per turn, and both sides can win it - if they both do,
 * the faster of the two goes first, which is the ordinary rule applied to a
 * smaller field.
 */
export function rollsFirstStrike(holder: GearHolder, random: RandomSource): boolean {
  const effect = gearEffect(holder);
  return effect?.type === 'first-strike' && Math.min(0.999999, Math.max(0, random())) < effect.chance;
}

/**
 * When a held berry is asked whether it is wanted - FireRed's two calls of
 * `ItemBattleEffects` that a berry answers (pret/pokefirered `battle_util.c`):
 *
 * - `after-move` is `ITEMEFFECT_MOVE_END`, asked of every battler on the
 *   field at the end of every move (`Cmd_moveend`'s `MOVEEND_ITEM_EFFECTS_ALL`).
 *   Only the status berries answer it, which is what lets a Chesto Berry wake
 *   its holder before the turn it was put to sleep for ever comes round.
 * - `end-of-turn` is `ITEMEFFECT_NORMAL` at `ENDTURN_ITEMS1`, after the
 *   ability and before Leech Seed and poison. The status berries answer it
 *   again, and it is the only time an HP berry is eaten: at half the holder's
 *   maximum HP or less (`hp <= maxHP / 2`, whole numbers), for its own HP and
 *   never past the maximum.
 */
export type BerryMoment = 'after-move' | 'end-of-turn';

/** What eating a held berry did. */
export type BerryBite =
  | { readonly kind: 'cure'; readonly status: PrimaryStatus }
  | { readonly kind: 'heal'; readonly amount: number };

/**
 * Whether the holder eats its berry now, and what it does if it does.
 *
 * Nothing for a holder that has fainted (FireRed asks `gBattleMons[].hp`
 * first), for one holding no berry, and for a berry with nothing to do: a
 * Cheri Berry on a Pokemon that is not paralysed stays in its hand.
 */
export function berryBite(
  holder: GearHolder,
  currentHp: number,
  status: PrimaryStatus | null,
  moment: BerryMoment,
): BerryBite | undefined {
  if (currentHp <= 0) {
    return undefined;
  }
  const effect = gearEffect(holder);
  if (effect?.type === 'berry-cure') {
    return status === effect.status ? { kind: 'cure', status } : undefined;
  }
  if (effect?.type === 'berry-heal' && moment === 'end-of-turn') {
    if (currentHp > Math.floor(holder.maxHp / 2)) {
      return undefined;
    }
    const amount = Math.min(effect.amount, holder.maxHp - currentHp);
    return amount > 0 ? { kind: 'heal', amount } : undefined;
  }
  return undefined;
}
