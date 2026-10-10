import { describe, expect, it } from 'vitest';
import { linkTable } from '../movement/gridMovement';
import {
  doorEnds,
  insideOf,
  makeInside,
  moveBuilding,
  moveDoorway,
  removeBuilding,
} from '../maker/areas';
import { composeMapFile, searchedLinks, type ComposedMap } from './mapAreas';
import { plantedProp, type MapFile, type MapFileOutdoorBuildingKind } from './mapFile';
import { checkMapFile } from './mapFileChecks';
import { stepDistances } from './mapStructure';
import { TOWN_PROPS } from './tileset/townSheet';

/**
 * FireRed's gatehouses, walked through from one side to the other: Route 2's
 * and Saffron's north to south, up the steps into the door and out the back
 * onto the ridge of the roof; and Saffron's west to east, porch to porch,
 * through a room with a mat let into each side wall.
 */

const NORTH_SOUTH: readonly MapFileOutdoorBuildingKind[] = ['route-gate', 'saffron-gate'];

/**
 * A map split by a wall of trees with one gatehouse in it: a north-south one
 * in a row of trees across the map, the east-west one in a column down it.
 */
function splitBy(kind: MapFileOutdoorBuildingKind): MapFile {
  const width = 30;
  const height = 30;
  const across = kind !== 'saffron-side-gate';
  const prop = plantedProp(kind);
  const at = across ? { x: 10, y: 12 } : { x: 11, y: 12 };
  const rows = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return 'T';
      if (
        across
          ? y >= at.y + 1 && y < at.y + prop.height - 1
          : x >= at.x + 1 && x < at.x + prop.width - 1
      ) {
        return 'T';
      }
      return '.';
    }),
  );
  for (let y = 0; y < prop.height; y += 1) {
    for (let x = 0; x < prop.width; x += 1) {
      rows[at.y + y][at.x + x] = '.';
    }
  }
  return {
    format: 1,
    id: 'gatehouse',
    name: 'Gatehouse Probe',
    maker: 'Probe',
    width,
    height,
    ground: rows.map((row) => row.join('')),
    buildings: [{ kind, ...at }],
    dropIns: [across ? { x: 4, y: 4, name: 'Near side' } : { x: 4, y: 20, name: 'Near side' }],
    exits: [
      across
        ? { x: 25, y: 25, name: 'Far side', opens: { when: 'always' } }
        : { x: 25, y: 20, name: 'Far side', opens: { when: 'always' } },
    ],
    itemSpots: [],
    wildlife: 'town',
  };
}

function walkedThrough(kind: MapFileOutdoorBuildingKind): {
  file: MapFile;
  composed: ComposedMap;
  area: string;
} {
  const made = makeInside(splitBy(kind), 0);
  if (!made.made) {
    throw new Error(made.reason);
  }
  return { file: made.file, composed: composeMapFile(made.file), area: made.area };
}

