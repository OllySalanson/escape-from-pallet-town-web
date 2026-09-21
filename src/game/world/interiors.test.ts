import { describe, expect, it } from 'vitest';

import { districtsForMap } from './districts';
import { WORLD_INTERIORS, isInsideRect, type MapInterior, type Rect } from './interiors';
import { RUN_INSERTIONS, type RunInsertion } from '../run/runGeneration';
import { EXTRACTION_POINTS } from './extractionPoints';
import { getWorldMap, type WorldMapDefinition, type WorldMapId } from '../worldMap';
import type { GridPosition } from '../movement/gridMovement';

/**
 * What an author can get wrong about a roofed place.
 *
 * The rules here are the ones the header of `interiors.ts` argues for, turned
 * into questions a suite can ask. The two that matter most are both about the
 * same fault - the captain sealed into a dead end by a hunter that had settled
 * in the gap he came through - so an interior must have **two mouths**, and no
 * single tile of it may be a dead end. The third is that a cave is a *choice*:
 * seal it and every place on the map must still be reachable, or the hole in
 * the hill has quietly become the map.
 */

const STEPS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;

function walkable(map: WorldMapDefinition, tile: GridPosition): boolean {
  return (
    tile.x >= 0 &&
    tile.y >= 0 &&
    tile.x < map.width &&
    tile.y < map.height &&
    !map.collision[tile.y][tile.x]
  );
}

/** Every walkable tile the lid covers. */
function floorOf(map: WorldMapDefinition, roof: Rect): GridPosition[] {
  const floor: GridPosition[] = [];
  for (let y = roof.y; y < roof.y + roof.height; y += 1) {
    for (let x = roof.x; x < roof.x + roof.width; x += 1) {
      if (walkable(map, { x, y })) {
        floor.push({ x, y });
      }
    }
  }
  return floor;
}

