import { describe, expect, it } from 'vitest';
import { blankMap } from '../maker/draft';
import { makeInside } from '../maker/areas';
import { composeMapFile, searchedLinks } from './mapAreas';
import {
  doorFront,
  MAP_FILE_BUILDING_DOORS,
  plantedProp,
  type MapFileBuildingDoor,
  type MapFile,
  type MapFileOutdoorBuildingKind,
} from './mapFile';
import { checkMapFile } from './mapFileChecks';

const DOORS = Object.entries(MAP_FILE_BUILDING_DOORS) as [
  MapFileOutdoorBuildingKind,
  readonly MapFileBuildingDoor[],
][];

const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

/** A blank map with one building on open grass in the middle of it, and a way out. */
function withBuilding(kind: MapFileOutdoorBuildingKind): MapFile {
  const map = blankMap(40, 30);
  return {
    ...map,
    maker: 'Probe',
    ground: map.ground.map((row, y) => (y > 1 && y < 28 ? `TT${'.'.repeat(36)}TT` : row)),
    buildings: [{ kind, x: 10, y: 6 }],
    dropIns: [{ x: 4, y: 26, name: 'Lane' }],
    exits: [{ x: 35, y: 26, name: 'Road', opens: { when: 'always' } }],
  };
}

describe("every building's door", () => {
  it('is drawn on the building, with open ground before every cell of it', () => {
    const faults: string[] = [];
    for (const [kind, doors] of DOORS) {
      const prop = plantedProp(kind);
      const cellAt = (x: number, y: number) =>
        x >= 0 && y >= 0 && x < prop.width && y < prop.height ? prop.cells[y * prop.width + x] : undefined;
      for (const door of doors) {
        const along = door.toward === 'up' || door.toward === 'down';
        for (let step = 0; step < door.width; step += 1) {
          const x = door.x + (along ? step : 0);
          const y = door.y + (along ? 0 : step);
          const cell = cellAt(x, y);
          if (!cell || cell.tile < 0) {
            faults.push(`${kind}: its door at ${x},${y} is not drawn`);
          }
          // Where it is stood at: off the building, or a cell of it walked on.
          const [dx, dy] = STEP[door.toward];
          const stand = cellAt(x - dx, y - dy);
          if (stand && stand.tile >= 0 && stand.solid) {
            faults.push(`${kind}: the tile its door at ${x},${y} is stood at is part of it`);
          }
        }
      }
    }
    expect(faults).toEqual([]);
  });

  it("opens Kanto's town buildings where FireRed's own maps do", () => {
    // Read off pret's warps by the town cutter: the Gym's door in the middle of
    // its front, the Bike Shop's two cells wide under its awning.
    expect(MAP_FILE_BUILDING_DOORS['pewter-gym']).toEqual([{ x: 3, y: 4, width: 1, toward: 'up' }]);
    expect(MAP_FILE_BUILDING_DOORS['bike-shop']).toEqual([{ x: 3, y: 5, width: 2, toward: 'up' }]);
    expect(MAP_FILE_BUILDING_DOORS['silph-co']).toEqual([{ x: 4, y: 14, width: 1, toward: 'up' }]);
    // A gatehouse is gone through both ways: Route 2's by the ridge of its
    // roof from the north and up its steps from the south, both of which
    // Route 2 warps; Saffron's the same way, its ridge warped by Route 5 and
    // its steps by Saffron's own map; the east-west one by its two porches,
    // each warped by the map on its side.
    expect(MAP_FILE_BUILDING_DOORS['route-gate']).toEqual([
      { x: 2, y: 5, width: 2, toward: 'up' },
      { x: 2, y: 1, width: 2, toward: 'down' },
    ]);
    expect(MAP_FILE_BUILDING_DOORS['saffron-gate']).toEqual([
      { x: 2, y: 6, width: 2, toward: 'up' },
      { x: 2, y: 1, width: 2, toward: 'down' },
    ]);
    expect(MAP_FILE_BUILDING_DOORS['saffron-side-gate']).toEqual([
      { x: 1, y: 3, width: 1, toward: 'right' },
      { x: 6, y: 3, width: 1, toward: 'left' },
    ]);
    // The pier's warps are the S.S. Anne's gangway, and Saffron's gate is
    // walked through: neither is a door into a room.
    expect(MAP_FILE_BUILDING_DOORS.pier).toBeUndefined();
    expect(MAP_FILE_BUILDING_DOORS['city-gate']).toBeUndefined();
  });

  it('can be given an inside that works, for every building that has one', () => {
    const faults: string[] = [];
    for (const [kind] of DOORS) {
      if (kind === 'cave-mouth') {
        continue;
      }
      const made = makeInside(withBuilding(kind), 0);
      if (!made.made) {
        faults.push(`${kind}: ${made.reason}`);
        continue;
      }
      const failing = checkMapFile(made.file)
        .filter((check) => !check.passed)
        .flatMap((check) => check.problems);
      if (failing.length > 0) {
        faults.push(`${kind}: ${failing.join(' ')}`);
      }
    }
    expect(faults).toEqual([]);
  });
});

describe('a way through as wide as FireRed draws it', () => {
  it('takes a player in from every cell of a wide door, and out from the middle of the mat', () => {
    const made = makeInside(withBuilding('shop'), 0);
    if (!made.made) {
      throw new Error(made.reason);
    }
    const composed = composeMapFile(made.file);
    const front = doorFront(made.file.buildings[0])!;
    const ins = composed.doorways.filter((doorway) => doorway.toward === 'up' && doorway.look === 'door');
    const outs = composed.doorways.filter((doorway) => doorway.look === 'mat');
    // The shop's door is two cells wide: both lead onto the mat's own tile.
    expect(ins.map((doorway) => doorway.from)).toEqual([front, { x: front.x + 1, y: front.y }]);
    expect(new Set(ins.map((doorway) => JSON.stringify(doorway.to))).size).toBe(1);
    // A mat is three tiles of art with one way out under its middle, as
    // FireRed's is: the warps beside it are on plain floor and never fire.
    const mat = made.file.links![0].ends[1];
    expect(outs.map((doorway) => doorway.from)).toEqual([
      expect.objectContaining({ y: ins[0].to.y, x: ins[0].to.x }),
    ]);
    expect(outs[0].to).toEqual(front);
    expect(ins[0].to.x - outs[0].art.x).toBe(1);
    expect(mat.look).toBe('mat');
    // Only the ways that come back are walked by the searches, and only one
    // tile of each end is named on the map.
    expect(searchedLinks(composed.doorways)).toHaveLength(2);
    expect(composed.doorways.filter((doorway) => doorway.primary)).toHaveLength(2);
  });

  it("keeps the mat's way out clear, and the floor either side of it is floor", () => {
    const made = makeInside(withBuilding('house'), 0);
    if (!made.made) {
      throw new Error(made.reason);
    }
    const mat = made.file.links![0].ends[1];
    const apartWith = (x: number) =>
      checkMapFile({
        ...made.file,
        itemSpots: [...made.file.itemSpots, { area: made.area, x, y: mat.y }],
      }).find((check) => check.id === 'apart')!;
    expect(apartWith(mat.x).passed).toBe(false);
    expect(apartWith(mat.x).problems[0]).toMatch(/share the tile/);
    expect(apartWith(mat.x + 1).passed).toBe(true);
  });
});
