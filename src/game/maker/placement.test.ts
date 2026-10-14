import { describe, expect, it } from 'vitest';
import { checkMapFile } from '../world/mapFileChecks';
import { buildPlayerMap, readMapFile, type MapFile } from '../world/mapFile';
import { focusArea, makeInside, moveBuilding } from './areas';
import {
  blankMap,
  moveThing,
  paintWith,
  placeBuilding,
  placeDoor,
  placeSpot,
  rectangle,
  removeThing,
  setMaker,
} from './draft';
import { groundBrush } from './palette';
import {
  clearGrownWood,
  footprintOf,
  paintAround,
  planPiece,
  spotRefusal,
  type PlacementPlan,
} from './placement';

/**
 * The map maker's collisions (`placement.ts`): what may go where, what a
 * placement clears and what refuses it - the rules asked directly, as the
 * ghost and the click both ask them.
 */

/** A 34x26 map: grass in a ring of whole trees, with a way in and a way out, and whatever a test paints. */
function map(paint: (x: number, y: number) => string | undefined = () => undefined): MapFile {
  const width = 34;
  const height = 26;
  return {
    ...setMaker(blankMap(width, height, 'Collisions'), 'Tester'),
    ground: Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) =>
        x < 2 || y < 2 || x >= width - 2 || y >= height - 2 ? 'T' : (paint(x, y) ?? '.'),
      ).join(''),
    ),
    dropIns: [{ x: 3, y: 22, name: 'Gate' }],
    exits: [{ x: 30, y: 22, name: 'Way out', opens: { when: 'always' } }],
  };
}

const inRect = (x: number, y: number, [x0, y0, x1, y1]: readonly number[]): boolean =>
  x >= x0 && x <= x1 && y >= y0 && y <= y1;
const forest = (rect: readonly number[]) => (x: number, y: number) =>
  inRect(x, y, rect) ? 'T' : undefined;
const pond = (rect: readonly number[]) => (x: number, y: number) =>
  inRect(x, y, rect) ? 'W' : undefined;

function placed<T extends { readonly placed: boolean }>(outcome: T): Extract<T, { placed: true }> {
  if (!outcome.placed) {
    throw new Error((outcome as unknown as { reason: string }).reason);
  }
  return outcome as Extract<T, { placed: true }>;
}

/** Every lattice block of a map's ground with some of its tiles trees and some not: half a tree. */
function halfTrees(file: MapFile): string[] {
  const found: string[] = [];
  for (let top = 0; top + 1 < file.height; top += 2) {
    for (let left = 0; left + 1 < file.width; left += 2) {
      const trees = [
        file.ground[top][left],
        file.ground[top][left + 1],
        file.ground[top + 1][left],
        file.ground[top + 1][left + 1],
      ].filter((letter) => letter === 'T').length;
      if (trees > 0 && trees < 4) {
        found.push(`${left},${top}`);
      }
    }
  }
  return found;
}

const keyOf = ({ x, y }: { x: number; y: number }): string => `${x},${y}`;

describe('a building dropped on a wood (the captain, 2026-10-12)', () => {
  const wood = map(forest([6, 6, 25, 19]));
  const plan: PlacementPlan = planPiece(wood, 'gym', { x: 11, y: 9 });

  it('is planted, and fells every tree under it and in front of its door, whole', () => {
    expect(plan.ok).toBe(true);
    const file = plan.file!;
    for (const tile of plan.footprint) {
      expect(file.ground[tile.y][tile.x], keyOf(tile)).toBe('.');
    }
    for (const step of plan.doorsteps) {
      expect(file.ground[step.y][step.x], keyOf(step)).toBe('.');
    }
    expect(halfTrees(file)).toEqual([]);
  });

  it('fells the trees whose tips would hang over its walls, so no crown is drawn over its roof', () => {
    const file = plan.file!;
    // The gym's bottom row is 13: a tree with its body on row 14 would hang its tip over it.
    for (let x = 11; x < 17; x += 1) {
      expect(file.ground[14][x], `${x},14`).not.toBe('T');
    }
    const layers = buildPlayerMap(file).compose().layers;
    for (const tile of plan.footprint) {
      expect(layers.canopy.tiles[tile.y][tile.x], keyOf(tile)).toBe(-1);
    }
  });

  it('shows what it will clear before the click, and says so', () => {
    expect(plan.clears.length).toBeGreaterThan(plan.footprint.length);
    expect(plan.note).toMatch(/^Clears \d+ trees\.$/);
  });

  it('leaves a gym whose roof stands on grass and whose walls stand in the wood just as clean', () => {
    const edge = planPiece(map(forest([6, 10, 25, 19])), 'gym', { x: 11, y: 7 });
    expect(edge.ok).toBe(true);
    expect(halfTrees(edge.file!)).toEqual([]);
    const layers = buildPlayerMap(edge.file!).compose().layers;
    for (const tile of edge.footprint) {
      expect(layers.canopy.tiles[tile.y][tile.x], keyOf(tile)).toBe(-1);
    }
  });

  it('is one step: the map it makes is the map before with the gym and its clearing', () => {
    const outcome = placed(placeBuilding(wood, 'gym', { x: 11, y: 9 }));
    expect(outcome.file).toEqual(plan.file);
    expect(outcome.note).toBe(plan.note);
  });
});

