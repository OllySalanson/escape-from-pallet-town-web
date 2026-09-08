import type { BagContents } from '../items';
import type { RaidCondition, RaidSettlement, StashItemChange } from '../stash';
import type { ItemStack, RunSnapshot } from './RunManager';

/**
 * What a finished raid owes the vault, derived once for every way a raid can
 * end.
 *
 * A raid is played on the stash's own Pokemon objects and on a Bag copied from
 * its supplies, but every write-back path reloads the vault from storage before
 * it changes anything - so without this the whole raid was free: damage healed
 * itself, status wore off and drunk Potions came back. That made wiping the
 * cheapest way to fix a worn party, which inverts a loop built on banking what
 * you earn.
 *
 * Everything here is derived from the run snapshot and the bag as it stood at
 * the end, so the three endings settle identically and none of them can invent
 * a number of its own.
 */

/**
 * The state each deployed Pokemon came out of the raid in, addressed by stash
 * ID.
 *
 * A Pokemon that merely ends a raid hurt comes home hurt; one that fainted
 * comes home fainted rather than deleted, because deleting deployed Pokemon is
 * the wipe's job and doing it here would charge a faint twice. Reviving is then
 * the recovery bay's premium (`../hub/recovery`), which is exactly the price a
 * faint is supposed to carry.
 *
 * Experience travels the same way, and for the same reason: a raid is played on
 * the stash's own Pokemon, so a win in the field is real until the vault is
 * reloaded over it. Carrying it here is what lets a starter ever reach the
 * level-7 typed move the early curve is built around - without it the level
 * every threat in the game is priced against was unreachable by construction.
 * It is carried on every ending, including a lost one: a wipe already deletes
 * the Pokemon it took, so the only body left for it to come home to is the one
 * the secure slot protected, and a secure slot that returned a demoted Pokemon
 * would be punishment where the game promised protection.
 *
 * `broughtPokemonIds` and the run loadout's party are the same deployment in
 * the same order - `HubScene.startRun()` builds both from one list - so they are
 * paired by position, and a party the ids cannot account for is left alone
 * rather than guessed at.
 */
export function deployedRaidCondition(
  broughtPokemonIds: readonly string[],
  snapshot: RunSnapshot,
): readonly RaidCondition[] {
  const party = snapshot.loadout?.party ?? [];
  return broughtPokemonIds
    .slice(0, party.length)
    .map((id, index) => ({
      id,
      currentHp: party[index].currentHp,
      primaryStatus: party[index].primaryStatus,
      experience: party[index].experience,
    }));
}

/**
 * The signed supply delta of a raid: the bag carried out, minus the supplies
 * carried in.
 *
 * Loot found in the field is already in that bag, so it arrives as a positive
 * entry and never needs banking twice; supplies spent arrive as negative ones.
 * Reading the difference rather than counting uses means anything that can
 * change the bag mid-raid is accounted for without this having to know it
 * happened.
 */
export function raidSupplyDelta(
  snapshot: RunSnapshot,
  carriedOut: BagContents,
): readonly StashItemChange[] {
  const brought = new Map<string, number>();
  for (const { itemId, quantity } of snapshot.loadout?.items ?? ([] as readonly ItemStack[])) {
    brought.set(itemId, (brought.get(itemId) ?? 0) + quantity);
  }

  const delta: StashItemChange[] = [];
  for (const itemId of new Set([...brought.keys(), ...Object.keys(carriedOut)])) {
    const quantity = (carriedOut[itemId] ?? 0) - (brought.get(itemId) ?? 0);
    if (quantity !== 0) {
      delta.push({ itemId, quantity });
    }
  }
  return delta;
}

/** Both halves of a settlement, for the endings that keep what they carried. */
export function buildRaidSettlement(
  broughtPokemonIds: readonly string[],
  snapshot: RunSnapshot,
  carriedOut: BagContents,
): RaidSettlement {
  return {
    condition: deployedRaidCondition(broughtPokemonIds, snapshot),
    supplies: raidSupplyDelta(snapshot, carriedOut),
  };
}

/**
 * How a lost raid's supplies divide, with nothing counted twice.
 *
 * A wipe used to settle supplies without ever looking in the pack, and that
 * one blind spot produced two separate untruths. The stash handed back every
 * secured stack whether or not the raid had drunk it, so securing a Potion and
 * drinking it made the heal free - and wiping the cheapest way to fix a worn
 * party, which is the loop inverted. And the result screen listed the whole
 * loadout under "Gone for good" while the panel beside it listed part of that
 * same loadout again under "Supplies spent", so two Potions read as four.
 *
 * The pack at the end is what separates the two: what is still in it was either
 * protected or destroyed, and what is missing from it was spent. The three add
 * back up to everything the raid held.
 */
export interface WipeSettlement {
  /** Secured supplies still in the pack, and so the only ones the stash keeps. */
  readonly securedItems: readonly StashItemChange[];
  /** What was still on the player when the raid was lost, and is now gone. */
  readonly destroyedItems: readonly StashItemChange[];
}

/**
 * The secured stacks that survived the raid.
 *
 * Spending is charged against unprotected stock first, which is both the
 * generous reading and the honest one: supplies are fungible, so a player who
 * carried three Potions and protected two of them drank the loose one.
 *
 * Shared with the result screen so the secure-slot panel names exactly what the
 * stash is about to receive; two derivations of one rule is how they drift.
 */
export function survivingSecureItems(
  secured: readonly StashItemChange[],
  carriedOut: BagContents,
): readonly StashItemChange[] {
  const held = new Map<string, number>();
  for (const { itemId, quantity } of secured) {
    held.set(itemId, (held.get(itemId) ?? 0) + quantity);
  }
  return [...held]
    .map(([itemId, quantity]) => ({ itemId, quantity: Math.min(quantity, carriedOut[itemId] ?? 0) }))
    .filter(({ quantity }) => quantity > 0);
}

/** Both halves of a lost raid's supply accounting, from the pack it went down with. */
export function buildWipeSettlement(
  secured: readonly StashItemChange[],
  carriedOut: BagContents,
): WipeSettlement {
  const securedItems = survivingSecureItems(secured, carriedOut);
  const kept = new Map(securedItems.map(({ itemId, quantity }) => [itemId, quantity]));
  const destroyedItems = Object.entries(carriedOut)
    .map(([itemId, quantity]) => ({ itemId, quantity: quantity - (kept.get(itemId) ?? 0) }))
    .filter(({ quantity }) => quantity > 0);
  return { securedItems, destroyedItems };
}
