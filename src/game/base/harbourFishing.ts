import type { GridPosition } from '../movement/gridMovement';
import type { WildEncounterTable } from '../pokemon/encounters';
import { rollEncounter } from '../world/wildEncounters';
import { getSpeciesById } from '../pokemon/species';
import { fishingTable, type RodItemId } from '../world/fishing';

/**
 * Fishing off THE HARBOUR's edges: something to do on the quay, and a reason
 * to walk to the end of the long pier.
 *
 * It is the raid's fishing (`world/fishing.ts`) - FireRed's own cast, its dots
 * and its coin - with the one thing the harbour is never allowed: a fight. The
 * harbour is safe by construction, so a bite is reeled in, named and let go,
 * and the only thing kept is the ANGLER's tally of the kinds a player has had
 * out of these waters (`raidProgress.harbourCatches`). Nothing is won and
 * nothing is spent: a cast costs no clock here, because there is none.
 *
 * The rod is the angler's, lent once he has been spoken to - or the player's
 * own, if Bill has traded them one. What bites is FireRed's Pallet Town water:
 * the Old Rod's Magikarp in the shallows along the quays, and out where it is
 * deep - off the end of the long pier and the breakwater - the Good Rod's
 * Horsea and Krabby as well, because that is where the bigger ones are.
 */

/** Water this far down the map is out in the harbour rather than along a quay's foot. */
export const DEEP_WATER_FROM_ROW = 24;

/** Whether a cast into `tile` is out in the deep water. */
export function isDeepWater(tile: GridPosition): boolean {
  return tile.y >= DEEP_WATER_FROM_ROW;
}

/** What bites where the line goes in: the Old Rod's table in the shallows, the Good Rod's out deep. */
export function harbourTable(tile: GridPosition): WildEncounterTable {
  const rod: RodItemId = isDeepWater(tile) ? 'good-rod' : 'old-rod';
  return fishingTable('sea', rod);
}

/** Every kind that can be had out of the harbour, by species id, in table order. */
export const HARBOUR_KINDS: readonly string[] = [
  ...new Set(
    [harbourTable({ x: 0, y: 0 }), harbourTable({ x: 0, y: DEEP_WATER_FROM_ROW })].flatMap((table) =>
      table.entries.map((entry) => entry.speciesId),
    ),
  ),
];

export interface HarbourBite {
  readonly speciesId: string;
  readonly name: string;
  readonly dexId: number;
  readonly level: number;
}

/** What is on the hook when something bites at `tile`. */
export function harbourBite(tile: GridPosition, rng: () => number = Math.random): HarbourBite | null {
  const wild = rollEncounter(harbourTable(tile), rng);
  const species = wild ? getSpeciesById(wild.speciesId) : undefined;
  if (!wild || !species) {
    return null;
  }
  return { speciesId: wild.speciesId, name: species.name.toUpperCase(), dexId: species.dexId, level: wild.level };
}

/** What is said once a bite is reeled in: what it was, that it went back, and whether the angler's book is the richer for it. */
export function reeledInLines(bite: HarbourBite, newKind: boolean, kindsCaught: number): readonly string[] {
  const lines = [`You reeled in a Lv. ${bite.level} ${bite.name}! It slips back into the harbour.`];
  if (newKind) {
    lines.push(
      kindsCaught >= HARBOUR_KINDS.length
        ? `A new one for the ANGLER's book - that's every kind there is in these waters!`
        : `A new one for the ANGLER's book. That's ${kindsCaught} of ${HARBOUR_KINDS.length}.`,
    );
  }
  return lines;
}

/** What the angler says, given whether he has lent his rod yet and how many kinds the book holds. */
export function anglerLines(lent: boolean, caught: readonly string[]): readonly string[] {
  if (!lent) {
    return [
      'Nothing out here but MAGIKARP. Hundreds of them.',
      'Here - borrow my rod. Face the water anywhere in the harbour and press SPACE to cast.',
      'Off the end of the long pier and out on the breakwater it\'s deep. That\'s where the good ones bite.',
    ];
  }
  if (caught.length === 0) {
    return ['Not had a bite yet? Try off the end of the long pier. It\'s deep out there.'];
  }
  if (caught.length >= HARBOUR_KINDS.length) {
    return [`${caught.join(', ')} - you've had every kind out of these waters. I'll make an angler of you yet.`];
  }
  return [
    `You've had ${caught.length} of ${HARBOUR_KINDS.length} kinds out of the harbour: ${caught.join(', ')}.`,
    'The deep water off the long pier and the breakwater has the rest.',
  ];
}
