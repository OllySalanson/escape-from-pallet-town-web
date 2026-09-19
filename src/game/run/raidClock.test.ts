import { STEP_DURATION_MS } from '../movement/stepClock';
import { describe, expect, it } from 'vitest';
import { EXTRACTION_POINTS } from '../world/extractionPoints';
import { HUNTER_SEARCH_MS, HUNTER_TIERS } from '../world/hunter';
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

/** What a walked tile costs the clock - at any frame rate, since `stepClock.ts`. */
const STEP_COST_MS = STEP_DURATION_MS;

describe('raid duration', () => {
  it('is long enough to walk the Floodplain Relay contract route several times over', () => {
    const relay = WORLD_MAPS['floodplain-relay'];
    const insertion = RUN_INSERTIONS['floodplain-relay'].position;
    const southGate = EXTRACTION_POINTS.find(
      (point) => point.mapId === 'floodplain-relay' && point.label === 'SOUTH GATE',
    )!;
    const kit = FIRST_CONTRACT.markers[0].position;
    const station = relay.pois.find((poi) => poi.id === 'floodplain-ranger-radio')!.position;
    const radioExit = EXTRACTION_POINTS.find(
      (point) => point.mapId === 'floodplain-relay' && point.label === 'RADIO EXIT',
    )!;

    // What the contract asks of a first raid: past the ranger station, which is
    // on the way and opens the Radio Exit; into the reeds for the kit; and out
    // by the exit just opened, which is the nearest one to it.
    const contractTiles =
      walkingDistance(relay, insertion, station) +
      walkingDistance(relay, station, kit) +
      walkingDistance(relay, kit, radioExit.position);
    expect(contractTiles).toBe(33);
    // The objective route must never be a sprint: walking it costs a small part
    // of the raid, leaving the clock to price detours, reading and hesitation.
    expect(contractTiles * STEP_COST_MS).toBeLessThan(RAID_DURATION_MS * 0.05);

    // The map is vast now and the one exit that is always open is at the far
    // end of it. That is the long way home, not the objective route - but it is
    // the way a raid falls back on, so it too has to be walkable many times over.
    const longWayTiles =
      walkingDistance(relay, insertion, kit) + walkingDistance(relay, kit, southGate.position);
    expect(longWayTiles).toBe(85);
    expect(longWayTiles * STEP_COST_MS).toBeLessThan(RAID_DURATION_MS * 0.1);
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

  /**
   * How the tier schedule is derived, rather than what it happens to say. The
   * hunter is only on the map from its arrival onwards, so a rung's worth is
   * measured in *hunted* time: the first rung's stretch is the one the spawn
   * eats into, and adding a rung is re-dividing that hunted raid rather than
   * finding a gap in the raid clock.
   */
  it('gives every hunter tier a comparable watch of the hunted raid', () => {
    const boundaries = [...HUNTER_TIERS.map((tier) => tier.startsAtMs), RAID_DURATION_MS];
    // The rungs are in order and none of them is skipped past.
    for (let index = 1; index < boundaries.length; index += 1) {
      expect(boundaries[index]).toBeGreaterThan(boundaries[index - 1]);
    }

    // The first rung starts when the hunter arrives, not when the raid does, and
    // at its worst seed that is the latest spawn the generator can roll.
    const watches = boundaries.slice(1).map((endsAtMs, index) =>
      endsAtMs -
      Math.max(
        HUNTER_TIERS[index].startsAtMs,
        index === 0 ? RUN_GENERATION_BOUNDS.hunterSpawnDelayMaximumMs : 0,
      ),
    );
    const shortest = Math.min(...watches);
    const longest = Math.max(...watches);
    // No rung may be a fifth of another: a team nobody meets is not escalation.
    expect(`shortest watch ${shortest}ms of a longest ${longest}ms`)
      .toBe(`shortest watch ${shortest}ms of a longest ${Math.min(longest, shortest * 2)}ms`);
  });

  /**
   * The relationship between the two things that spend the clock. An escape is
   * bought because the fight cannot be won, so it must not simply hand over the
   * next team: the first one, the one the design expects everyone to pay, has to
   * fit inside a rung with walking room left over.
   */
  it('leaves a first escape shorter than the tier it is taken inside', () => {
    const spacings = HUNTER_TIERS.slice(1).map(
      (tier, index) => tier.startsAtMs - HUNTER_TIERS[index].startsAtMs,
    );
    const tightest = Math.min(...spacings, RAID_DURATION_MS - HUNTER_TIERS[HUNTER_TIERS.length - 1].startsAtMs);

    expect(HUNTER_FLEE_BASE_PENALTY_MS).toBeLessThan(tightest);
    // And what is left of the rung after paying for it is still a walk, not a
    // rounding error: the window an escape buys covers the way to an exit.
    expect(tightest - HUNTER_FLEE_BASE_PENALTY_MS).toBeGreaterThanOrEqual(HUNTER_SEARCH_MS);
    // The second escape is the escalation being felt: it costs a whole tier.
    expect(hunterFleePenaltyMs(1)).toBeGreaterThanOrEqual(tightest);
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
