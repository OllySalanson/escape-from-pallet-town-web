import { heldItemEffect, heldItemName, type HeldItemEffect } from '../../items';
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

/** Life Orb: what the holder's damage is multiplied by. One for everything else. */
export function attackMultiplier(holder: GearHolder): number {
  const effect = gearEffect(holder);
  return effect?.type === 'power-at-a-price' ? effect.damageMultiplier : 1;
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
