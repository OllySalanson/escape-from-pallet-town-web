import { describe, expect, it } from 'vitest';

import { DIRECTION_DELTAS, type GridPosition } from '../movement/gridMovement';
import { getWorldMap, getWarpAt, type WorldMapDefinition } from '../worldMap';
import { BUILDING_INSIDES, insideLayout, insidesForMap, type BuildingInside } from './buildingInsides';
import { districtAt } from './districts';
import { hiddenInArea, placedAreaAt, type PlacedArea } from './mapAreas';
import { stepDistances } from './mapStructure';
import { gatesForMap, gateKey } from './gates';
import { frontDoorFor } from '../run/runGeneration';

/**
 * What an author can get wrong about a building you can walk into.
 *
 * The rule that matters most is the one the Delve is held to (`interiors.test.ts`)
 * and for the same reason - the captain sealed into a dead end by a hunter that
 * had settled in the gap he came through: a room has **two doors**, and no
 * tile of it is a dead end, so whoever stands anywhere in it, every other tile
 * still has a way out.
 */

const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;

function roomOf(map: WorldMapDefinition, inside: BuildingInside): PlacedArea {
  const placed = map.areas?.find((area) => area.id === inside.area.id);
  if (!placed) {
    throw new Error(`${inside.area.id} is not laid out on ${map.id}`);
  }
  return placed;
}

function floorOf(map: WorldMapDefinition, room: PlacedArea): GridPosition[] {
  const floor: GridPosition[] = [];
  for (let y = room.rect.y; y < room.rect.y + room.rect.height; y += 1) {
    for (let x = room.rect.x; x < room.rect.x + room.rect.width; x += 1) {
      if (!map.collision[y][x]) {
        floor.push({ x, y });
      }
    }
  }
  return floor;
}

/** The tiles of a room you go out of it from: each mat that leads outdoors. */
function waysOut(map: WorldMapDefinition, room: PlacedArea): GridPosition[] {
  return map.warps
    .filter(
      (warp) =>
        warp.activation === 'push' &&
        placedAreaAt([room], warp.source) !== undefined &&
        placedAreaAt([map.areas![0]], warp.destination) !== undefined,
    )
    .map((warp) => warp.source);
}

