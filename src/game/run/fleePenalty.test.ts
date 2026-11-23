import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunManager } from './RunManager';
import { formatHunterFleeCommand } from '../scenes/battlePresentation';
import {
  HUNTER_FLEE_BASE_PENALTY_MS,
  HUNTER_FLEE_PENALTY_CAP_MS,
  hunterFleePenaltyMs,
} from './fleePenalty';

const RAID_DURATION_MS = 18 * 60 * 1_000;

const startedRun = () => {
  const manager = new RunManager();
  manager.startRun(
    { party: [new Pokemon(CHARMANDER, 12)], items: [] },
    { mapId: 'route-1', durationMs: RAID_DURATION_MS },
  );
  return manager;
};

describe('hunterFleePenaltyMs', () => {
  it('starts at the base cost and grows with every escape already taken', () => {
    expect(hunterFleePenaltyMs(0)).toBe(HUNTER_FLEE_BASE_PENALTY_MS);
    expect(hunterFleePenaltyMs(1)).toBe(60_000);
    expect(hunterFleePenaltyMs(2)).toBe(80_000);
  });

  it('stops growing at the cap, so it stays a cost rather than an execution', () => {
    expect(hunterFleePenaltyMs(4)).toBe(HUNTER_FLEE_PENALTY_CAP_MS);
    expect(hunterFleePenaltyMs(40)).toBe(HUNTER_FLEE_PENALTY_CAP_MS);
  });
});

describe('charging an escape to the raid clock', () => {
  it('quotes the next cost before it is spent, so the battle screen can print it', () => {
    const manager = startedRun();

    expect(manager.nextHunterFleePenaltyMs()).toBe(40_000);
    manager.registerHunterFlee();
    expect(manager.nextHunterFleePenaltyMs()).toBe(60_000);
  });

  it('takes the quoted time off the raid clock and counts the escape', () => {
    const manager = startedRun();

    const { penaltyMs, snapshot } = manager.registerHunterFlee();

    expect(penaltyMs).toBe(40_000);
    expect(snapshot.elapsedMs).toBe(40_000);
    expect(snapshot.remainingMs).toBe(RAID_DURATION_MS - 40_000);
    expect(snapshot.hunterFlees).toBe(1);
  });

  it('makes a habit of fleeing cost a visible share of the raid', () => {
    const manager = startedRun();

    for (let flee = 0; flee < 5; flee += 1) {
      manager.registerHunterFlee();
    }

    // 40 + 60 + 80 + 100 + 120 seconds: over a third of an eighteen minute raid.
    expect(manager.snapshot().elapsedMs).toBe(400_000);
    expect(manager.snapshot().elapsedMs / RAID_DURATION_MS).toBeGreaterThan(0.35);
  });

  it('enrages the raid on the ordinary timer path when an escape runs the clock out', () => {
    const enraged: number[] = [];
    const manager = new RunManager({ onEnrage: (snapshot) => enraged.push(snapshot.elapsedMs) });
    manager.startRun(
      { party: [new Pokemon(CHARMANDER, 12)], items: [] },
      { mapId: 'route-1', durationMs: 30_000 },
    );

    manager.registerHunterFlee();

    expect(manager.isEnraged).toBe(true);
    expect(enraged).toEqual([30_000]);
  });

  it('resets the escalation for the next raid', () => {
    const manager = startedRun();
    manager.registerHunterFlee();
    manager.resolveEscape();

    manager.startRun(
      { party: [new Pokemon(CHARMANDER, 12)], items: [] },
      { mapId: 'route-1', durationMs: RAID_DURATION_MS },
    );

    expect(manager.nextHunterFleePenaltyMs()).toBe(HUNTER_FLEE_BASE_PENALTY_MS);
    expect(manager.snapshot().hunterFlees).toBe(0);
  });
});

describe('a flee priced past the clock and the enrage after it', () => {
  // The label the battle prints must say what the escape does: with 0:25 left
  // a 0:40 escape uses up the clock and all fifteen seconds of the enrage, and
  // the raid is over the moment the world comes back (break-it test, 23 Nov 2026).
  it.each([
    [30_000, false, 'FLEE: CLOCK OUT'],
    [25_000, true, 'FLEE: RAID LOST'],
    [5_000, true, 'FLEE: RAID LOST'],
  ])('with %ims left, the raid is lost: %s, and the command says %s', (left, lost, label) => {
    const manager = startedRun();
    manager.tick(RAID_DURATION_MS - left);
    const before = manager.snapshot();

    expect(formatHunterFleeCommand(manager.nextHunterFleePenaltyMs(), before.durationMs - before.elapsedMs, manager.enrageGraceRemainingMs())).toBe(label);
    manager.registerHunterFlee();
    expect(manager.isEnrageGraceExpired).toBe(lost);
  });

  it('is always lost once ENRAGED', () => {
    const manager = startedRun();
    manager.tick(RAID_DURATION_MS + 3_000);
    const before = manager.snapshot();

    expect(formatHunterFleeCommand(manager.nextHunterFleePenaltyMs(), before.durationMs - before.elapsedMs, manager.enrageGraceRemainingMs())).toBe('FLEE: RAID LOST');
    manager.registerHunterFlee();
    expect(manager.isEnrageGraceExpired).toBe(true);
  });
});
