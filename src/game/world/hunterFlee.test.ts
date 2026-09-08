import { describe, expect, it } from 'vitest';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { getWorldMap, WORLD_MAPS, type WorldMapId } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import {
  findHunterBreakawayTile,
  HUNTER_BREAKAWAY_DISTANCE,
  HUNTER_SEARCH_MS,
} from './hunter';
import { stepDistances, walkableTiles } from './mapStructure';
import { createRunTrainerEncounters } from './trainers';
import { RAID_CONTRACTS } from '../objectives';
import { hunterFleePenaltyMs, HUNTER_FLEE_BASE_PENALTY_MS } from '../run/fleePenalty';
import { RAID_DURATION_MS } from '../run/raidClock';

/**
 * What an escape from the hunter costs, and what it buys, measured on the maps
 * the game actually ships.
 *
 * The escape was tuned when a raid ran for eighteen minutes and the maps were
 * open ground. Both are gone: a raid is five minutes and all four maps are
 * networks of one and two-tile passages, which is exactly the shape in which
 * "the hunter falls back six tiles" can mean "the hunter is now standing in the
 * lane you were walking down". These hold the two halves of the bargain - the
 * price is a legible share of the raid, and the window is long enough to be
 * worth that price from anywhere a player can be standing.
 */

const MAP_IDS = Object.keys(WORLD_MAPS) as WorldMapId[];

/**
 * The pessimistic tile cost. `raidClock.ts` records ~0.17s at 60fps and ~0.23s
 * measured in a headless browser; the window has to hold at the slower one.
 */
const SLOW_STEP_MS = 230;

const D4: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

const HEADINGS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const HEADING_DELTA: Record<Direction, GridPosition> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Signs, townsfolk and live trainers block their own tile, as the engine does. */
function blockerFor(mapId: WorldMapId): (tile: GridPosition) => boolean {
  const map = getWorldMap(mapId);
  const taken = new Set(map.entities.map((entity) => `${entity.position.x},${entity.position.y}`));
  for (const trainer of createRunTrainerEncounters()) {
    if (trainer.mapId === mapId) {
      taken.add(`${trainer.position.x},${trainer.position.y}`);
    }
  }
  return (tile) => map.collision[tile.y]?.[tile.x] !== false || taken.has(`${tile.x},${tile.y}`);
}

function boundsOf(mapId: WorldMapId) {
  const map = getWorldMap(mapId);
  return { width: map.width, height: map.height };
}

function openTiles(mapId: WorldMapId): GridPosition[] {
  const isBlocked = blockerFor(mapId);
  return walkableTiles(getWorldMap(mapId).collision).filter((tile) => !isBlocked(tile));
}

/** Every place a raid on this map might be walking to when the hunter catches it. */
function destinationsOn(mapId: WorldMapId): GridPosition[] {
  const map = getWorldMap(mapId);
  return [
    ...EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map((point) => point.position),
    ...map.pois.map((poi) => poi.position),
    ...RAID_CONTRACTS.filter((contract) => contract.mapId === mapId).flatMap((contract) =>
      contract.markers.map((marker) => marker.position),
    ),
  ];
}

describe('what an escape costs', () => {
  it('is an escalating, legible share of the raid', () => {
    expect(hunterFleePenaltyMs(0)).toBe(HUNTER_FLEE_BASE_PENALTY_MS);
    // Re-measured at five minutes rather than eighteen: the first escape is an
    // eighth of the raid, and each one after it costs more, so fleeing every
    // contact runs the raid out on its own. It is a tool, never a strategy.
    expect(hunterFleePenaltyMs(0) / RAID_DURATION_MS).toBeCloseTo(0.133, 2);
    expect(hunterFleePenaltyMs(1)).toBeGreaterThan(hunterFleePenaltyMs(0));
    expect(hunterFleePenaltyMs(2)).toBeGreaterThan(hunterFleePenaltyMs(1));
    const threeEscapes = hunterFleePenaltyMs(0) + hunterFleePenaltyMs(1) + hunterFleePenaltyMs(2);
    expect(threeEscapes).toBeGreaterThan(RAID_DURATION_MS / 2);
  });
});