describe('buildings you can walk into on the shipped maps', () => {
  it('has a room or two to start with, each with a name', () => {
    expect(BUILDING_INSIDES.length).toBeGreaterThanOrEqual(2);
    for (const inside of BUILDING_INSIDES) {
      expect(inside.area.name.length).toBeGreaterThan(0);
    }
  });

  it.each(BUILDING_INSIDES.map((inside) => [inside.area.id, inside] as const))(
    '%s has two doors, each into a building you see from the street',
    (_id, inside) => {
      expect(inside.doors.length).toBeGreaterThanOrEqual(2);
      const map = getWorldMap(inside.mapId);
      const outdoors = map.areas![0];
      const room = roomOf(map, inside);
      const streets = new Set(inside.doors.map(({ street }) => key(street)));
      expect(streets.size).toBe(inside.doors.length);
      for (const { street } of inside.doors) {
        // The street is ground outdoors, and the door is the cell above it of
        // a building that is drawn there.
        expect(placedAreaAt([outdoors], street)).toBeDefined();
        expect(map.collision[street.y][street.x]).toBe(false);
        const door = { x: street.x, y: street.y - 1 };
        expect(map.collision[door.y][door.x]).toBe(true);
        expect(map.layers.overlay.tiles[door.y][door.x] >= 0 || map.layers.detail.tiles[door.y][door.x] >= 0).toBe(true);
        // Pressing up into it goes in, and comes out on the room's own floor.
        const warp = getWarpAt(map, street, 'push', 'up');
        expect(warp).toBeDefined();
        expect(placedAreaAt([room], warp!.destination)).toBeDefined();
        // And the mat it came out on leads back to the same doorstep.
        const back = getWarpAt(map, warp!.destination, 'push', 'down');
        expect(back?.destination).toEqual(street);
      }
    },
  );

  it.each(BUILDING_INSIDES.map((inside) => [inside.area.id, inside] as const))(
    '%s has no dead end: whoever stands anywhere in it, every other tile still has a way out',
    (_id, inside) => {
      const map = getWorldMap(inside.mapId);
      const room = roomOf(map, inside);
      const floor = floorOf(map, room);
      const exits = waysOut(map, room);
      expect(exits.length).toBeGreaterThanOrEqual(2);
      const inRoom = new Set(floor.map(key));
      const stranded: string[] = [];
      for (const standing of floor) {
        const reached = new Set<string>();
        const queue = exits.filter((exit) => key(exit) !== key(standing));
        queue.forEach((tile) => reached.add(key(tile)));
        for (let index = 0; index < queue.length; index += 1) {
          const here = queue[index];
          for (const delta of Object.values(DIRECTION_DELTAS)) {
            const next = { x: here.x + delta.x, y: here.y + delta.y };
            const name = key(next);
            if (inRoom.has(name) && name !== key(standing) && !reached.has(name)) {
              reached.add(name);
              queue.push(next);
            }
          }
        }
        for (const tile of floor) {
          if (key(tile) !== key(standing) && !reached.has(key(tile))) {
            stranded.push(`${key(tile)} with someone on ${key(standing)}`);
          }
        }
      }
      expect(stranded).toEqual([]);
    },
  );

  it.each(BUILDING_INSIDES.map((inside) => [inside.area.id, inside] as const))(
    '%s can be walked into by either door in every gate state, and from the front door once they are open',
    (_id, inside) => {
      const opened = gatesForMap(inside.mapId).map(gateKey);
      for (const state of [[], opened]) {
        const map = getWorldMap(inside.mapId, state);
        const room = roomOf(map, inside);
        const from = [
          ...inside.doors.map(({ street }) => street),
          ...(state === opened ? [frontDoorFor(inside.mapId)!.position] : []),
        ];
        for (const start of from) {
          const steps = stepDistances(map.collision, start, undefined, map.links);
          const unreached = floorOf(map, room).filter((tile) => steps[tile.y][tile.x] < 0);
          expect(`from ${key(start)}: ${unreached.map(key).join(' ')}`).toBe(`from ${key(start)}: `);
        }
      }
    },
  );

  it.each(BUILDING_INSIDES.map((inside) => [inside.area.id, inside] as const))(
    '%s is a place of its own, named as you walk in, and it hides you',
    (_id, inside) => {
      const map = getWorldMap(inside.mapId);
      const room = roomOf(map, inside);
      expect(room.hides).toBe(true);
      const tile = floorOf(map, room)[0];
      expect(districtAt(inside.mapId, tile)?.name).toBe(inside.area.name.toUpperCase());
    },
  );

  it('lays the rooms out where the map is built, so the districts name the right ground', () => {
    for (const mapId of new Set(BUILDING_INSIDES.map((inside) => inside.mapId))) {
      const map = getWorldMap(mapId);
      expect(insideLayout(mapId)?.map((area) => area.rect)).toEqual(map.areas?.map((area) => area.rect));
      expect(insidesForMap(mapId).length).toBe((map.areas?.length ?? 1) - 1);
      // No floor on the grid's own edge.
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const onEdge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
          if (onEdge && !map.collision[y][x]) {
            expect(placedAreaAt([map.areas![0]], { x, y })).toBeDefined();
          }
        }
      }
    }
  });
});

describe('who a room hides', () => {
  const outdoors: PlacedArea = { id: undefined, name: 'Out', kind: 'outdoors', rect: { x: 0, y: 0, width: 10, height: 10 } };
  const hiding: PlacedArea = { id: 'press', name: 'Press', kind: 'inside', rect: { x: 11, y: 0, width: 5, height: 5 }, hides: true };
  const pocket: PlacedArea = { id: 'shed', name: 'Shed', kind: 'inside', rect: { x: 11, y: 6, width: 5, height: 4 } };
  const areas = [outdoors, hiding, pocket];

  it('hides a player in a room with two doors from a hunter outside it', () => {
    expect(hiddenInArea(areas, { x: 12, y: 2 }, { x: 3, y: 3 })).toBe(true);
    expect(hiddenInArea(areas, { x: 12, y: 2 }, undefined)).toBe(true);
  });

  it('does not hide them from a hunter in the room with them', () => {
    expect(hiddenInArea(areas, { x: 12, y: 2 }, { x: 14, y: 3 })).toBe(false);
  });

  it('never hides anyone outdoors, or in a room with one door a hunter could shut', () => {
    expect(hiddenInArea(areas, { x: 3, y: 3 }, { x: 5, y: 5 })).toBe(false);
    expect(hiddenInArea(areas, { x: 12, y: 7 }, { x: 3, y: 3 })).toBe(false);
    expect(hiddenInArea(undefined, { x: 3, y: 3 }, { x: 5, y: 5 })).toBe(false);
  });
});