describe('a gatehouse', () => {
  it.each([...NORTH_SOUTH, 'saffron-side-gate'] as const)(
    '%s opens both its doors into the one room, and the map stands every check',
    (kind) => {
      const { file, area } = walkedThrough(kind);
      const ends = doorEnds(file.buildings[0]);
      expect(ends).toHaveLength(2);
      for (const end of ends) {
        const link = file.links!.find((candidate) =>
          candidate.ends.some(
            (other) => other.area === undefined && other.x === end.x && other.y === end.y,
          ),
        );
        expect(link?.ends.some((other) => other.area === area)).toBe(true);
      }
      expect(insideOf(file, file.buildings[0])?.id).toBe(area);
      const failing = checkMapFile(file).filter((check) => !check.passed);
      expect(failing.flatMap((check) => check.problems)).toEqual([]);
    },
  );

  it.each([...NORTH_SOUTH, 'saffron-side-gate'] as const)(
    '%s is the only way across the trees it stands in, and it goes both ways',
    (kind) => {
      const { file, composed } = walkedThrough(kind);
      const links = linkTable(searchedLinks(composed.doorways), composed.width);
      const near = file.dropIns[0];
      const far = file.exits[0];
      const through = stepDistances(composed.layers.collision, near, new Set(), links);
      const round = stepDistances(
        composed.layers.collision,
        near,
        new Set(),
        linkTable([], composed.width),
      );
      expect(through[far.y][far.x]).toBeGreaterThan(0);
      expect(round[far.y][far.x]).toBe(-1);
      const back = stepDistances(composed.layers.collision, far, new Set(), links);
      expect(back[near.y][near.x]).toBeGreaterThan(0);
    },
  );

  it.each(NORTH_SOUTH)(
    '%s is gone into up its steps and left by its back door, out onto the ridge of its roof facing north',
    (kind) => {
      const { file, composed, area } = walkedThrough(kind);
      const [front, back] = doorEnds(file.buildings[0]);
      const placed = composed.areas.find((candidate) => candidate.id === area)!.rect;
      const inside = (tile: { x: number; y: number }): boolean =>
        tile.x >= placed.x &&
        tile.y >= placed.y &&
        tile.x < placed.x + placed.width &&
        tile.y < placed.y + placed.height;
      const goingIn = composed.doorways.find(
        (doorway) => doorway.primary && doorway.from.x === front.x && doorway.from.y === front.y,
      )!;
      expect(goingIn.toward).toBe('up');
      expect(inside(goingIn.to)).toBe(true);
      expect(goingIn.arrivalFacing).toBe('up');
      // The back door's own way out comes out on the ridge, facing away from the roof.
      const goingOut = composed.doorways.find(
        (doorway) => doorway.primary && doorway.look === 'back-door',
      )!;
      expect(goingOut.toward).toBe('up');
      expect(goingOut.to).toEqual({ x: back.x, y: back.y });
      expect(goingOut.arrivalFacing).toBe('up');
      // Both cells of the ridge take you in, and you arrive below the doorway.
      const ridge = composed.doorways.filter(
        (doorway) => doorway.toward === 'down' && !inside(doorway.from),
      );
      expect(ridge.map((doorway) => doorway.from)).toEqual([
        { x: back.x, y: back.y },
        { x: back.x + 1, y: back.y },
      ]);
      expect(
        ridge.every(
          (doorway) => doorway.to.x === goingOut.from.x && doorway.to.y === goingOut.from.y,
        ),
      ).toBe(true);
    },
  );

  it('east-west is gone into from either porch, onto the mat let into that side wall', () => {
    const { file, composed, area } = walkedThrough('saffron-side-gate');
    const [west, east] = doorEnds(file.buildings[0]);
    expect(west.toward).toBe('right');
    expect(east.toward).toBe('left');
    const placed = composed.areas.find((candidate) => candidate.id === area)!.rect;
    const fromWest = composed.doorways.find(
      (doorway) => doorway.from.x === west.x && doorway.from.y === west.y,
    )!;
    expect(fromWest.to).toEqual({ x: placed.x + 1, y: placed.y + 5 });
    expect(fromWest.arrivalFacing).toBe('right');
    const outEast = composed.doorways.find(
      (doorway) => doorway.from.x === placed.x + 11 && doorway.from.y === placed.y + 5,
    )!;
    expect(outEast.toward).toBe('right');
    expect(outEast.to).toEqual({ x: east.x, y: east.y });
    expect(outEast.arrivalFacing).toBe('right');
  });

  it("east-west's room is dark down both sides, with each mat drawn whole over the dark beside it", () => {
    const { composed, area } = walkedThrough('saffron-side-gate');
    const placed = composed.areas.find((candidate) => candidate.id === area)!.rect;
    const at = (x: number, y: number) => ({ x: placed.x + x, y: placed.y + y });
    const solid = (x: number, y: number): boolean =>
      composed.layers.collision[at(x, y).y][at(x, y).x];
    const drawn = (x: number, y: number): boolean =>
      [composed.layers.ground, composed.layers.overlay, composed.layers.detail].some(
        (layer) => layer.tiles[at(x, y).y][at(x, y).x] >= 0,
      );
    // The dark is nothing, and nobody walks it.
    expect(drawn(0, 1)).toBe(false);
    expect(drawn(12, 8)).toBe(false);
    for (let y = 0; y < 9; y += 1) {
      expect(solid(0, y)).toBe(true);
      expect(solid(12, y)).toBe(true);
    }
    // The mats hang over it, and are stood on from the floor beside it.
    expect(drawn(0, 5)).toBe(true);
    expect(drawn(12, 5)).toBe(true);
    expect(solid(1, 5)).toBe(false);
    expect(solid(11, 5)).toBe(false);
  });

  it('moves with both its ways through, and taken away takes its inside and both', () => {
    for (const kind of [...NORTH_SOUTH, 'saffron-side-gate'] as const) {
      const { file } = walkedThrough(kind);
      const moved = moveBuilding(file, 0, { x: file.buildings[0].x + 1, y: file.buildings[0].y });
      if (!moved.placed) {
        throw new Error(moved.reason);
      }
      const ends = doorEnds(moved.file.buildings[0]);
      for (const end of ends) {
        expect(
          moved.file.links!.some((link) =>
            link.ends.some(
              (other) => other.area === undefined && other.x === end.x && other.y === end.y,
            ),
          ),
        ).toBe(true);
      }
      const gone = removeBuilding(file, 0);
      expect(gone.areas).toEqual([]);
      expect(gone.links).toEqual([]);
    }
  });

  it('keeps its back door in the back wall and its side mats in their walls when dragged', () => {
    const north = walkedThrough('saffron-gate');
    const backDoor = north.file.links!.findIndex((link) => link.ends[1].look === 'back-door');
    const slid = moveDoorway(north.file, { link: backDoor, end: 1 }, { x: 0, y: 6 });
    expect(slid.links![backDoor].ends[1]).toMatchObject({ x: 1, y: 2, toward: 'up' });

    const side = walkedThrough('saffron-side-gate');
    const west = side.file.links!.findIndex((link) => link.ends[1].toward === 'left');
    const dragged = moveDoorway(side.file, { link: west, end: 1 }, { x: 7, y: 3 });
    expect(dragged.links![west].ends[1]).toMatchObject({ x: 1, y: 3, toward: 'left' });
  });
});

