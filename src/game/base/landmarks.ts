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
 * walking down to; and a row of brick warehouses on the quay front, which is
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
   * Every tile of it that answers when faced, `at` among them; `at` alone when
   * absent. A board three tiles wide answers from under either post as well as
   * the middle (playtest 51, finding 8).
   */
  readonly faced?: readonly GridPosition[];
  /**
   * A boat rides the swell (`floatingBoats.ts`): how long one rise and fall
   * takes under it, and whether it is the one a raid comes home on.
   */
  readonly floats?: { readonly swellMs: number; readonly bringsRaidsHome?: true };
}

const LANDMARKS: readonly HarbourLandmark[] = [
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
    props: [{ name: 'ssAnne', x: 30, y: 24 }],
    at: { x: 30, y: 26 },
    // Named the length of the walkway she lies along.
    near: [24, 25, 26, 27].flatMap((y) => [27, 28, 29].map((x) => ({ x, y }))),
    // A big ship rides a long, slow swell.
    floats: { swellMs: 3_700 },
  },
  {
    id: 'warehouses',
    name: 'THE WAREHOUSES',
    note: 'What the boats bring in waits here',
    // On the quay front's building line, their roofs backing onto KEEPERS'
    // ROW and their west gable closing HARBOUR SQUARE: the quay along their
    // front is three tiles deep, the row against the wall the fish stall's
    // and the two along the water the way to THE COVE. They stood two rows
    // nearer the water, with a lawn nobody walked behind them.
    props: [{ name: 'warehouses', x: 36, y: 14 }],
    // Read at their west door: the stall and its gear stand along the rest.
    at: { x: 37, y: 17 },
    // Named all along their front, which is where the quay is walked.
    near: Array.from({ length: 10 }, (_, index) => ({ x: 36 + index, y: 19 })),
  },
  // THE PROMENADE's east end: THE FIELD-MOVE COURSE's gate, COURSE painted
  // over it with the four field moves it asks for, and the chalk board its
  // times are kept on (`minigames/fieldCourse.ts`). Facing either runs or
  // reads the course rather than saying the note (`BaseScene`).
  {
    id: 'field-course',
    name: 'FIELD-MOVE COURSE',
    note: 'CUT, SMASH, PUSH and SURF it',
    props: [{ name: 'courseGate', x: 84, y: 7 }],
    at: { x: 85, y: 9 },
    near: [83, 84, 85, 86].map((x) => ({ x, y: 10 })),
  },
  {
    id: 'time-board',
    name: 'TIME BOARD',
    note: "The course's best times",
    // Flush with the gate's top, so no lawn is left shut in behind it.
    props: [{ name: 'timeBoard', x: 83, y: 7 }],
    at: { x: 83, y: 8 },
    near: [
      { x: 82, y: 9 },
      { x: 83, y: 9 },
    ],
  },
];


/**
 * THE PROMENADE's three outdoor games, each a landmark whose board says what
 * it is (`scripts/draw-promenade.mjs`): facing it plays it rather than saying
 * the note (`BaseScene`, `OUTDOOR_GAME_SPOTS`).
 */
export const OUTDOOR_GAME_LANDMARKS: readonly HarbourLandmark[] = [
  {
    // Over the race's start and finish line, where THE GREEN meets the stone.
    id: 'derby',
    name: 'PROMENADE DERBY',
    note: 'Six run the front: pier, bay or sky',
    props: [{ name: 'derbyBoard', x: 61, y: 9 }],
    at: { x: 62, y: 11 },
    near: [61, 62, 63].map((x) => ({ x, y: 12 })),
    faced: [61, 62, 63].map((x) => ({ x, y: 11 })),
  },
  {
    // On the sand in front of the blue and green huts, beside the first steps
    // down from the boardwalk rather than at their foot.
    id: 'dig',
    name: 'THE DIG',
    note: 'Ten digs: what is buried is yours',
    props: [{ name: 'digSign', x: 68, y: 19 }],
    at: { x: 68, y: 19 },
    near: [{ x: 67, y: 19 }, { x: 67, y: 20 }, { x: 68, y: 21 }, { x: 69, y: 21 }],
    faced: [68, 69].flatMap((x) => [{ x, y: 19 }, { x, y: 20 }]),
  },
  {
    // At the pier head, where the deep water is.
    id: 'fishing-derby',
    name: 'FISHING DERBY',
    note: 'Two minutes off the deep end',
    props: [{ name: 'fishingBoard', x: 76, y: 28 }],
    at: { x: 77, y: 29 },
    near: [78, 79].flatMap((x) => [{ x, y: 28 }, { x, y: 29 }]),
    faced: [76, 77].flatMap((x) => [{ x, y: 28 }, { x, y: 29 }]),
  },
];

/** Which outdoor game a faced tile plays: its landmark's tiles, from in front. */
export type OutdoorGameId = 'derby' | 'dig' | 'fishing-derby';

/** The gate's front tiles: facing any of them from below runs the course. */
export const COURSE_GATE_FRONT: readonly GridPosition[] = [84, 85, 86].map((x) => ({ x, y: 9 }));

/** Whether facing `tile` is facing the landmark: any tile of it that answers. */
export function landmarkFaced(landmark: HarbourLandmark, tile: GridPosition): boolean {
  return (landmark.faced ?? [landmark.at]).some((each) => each.x === tile.x && each.y === tile.y);
}

/** Every landmark the harbour stands, the outdoor games' among them. */
export const HARBOUR_LANDMARKS: readonly HarbourLandmark[] = [...LANDMARKS, ...OUTDOOR_GAME_LANDMARKS];