/** Walking distances from one tile, with `blocked` treated as solid. */
function distancesFrom(
  map: WorldMapDefinition,
  start: GridPosition,
  blocked: ReadonlySet<string> = new Set(),
): Map<string, number> {
  const seen = new Map<string, number>();
  if (!walkable(map, start) || blocked.has(key(start))) {
    return seen;
  }
  seen.set(key(start), 0);
  let frontier: GridPosition[] = [start];
  while (frontier.length > 0) {
    const next: GridPosition[] = [];
    for (const tile of frontier) {
      for (const step of STEPS) {
        const neighbour = { x: tile.x + step.x, y: tile.y + step.y };
        const id = key(neighbour);
        if (!walkable(map, neighbour) || seen.has(id) || blocked.has(id)) {
          continue;
        }
        seen.set(id, (seen.get(key(tile)) ?? 0) + 1);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return seen;
}

/** Every tile of an interior, as ids, so it can be sealed in one go. */
function roofTiles(roof: Rect): Set<string> {
  const tiles = new Set<string>();
  for (let y = roof.y; y < roof.y + roof.height; y += 1) {
    for (let x = roof.x; x < roof.x + roof.width; x += 1) {
      tiles.add(`${x},${y}`);
    }
  }
  return tiles;
}

const mapFor = (id: WorldMapId): WorldMapDefinition => getWorldMap(id, []);

const insertionsOn = (mapId: WorldMapId): RunInsertion[] =>
  Object.values(RUN_INSERTIONS).filter((insertion) => insertion.mapId === mapId);

const exitsOn = (mapId: WorldMapId) =>
  EXTRACTION_POINTS.filter((point) => point.mapId === mapId);

describe.each(WORLD_INTERIORS.map((interior) => [interior.id, interior] as const))(
  '%s',
  (_id, interior: MapInterior) => {
    const map = mapFor(interior.mapId);
    const floor = floorOf(map, interior.roof);

    it('is drawn inside its map', () => {
      expect(interior.roof.x).toBeGreaterThanOrEqual(0);
      expect(interior.roof.y).toBeGreaterThanOrEqual(0);
      expect(interior.roof.x + interior.roof.width).toBeLessThanOrEqual(map.width);
      expect(interior.roof.y + interior.roof.height).toBeLessThanOrEqual(map.height);
      // A lid covers everything but its mouths, and there the hillside's own
      // ground is painted too - one layer under the other, because every wall
      // material on this sheet is an overlay and a lid has to be opaque.
      const mouths = new Set(interior.mouths.map(key));
      let covered = 0;
      for (let y = interior.roof.y; y < interior.roof.y + interior.roof.height; y += 1) {
        for (let x = interior.roof.x; x < interior.roof.x + interior.roof.width; x += 1) {
          if (mouths.has(`${x},${y}`)) {
            expect(map.layers.roofGround.tiles[y][x], `lid over the mouth at ${x},${y}`).toBe(-1);
            expect(map.layers.roof.tiles[y][x], `lid over the mouth at ${x},${y}`).toBe(-1);
            continue;
          }
          expect(map.layers.roofGround.tiles[y][x], `hole in the lid at ${x},${y}`).toBeGreaterThanOrEqual(0);
          covered += 1;
        }
      }
      expect(covered).toBe(interior.roof.width * interior.roof.height - interior.mouths.length);
    });

    it('has at least two mouths, each one a walkable tile under its own lid', () => {
      // The whole of why a room here is never a pocket. One door is the shape
      // of the fault this rule exists for.
      expect(interior.mouths.length).toBeGreaterThanOrEqual(2);
      for (const mouth of interior.mouths) {
        expect(walkable(map, mouth)).toBe(true);
        expect(isInsideRect(interior.roof, mouth)).toBe(true);
      }
    });

    it('opens onto the outside at every mouth', () => {
      for (const mouth of interior.mouths) {
        const outside = STEPS.map((step) => ({ x: mouth.x + step.x, y: mouth.y + step.y })).filter(
          (tile) => walkable(map, tile) && !isInsideRect(interior.roof, tile),
        );
        expect(outside.length, `mouth ${key(mouth)} opens onto nothing`).toBeGreaterThan(0);
      }
    });

    it('is one place: every floor tile reaches every mouth without leaving it', () => {
      const outsideSealed = new Set<string>();
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (!isInsideRect(interior.roof, { x, y })) {
            outsideSealed.add(`${x},${y}`);
          }
        }
      }
      for (const mouth of interior.mouths) {
        const inside = distancesFrom(map, mouth, outsideSealed);
        for (const tile of floor) {
          expect(inside.has(key(tile)), `${key(tile)} is cut off from mouth ${key(mouth)}`).toBe(
            true,
          );
        }
      }
    });

    it('has no dead end: block any one tile of it and everything else still gets out', () => {
      // A figure is collision, so any floor tile may be occupied - by the
      // hunter above all. This is the guarantee that whoever is inside always
      // has somewhere to go, made by construction rather than hoped for.
      const mouths = new Set(interior.mouths.map(key));
      for (const blocker of floor) {
        const blocked = new Set([key(blocker)]);
        for (const tile of floor) {
          if (key(tile) === key(blocker)) {
            continue;
          }
          const reached = distancesFrom(map, tile, blocked);
          const out = [...reached.keys()].some(
            (id) => mouths.has(id) || !roofTiles(interior.roof).has(id),
          );
          expect(out, `${key(tile)} is sealed in when ${key(blocker)} is stood on`).toBe(true);
        }
      }
    });

    it('is a way through, and a long enough one to be a place', () => {
      const [first, ...rest] = interior.mouths;
      const distances = distancesFrom(map, first);
      for (const other of rest) {
        const steps = distances.get(key(other));
        expect(steps, `no route from ${key(first)} to ${key(other)}`).toBeDefined();
        // A hole through a hill that is four steps long is a doorway, not a
        // cave. Twelve is the floor a place has to clear to be worth the risk
        // of walking into it.
        expect(steps).toBeGreaterThanOrEqual(12);
      }
    });

    it('is never the only way anywhere', () => {
      // Seal the whole hill: every tile the map could reach before must still
      // be reachable. A cave that some landmark can only be got at through is
      // not an alternative route, it is the route with a roof on it - and it
      // would make the hunter standing in a mouth a lid after all.
      //
      // Asked as a difference rather than against a list of places, because a
      // map has ground behind its gates that no landing reaches with the gates
      // shut, and that was true before this cave was cut.
      const sealed = roofTiles(interior.roof);
      const landings = insertionsOn(interior.mapId);
      expect(landings.length).toBeGreaterThan(0);
      for (const landing of landings) {
        const withCave = distancesFrom(map, landing.position);
        const withoutCave = distancesFrom(map, landing.position, sealed);
        for (const id of withCave.keys()) {
          if (sealed.has(id)) {
            continue;
          }
          expect(
            withoutCave.has(id),
            `${id} is only reachable from ${key(landing.position)} through ${interior.id}`,
          ).toBe(true);
        }
      }
    });

    it('holds no tree crown, because a cave has no sky', () => {
      // The lid is above the canopy, so a crown left standing inside one is
      // invisible until the lid comes off and then it is a beech in a mine.
      for (let y = interior.roof.y; y < interior.roof.y + interior.roof.height; y += 1) {
        for (let x = interior.roof.x; x < interior.roof.x + interior.roof.width; x += 1) {
          expect(map.layers.canopy.tiles[y][x], `crown at ${x},${y}`).toBe(-1);
        }
      }
    });

    it('is named as its own place, with the wildlife its floor rolls for', () => {
      const district = districtsForMap(interior.mapId).find(
        (candidate) => candidate.name === interior.label,
      );
      expect(district, `no district named ${interior.label}`).toBeDefined();
      expect(district?.areas).toEqual([interior.roof]);
      if (interior.floorRolls) {
        // Every step of the floor rolls, so an interior without a table of its
        // own would quietly roll the map's fallback underground.
        expect(district?.encounters).toBeDefined();
        expect(district?.encounters?.entries.length ?? 0).toBeGreaterThan(0);
      }
    });

    it('has no tall grass in it, and takes no exit or landing under its lid', () => {
      for (const tile of floor) {
        expect(map.tallGrass[tile.y][tile.x], `tall grass at ${key(tile)}`).toBe(false);
      }
      // An open exit takes whoever steps on it, so one inside a passage would
      // end the raid of anybody walking through - and a landing under a lid
      // would open the raid in the dark.
      for (const point of exitsOn(interior.mapId)) {
        expect(isInsideRect(interior.roof, point.position)).toBe(false);
      }
      for (const insertion of insertionsOn(interior.mapId)) {
        expect(isInsideRect(interior.roof, insertion.position)).toBe(false);
      }
    });
  },
);

describe('the authored set', () => {
  it('names every interior once', () => {
    const ids = WORLD_INTERIORS.map((interior) => interior.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every interior dim rather than dark', () => {
    for (const interior of WORLD_INTERIORS) {
      // A veil that can be seen through. Darkness here is atmosphere: a cave
      // the player cannot read is a cave that wants a lamp, and a lamp is the
      // terrain key this game refuses.
      expect(interior.dim).toBeGreaterThan(0);
      expect(interior.dim).toBeLessThanOrEqual(0.6);
    }
  });
});
