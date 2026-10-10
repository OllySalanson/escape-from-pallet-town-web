import { afterEach, describe, expect, it } from 'vitest';
import { WeatherId } from '../pokemon/battle/weather';
import { getWorldMap } from '../worldMap';
import { weatherAt } from '../world/districts';
import { gateKey, gatesForMap } from '../world/gates';
import { ledgeHopAt } from '../world/ledges';
import { buildPlayerMap, readMapFile, type MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import { registerPlayerMap, unregisterPlayerMap } from '../world/playerMaps';
import {
  addDistrict,
  blankMap,
  keepOnMap,
  moveThing,
  paint,
  placeDoor,
  placeSpot,
  rectangle,
  removeThing,
  resizeMap,
  updateThing,
} from './draft';

/**
 * A 30x20 map split down the middle by a wood with a one-tile gap at 15,10:
 * the drop-in on the west side, the exit wherever a test puts it.
 */
function splitMap(exit: { x: number; y: number }): MapFile {
  let file: MapFile = { ...blankMap(30, 20, 'Doors'), maker: 'Tester' };
  file = paint(
    file,
    rectangle({ x: 15, y: 0 }, { x: 15, y: 19 }).filter((tile) => tile.y !== 10),
    'T',
  );
  for (const [kind, at] of [
    ['drop-in', { x: 5, y: 10 }],
    ['exit', exit],
  ] as const) {
    const outcome = placeSpot(file, kind, at);
    if (!outcome.placed) {
      throw new Error(outcome.reason);
    }
    file = outcome.file;
  }
  return file;
}

function withDoor(
  file: MapFile,
  ...args: Parameters<typeof placeDoor> extends [MapFile, ...infer R] ? R : never
): MapFile {
  const outcome = placeDoor(file, ...args);
  if (!outcome.placed) {
    throw new Error(outcome.reason);
  }
  return outcome.file;
}

const check = (file: MapFile, id: string) => checkMapFile(file).find((entry) => entry.id === id);

/** A 30x20 map with its front door and a way out, for painting ledges on. */
function ledgeMap(): MapFile {
  let file: MapFile = { ...blankMap(30, 20, 'Ledges'), maker: 'Tester' };
  for (const [kind, at] of [
    ['drop-in', { x: 3, y: 3 }],
    ['exit', { x: 26, y: 16 }],
  ] as const) {
    const outcome = placeSpot(file, kind, at);
    file = outcome.placed ? outcome.file : file;
  }
  return file;
}

const registered: MapFile[] = [];
function play(file: MapFile): ReturnType<typeof buildPlayerMap> {
  const map = buildPlayerMap(file);
  registerPlayerMap(map);
  registered.push(file);
  return map;
}

afterEach(() => {
  for (const file of registered.splice(0)) {
    unregisterPlayerMap(buildPlayerMap(file).id);
  }
});

describe('a Cut tree', () => {
  it('is a field-move gate that shuts its tile until Cut opens it, for good', () => {
    const file = withDoor(splitMap({ x: 25, y: 10 }), 'cut-tree', { x: 15, y: 10 });
    const map = play(file);
    const [gate] = gatesForMap(map.id);
    expect(gate).toMatchObject({ fieldMove: 'cut', tiles: [{ x: 15, y: 10 }] });
    expect(getWorldMap(map.id).collision[10][15]).toBe(true);
    expect(getWorldMap(map.id, [gateKey(gate)]).collision[10][15]).toBe(false);
  });

  it('may not be the only way out, but may stand in front of what a raid is for', () => {
    const shut = withDoor(splitMap({ x: 25, y: 10 }), 'cut-tree', { x: 15, y: 10 });
    expect(check(shut, 'way-out')?.passed).toBe(false);

    // An exit on the near side, and an item spot behind the tree.
    let behind = withDoor(splitMap({ x: 5, y: 15 }), 'cut-tree', { x: 15, y: 10 });
    const item = placeSpot(behind, 'item', { x: 25, y: 10 });
    expect(item.placed).toBe(true);
    behind = item.placed ? item.file : behind;
    expect(check(behind, 'way-out')?.passed).toBe(true);
    expect(check(behind, 'reachable')?.passed).toBe(true);
  });

  it('cannot stand on a tile something else is on', () => {
    const file = splitMap({ x: 25, y: 10 });
    expect(placeDoor(file, 'cut-tree', { x: 5, y: 10 }).placed).toBe(false);
    const once = withDoor(file, 'cut-tree', { x: 10, y: 10 });
    expect(placeDoor(once, 'cut-tree', { x: 10, y: 10 }).placed).toBe(false);
  });
});

describe('Surf water', () => {
  it('is deep water shut and a ford to wade once Surf has crossed it', () => {
    const file = withDoor(splitMap({ x: 25, y: 10 }), 'surf', { x: 15, y: 9 }, { x: 15, y: 11 });
    const map = play(file);
    const [gate] = gatesForMap(map.id);
    expect(gate.fieldMove).toBe('surf');
    expect(gate.tiles).toHaveLength(3);
    expect(getWorldMap(map.id).collision[10][15]).toBe(true);
    expect(getWorldMap(map.id, [gateKey(gate)]).collision[10][15]).toBe(false);
  });

  it('moves whole, and is taken off a map shrunk out from under it', () => {
    const file = withDoor(splitMap({ x: 25, y: 10 }), 'surf', { x: 8, y: 4 }, { x: 10, y: 5 });
    const moved = moveThing(file, { kind: 'door', index: 0 }, { x: 20, y: 14 });
    expect(moved.placed && moved.file.doors?.[0]).toMatchObject({
      x: 20,
      y: 14,
      width: 3,
      height: 2,
    });
    expect(removeThing(file, { kind: 'door', index: 0 }).doors).toEqual([]);
    expect(
      keepOnMap({ ...file, width: 9, ground: file.ground.map((row) => row.slice(0, 9)) }).doors,
    ).toEqual([]);
    const east = withDoor(splitMap({ x: 25, y: 10 }), 'surf', { x: 22, y: 4 }, { x: 24, y: 5 });
    expect(resizeMap(east, 20, 16).doors).toEqual([]);
  });
});

describe('the map file', () => {
  it('refuses a door it cannot draw', () => {
    const file = splitMap({ x: 25, y: 10 });
    for (const doors of [
      [{ kind: 'cut-tree', x: 3, y: 3, width: 2, height: 1 }],
      [{ kind: 'boulder', x: 3, y: 3, width: 1, height: 1 }],
      [{ kind: 'surf', x: 28, y: 3, width: 4, height: 1 }],
    ]) {
      expect(readMapFile({ ...file, doors }).ok).toBe(false);
    }
    expect(
      readMapFile({ ...file, doors: [{ kind: 'surf', x: 3, y: 3, width: 4, height: 2 }] }).ok,
    ).toBe(true);
  });
});

describe('a painted ledge', () => {
  it('is a drop a player hops down and never back up', () => {
    let file = ledgeMap();
    file = paint(file, rectangle({ x: 8, y: 8 }, { x: 12, y: 8 }), '=');
    file = {
      ...file,
      ground: file.ground.map((row, y) => (y === 8 ? row.replace('=====', '<===>') : row)),
    };
    const map = play(file);
    expect(map.ledges).toHaveLength(1);
    expect(ledgeHopAt(map.id, { x: 10, y: 7 }, 'down')?.landing).toEqual({ x: 10, y: 9 });
    expect(ledgeHopAt(map.id, { x: 10, y: 9 }, 'up')).toBeNull();
  });

  it('never lands a player on a way out of the map', () => {
    let file = ledgeMap();
    file = {
      ...file,
      ground: file.ground.map((row, y) =>
        y === 8 ? `${row.slice(0, 8)}<=>${row.slice(11)}` : row,
      ),
    };
    const outcome = placeSpot(file, 'exit', { x: 9, y: 9 });
    file = outcome.placed ? outcome.file : file;
    const map = play(file);
    expect(ledgeHopAt(map.id, { x: 9, y: 7 }, 'down')).toBeNull();
    expect(ledgeHopAt(map.id, { x: 8, y: 7 }, 'down')?.landing).toEqual({ x: 8, y: 9 });
  });
});

describe('a district in the rain', () => {
  it('rains on every fight fought in it, and says nothing about rain where it is dry', () => {
    const file = splitMap({ x: 25, y: 10 });
    const added = addDistrict(file, { x: 2, y: 2 }, { x: 10, y: 10 });
    expect(added.placed).toBe(true);
    if (!added.placed) {
      return;
    }
    const wet = updateThing(added.file, added.thing, { rain: true });
    expect(wet.districts?.[0].rain).toBe(true);
    const map = play(wet);
    expect(weatherAt(map.id, { x: 5, y: 5 })).toBe(WeatherId.Rain);
    expect(weatherAt(map.id, { x: 20, y: 15 })).toBeNull();
    const dry = updateThing(wet, added.thing, { rain: false });
    expect(dry.districts?.[0]).not.toHaveProperty('rain');
  });
});
