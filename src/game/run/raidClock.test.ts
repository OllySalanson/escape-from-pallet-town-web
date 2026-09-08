import { describe, expect, it } from 'vitest';
import { EXTRACTION_POINTS } from '../world/extractionPoints';
import { HUNTER_TIERS } from '../world/hunter';
import { WORLD_MAPS, type WorldMapDefinition } from '../worldMap';
import { ENRAGE_GRACE_MS, RunManager } from './RunManager';
import {
  HUNTER_FLEE_BASE_PENALTY_MS,
  HUNTER_FLEE_PENALTY_CAP_MS,
  hunterFleePenaltyMs,
} from './fleePenalty';
import { RAID_DURATION_MS, formatRaidClock, raidClockProgress } from './raidClock';
import { FIRST_CONTRACT, RUN_GENERATION_BOUNDS, RUN_INSERTIONS } from './runGeneration';

/** Tiles between two walkable tiles of one map, by breadth-first search. */
function walkingDistance(
  map: WorldMapDefinition,
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  const distances = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  const frontier = [from];
  while (frontier.length > 0) {
    const tile = frontier.shift()!;
    const distance = distances.get(`${tile.x},${tile.y}`)!;
    if (tile.x === to.x && tile.y === to.y) {
      return distance;
    }
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const next = { x: tile.x + dx, y: tile.y + dy };
      const key = `${next.x},${next.y}`;
      if (
        next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height ||
        map.collision[next.y][next.x] || distances.has(key)
      ) {
        continue;
      }
      distances.set(key, distance + 1);
      frontier.push(next);
    }
  }
  return Number.POSITIVE_INFINITY;
}

/** The step cadence the duration was measured against: animation plus two frames. */
const STEP_COST_MS = 130 + 1000 / 60 * 2;

describe('raid duration', () => {
  it('is long enough to walk the Floodplain Relay contract route several times over', () => {
    const relay = WORLD_MAPS['floodplain-relay'];
    const insertion = RUN_INSERTIONS['floodplain-relay'].position;
    const southGate = EXTRACTION_POINTS.find(
      (point) => point.mapId === 'floodplain-relay' && point.label === 'SOUTH GATE',
    )!;
    const beelineTiles =
      walkingDistance(relay, insertion, FIRST_CONTRACT.position) +
      walkingDistance(relay, FIRST_CONTRACT.position, southGate.position);

    expect(beelineTiles).toBe(53);
    // The objective route must never be a sprint: walking it costs a small part
    // of the raid, leaving the clock to price detours, reading and hesitation.
    expect(beelineTiles * STEP_COST_MS).toBeLessThan(RAID_DURATION_MS * 0.05);
  });

  it('is short enough that fleeing the hunter is a visible share of the raid', () => {
    expect(hunterFleePenaltyMs(0)).toBe(HUNTER_FLEE_BASE_PENALTY_MS);
    // A first escape costs a tenth of the raid or more, and the capped escape
    // costs at least a third, so the price from PR #66 is legible on the clock.
    expect(HUNTER_FLEE_BASE_PENALTY_MS / RAID_DURATION_MS).toBeGreaterThan(0.1);
    expect(HUNTER_FLEE_PENALTY_CAP_MS / RAID_DURATION_MS).toBeGreaterThan(1 / 3);
    // But no single escape may end a raid outright from a standing start.
    expect(HUNTER_FLEE_PENALTY_CAP_MS).toBeLessThan(RAID_DURATION_MS / 2);
  });

  it('leaves every hunter escalation tier reachable before the raid enrages', () => {
    for (const tier of HUNTER_TIERS) {
      expect(tier.startsAtMs).toBeLessThan(RAID_DURATION_MS);
    }
    const lastTier = HUNTER_TIERS[HUNTER_TIERS.length - 1];
    // The hardest team has to be survivable for long enough to matter, not just
    // arrive in the final seconds.
    expect(RAID_DURATION_MS - lastTier.startsAtMs).toBeGreaterThanOrEqual(60_000);
    // And the raid must outlast the latest hunter spawn by a wide margin.
    expect(RUN_GENERATION_BOUNDS.hunterSpawnDelayMaximumMs).toBeLessThan(RAID_DURATION_MS / 3);
  });

  it('leaves every authored and generated extraction openable with time left to reach it', () => {
    const latestAuthoredUnlock = Math.max(
      ...EXTRACTION_POINTS.map((point) =>
        point.requirement?.kind === 'elapsed' ? point.requirement.unlockAtMs : point.unlockAtMs,
      ),
    );
    const latestPossibleUnlock = Math.max(
      latestAuthoredUnlock,
      RUN_GENERATION_BOUNDS.extractionUnlockMaximumMs,
    );

    // Waiting out the slowest exit may never be most of the raid: the Ferry Dock
    // has to stay a route a player can plan around, not a gamble on the clock.
    expect(latestPossibleUnlock).toBeLessThan(RAID_DURATION_MS / 3);
  });

  it('ends the raid on the new duration and then allows the grace period', () => {
    const manager = new RunManager();
    manager.startRun({ party: [], items: [] }, { mapId: 'floodplain-relay', durationMs: RAID_DURATION_MS });

    expect(manager.tick(RAID_DURATION_MS - 1).isEnraged).toBe(false);
    expect(manager.tick(1).isEnraged).toBe(true);
    expect(manager.isEnrageGraceExpired).toBe(false);
    manager.tick(ENRAGE_GRACE_MS);
    expect(manager.isEnrageGraceExpired).toBe(true);
  });
});

describe('raid clock readings', () => {
  it('reports progress as a bounded share of the raid', () => {
    expect(raidClockProgress(0)).toBe(0);
    expect(raidClockProgress(RAID_DURATION_MS / 2)).toBeCloseTo(0.5);
    expect(raidClockProgress(RAID_DURATION_MS * 2)).toBe(1);
    expect(raidClockProgress(10_000, 0)).toBe(1);
  });

  it('formats mm:ss and never shows a negative clock', () => {
    expect(formatRaidClock(RAID_DURATION_MS)).toBe('5:00');
    expect(formatRaidClock(65_000)).toBe('1:05');
    expect(formatRaidClock(0)).toBe('0:00');
    expect(formatRaidClock(-5_000)).toBe('0:00');
  });
});
