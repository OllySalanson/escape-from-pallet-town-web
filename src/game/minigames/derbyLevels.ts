import type { CourseLeg, CoursePoint, DerbyLevel, DerbyLine, DerbyStretch, DerbySurface, WaveZone } from './derby';

/**
 * THE PROMENADE DERBY's levels, as data: each a course drawn on THE HARBOUR's
 * own tiles (`base/baseMap.ts`), the field it is run against, and how long the
 * race may go. The rules that read them are `derby.ts`; a new level is a row
 * here, and `derbyLevels.test.ts` holds every one to being finishable by every
 * kind and harder than the one before it.
 *
 * A course is a run of **stretches**. A stretch with one line is road everybody
 * runs; a stretch with two or more is a **fork**, and every line of a fork
 * starts where the stretch before it ended and ends where the next one starts.
 * A line is one or more **legs**, each on one surface - stone and boards are
 * `land`, the beach is `sand`, the bay is `water`, and a flyer's line is `air`
 * - and a leg marks its own **tight corners**, **crates** (hurdles) and the
 * stretches of breakwater **waves** break over, by index into its points.
 *
 * The levels grow out of each other, as the course at a real meeting does:
 *
 * 1. THE FRONT - along the front to PIER SQUARE, down the pier and home.
 * 2. THE SANDS - the front, then home along the beach to a finish on the
 *    west sand: sand (a Ground type's own going) and a crate on the pier and
 *    the stone, leapt at a sprint.
 * 3. THE BREAKWATER - the sands' course carried out along the breakwater and
 *    round its end, where the waves break over the stone.
 * 4. THE GRAND DERBY - a whole lap from the west sand and back: the green or
 *    the shore, crates down the front, the pier and the breakwater, against
 *    seven riders on their best.
 */

const at = (x: number, y: number): CoursePoint => ({ x, y });

interface LegMarks {
  readonly tight?: readonly number[];
  readonly hurdles?: readonly number[];
  readonly waves?: readonly WaveZone[];
}

const leg = (id: string, surface: DerbySurface, points: readonly CoursePoint[], marks: LegMarks = {}): CourseLeg => ({
  id,
  surface,
  points,
  tight: marks.tight ?? [],
  ...(marks.hurdles ? { hurdles: marks.hurdles } : {}),
  ...(marks.waves ? { waves: marks.waves } : {}),
});

const road = (id: string, ...legs: CourseLeg[]): DerbyStretch => ({ id, lines: [{ id, word: id, key: null, legs }] });

const line = (id: string, key: DerbyLine['key'], legs: readonly CourseLeg[], needs?: DerbyLine['needs'], word = id.toUpperCase()): DerbyLine => ({
  id,
  word,
  key,
  legs,
  ...(needs ? { needs } : {}),
});

// --- 1. THE FRONT ------------------------------------------------------------------

/** The start and finish of THE FRONT: one line across the stone, chequered under the DERBY's gantry. */
export const START_X = 64;

/** The pier's own line, down from PIER SQUARE on THE GAME CORNER's door. */
const PIER_X = 85;

const FRONT_OUT = leg('out', 'land', [at(START_X, 12), at(82, 12)]);
// Down through the pier's gate from the near side of the square: short, and a tight turn onto it.
const INSIDE = leg('inside', 'land', [at(82, 12), at(84, 12), at(84, 19), at(PIER_X, 20)], { tight: [1] });
// Out across the square and round under the arch in a sweep: longer, no tight turn.
const WIDE = leg('wide', 'land', [at(82, 12), at(87, 13), at(86, 16), at(PIER_X, 20)]);
const PIER = leg('pier', 'land', [at(PIER_X, 20), at(PIER_X, 27)]);
// Round the pier head and back: two tight turns, at the head and at the pier's foot.
const BACK = leg('back', 'land', [at(PIER_X, 27), at(86, 28), at(84, 28), at(PIER_X, 27), at(PIER_X, 13), at(START_X, 13)], { tight: [2, 4] });
// Off the head's landward edge and across the bay to the beach under THE DIG, between the rocks.
const HEAD_WEST = leg('head-west', 'land', [at(PIER_X, 27), at(83, 27)]);
const BAY_SWIM = leg('bay-swim', 'water', [at(83, 27), at(82, 26), at(77, 26), at(71, 25), at(70, 23)]);
// Out of the water up the sand - a scramble, and a tight one for a big swimmer - and up the steps.
const BAY_RUN = leg('bay-run', 'land', [at(70, 23), at(69, 22), at(69, 13), at(START_X, 13)], { tight: [1, 2] });
const AIR = leg('air', 'air', [at(PIER_X, 27), at(START_X, 13)]);

/** The first fork, at the pier's gate: the tight inside turn, or the wide sweep. */
const FIRST_FORK: DerbyStretch = { id: 'first', lines: [line('inside', 'down', [INSIDE]), line('wide', 'right', [WIDE])] };

