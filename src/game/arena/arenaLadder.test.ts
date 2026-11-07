import { describe, expect, it } from 'vitest';
import { trainerWinRate } from '../world/trainerMeasure';
import { DOJO_REFERENCE_TEAMS } from './arenaReferences';
import { beltFoe, DOJO_CLASSES, foeTrainer, regularFoe } from './classes';
import { DOJO_REGULARS } from './dojoCounter';

/**
 * THE BATTLE ARENA's class ladder, measured over the real engine
 * (`tools/arena/ladder.mts` prints the whole grid). A class is a promise that
 * the next one is harder, so it is held here as `trainerLadder.test.ts` holds
 * the bosses: the share of bouts the reference teams win, mean over all three,
 * must fall at every step - the regulars of a class, then its Black Belt, then
 * the next class's regulars - by at least `STEP`, so two rungs that only differ
 * by a roll never pass for a ladder. MASTER BALL's regulars are ULTRA's (the end
 * of every line), so there only AARON is held harder. Few trials, seeded: a
 * guard against a rung quietly moving, not a balance study.
 */

const TRIALS = 40;
const STEP = 0.04;

const rate = (trainer: ReturnType<typeof foeTrainer>): number =>
  DOJO_REFERENCE_TEAMS.reduce((sum, party) => sum + trainerWinRate(party, trainer, TRIALS), 0) / DOJO_REFERENCE_TEAMS.length;

const regularsRate = (classIndex: number): number =>
  DOJO_REGULARS.reduce((sum, regular) => sum + rate(foeTrainer(regularFoe(regular, DOJO_CLASSES[classIndex].id), 3)), 0) /
  DOJO_REGULARS.length;

describe("THE BATTLE ARENA's class ladder", () => {
  it('gets harder at every step: regulars, their Black Belt, the next class', { timeout: 60_000 }, () => {
    const rungs: { name: string; rate: number }[] = [];
    DOJO_CLASSES.forEach((cls, index) => {
      if (index < 3) {
        rungs.push({ name: `${cls.name} regulars`, rate: regularsRate(index) });
      }
      rungs.push({ name: cls.head.name, rate: rate(foeTrainer(beltFoe(cls.head), 3)) });
    });
    for (let index = 1; index < rungs.length; index += 1) {
      expect(rungs[index].rate, `${rungs[index].name} after ${rungs[index - 1].name}: ${rungs.map((r) => `${r.name} ${(r.rate * 100).toFixed(0)}%`).join(', ')}`).toBeLessThan(
        rungs[index - 1].rate - STEP,
      );
    }
  });

  it('never puts a Black Belt out of reach: every reference team wins every one some of the time', { timeout: 60_000 }, () => {
    const aaron = foeTrainer(beltFoe(DOJO_CLASSES[3].head), 3);
    expect(Math.max(...DOJO_REFERENCE_TEAMS.map((party) => trainerWinRate(party, aaron, TRIALS)))).toBeGreaterThan(0.25);
    const hideki = foeTrainer(beltFoe(DOJO_CLASSES[0].head), 3);
    expect(DOJO_REFERENCE_TEAMS.every((party) => trainerWinRate(party, hideki, TRIALS) > 0.15)).toBe(true);
  });
});