describe('a building and what is already there', () => {
  it('refuses another building, red where they meet, and says which', () => {
    const file = placed(placeBuilding(map(), 'house', { x: 12, y: 10 })).file;
    const plan = planPiece(file, 'house', { x: 14, y: 11 });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe('The house is in the way.');
    expect(plan.blocked.length).toBeGreaterThan(0);
    expect(plan.blocked.every((tile) => inRect(tile.x, tile.y, [12, 10, 16, 13]))).toBe(true);
  });

  it('clears loose clutter - a tree, a crate, a stump - as one step', () => {
    let file = map();
    for (const [kind, x, y] of [
      ['tree', 14, 10],
      ['crate', 12, 13],
      ['stump', 16, 13],
    ] as const) {
      file = placed(placeBuilding(file, kind, { x, y })).file;
    }
    const outcome = placed(placeBuilding(file, 'house', { x: 12, y: 10 }));
    expect(outcome.file.buildings).toEqual([{ x: 12, y: 10, kind: 'house' }]);
    expect(outcome.thing).toEqual({ kind: 'building', index: 0 });
    expect(outcome.note).toBe('Clears a tree, a crate and a stump.');
  });

  it('refuses a structure: a fountain is not clutter', () => {
    const file = placed(placeBuilding(map(), 'fountain', { x: 14, y: 11 })).file;
    expect(planPiece(file, 'house', { x: 12, y: 10 })).toMatchObject({
      ok: false,
      reason: 'The fountain is in the way.',
    });
  });

  it.each([
    ['berry-tree', 'The Oran Berry tree is in the way.'],
    ['person', 'Person 1 is in the way.'],
    ['item', 'An item spot is in the way.'],
    ['sign', 'A sign is in the way.'],
    ['exit', 'Exit 1 is in the way.'],
    ['drop-in', 'Drop-in 1 is in the way.'],
  ] as const)('refuses to stand on a %s', (kind, reason) => {
    const file = placed(placeSpot(map(), kind, { x: 14, y: 12 })).file;
    expect(planPiece(file, 'house', { x: 12, y: 10 })).toMatchObject({
      ok: false,
      reason,
      blocked: [{ x: 14, y: 12 }],
    });
  });

  it('names everything standing where it would stand, not only the first', () => {
    let file = map();
    for (const [kind, x, y] of [
      ['berry-tree', 13, 12],
      ['person', 15, 12],
    ] as const) {
      file = placed(placeSpot(file, kind, { x, y })).file;
    }
    expect(planPiece(file, 'house', { x: 12, y: 10 }).reason).toBe(
      'The Oran Berry tree and Person 1 are in the way.',
    );
    file = placed(placeSpot(file, 'item', { x: 14, y: 13 })).file;
    file = placed(placeSpot(file, 'sign', { x: 16, y: 13 })).file;
    expect(planPiece(file, 'house', { x: 12, y: 10 }).reason).toBe(
      'The Oran Berry tree, Person 1 and 2 more things are in the way.',
    );
  });

  it('refuses a field move door under it', () => {
    const file = placed(placeDoor(map(), 'cut-tree', { x: 14, y: 12 })).file;
    expect(planPiece(file, 'house', { x: 12, y: 10 })).toMatchObject({
      ok: false,
      reason: 'The small tree is in the way.',
    });
  });

  it.each([
    ['W', 'That is deep water.'],
    ['w', 'That is shallow water.'],
    ['C', 'Rock is in the way.'],
    ['F', 'A fence is in the way.'],
    ['B', 'A wall is in the way.'],
    ['=', 'A ledge is in the way.'],
  ])('refuses %s under it', (letter, reason) => {
    const file = map((x, y) => (inRect(x, y, [10, 12, 24, 17]) ? letter : undefined));
    expect(planPiece(file, 'house', { x: 13, y: 10 })).toMatchObject({ ok: false, reason });
  });

  it('refuses a door opening onto water, and clears trees in front of one', () => {
    expect(planPiece(map(pond([10, 14, 24, 17])), 'house', { x: 13, y: 10 })).toMatchObject({
      ok: false,
      reason: 'Its door would open onto deep water.',
      blocked: [{ x: 14, y: 14 }],
    });
    const trees = planPiece(map(forest([6, 14, 25, 19])), 'house', { x: 13, y: 10 });
    expect(trees.ok).toBe(true);
    expect(trees.file!.ground[14][14]).toBe('.');
    expect(halfTrees(trees.file!)).toEqual([]);
  });

  it('refuses a door opening off the edge of the map', () => {
    expect(planPiece(map(), 'house', { x: 13, y: 22 })).toMatchObject({
      ok: false,
      reason: 'Its door would open off the edge of the map.',
    });
  });

  it('lets the pieces made for water stand in it', () => {
    const water = map(pond([10, 10, 24, 20]));
    for (const kind of ['jetty', 'bridge', 'ss-anne', 'lilies'] as const) {
      expect(planPiece(water, kind, { x: 12, y: 12 }).ok, kind).toBe(true);
    }
  });

  it('cuts a cave mouth only into the foot of a rock face', () => {
    expect(planPiece(map(), 'cave-mouth', { x: 12, y: 10 })).toMatchObject({ ok: false });
    const rock = map((x, y) => (inRect(x, y, [10, 8, 14, 10]) ? 'C' : undefined));
    expect(planPiece(rock, 'cave-mouth', { x: 12, y: 10 }).ok).toBe(true);
  });

  it('lets a small thing clear growth but not another thing, and a building clear both', () => {
    const hedge = map((x, y) => (inRect(x, y, [10, 10, 20, 10]) ? '#' : undefined));
    expect(planPiece(hedge, 'crate', { x: 12, y: 10 }).ok).toBe(true);
    const stump = placed(placeBuilding(map(), 'stump', { x: 12, y: 10 })).file;
    expect(planPiece(stump, 'crate', { x: 12, y: 10 })).toMatchObject({
      ok: false,
      reason: 'The stump is in the way.',
    });
  });

  it('keeps a crown off a roof: a tree whose leaves would hang over a house is refused', () => {
    const house = placed(placeBuilding(map(), 'house', { x: 12, y: 8 })).file;
    // A broadleaf's top row is its crown: planted with it on the house's bottom
    // row, clear of the house's doorstep.
    expect(planPiece(house, 'tree', { x: 15, y: 11 })).toMatchObject({
      ok: false,
      reason: 'Its leaves would hang over the house.',
    });
  });

  it('will not box in a berry tree it would stand beside', () => {
    // A berry tree in a notch of a hedge, its one open side to the north.
    const notch = map((x, y) =>
      inRect(x, y, [10, 10, 20, 12]) && !(x === 15 && y === 10) ? '#' : undefined,
    );
    const file = placed(placeSpot(notch, 'berry-tree', { x: 15, y: 10 })).file;
    expect(planPiece(file, 'crate', { x: 15, y: 9 })).toMatchObject({
      ok: false,
      reason: 'It would box in the Oran Berry tree: leave it a side to be reached from.',
    });
  });
});

