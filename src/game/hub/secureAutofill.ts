import {
  currentItemId,
  fitsInGrid,
  gridCells,
  isFoundOnly,
  stackSizeOf,
  type GridCargo,
  type GridSize,
  type ItemId,
} from '../items';

/**
 * What the secure container fills itself with, and what it remembers.
 *
 * The captain's ruling, 2026-09-19: "The secure slot should be auto-filled, and
 * if you remember your choices from last time, Pokemon should always be the
 * first thing to be auto-loaded, ordered by level."
 *
 * Three rules in his order of priority, and the order matters because they can
 * disagree:
 *
 * 1. **It fills itself.** The raid pack has packed itself since the grid
 *    arrived; a container the player has to remember to fill is a way to lose a
 *    Pokemon to forgetfulness rather than to a decision.
 * 2. **Pokemon go in first, highest level first.** This is the half that earns
 *    its keep: nobody should ever deploy with their best Pokemon unprotected
 *    because they did not open a screen. It outranks the remembered choice - a
 *    remembered Potion never keeps a higher-level Pokemon out.
 * 3. **Last raid is the starting point for the next**, so a player running raid
 *    after raid is not re-picking from scratch.
 *
 * It is a default and never a cage: the moment the player changes anything in
 * the container it is theirs, nothing refills it, and what they left in it is
 * what is remembered for next time. That is why `pokemon` is a flag rather than
 * a list of ids - a Pokemon is remembered as a *policy* ("lead with them"),
 * because the ids change every raid, while a supply is remembered as itself.
 */

/** One kind, and how many units of it the container held. */
export interface SecurePreferenceStack {
  readonly itemId: string;
  readonly quantity: number;
}

export interface SecurePreference {
  /** Whether the container leads with Pokemon, highest level first. */
  readonly pokemon: boolean;
  /** What else was in it last time, in the order it was chosen. */
  readonly items: readonly SecurePreferenceStack[];
}

/**
 * Lead with Pokemon and carry nothing else. It is what an untouched save gets
 * and what every save written before the container remembered anything reads
 * as, which is the right answer for both: the protection nobody chose is the
 * one that should have been chosen.
 */
export const DEFAULT_SECURE_PREFERENCE: SecurePreference = { pokemon: true, items: [] };

/** One Pokemon the container could lead with. */
export interface SecureCandidate {
  readonly id: string;
  readonly level: number;
  readonly cargo: GridCargo;
}

export interface SecureFill {
  readonly pokemonIds: readonly string[];
  readonly items: readonly SecurePreferenceStack[];
}

/**
 * What the container fills itself with, given this party and this preference.
 *
 * Pure, and it takes the cargo already built rather than a species id, so the
 * rule is testable without the evolution table and a container that turns a
 * Pokemon away can say exactly which squares it could not find.
 *
 * `heldQuantity` is what the loadout actually packed, because a supply can only
 * be protected if it is being carried; a found-only kind (a material, the
 * money) is never packed, so the container reserves room for it instead and its
 * only ceiling is the container.
 */
export function autofillSecureSlot(
  candidates: readonly SecureCandidate[],
  preference: SecurePreference,
  grid: GridSize,
  pokemonSlots: number,
  heldQuantity: (itemId: ItemId) => number,
): SecureFill {
  const pokemonIds: string[] = [];
  const cargo: GridCargo[] = [];
  if (preference.pokemon) {
    for (const candidate of [...candidates].sort(byLevelThenName)) {
      if (pokemonIds.length >= pokemonSlots) {
        break;
      }
      if (!fitsInGrid({}, grid, [...cargo, candidate.cargo])) {
        // Not a break: a Venusaur that will not go in must not keep a Pidgey
        // out behind it, and the list is sorted by level rather than by size.
        continue;
      }
      cargo.push(candidate.cargo);
      pokemonIds.push(candidate.id);
    }
  }

  const items: SecurePreferenceStack[] = [];
  const contents: Record<string, number> = {};
  for (const remembered of preference.items) {
    const step = stackSizeOf(remembered.itemId);
    const ceiling = isFoundOnly(remembered.itemId)
      ? gridCells(grid) * step
      : heldQuantity(remembered.itemId as ItemId);
    // Down a square at a time rather than refused outright: a container that
    // has grown a Pokemon since last raid should still keep the two Potions it
    // has room for out of the four it carried.
    let quantity = Math.min(remembered.quantity, ceiling);
    while (quantity > 0 && !fitsInGrid({ ...contents, [remembered.itemId]: quantity }, grid, cargo)) {
      quantity -= step;
    }
    if (quantity > 0) {
      contents[remembered.itemId] = quantity;
      items.push({ itemId: remembered.itemId, quantity });
    }
  }

  return { pokemonIds, items };
}

/** Highest level first, then by name and id so the same party fills the same way. */
function byLevelThenName(a: SecureCandidate, b: SecureCandidate): number {
  return b.level - a.level || a.cargo.name.localeCompare(b.cargo.name) || a.id.localeCompare(b.id);
}

/** A stored preference, read defensively; anything unrecognisable is the default. */
export function readSecurePreference(value: unknown): SecurePreference {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_SECURE_PREFERENCE;
  }
  const record = value as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items.flatMap((entry): SecurePreferenceStack[] => {
      if (typeof entry !== 'object' || entry === null) {
        return [];
      }
      const stack = entry as Record<string, unknown>;
      return typeof stack.itemId === 'string' &&
        typeof stack.quantity === 'number' &&
        Number.isSafeInteger(stack.quantity) &&
        stack.quantity > 0
        ? [{ itemId: currentItemId(stack.itemId), quantity: stack.quantity }]
        : [];
    })
    : [];
  return { pokemon: record.pokemon !== false, items };
}
