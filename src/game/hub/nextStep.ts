import { buildContractBoard } from './contractBoard';
import { mayAskAFavour, type ErrandProgress } from './errands';
import { isFirstRaid } from './firstRaid';
import { NEAR_JOBS, type StandingBoardProgress } from '../objectives/standingBoard';
import { availableInsertionIds, frontDoorFor, RUN_INSERTIONS, type RunInsertion } from '../run/runGeneration';
import { isMapOffered } from '../world/mapRoster';
import { isLandingOpen, nextGym } from '../world/valeQuarters';
import { CHART_PIECES, huntStage, MARLOW, NO_TREASURE_HUNT, TREASURE_GOAL, TREASURE_PLACE, type TreasureHunt } from '../treasure/treasureMap';

/**
 * The one next thing, as Professor Oak says it.
 *
 * The overnight critic came home from a first raid to four keepers each asking
 * a favour, a job on the rim, a cash stake, a gym arrow, two rumours and a
 * shop's loyalty points, and Oak read the whole of his cork board aloud after
 * every word (problems 8 and 9, 25 Nov 2026). Nothing said which of it came
 * first. This does: one thing at a time, in the order a newcomer meets the
 * game - a job, then a second, then the wider vale and a landing to walk to,
 * then the next gym - and Oak says it instead of reading the board, which is
 * still read in full off the wall beside him.
 *
 * Read off the save, so nothing is stored; Phaser-free, so `nextStep.test.ts`
 * holds the order.
 */
export type NextStepProgress = StandingBoardProgress & ErrandProgress & {
  readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>>;
  readonly defeatedBosses: readonly string[];
  readonly reachedInsertions: readonly string[];
  readonly unlockedInsertions: readonly string[];
  readonly openedGates?: readonly string[];
  readonly treasureHunt?: TreasureHunt;
  readonly pokedexOwned?: readonly number[];
};

/**
 * The vale's five legends, in the order Oak names them once the gyms are
 * done: the three birds, then Mew, then Mewtwo at the bottom of the Bunker,
 * the highest of them. Where each stands is the stitched map's own (`pokemon`
 * marked `legendary` in `world/maps/greystoneVale.json`), said in the words its
 * districts use; `nextStep.test.ts` holds that every one is on the map.
 */
export const VALE_LEGENDS: readonly { readonly name: string; readonly dexId: number; readonly speciesId: string; readonly where: string }[] = [
  { name: 'ZAPDOS', dexId: 145, speciesId: 'zapdos', where: 'sleeps in the TURBINE HALL under the POWER STATION' },
  { name: 'ARTICUNO', dexId: 144, speciesId: 'articuno', where: 'roosts on THE FROZEN LAGOON, out on FROSTREEF' },
  { name: 'MOLTRES', dexId: 146, speciesId: 'moltres', where: 'nests in THE CRATER on EMBER ISLE' },
  { name: 'MEW', dexId: 151, speciesId: 'mew', where: 'has been seen at THE CAIRN on top of STORMCROWN' },
  { name: 'MEWTWO', dexId: 150, speciesId: 'mewtwo', where: 'waits four floors down THE BUNKER' },
];

/**
 * The named thing to chase once both gyms are beaten (the overnight critic's
 * problem 17, 25 Nov 2026: "After both badges the game has nothing to say", and
 * the arrow turned round to point at ₽75). First the treasure map, which a
 * two-badge team can finish in an evening; then the legends not yet caught,
 * a different one each raid, which it has to grow into. Undefined once there is nothing left to name.
 */
