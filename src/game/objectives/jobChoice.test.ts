import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import {
  jobChoice,
  jobsForMap,
  mayTurnJobDown,
  noJobChoice,
  standingBoard,
  standingRoundOf,
  type StandingBoardProgress,
} from './standingBoard';

/**
 * The raid's job is chosen at the rim, out of two, or turned down.
 *
 * With one map in play the standing board held one job, so the same LINE
 * SURVEY was every raid's until it was banked, and nothing let a player take
 * another or none (AI playtest 4, 22 Nov 2026: "pure tedium" by the tenth
 * raid). Now a second job of another kind stands beside the board's.
 */

const progressAt = (standingContractsBanked: number): StandingBoardProgress => ({
  completedContracts: [],
  standingContractsBanked,
  defeatedBosses: [],
  workshopUpgrades: [],
  unlockedInsertions: [],
  reachedInsertions: [],
  // Told what a survey stake is, as a save is once it has spoken to the Gym Guide.
  firstWordsHeard: ['stakes'],
});

describe('the jobs a raid may carry', () => {
  // As the game ships: the vale, and the chain put away with its maps.
  beforeAll(() => retireMapsForTests(RETIRED_MAPS));
  afterAll(() => retireMapsForTests([]));

  it.each([0, 1, 2, 5])('are two of different kinds on the vale, the board’s first, in round %i', (round) => {
    const progress = progressAt(round);
    const jobs = jobsForMap('greystone-vale', progress);
    expect(jobs).toHaveLength(2);
    const [board, other] = jobs;
    expect(board).toBe(standingBoard(progress).find((job) => job.mapId === 'greystone-vale'));
    expect(other.standingTemplate).not.toBe(board.standingTemplate);
    expect(other.name).not.toBe(board.name);
    expect(other.id).not.toBe(board.id);
    // Same round, so either one pays once and moves the board on.
    expect(standingRoundOf(other.id)).toBe(round);
    expect(other.markers.every((marker) => marker.id.startsWith(`${other.id}-`))).toBe(true);
    expect(other.hunterPressure).toBe(board.hunterPressure);
  });

  it('leads the first round with LINE SURVEY, and offers another kind beside it', () => {
    const [board, other] = jobsForMap('greystone-vale', progressAt(0));
    expect(board.name).toBe('Line survey');
    expect(other.name).not.toBe('Line survey');
  });

  it.each([0, 1, 2, 5])('deals no survey in round %i to a save nobody has told what a survey stake is', (round) => {
    // The captain was asked to "read all 3 survey stakes" from his second raid
    // and only heard what one was on his fifth, from the Gym Guide (25 Nov 2026).
    const untold = { ...progressAt(round), firstWordsHeard: [] };
    const jobs = jobsForMap('greystone-vale', untold);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) {
      expect(job.standingTemplate, job.id).not.toBe('survey');
      expect(`${job.name} ${job.description} ${job.briefing.join(' ')}`, job.id).not.toMatch(/survey|stake/i);
    }
    // The first job still asks nothing out of the pack, survey or not.
    if (round === 0) {
      expect(jobs[0].markers.every((marker) => (marker.carriedIn ?? []).length === 0)).toBe(true);
    }
  });

  it('carries the one chosen, the board’s when nothing still on offer was, and none when turned down', () => {
    const jobs = jobsForMap('greystone-vale', progressAt(1));
    expect(jobChoice(jobs, undefined)).toBe(jobs[0]);
    expect(jobChoice(jobs, jobs[1].id)).toBe(jobs[1]);
    expect(mayTurnJobDown(jobs)).toBe(true);
    expect(jobChoice(jobs, noJobChoice(jobs))).toBeUndefined();
    // A choice made against another round lapses with it.
    const later = jobsForMap('greystone-vale', progressAt(2));
    expect(jobChoice(later, jobs[1].id)).toBe(later[0]);
    expect(jobChoice(later, noJobChoice(jobs))).toBe(later[0]);
  });
});