export const THE_FRONT: DerbyLevel = {
  number: 1,
  id: 'the-front',
  name: 'THE FRONT',
  blurb: 'Along the stone, down the pier, round its head and home.',
  news: ['Sprint on the straights', 'ease off into the tight corners'],
  stretches: [
    road('out', FRONT_OUT),
    FIRST_FORK,
    road('pier', PIER),
    {
      id: 'second',
      lines: [line('pier', 'up', [BACK]), line('bay', 'left', [HEAD_WEST, BAY_SWIM, BAY_RUN], 'water'), line('air', 'right', [AIR], 'flying')],
    },
  ],
  start: { x: START_X, from: 12, to: 13 },
  finish: { x: START_X, from: 12, to: 13 },
  view: { x: 59, y: 11, width: 33, height: 21 },
  field: { rivals: 5, skill: 0, stages: 0 },
  longestMs: 60_000,
};

/**
 * THE FRONT as the race first shipped, on the front before the bay was laid out
 * (`docs/screens/promenade-bay/`): no longer run, and kept so the engine can be
 * held frame for frame to every race it ran (`derbyFront.fixture.json`).
 */
export const SHIPPED_FRONT: DerbyLevel = (() => {
  const out = leg('out', 'land', [at(64, 13), at(77, 13)]);
  const inside = leg('inside', 'land', [at(77, 13), at(80, 13), at(80, 20)], { tight: [1] });
  const wide = leg('wide', 'land', [at(77, 13), at(82, 13), at(82, 16), at(81, 18), at(80, 20)]);
  const pier = leg('pier', 'land', [at(80, 20), at(80, 28)]);
  const back = leg('back', 'land', [at(80, 28), at(81, 29), at(79, 29), at(80, 28), at(80, 14), at(64, 14)], { tight: [2, 4] });
  const swim = leg('bay-swim', 'water', [at(80, 28), at(77, 27), at(74, 25), at(73, 22)]);
  const run = leg('bay-run', 'land', [at(73, 22), at(73, 21), at(73, 14), at(64, 14)], { tight: [1, 2] });
  const air = leg('air', 'air', [at(80, 28), at(64, 14)]);
  return {
    ...THE_FRONT,
    stretches: [
      road('out', out),
      { id: 'first', lines: [line('inside', 'down', [inside]), line('wide', 'right', [wide])] },
      road('pier', pier),
      { id: 'second', lines: [line('pier', 'up', [back]), line('bay', 'left', [swim, run], 'water'), line('air', 'right', [air], 'flying')] },
    ],
    start: { x: 64, from: 13, to: 14 },
    finish: { x: 64, from: 13, to: 14 },
    view: { x: 59, y: 11, width: 28, height: 21 },
  };
})();

// --- what the later courses share ------------------------------------------------

/** The west beach's finish line, on the sand below THE GREEN. */
const WEST_LINE = { x: 55, from: 17, to: 19 } as const;

// The pier with a crate on it, at (85,24): leapt going down and again coming back.
const PIER_CRATE = leg('pier-crate', 'land', [at(PIER_X, 20), at(PIER_X, 24), at(PIER_X, 27)], { hurdles: [1] });

/**
 * The second fork from the pier head to the foot of THE GREEN at `x 60`, row
 * `end`: back up the pier and west along the stone past a second crate, off
 * the pier onto the beach and along the sand, across the bay for a swimmer
 * onto the breakwater's root, or over it all for a flyer.
 */
function homeFork(end: number): DerbyStretch {
  // Up the breakwater's root, or - on sand - up the beach beside it.
  const tail = end === 21 ? [at(60, 21)] : [at(60, 21), at(60, end)];
  const sandTail = end === 21 ? [at(60, 21)] : [at(61, 20), at(60, 19), at(60, end)];
  return {
    id: 'second',
    lines: [
      line('pier', 'up', [
        leg('home-pier', 'land', [at(PIER_X, 27), at(86, 28), at(84, 28), at(PIER_X, 27), at(PIER_X, 24), at(PIER_X, 13), at(72, 13), at(60, 13), at(60, end)], {
          tight: [2, 5, 7],
          hurdles: [4, 6],
        }),
      ]),
      line('sands', 'down', [
        leg('off-pier', 'land', [at(PIER_X, 27), at(86, 28), at(84, 28), at(PIER_X, 27), at(PIER_X, 24), at(PIER_X, 21), at(81, 21)], { tight: [2, 5], hurdles: [4] }),
        leg('the-sands', 'sand', [at(81, 21), at(80, 22), at(66, 22), at(63, 21), ...sandTail]),
      ]),
      line('bay', 'left', [HEAD_WEST, leg('bay-cross', 'water', [at(83, 27), at(82, 26), at(79, 26), at(70, 26), at(64, 25), at(62, 23), at(61, 22)]), leg('bay-climb', 'land', [at(61, 22), ...tail])], 'water'),
      line('air', 'right', [leg('air-home', 'air', [at(PIER_X, 27), at(60, end)])], 'flying'),
    ],
  };
}

/** Waves over the breakwater: the stem breaks every 4.6 seconds, the arm every 5.2, and each over both its lanes at once. */
const STEM_WAVES = { everyMs: 4600, offsetMs: 2600 } as const;
const ARM_WAVES = { everyMs: 5200, offsetMs: 4400 } as const;

