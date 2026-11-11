import { describe, expect, it } from 'vitest';
import { stepDistances } from '../../../../src/game/world/mapStructure';
import { beatSpots, buildingDoorways } from '../../../../src/game/world/mapFile';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import { getWorldMap } from '../../../../src/game/worldMap';
import { millbrook } from './millbrook';

/**
 * What Millbrook is for, in the terms it was redrawn to: a new game lands here,
 * so the rule is the harbour's rule. A redraw that keeps the roads and loses the
 * people still passes every rule a map is held to.
 */
const { file } = millbrook();
const OUTDOORS = (spot: { readonly area?: string }) => spot.area === undefined;
const SCREEN = { width: 25, height: 16 };
const open = (x: number, y: number) => {
  const letter = file.ground[y]?.[x];
  return letter !== undefined && !'TCWF#'.includes(letter);
};

describe('Millbrook, where a new game lands', () => {
  const figures = [...(file.people ?? []), ...(file.pokemon ?? [])].filter(OUTDOORS);

  it('has somebody on every screen a player can stand in the village on', () => {
    const empty: string[] = [];
    let seen = 0;
    let screens = 0;
    for (let y = 8; y < 52; y += 1) {
      for (let x = 8; x < 56; x += 1) {
        if (!open(x, y)) continue;
        const left = Math.max(0, Math.min(64 - SCREEN.width, x - 12));
        const top = Math.max(0, Math.min(64 - SCREEN.height, y - 8));
        const inView = figures.filter(
          (one) => one.x >= left && one.x < left + SCREEN.width && one.y >= top && one.y < top + SCREEN.height,
        ).length;
        seen += inView;
        screens += 1;
        if (inView === 0) empty.push(`${x},${y}`);
      }
    }
    expect(empty).toEqual([]);
    // The harbour shows 4.9 at a time; the vale as a whole showed 0.9.
    expect(seen / screens).toBeGreaterThan(3);
  });

  it('keeps every figure off the streets: a figure is a wall to a walk out', () => {
    const onStreet = figures.flatMap((figure) =>
      beatSpots(figure)
        .filter((spot) => ',d'.includes(file.ground[spot.y][spot.x]))
        .map((spot) => `${spot.x},${spot.y}`),
    );
    expect(onStreet).toEqual([]);
  });

  it('has nobody walking on the pond: the jetty\u2019s right-hand plank stops a row short', () => {
    const map = getWorldMap('greystone-vale');
    expect(map.collision[138 + 1][109]).toBe(true);
    expect(map.collision[138][109]).toBe(false);
    const wick = file.people?.find((person) => person.name === 'Old Wick');
    expect(map.collision[128 + (wick?.y ?? 0)][64 + (wick?.x ?? 0)]).toBe(false);
  });

  it('opens doors: every building a player is told about has somebody or something inside', () => {
    const areas = file.areas ?? [];
    expect(areas.map((area) => area.name)).toEqual(
      expect.arrayContaining(['The Mill', 'Millbrook Center', 'Millbrook Mart', 'The Woodshed']),
    );
    for (const area of areas) {
      const held = [...(file.people ?? []), ...file.itemSpots].filter((spot) => spot.area === area.id);
      expect(`${area.name}: ${held.length > 0}`).toBe(`${area.name}: true`);
    }
  });

  it('gives a player things to do besides leave', () => {
    const fights = (file.pokemon ?? []).filter((one) => one.level !== undefined).length;
    expect(fights).toBeGreaterThanOrEqual(3);
    expect((file.berryTrees ?? []).length).toBeGreaterThanOrEqual(5);
    expect(file.itemSpots.filter((spot) => spot.hidden).length).toBeGreaterThanOrEqual(4);
    expect(file.trainers?.every((trainer) => trainer.sight === 0)).toBe(true);
  });
});

