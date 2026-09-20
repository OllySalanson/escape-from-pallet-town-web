import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { EXTRACTION_POINTS } from './extractionPoints';
import {
  WORLD_LEDGES,
  ledgeCaption,
  ledgeHopAt,
  ledgeHopTiles,
  ledgeLanding,
  ledgesForMap,
  type MapLedge,
} from './ledges';
import { stepDistances } from './mapStructure';
import { trainerSightTiles } from './trainerSight';
import { createRunTrainerEncounters } from './trainers';
import { WORLD_MAPS, getWorldMap, type WorldMapDefinition } from '../worldMap';
import { WORLD_GATES, gateKeys } from './gates';

const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;

/** Every gate state a raid can be played in, as `mapStructure.test.ts` builds them. */
function statesFor(mapId: MapLedge['mapId']): WorldMapDefinition[] {
  const keys = gateKeys(WORLD_GATES.filter((gate) => gate.mapId === mapId));
  return [WORLD_MAPS[mapId], ...keys.map((key) => getWorldMap(mapId, [key])), getWorldMap(mapId, keys)];
}

describe('a one-way ledge', () => {
  it.each(WORLD_LEDGES.map((ledge) => [ledge.id, ledge] as const))(
    '%s stands on ground the map already had',
    (_id, ledge) => {
      for (const map of statesFor(ledge.mapId)) {
        for (const from of ledge.brow) {
          expect(`brow ${key(from)}: ${map.collision[from.y][from.x] ? 'solid' : 'ground'}`)
            .toBe(`brow ${key(from)}: ground`);
          const over = ledgeHopTiles(ledge, from);
          for (const tile of over.slice(0, -1)) {
            // The ledge itself is solid and stays solid, which is the whole
            // reason the hunter can never use it.
            expect(`over ${key(tile)}: ${map.collision[tile.y][tile.x] ? 'solid' : 'ground'}`)
              .toBe(`over ${key(tile)}: solid`);
          }
          const landing = over[over.length - 1];
          expect(`landing ${key(landing)}: ${map.collision[landing.y][landing.x] ? 'solid' : 'ground'}`)
            .toBe(`landing ${key(landing)}: ground`);
        }
      }
    },
  );

  /**
   * The hunter searches the map's collision, so a ledge it cannot stand on is a
   * ledge it cannot follow the player over. The only thing worth asserting is
   * that the way round is genuinely longer - a drop that saves nothing is not a
   * flee route, it is decoration.
   */
  it.each(WORLD_LEDGES.map((ledge) => [ledge.id, ledge] as const))(
    '%s is a real saving, and the hunter has to take the long way',
    (_id, ledge) => {
      const map = WORLD_MAPS[ledge.mapId];
      for (const from of ledge.brow) {
        const landing = ledgeLanding(ledge, from);
        const round = stepDistances(map.collision, from)[landing.y][landing.x];
        expect(`${key(from)} round to ${key(landing)}: ${round < 0 ? 'no way' : round}`)
          .not.toBe(`${key(from)} round to ${key(landing)}: no way`);
        // One hop against a walk. Anything under four steps saved is not worth
        // teaching the player a second way to move, and is not a flee route.
        expect(`${key(from)} saves ${round - 1} steps`, 'the way round is barely longer')
          .toBe(`${key(from)} saves ${Math.max(round - 1, 4)} steps`);
      }
    },
  );

  /**
   * A ledge adds a route rather than replacing one: the map is the same map
   * with the ledge taken away, which is what lets every structural rule go on
   * being asked of the collision alone.
   */
  it.each(WORLD_LEDGES.map((ledge) => [ledge.id, ledge] as const))(
    '%s is never the only way anywhere',
    (_id, ledge) => {
      for (const map of statesFor(ledge.mapId)) {
        for (const from of ledge.brow) {
          const landing = ledgeLanding(ledge, from);
          expect(`${key(landing)} back to ${key(from)}: ${stepDistances(map.collision, landing)[from.y][from.x]}`)
            .not.toContain(': -1');
        }
      }
    },
  );

  it.each(WORLD_LEDGES.map((ledge) => [ledge.id, ledge] as const))(
    '%s never puts the player down on something a raid is for',
    (_id, ledge) => {
      const map = WORLD_MAPS[ledge.mapId];
      const sacred = new Map<string, string>();
      for (const point of EXTRACTION_POINTS.filter((point) => point.mapId === ledge.mapId)) {
        // Landing on an open exit would end the raid on a step taken to escape.
        sacred.set(key(point.position), point.label);
      }
      for (const insertion of Object.values(RUN_INSERTIONS).filter((one) => one.mapId === ledge.mapId)) {
        sacred.set(key(insertion.position), insertion.id);
      }
      const isSightBlocked = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] !== false;
      for (const trainer of createRunTrainerEncounters().filter((one) => one.mapId === ledge.mapId)) {
        for (const tile of trainerSightTiles(trainer, isSightBlocked)) {
          sacred.set(key(tile), `${trainer.trainer.id}'s watch`);
        }
      }
      const landings = ledge.brow.map((from) => ledgeLanding(ledge, from));
      expect(landings.filter((tile) => sacred.has(key(tile))).map((tile) => `${key(tile)} is ${sacred.get(key(tile))}`))
        .toEqual([]);
    },
  );

  it('answers only the way it was authored, so no ledge can be gone back up', () => {
    for (const ledge of WORLD_LEDGES) {
      for (const from of ledge.brow) {
        expect(ledgeHopAt(ledge.mapId, from, ledge.drop)?.ledge.id).toBe(ledge.id);
        const landing = ledgeLanding(ledge, from);
        for (const way of ['up', 'down', 'left', 'right'] as const) {
          expect(`${key(landing)} ${way}: ${ledgeHopAt(ledge.mapId, landing, way) ? 'a hop' : 'nothing'}`)
            .toBe(`${key(landing)} ${way}: nothing`);
        }
      }
    }
  });

  it('says the one thing about it a player has to know', () => {
    for (const ledge of WORLD_LEDGES) {
      expect(ledgeCaption(ledge)).toContain('ONE WAY');
      expect(ledgeCaption(ledge).split('\n')).toHaveLength(2);
    }
  });

  it('is authored on a map that exists, and nowhere else', () => {
    expect(ledgesForMap('viridian-forest').length).toBeGreaterThan(0);
    expect(ledgesForMap('floodplain-relay')).toEqual([]);
  });
});
