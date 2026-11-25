import { buildContractBoard } from './contractBoard';
import { mayAskAFavour, type ErrandProgress } from './errands';
import { isFirstRaid } from './firstRaid';
import { NEAR_JOBS, type StandingBoardProgress } from '../objectives/standingBoard';
import { availableInsertionIds, frontDoorFor, RUN_INSERTIONS, type RunInsertion } from '../run/runGeneration';
import { isMapOffered } from '../world/mapRoster';
import { isLandingOpen, nextGym } from '../world/valeQuarters';

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
};

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

/** What Oak says is next, or nothing on a save that has not been on a raid. */
export function nextStepLines(progress: NextStepProgress): readonly string[] {
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
    ...(gym ? [`And when you're ready, the next gym: ${gym.leader.toUpperCase()}, at ${gym.building.toUpperCase()} in ${gym.standsIn.toUpperCase()}.`] : []),
  ];
}