describe('Millbrook, walked in the stitched vale', () => {
  // Millbrook is the plan's cell [0, 1], one cell in from the map's west and north edges.
  const at = (x: number, y: number) => ({ x: 64 + x, y: 128 + y });
  const landing = at(30, 32);
  const walk = (opened: readonly string[] = []) => {
    const map = getWorldMap('greystone-vale', opened);
    return stepDistances(map.collision, landing, undefined, map.links);
  };

  it('keeps Hazel’s garden behind the Cut tree, and only behind the Cut tree', () => {
    const door = gatesForMap('greystone-vale').find((gate) =>
      gate.tiles.some((tile) => tile.x === 64 + 16 && tile.y === 128 + 56),
    );
    expect(door).toBeDefined();
    const garden = at(12, 56);
    expect(walk()[garden.y][garden.x]).toBe(-1);
    expect(walk([gateKey(door!)])[garden.y][garden.x]).toBeGreaterThan(0);
  });

  it('leaves all four roads a short walk from the square, with nothing in the way', () => {
    const steps = walk();
    const roads = { north: at(30, 0), east: at(63, 30), south: at(40, 63), west: at(1, 30) };
    for (const [name, tile] of Object.entries(roads)) {
      const distance = steps[tile.y][tile.x];
      expect(`${name}: ${distance > 0 && distance < 60}`).toBe(`${name}: true`);
    }
  });

  it('reaches the island in the pool on foot, over the stones', () => {
    const island = at(28, 47);
    expect(walk()[island.y][island.x]).toBeGreaterThan(0);
  });
});

/**
 * The captain, 11 Nov 2026, of the vale after it was filled: "when you're
 * walking around, there's just often things in your way, and it's quite fiddly
 * to get through places". So the village a new game lands in is held to walking
 * two abreast: a walker two tiles wide - which is what a street is - gets from
 * where you land to every way out, door, sign, landmark, berry tree, person and
 * find, to within the one last step a door's porch or a way out's pocket is. A
 * figure counts as standing on every tile of its beat, because that is where a
 * walker meets it. A prop dropped in the middle of a walking line, a figure in a
 * gateway or a tree just inside one, and a gap one tile wide where people walk
 * each fail it, by name.
 */
