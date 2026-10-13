/**
 * The Greystone Caves: five floors under the east of the vale, with three
 * mouths - high in Greystone Peaks, in the rock outcrop in Tanglewood, and in
 * the sea cliffs of Gull Strand - so a group can go in at one end of the vale
 * and come out at another (`plan.ts`).
 *
 * Each mouth opens onto a floor of its own, and the floors are stacked so the
 * only way between the mouths is down and up again: the peaks open onto the
 * top floor, the wood one floor down, the sea at the bottom. The two middle
 * floors are sealed (`caves.ts`): each is two halves joined only through the
 * floors above and below, which is what makes the stack a maze rather than a
 * staircase. Every floor is drawn the way the research's best caves were -
 * rooms of different sizes in a ragged rim, winding passages with loops,
 * boulder rows, sand drifts - and every third dead end hides something.
 *
 * The floors are built once, whichever districts are drawn, so a mouth added
 * later never moves a floor: the floors, the ladders and the wood's mouth ride
 * in Tanglewood's file; a district with a mouth plants a `cave-mouth` at the
 * foot of a rock face and adds `caveMouthLink(mouth, at)` to its links. Until
 * then that mouth's way out is a passage into the south wall of its floor that
 * goes nowhere yet.
 */
import { caveMaze, type CaveMaze } from '../../caves';
import { seeded, type Point } from '../../program';
import type { MapFileLink } from '../../../../src/game/world/mapFile';

export type CaveMouth = 'peaks' | 'wood' | 'sea';

/** Which floor each mouth opens onto: the peaks highest, the sea lowest. */
const MOUTH_FLOOR: Readonly<Record<CaveMouth, string>> = {
  peaks: 'greystone-caves-1f',
  wood: 'greystone-caves-b1f',
  sea: 'greystone-caves-b4f',
};

const FLOORS = [
  { id: 'greystone-caves-1f', name: 'Greystone Caves', width: 48, height: 40 },
  { id: 'greystone-caves-b1f', name: 'Greystone Caves B1F', width: 52, height: 42 },
  { id: 'greystone-caves-b2f', name: 'Greystone Caves B2F', width: 56, height: 44, seal: true },
  { id: 'greystone-caves-b3f', name: 'Greystone Caves B3F', width: 56, height: 44, seal: true },
  { id: 'greystone-caves-b4f', name: 'Greystone Caves B4F', width: 52, height: 40 },
] as const;

/**
 * Ladders, the floor above first: two between each pair of floors, landing on
 * alternate halves of a sealed one, and one long drop from the wood's floor
 * past the first sealed floor, so there is more than one way down.
 */
const LADDERS: readonly (readonly [string, string, number])[] = [
  ['greystone-caves-1f', 'greystone-caves-b1f', 2],
  ['greystone-caves-b1f', 'greystone-caves-b2f', 2],
  ['greystone-caves-b2f', 'greystone-caves-b3f', 2],
  ['greystone-caves-b3f', 'greystone-caves-b4f', 2],
  ['greystone-caves-b1f', 'greystone-caves-b3f', 1],
];

/** The outdoor tile each mouth link is written against; a district's own tiles. */
const STAND_IN: Point = [0, 0];

/** The whole cave: every floor, every ladder between them, and the hidden finds. */
export function greystoneCaves(): CaveMaze {
  return caveMaze({
    floors: FLOORS,
    ladders: LADDERS,
    mouths: (Object.keys(MOUTH_FLOOR) as CaveMouth[]).map((mouth) => ({
      at: STAND_IN,
      floor: MOUTH_FLOOR[mouth],
    })),
    random: seeded(1871),
    secretsEvery: 3,
  });
}

/** The ladders between floors: every link that has no outdoor end. */
export function caveLadders(cave: CaveMaze): MapFileLink[] {
  return cave.links.filter((link) => link.ends.every((end) => end.area !== undefined));
}

/**
 * The link from a cave mouth planted at `at` (a district's own tiles, as
 * `plantCaveMouth` takes it) to the way out of its floor.
 */
export function caveMouthLink(cave: CaveMaze, mouth: CaveMouth, at: Point): MapFileLink {
  const floor = MOUTH_FLOOR[mouth];
  const link = cave.links.find(
    (candidate) =>
      candidate.ends[0].area === undefined && candidate.ends[1].area === floor,
  );
  if (!link) throw new Error(`the cave has no way out onto ${floor}`);
  return { ends: [{ ...link.ends[0], x: at[0], y: at[1] + 1 }, link.ends[1]] };
}