describe("a gatehouse's ways through, checked", () => {
  it("a back door is a gatehouse's, let into the back wall of the room", () => {
    const { file, area } = walkedThrough('saffron-gate');
    const asHouse = {
      ...file,
      areas: file.areas!.map((candidate) =>
        candidate.id === area ? { ...candidate, style: 'house' as const } : candidate,
      ),
    };
    const doors = checkMapFile(asHouse).find((check) => check.id === 'doors')!;
    expect(doors.problems.join(' ')).toMatch(
      /back door .* is a gatehouse's: give the room the Gatehouse look/,
    );
    const backDoor = file.links!.findIndex((link) => link.ends[1].look === 'back-door');
    const offTheWall = {
      ...file,
      links: file.links!.map((link, index) =>
        index === backDoor ? { ends: [link.ends[0], { ...link.ends[1], y: 5 }] as const } : link,
      ),
    };
    expect(
      checkMapFile(offTheWall)
        .find((check) => check.id === 'doors')!
        .problems.join(' '),
    ).toMatch(/has to be let into the back wall of the room/);
  });

  it("a mat in a side wall is a gatehouse's too", () => {
    const { file, area } = walkedThrough('saffron-side-gate');
    const asHouse = {
      ...file,
      areas: file.areas!.map((candidate) =>
        candidate.id === area ? { ...candidate, style: 'house' as const } : candidate,
      ),
    };
    expect(
      checkMapFile(asHouse)
        .find((check) => check.id === 'doors')!
        .problems.join(' '),
    ).toMatch(/let into a side wall, as a gatehouse's is/);
  });
});

describe('the gatehouses, as the town sheet stands them', () => {
  const cell = (name: 'route2Gate' | 'saffronGate' | 'saffronSideGate', x: number, y: number) => {
    const prop = TOWN_PROPS[name];
    return prop.cells[y * prop.width + x];
  };

  it.each([
    ['route2Gate', 6],
    ['saffronGate', 7],
  ] as const)('walks behind the ridge of %s and up its steps', (name, steps) => {
    for (const x of [1, 2, 3, 4]) {
      expect(cell(name, x, 0)).toMatchObject({
        solid: false,
        canopy: true,
        walkedUnder: true,
      });
      expect(cell(name, x, steps)).toMatchObject({ solid: false });
      expect(cell(name, x, steps).canopy).toBeFalsy();
    }
    expect(cell(name, 2, 1).solid).toBe(true);
  });

  it("walks behind each porch's roof of the east-west one and on its floor", () => {
    for (const x of [0, 7]) {
      for (const y of [1, 2]) {
        expect(cell('saffronSideGate', x, y)).toMatchObject({
          solid: false,
          canopy: true,
          walkedUnder: true,
        });
      }
      for (const y of [3, 4]) {
        expect(cell('saffronSideGate', x, y)).toMatchObject({ solid: false });
      }
    }
    expect(cell('saffronSideGate', 1, 3).solid).toBe(true);
    expect(cell('saffronSideGate', 6, 3).solid).toBe(true);
  });
});
