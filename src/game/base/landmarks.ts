import type { GridPosition } from '../movement/gridMovement';
import type { BaseProp } from './fixtures';

/**
 * The harbour's own landmarks: what makes it a harbour rather than a yard with
 * water at the bottom of it, and what a player names when they describe it.
 *
 * A fixture (`fixtures.ts`) is something the player built and stands only once
 * its rung is paid for; a landmark is always here. Each is planted, captioned
 * by name as a door is, and read by facing it exactly as a fixture is - so an
 * `at` is a solid tile with walkable ground beside it (`baseMap.test.ts`).
 *
 * They are FireRed's own: the Seagallop ferry from the Sevii Islands, tied up
 * at the jetty a raid comes home to, because that is the boat a raid goes out
 * and comes back on; the S.S. Anne at the end of Vermilion's long pier, which
 * is the biggest thing in Kanto that floats and the reason a harbour is worth
 * walking down to; and a row of brick warehouses on the east quay, which is
 * what a working waterfront is made of.
 */
export interface HarbourLandmark {
  readonly id: string;
  /** What the caption over it says. */
  readonly name: string;
  /** The line under it, and what facing it says. */
  readonly note: string;
  /** What is planted, in drawing order. */
  readonly props: readonly BaseProp[];
  /** The tile of it the player faces to read it. */
  readonly at: GridPosition;
  /** The tiles its caption speaks from (`captionReveal.ts`); `at` when absent. */
  readonly near?: readonly GridPosition[];
  /**
   * A boat rides the swell (`floatingBoats.ts`): how long one rise and fall
   * takes under it, and whether it is the one a raid comes home on.
   */
  readonly floats?: { readonly swellMs: number; readonly bringsRaidsHome?: true };
}

export const HARBOUR_LANDMARKS: readonly HarbourLandmark[] = [
  {
    id: 'seagallop',
    name: 'THE SEAGALLOP',
    note: 'Every raid sails on her',
    // Tied up against the west side of the jetty, with her stern to the quay.
    props: [{ name: 'raidFerry', x: 7, y: 20 }],
    at: { x: 10, y: 21 },
    // Named from the jetty she is tied to, which is where a raid lands.
    near: [20, 21].flatMap((y) => [11, 12, 13, 14].map((x) => ({ x, y }))),
    floats: { swellMs: 1_900, bringsRaidsHome: true },
  },
  {
    id: 'ss-anne',
    name: 'S.S. ANNE',
    note: 'In from Vermilion, and staying',
    // At the end of the long pier, her bow against the walkway.
    props: [{ name: 'ssAnne', x: 31, y: 24 }],
    at: { x: 31, y: 26 },
    // Named the length of the walkway she lies along.
    near: [24, 25, 26, 27].flatMap((y) => [28, 29, 30].map((x) => ({ x, y }))),
    // A big ship rides a long, slow swell.
    floats: { swellMs: 3_700 },
  },
  {
    id: 'warehouses',
    name: 'THE WAREHOUSES',
    note: 'What the boats bring in waits here',
    props: [{ name: 'warehouses', x: 36, y: 17 }],
    at: { x: 44, y: 20 },
    // Named all along their front, which is where the quay is walked.
    near: Array.from({ length: 10 }, (_, index) => ({ x: 36 + index, y: 21 })),
  },
];
