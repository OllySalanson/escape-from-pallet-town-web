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