describe('Millbrook, walked two abreast', () => {
  const map = getWorldMap('greystone-vale');
  const ORIGIN = { x: 64, y: 128 };
  const SIZE = 64;
  const LANDING = { x: 30, y: 32 };
  const outdoors = <T extends { readonly area?: string }>(spots: readonly T[] | undefined): T[] =>
    (spots ?? []).filter(OUTDOORS);
  const held = new Set<string>();
  for (const figure of [...outdoors(file.people), ...outdoors(file.pokemon)]) {
    for (const spot of [figure, ...beatSpots(figure)]) held.add(`${spot.x},${spot.y}`);
  }
  for (const thing of [
    ...outdoors(file.trainers),
    ...outdoors(file.signs),
    ...outdoors(file.berryTrees),
    ...outdoors(file.landmarks),
  ]) {
    held.add(`${thing.x},${thing.y}`);
  }
  const free = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < SIZE && y < SIZE && !map.collision[ORIGIN.y + y][ORIGIN.x + x] && !held.has(`${x},${y}`);
  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const walk = (fits: (x: number, y: number) => boolean, starts: readonly (readonly [number, number])[]) => {
    const steps = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(-1));
    const queue = starts.filter(([x, y]) => fits(x, y));
    for (const [x, y] of queue) steps[y][x] = 0;
    for (let k = 0; k < queue.length; k += 1) {
      const [x, y] = queue[k];
      for (const [dx, dy] of STEPS) {
        if (fits(x + dx, y + dy) && steps[y + dy][x + dx] < 0) {
          steps[y + dy][x + dx] = steps[y][x] + 1;
          queue.push([x + dx, y + dy]);
        }
      }
    }
    return steps;
  };
  /** A pair walking side by side: the 2x2 block whose top-left is (x, y), all of it free. */
  const pair = (x: number, y: number) => free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1);
  const CORNERS = [[0, 0], [-1, 0], [0, -1], [-1, -1]] as const;
  const single = walk(free, [[LANDING.x, LANDING.y]]);
  const abreast = walk(pair, CORNERS.map(([ox, oy]) => [LANDING.x + ox, LANDING.y + oy] as const));
  /** Steps to a tile walking two abreast, or -1: the nearest block that covers it. */
  const twoAbreast = (x: number, y: number): number => {
    const reached = CORNERS.map(([ox, oy]) => abreast[y + oy]?.[x + ox] ?? -1).filter((steps) => steps >= 0);
    return reached.length > 0 ? Math.min(...reached) : -1;
  };
  /** Steps to stand on a tile: two abreast all the way, or two abreast to beside it and one step in. */
  const toStand = (x: number, y: number): number => {
    if (!free(x, y)) return -1;
    const reached = [
      twoAbreast(x, y),
      ...STEPS.filter(([dx, dy]) => free(x + dx, y + dy) && twoAbreast(x + dx, y + dy) >= 0).map(
        ([dx, dy]) => twoAbreast(x + dx, y + dy) + 1,
      ),
    ].filter((steps) => steps >= 0);
    return reached.length > 0 ? Math.min(...reached) : -1;
  };
  /** Steps to face a thing that stands on its tile: to stand beside it. */
  const toFace = (x: number, y: number): number => {
    const reached = STEPS.map(([dx, dy]) => toStand(x + dx, y + dy)).filter((steps) => steps >= 0);
    return reached.length > 0 ? Math.min(...reached) : -1;
  };

  // What is narrow on purpose, and only this: the old jetty Wick fishes off, the
  // stepping stones to the island, and Hazel's garden behind the Cut tree.
  const NARROW_ON_PURPOSE = new Set(['Old Wick', 'the island', 'Hazel\u2019s garden']);
  const hazels = (x: number, y: number) => x <= 15 && y >= 53;
  const island = (x: number, y: number) => x >= 27 && x <= 30 && y >= 46 && y <= 48;
  const places = (): { name: string; steps: number; x: number; y: number }[] => {
    const named: { name: string; steps: number; x: number; y: number }[] = [];
    const add = (name: string, x: number, y: number, steps: number) => {
      const why = hazels(x, y) ? 'Hazel\u2019s garden' : island(x, y) ? 'the island' : name;
      if (!NARROW_ON_PURPOSE.has(why)) named.push({ name, steps, x, y });
    };
    for (const exit of outdoors(file.exits)) add(`the way out ${exit.name}`, exit.x, exit.y, toStand(exit.x, exit.y));
    for (const building of outdoors(file.buildings)) {
      for (const door of buildingDoorways(building)) {
        // A shed searched at its door is a landmark on the doorstep: faced, not stood on.
        const searched = outdoors(file.landmarks).some((landmark) => landmark.x === door.x && landmark.y === door.y);
        const steps = searched ? toFace(door.x, door.y) : toStand(door.x, door.y);
        add(`the door of the ${building.kind} at ${building.x},${building.y}`, door.x, door.y, steps);
      }
    }
    for (const sign of outdoors(file.signs)) add(`the sign ${sign.lines[0]}`, sign.x, sign.y, toFace(sign.x, sign.y));
    for (const landmark of outdoors(file.landmarks)) add(landmark.name, landmark.x, landmark.y, toFace(landmark.x, landmark.y));
    for (const tree of outdoors(file.berryTrees)) add(`the ${tree.berry} tree`, tree.x, tree.y, toFace(tree.x, tree.y));
    for (const person of outdoors(file.people)) add(person.name, person.x, person.y, toFace(person.x, person.y));
    for (const trainer of outdoors(file.trainers)) add(trainer.name, trainer.x, trainer.y, toFace(trainer.x, trainer.y));
    for (const spot of outdoors(file.itemSpots)) add(`the find at ${spot.x},${spot.y}`, spot.x, spot.y, toStand(spot.x, spot.y));
    return named;
  };

  it('lands you with room to walk off two abreast', () => {
    expect(twoAbreast(LANDING.x, LANDING.y)).toBe(0);
  });

  it('reaches every way out, door, sign, landmark, berry tree, person and find two abreast', () => {
    const snagged = places()
      .filter((place) => place.steps < 0)
      .map((place) => `${place.name} (${place.x},${place.y})`);
    expect(snagged).toEqual([]);
  });

  it('never makes a pair walk further than one walker would to a way out or a door', () => {
    // Longer two abreast is a prop or a figure narrowing the shortest way to one tile.
    const targets = [
      ...outdoors(file.exits).map((exit) => ({ name: exit.name, x: exit.x, y: exit.y })),
      ...outdoors(file.buildings).flatMap((building) =>
        buildingDoorways(building).map((door) => ({ name: `the ${building.kind} at ${building.x},${building.y}`, x: door.x, y: door.y })),
      ),
    ];
    const longer = targets
      .filter(({ x, y }) => free(x, y) && single[y][x] >= 0)
      .filter(({ x, y }) => toStand(x, y) > single[y][x])
      .map(({ name, x, y }) => `${name}: ${toStand(x, y)} steps two abreast, ${single[y][x]} single file`);
    expect(longer).toEqual([]);
  });

  it('keeps every street clear: nothing stands on a street', () => {
    const blocked: string[] = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const rim = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
        if (!rim && ',d'.includes(file.ground[y][x]) && !free(x, y)) blocked.push(`${x},${y}`);
      }
    }
    expect(blocked).toEqual([]);
  });
});