describe('a one-tile thing and what is already there', () => {
  const house = placed(placeBuilding(map(), 'house', { x: 12, y: 10 })).file;

  it('refuses a roof, a wood, water and the doorstep of a house', () => {
    expect(spotRefusal(house, 'berry-tree', { x: 14, y: 11 })?.reason).toBe(
      'The house is in the way.',
    );
    expect(spotRefusal(map(forest([6, 10, 25, 19])), 'berry-tree', { x: 15, y: 14 })?.reason).toBe(
      'Trees are in the way.',
    );
    expect(spotRefusal(map(pond([10, 10, 20, 20])), 'person', { x: 15, y: 15 })?.reason).toBe(
      'That is deep water.',
    );
    const step = footprintOf({ kind: 'house', x: 12, y: 10 }).doorsteps[0];
    expect(spotRefusal(house, 'item', step)?.reason).toBe(
      'That is the doorstep of the house: keep it clear.',
    );
  });

  it('refuses a tile under a crown, where it would be hidden', () => {
    const tree = placed(placeBuilding(map(), 'tree', { x: 12, y: 10 })).file;
    expect(spotRefusal(tree, 'item', { x: 13, y: 10 })?.reason).toBe(
      "It would be hidden under the tree's leaves.",
    );
  });

  it('stands on a walked cell of something, as on a bridge', () => {
    const bridge = placed(
      placeBuilding(map(pond([10, 8, 24, 20])), 'bridge', { x: 14, y: 10 }),
    ).file;
    expect(spotRefusal(bridge, 'item', { x: 14, y: 11 })).toBeUndefined();
  });

  it('refuses a tile nothing could reach, and a tile that takes the last side of something beside it', () => {
    const pocket = map((x, y) =>
      inRect(x, y, [10, 10, 12, 12]) && !(x === 11 && y === 11) ? '#' : undefined,
    );
    expect(spotRefusal(pocket, 'berry-tree', { x: 11, y: 11 })?.reason).toBe(
      'Nothing could reach it there: give it a side to be walked up to.',
    );
    const notch = map((x, y) =>
      inRect(x, y, [10, 10, 20, 12]) && !(x === 15 && y === 10) ? '#' : undefined,
    );
    const berry = placed(placeSpot(notch, 'berry-tree', { x: 15, y: 10 })).file;
    expect(spotRefusal(berry, 'person', { x: 15, y: 9 })?.reason).toBe(
      'It would box in the Oran Berry tree: leave it a side to be reached from.',
    );
    // Walked onto, an item takes no side away: it is a way in, not a wall.
    expect(spotRefusal(berry, 'item', { x: 15, y: 9 })).toBeUndefined();
  });

  it('is carried by the same rules, and may be carried onto the tile it left', () => {
    const file = placed(placeSpot(house, 'berry-tree', { x: 20, y: 15 })).file;
    expect(moveThing(file, { kind: 'berry-tree', index: 0 }, { x: 14, y: 11 })).toMatchObject({
      placed: false,
      reason: 'The house is in the way.',
    });
    expect(moveThing(file, { kind: 'berry-tree', index: 0 }, { x: 21, y: 15 }).placed).toBe(true);
  });

  it('keeps a Cut tree off a berry tree and out of a wood', () => {
    const berry = placed(placeSpot(map(), 'berry-tree', { x: 15, y: 12 })).file;
    expect(placeDoor(berry, 'cut-tree', { x: 15, y: 12 })).toMatchObject({
      placed: false,
      reason: 'The Oran Berry tree is in the way.',
    });
    expect(placeDoor(map(forest([6, 10, 25, 19])), 'cut-tree', { x: 15, y: 14 })).toMatchObject({
      placed: false,
    });
  });
});