/** Out along the breakwater from its root, the waves over its stem and its arm, and round its end in a hairpin. */
const MOLE_OUT: DerbyStretch = road(
  'mole-out',
  leg('mole-out', 'land', [at(60, 21), at(60, 24), at(60, 29), at(59, 30), at(56, 30), at(46, 30), at(41, 30), at(40, 30), at(40, 31), at(41, 31)], {
    tight: [3, 7, 8],
    waves: [
      { from: 1, to: 2, ...STEM_WAVES },
      { from: 4, to: 5, ...ARM_WAVES },
    ],
  }),
);

// Back along the breakwater's other lane: the same waves over it again.
const MOLE_BACK = leg('mole-back', 'land', [at(41, 31), at(46, 31), at(56, 31), at(59, 31), at(59, 29), at(59, 24), at(59, 21), at(59, 19), at(55, 18)], {
  tight: [3, 7],
  waves: [
    { from: 1, to: 2, ...ARM_WAVES },
    { from: 4, to: 5, ...STEM_WAVES },
  ],
});

/** From the breakwater's end home to the west line: back along the stone through the waves again, across the bay, or over it. */
const MOLE_HOME: DerbyStretch = {
  id: 'third',
  lines: [
    line('mole', 'up', [MOLE_BACK], undefined, 'STONE'),
    line('swim', 'left', [leg('mole-swim', 'water', [at(41, 31), at(45, 27), at(57, 24), at(57, 20)]), leg('mole-wade', 'sand', [at(57, 20), at(55, 18)])], 'water'),
    line('air', 'right', [leg('mole-air', 'air', [at(41, 31), at(55, 18)])], 'flying'),
  ],
};

// --- 2. THE SANDS ------------------------------------------------------------------

export const THE_SANDS: DerbyLevel = {
  number: 2,
  id: 'the-sands',
  name: 'THE SANDS',
  blurb: 'The front, then home along the beach to the west sand.',
  news: ['Sand slows all but a GROUND type', 'crates: sprint into one to leap it'],
  stretches: [
    road('out', FRONT_OUT),
    FIRST_FORK,
    road('pier', PIER_CRATE),
    homeFork(18),
    road('run-in', leg('run-in', 'sand', [at(60, 18), at(WEST_LINE.x, 18)])),
  ],
  start: { x: START_X, from: 12, to: 13 },
  finish: WEST_LINE,
  view: { x: 49, y: 11, width: 43, height: 21 },
  field: { rivals: 5, skill: 0.1, stages: 0 },
  longestMs: 75_000,
};

// --- 3. THE BREAKWATER -------------------------------------------------------------

export const THE_BREAKWATER: DerbyLevel = {
  number: 3,
  id: 'the-breakwater',
  name: 'THE BREAKWATER',
  blurb: 'The sands, then out along the breakwater and round its end.',
  news: ['Waves break over the breakwater', 'sprint through before one breaks'],
  stretches: [road('out', FRONT_OUT), FIRST_FORK, road('pier', PIER_CRATE), homeFork(21), MOLE_OUT, MOLE_HOME],
  start: { x: START_X, from: 12, to: 13 },
  finish: WEST_LINE,
  view: { x: 38, y: 11, width: 54, height: 23 },
  field: { rivals: 6, skill: 0.2, stages: 1 },
  longestMs: 100_000,
};

// --- 4. THE GRAND DERBY ------------------------------------------------------------

/** Off the west sand: up across THE GREEN with two turns, or along the shore, sand all the way to the stone. */
const START_FORK: DerbyStretch = {
  id: 'start',
  lines: [
    line('green', 'up', [leg('the-green', 'land', [at(55, 18), at(55, 16), at(59, 16), at(61, 12)], { tight: [1, 2] })]),
    line('shore', 'down', [leg('the-shore', 'sand', [at(55, 18), at(59, 18), at(60, 17)]), leg('shore-climb', 'land', [at(60, 17), at(60, 14), at(61, 12)])]),
  ],
};

export const THE_GRAND_DERBY: DerbyLevel = {
  number: 4,
  id: 'the-grand-derby',
  name: 'THE GRAND DERBY',
  blurb: 'A whole lap from the west sand: the front, the pier and the breakwater.',
  news: ['Crates down the front', 'seven riders on their best'],
  stretches: [
    START_FORK,
    road('front', leg('the-front', 'land', [at(61, 12), at(68, 12), at(74, 12), at(82, 12)], { hurdles: [1, 2] })),
    FIRST_FORK,
    road('pier', PIER_CRATE),
    homeFork(21),
    MOLE_OUT,
    MOLE_HOME,
  ],
  start: WEST_LINE,
  finish: WEST_LINE,
  view: { x: 38, y: 11, width: 54, height: 23 },
  field: { rivals: 7, skill: 0.3, stages: 2 },
  longestMs: 120_000,
};

/** Every level, in the order they open. */
export const DERBY_LEVELS: readonly DerbyLevel[] = [THE_FRONT, THE_SANDS, THE_BREAKWATER, THE_GRAND_DERBY];