describe('what an escape buys', () => {
  /**
   * The one promise the window has to keep. A player flees because they cannot
   * win the fight, so the least the purchase can be worth is the walk to a way
   * out - from the worst tile on the map, at the slower of the two measured step
   * costs. Redraw a map with a corner further from its exits than this and the
   * failure lands here rather than in a playtest.
   */
  it.each(MAP_IDS)('%s: the blind window covers the walk to an exit from anywhere', (mapId) => {
    const exits = EXTRACTION_POINTS.filter((point) => point.mapId === mapId);
    expect(exits.length).toBeGreaterThan(0);

    const collision = getWorldMap(mapId).collision;
    const fields = exits.map((exit) => stepDistances(collision, exit.position));
    let furthest = 0;
    for (const tile of openTiles(mapId)) {
      const walk = Math.min(
        ...fields.map((field) => {
          const steps = field[tile.y]?.[tile.x] ?? -1;
          return steps < 0 ? Number.POSITIVE_INFINITY : steps;
        }),
      );
      if (Number.isFinite(walk)) {
        furthest = Math.max(furthest, walk);
      }
    }

    expect(furthest).toBeGreaterThan(0);
    expect(`${mapId}: ${furthest} tiles to an exit, window covers ${Math.floor(HUNTER_SEARCH_MS / SLOW_STEP_MS)}`)
      .toBe(`${mapId}: ${furthest} tiles to an exit, window covers ${Math.max(furthest, Math.floor(HUNTER_SEARCH_MS / SLOW_STEP_MS))}`);
  });

  /**
   * The fault the rebuilt maps introduced. A fallback chosen without regard to
   * where the player was walking parked the hunter on the player's own shortest
   * route to an exit, landmark or contract stop about a third of the time, and
   * made that route longer about a quarter of the time - so a quarter of all
   * escapes were paid for in raid time and then made the player's position worse.
   */
  it.each(MAP_IDS)('%s: the hunter falls back off the ground the player is crossing', (mapId) => {
    const collision = getWorldMap(mapId).collision;
    const bounds = boundsOf(mapId);
    const isBlocked = blockerFor(mapId);
    const destinations = destinationsOn(mapId);
    expect(destinations.length).toBeGreaterThan(0);
    const toDestination = destinations.map((destination) => stepDistances(collision, destination));

    let scenarios = 0;
    let lengthened = 0;
    let lengthenedBlind = 0;
    let intoTheNextStep = 0;
    for (const player of openTiles(mapId)) {
      const contact = D4.map(([dx, dy]) => ({ x: player.x + dx, y: player.y + dy })).find(
        (tile) => !isBlocked(tile),
      );
      if (!contact) {
        continue;
      }
      const clean = stepDistances(collision, player);
      for (const [index, destination] of destinations.entries()) {
        const direct = clean[destination.y]?.[destination.x] ?? -1;
        if (direct <= 0) {
          continue;
        }
        // The player was walking towards where they are going when they were
        // caught, so the way they are facing is the first step of that route.
        const heading = HEADINGS.find((option) => {
          const step = {
            x: player.x + HEADING_DELTA[option].x,
            y: player.y + HEADING_DELTA[option].y,
          };
          return !isBlocked(step) && (toDestination[index][step.y]?.[step.x] ?? -1) === direct - 1;
        });
        if (!heading) {
          continue;
        }
        scenarios += 1;
        const ahead = {
          x: player.x + HEADING_DELTA[heading].x,
          y: player.y + HEADING_DELTA[heading].y,
        };
        const breakaway = findHunterBreakawayTile(
          contact,
          player,
          bounds,
          isBlocked,
          HUNTER_BREAKAWAY_DISTANCE,
          heading,
        );
        if (breakaway.x === ahead.x && breakaway.y === ahead.y) {
          intoTheNextStep += 1;
        }
        if (isDetour(breakaway)) {
          lengthened += 1;
        }
        // The same escape with nothing said about where the player was walking,
        // which is what the hunter did before, measured on the same scenario.
        if (isDetour(findHunterBreakawayTile(contact, player, bounds, isBlocked))) {
          lengthenedBlind += 1;
        }

        function isDetour(tile: GridPosition): boolean {
          const around = stepDistances(collision, player, new Set([`${tile.x},${tile.y}`]));
          const detoured = around[destination.y]?.[destination.x] ?? -1;
          return detoured < 0 || detoured > direct;
        }
      }
    }

    expect(scenarios).toBeGreaterThan(0);
    // The hardest version of the fault: the escape putting the hunter in the very
    // tile the player is about to step into.
    expect(`${mapId}: ${intoTheNextStep} escapes fell back into the player's next step`)
      .toBe(`${mapId}: 0 escapes fell back into the player's next step`);
    // It cannot be zero - a one-tile lane with the destination behind you has
    // nowhere else for the hunter to go - so this is measured against the same
    // escape taken heading-blind rather than against a number, and stays true if
    // a map is redrawn. Heading-blind ran at 22-28% on these four.
    expect(lengthenedBlind).toBeGreaterThan(0);
    const share = lengthened / scenarios;
    const blindShare = lengthenedBlind / scenarios;
    expect(`${mapId}: ${(share * 100).toFixed(0)}% lengthened against ${(blindShare * 100).toFixed(0)}% heading-blind`)
      .toBe(`${mapId}: ${(Math.min(share, blindShare * 0.6) * 100).toFixed(0)}% lengthened against ${(blindShare * 100).toFixed(0)}% heading-blind`);
    expect(share).toBeLessThan(0.2);
  });

  it('backs away down the corridor the player is leaving, not the one ahead of them', () => {
    // A straight east-west lane, the player walking east with the hunter beside
    // them. Both directions offer the same six tiles of separation; only one of
    // them is ground the player has already covered.
    const bounds = { width: 40, height: 3 };
    const isBlocked = (tile: GridPosition): boolean => tile.y !== 1;
    const player = { x: 20, y: 1 };
    const contact = { x: 21, y: 1 };

    const heading = findHunterBreakawayTile(
      contact,
      player,
      bounds,
      isBlocked,
      HUNTER_BREAKAWAY_DISTANCE,
      'right',
    );
    expect(heading).toEqual({ x: 14, y: 1 });

    // And with nothing said about where the player is going it still backs off
    // the full distance, by the shortest walk it has - which is where it came from.
    const blind = findHunterBreakawayTile(contact, player, bounds, isBlocked);
    expect(Math.abs(blind.x - player.x)).toBe(HUNTER_BREAKAWAY_DISTANCE);
  });

  it('takes the best separation a dead end offers rather than refusing to move', () => {
    // A six-tile stub with the player at the mouth: full separation is impossible,
    // and the heading must not talk the hunter out of the room that does exist.
    const bounds = { width: 8, height: 3 };
    const isBlocked = (tile: GridPosition): boolean =>
      tile.y !== 1 || tile.x < 1 || tile.x > 4;
    const player = { x: 1, y: 1 };

    const breakaway = findHunterBreakawayTile(
      { x: 2, y: 1 },
      player,
      bounds,
      isBlocked,
      HUNTER_BREAKAWAY_DISTANCE,
      'right',
    );
    expect(breakaway).toEqual({ x: 4, y: 1 });
  });
});