describe('painting round what stands on the map', () => {
  const brush = (id: string) => groundBrush(id)!;

  it('paints a stroke of water round a house, and leaves the ground under it alone', () => {
    const house = placed(placeBuilding(map(), 'house', { x: 13, y: 10 })).file;
    const tiles = rectangle({ x: 9, y: 12 }, { x: 23, y: 12 });
    const painted = paintAround(house, tiles, brush('water'), paintWith);
    expect(painted.file.ground[12].slice(9, 24)).toBe('WWWW.....WWWWWW');
    expect(painted.skipped).toHaveLength(5);
    expect(painted.reason).toBe('Water cannot go under the house.');
  });

  it('paints grass, tall grass and flowers round and under anything', () => {
    const house = placed(placeBuilding(map(), 'house', { x: 13, y: 10 })).file;
    const tiles = rectangle({ x: 9, y: 12 }, { x: 23, y: 12 });
    expect(paintAround(house, tiles, brush('tall-grass'), paintWith).skipped).toEqual([]);
  });

  it('skips the tiles of a berry tree and a person in a stroke of trees', () => {
    let file = placed(placeSpot(map(), 'berry-tree', { x: 14, y: 12 })).file;
    file = placed(placeSpot(file, 'person', { x: 18, y: 12 })).file;
    const painted = paintAround(
      file,
      rectangle({ x: 9, y: 12 }, { x: 23, y: 12 }),
      brush('trees'),
      paintWith,
    );
    expect(painted.file.ground[12][14]).toBe('.');
    expect(painted.file.ground[12][18]).toBe('.');
    expect(painted.file.ground[12][10]).toBe('T');
  });

  it('leaves the last side of a berry tree open', () => {
    const notch = map((x, y) =>
      inRect(x, y, [10, 10, 20, 12]) && !(x === 15 && y === 10) ? '#' : undefined,
    );
    const berry = placed(placeSpot(notch, 'berry-tree', { x: 15, y: 10 })).file;
    const painted = paintAround(
      berry,
      rectangle({ x: 12, y: 9 }, { x: 18, y: 9 }),
      brush('wall'),
      paintWith,
    );
    expect(painted.file.ground[9][15]).toBe('.');
    expect(painted.file.ground[9][14]).toBe('B');
    expect(painted.reason).toBe(
      'A side of the Oran Berry tree is left open, so it can be reached.',
    );
    expect(checkMapFile(painted.file).find((check) => check.id === 'standing')?.passed).toBe(true);
  });

  it('will not grow a tree with its tip over a building wall, and grows the rest of the wood', () => {
    const house = placed(placeBuilding(map(), 'house', { x: 12, y: 8 })).file;
    // The house's bottom row is 11: trees with their bodies on row 12 would tip
    // over it. Painted from beside its doorstep, so that is not what stops them.
    const painted = paintAround(
      house,
      rectangle({ x: 14, y: 12 }, { x: 19, y: 15 }),
      brush('trees'),
      paintWith,
    );
    for (let x = 14; x < 18; x += 1) {
      expect(painted.file.ground[12][x], `${x},12`).not.toBe('T');
    }
    expect(painted.file.ground[12][18]).toBe('T');
    expect(painted.file.ground[14][14]).toBe('T');
    expect(painted.reason).toBe("Trees there would grow into the house's wall.");
  });

  it('keeps a doorstep clear of anything solid', () => {
    const house = placed(placeBuilding(map(), 'house', { x: 13, y: 10 })).file;
    const step = footprintOf({ kind: 'house', x: 13, y: 10 }).doorsteps[0];
    const painted = paintAround(house, [step], brush('fence'), paintWith);
    expect(painted.skipped).toEqual([step]);
    expect(painted.reason).toBe('The doorstep of the house is kept clear.');
  });
});