export function chaseLine(progress: NextStepProgress, held: (itemId: string) => number = () => 0): string | undefined {
  const hunt = progress.treasureHunt ?? NO_TREASURE_HUNT;
  switch (huntStage(hunt, held)) {
    case 'no-chart':
      return 'Next, a treasure: a bottle has washed up on THE BEACH past the pier, with a chart in it. Nobody has looked.';
    case 'first-chart':
      return `Next, a treasure: take that bottled chart to ${MARLOW.name} at THE GREAT LIBRARY.`;
    case 'pinning': {
      const left = CHART_PIECES.length - hunt.pinned.length;
      return `Next, the treasure: ${MARLOW.name}'s chart still wants ${left} more piece${left === 1 ? '' : 's'}. Ask him where.`;
    }
    case 'whole':
      return `Next, the treasure: the X is in ${TREASURE_PLACE}. Dig up the ${TREASURE_GOAL.prize}!`;
    case 'chest':
      return `Next, the treasure: carry the ${TREASURE_GOAL.prize} to ${MARLOW.name}.`;
    case 'done':
      break;
  }
  const owned = new Set(progress.pokedexOwned ?? []);
  const left = VALE_LEGENDS.filter((each) => !owned.has(each.dexId));
  // One a raid, in turn: a legend's one throw is about 1 in 80 in a Poké Ball,
  // and the same name raid after raid while it kept missing read as a wall with
  // a signpost on it (the fresh critic, 25 Nov 2026).
  const raids = Object.values(progress.raidRecord ?? {}).reduce((total, record) => total + record.deployed, 0);
  const legend = left[raids % Math.max(1, left.length)];
  return legend
    ? `Next, a legend: ${legend.name} ${legend.where}. Beat it, and you get one throw.`
    : undefined;
}

/** Jobs banked, of either kind: the authored chain's and the standing board's. */
export function jobsBanked(progress: Pick<StandingBoardProgress, 'completedContracts' | 'standingContractsBanked'>): number {
  return (progress.completedContracts?.length ?? 0) + (progress.standingContractsBanked ?? 0);
}

/**
 * A landing this save has not yet walked to and could, for Oak to name once
 * the near jobs are done: the critic started fourteen raids on the same square
 * because nothing said a landing is a place you walk onto (problem 13).
 */
export function landingToWalkTo(progress: NextStepProgress): RunInsertion | undefined {
  const offered = new Set(availableInsertionIds(progress));
  const opened = [...progress.defeatedBosses, ...(progress.openedGates ?? [])];
  return (Object.values(RUN_INSERTIONS) as RunInsertion[]).find(
    (landing) =>
      isMapOffered(landing.mapId) &&
      !offered.has(landing.id) &&
      // Not one behind a gym's doors this save has not opened.
      isLandingOpen(landing.id, opened) &&
      frontDoorFor(landing.mapId)?.id !== landing.id,
  );
}

/** How many of the board's jobs the next step names: the job, while the near jobs are being done. */
export function jobsNamed(progress: NextStepProgress): number {
  return !isFirstRaid(progress) && jobsBanked(progress) < NEAR_JOBS && buildContractBoard(progress).rows.length > 0 ? 1 : 0;
}

/**
 * What Oak says is next, or nothing on a save that has not been on a raid.
 * `held` is what the vault holds of an item, which the treasure map's stage
 * reads (a bottled chart in hand is a different next step from one on the sand).
 */
export function nextStepLines(progress: NextStepProgress, held: (itemId: string) => number = () => 0): readonly string[] {
  if (isFirstRaid(progress)) {
    return [];
  }
  const banked = jobsBanked(progress);
  const [job] = buildContractBoard(progress).rows;
  if (banked === 0) {
    return job
      ? [`Next, a job: ${job.name.toUpperCase()}. Pick it at the RAID ARENA, before you jump.`]
      : ['Next, a raid for whatever the vale holds. Every raid starts at the RAID ARENA.'];
  }
  if (banked < NEAR_JOBS) {
    return [
      `${job ? `Next, ${job.name.toUpperCase()} is on the rail.` : 'Another job will be on the rail.'}${mayAskAFavour(progress) ? ' And folk about the harbour may ask you a favour now.' : ''}`,
    ];
  }
  const gym = nextGym(progress.defeatedBosses);
  const landing = landingToWalkTo(progress);
  return [
    ...(landing
      ? [`Walk to ${landing.label.toUpperCase()} on a raid, and you can land there next time.`]
      : []),
    ...(gym
      ? [`And when you're ready, the next gym: ${gym.leader.toUpperCase()}, at ${gym.building.toUpperCase()} in ${gym.standsIn.toUpperCase()}.`]
      : [chaseLine(progress, held)].filter((line): line is string => line !== undefined)),
  ];
}