describe('moving and growing', () => {
  it('carries a building into a wood as it plants one, and keeps the ways through its door', () => {
    const sample = map(forest([20, 6, 31, 19]));
    let file = placed(placeBuilding(sample, 'house', { x: 6, y: 6 })).file;
    const inside = makeInside(file, 0);
    if (!inside.made) {
      throw new Error(inside.reason);
    }
    file = inside.file;
    const moved = placed(moveBuilding(file, 0, { x: 23, y: 9 }));
    expect(moved.note).toMatch(/^Clears/);
    expect(halfTrees(moved.file)).toEqual([]);
    expect(readMapFile(moved.file).ok).toBe(true);
    expect(checkMapFile(moved.file).find((check) => check.id === 'doors')?.passed).toBe(true);
  });

  it('gives back the wood it cleared when it is carried out of it (playtest 48, finding 4)', () => {
    // The Pokémon Center planted over the map's south ring of trees, then carried north.
    const ring = map();
    const planted = placed(placeBuilding(ring, 'pokemon-center', { x: 14, y: 20 }));
    expect(planted.note).toMatch(/^Clears/);
    const moved = placed(moveThing(planted.file, { kind: 'building', index: 0 }, { x: 14, y: 8 }));
    expect(moved.file.ground.slice(22)).toEqual(ring.ground.slice(22));
    expect(halfTrees(moved.file)).toEqual([]);
    expect(moved.note).toMatch(/trees grew back where it stood\.$/);
    // And taken off the map, it gives it back too.
    expect(removeThing(planted.file, { kind: 'building', index: 0 }).ground).toEqual(ring.ground);
  });

  it('grows nothing back where something has come to stand since', () => {
    const ring = map();
    let file = placed(placeBuilding(ring, 'pokemon-center', { x: 14, y: 20 })).file;
    const cleared = ring.ground.flatMap((row, y) =>
      [...row].flatMap((letter, x) => (letter !== file.ground[y][x] ? [{ x, y }] : [])),
    );
    const outside = cleared.find(
      (tile) =>
        !footprintOf(file.buildings[0]).claimed.some(
          (cell) => cell.x === tile.x && cell.y === tile.y,
        ),
    );
    expect(outside).toBeDefined();
    file = placed(placeSpot(file, 'item', outside!)).file;
    const moved = placed(moveThing(file, { kind: 'building', index: 0 }, { x: 14, y: 8 }));
    expect(moved.file.ground[outside!.y][outside!.x]).not.toBe('T');
    expect(halfTrees(moved.file)).toEqual([]);
  });

  it('keeps a carried building in its own place in the list when it clears clutter before it', () => {
    let file = placed(placeBuilding(map(), 'stump', { x: 20, y: 10 })).file;
    file = placed(placeBuilding(file, 'house', { x: 6, y: 6 })).file;
    const moved = placed(moveThing(file, { kind: 'building', index: 1 }, { x: 18, y: 9 }));
    expect(moved.file.buildings).toEqual([{ x: 18, y: 9, kind: 'house' }]);
    expect(moved.thing).toEqual({ kind: 'building', index: 0 });
  });

  it('fells only the wood a map has just grown, never what the maker drew', () => {
    const file = map();
    const grown: MapFile = {
      ...file,
      ground: file.ground.map((row) => `TT${row}`),
      width: file.width + 2,
    };
    const cleared = clearGrownWood(
      grown,
      [
        { x: 0, y: 10 },
        { x: 2, y: 10 },
      ],
      { x: 2, y: 0, width: file.width, height: file.height },
    );
    expect(cleared.ground[10].slice(0, 4)).toBe('..TT');
    expect(cleared.ground[11].slice(0, 4)).toBe('..TT');
  });
});

describe('inside a building', () => {
  const house = (() => {
    const file = placed(placeBuilding(map(), 'house', { x: 12, y: 10 })).file;
    const made = makeInside(file, 0);
    if (!made.made) {
      throw new Error(made.reason);
    }
    return { file: made.file, area: made.area };
  })();

  it('keeps the way out of the room clear', () => {
    const mat = house.file.links![0].ends[1];
    const view = focusArea(house.file, house.area);
    expect(spotRefusal(view, 'item', mat, { area: house.area })?.reason).toBe(
      'The way out of the room is there: keep it clear.',
    );
  });

  it("refuses the room's wall", () => {
    const view = focusArea(house.file, house.area);
    expect(spotRefusal(view, 'person', { x: 9, y: 1 }, { area: house.area })?.reason).toBe(
      "That is the room's wall.",
    );
    // And names the furniture standing against it.
    expect(spotRefusal(view, 'person', { x: 0, y: 1 }, { area: house.area })?.reason).toBe(
      'The kitchen sink is in the way.',
    );
  });
});

describe('a map made before the rules', () => {
  it('cannot be given an inside while something stands at its door', () => {
    const file = placed(placeBuilding(map(), 'house', { x: 12, y: 10 })).file;
    const step = footprintOf({ kind: 'house', x: 12, y: 10 }).doorsteps[0];
    const blocked: MapFile = { ...file, itemSpots: [{ x: step.x, y: step.y }] };
    expect(makeInside(blocked, 0)).toEqual({
      made: false,
      reason: 'An item spot stands at its door: move it first.',
    });
  });
});
