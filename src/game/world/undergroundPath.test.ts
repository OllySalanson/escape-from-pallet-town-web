import { describe, expect, it } from 'vitest';
import { linkTable } from '../movement/gridMovement';
import {
  insideOf,
  makeInside,
  makeUndergroundPath,
  removeArea,
  removeBuilding,
  stairwellIn,
} from '../maker/areas';
import { brushesFor, furnitureFor } from '../maker/palette';
import { AREA_WEAVES } from './generated/areaPieces';
import { composeMapFile, searchedLinks } from './mapAreas';
import { readMapFile, TUNNEL_SIZE, type MapFile } from './mapFile';
import { checkMapFile } from './mapFileChecks';
import { stepDistances } from './mapStructure';
import { areaTile } from './tileset/areaSheet';

/**
 * The Underground Path: a hut, the stairwell down in its entrance, FireRed's
 * own tunnel north to south, and the stairs up into the entrance of another
 * hut - a way through that comes out somewhere else on the map.
 */

/** A map split by a river with an Underground Path hut either side of it. */
function splitByARiver(): MapFile {
  const width = 40;
  const height = 40;
  const ground = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      x < 2 || y < 2 || x >= width - 2 || y >= height - 2 ? 'T' : y >= 18 && y <= 21 ? 'W' : '.',
    ).join(''),
  );
  return {
    format: 1,
    id: 'path',
    name: 'Path Probe',
    maker: 'Probe',
    width,
    height,
    ground,
    buildings: [
      { kind: 'underground-path', x: 26, y: 28 },
      { kind: 'underground-path', x: 8, y: 8 },
    ],
    dropIns: [{ x: 4, y: 5, name: 'North' }],
    exits: [{ x: 34, y: 35, name: 'South Road', opens: { when: 'always' } }],
    itemSpots: [],
    wildlife: 'town',
  };
}

function withPath(): { file: MapFile; tunnel: string } {
  const made = makeUndergroundPath(splitByARiver(), 0, 1);
  if (!made.made) {
    throw new Error(made.reason);
  }
  return { file: made.file, tunnel: made.area };
}

describe('the Underground Path', () => {
  it("is made whole from one hut to another: both entrances, FireRed's tunnel, and the stairs between", () => {
    const { file, tunnel } = withPath();
    const kinds = (file.areas ?? []).map(
      (area) => `${area.kind} ${area.style} ${area.width}x${area.height}`,
    );
    expect(kinds).toEqual([
      'inside gatehouse 13x9',
      'inside gatehouse 13x9',
      `tunnel underground ${TUNNEL_SIZE.width}x${TUNNEL_SIZE.height}`,
    ]);
    expect(file.links).toHaveLength(4);
    const failing = checkMapFile(file).filter((check) => !check.passed);
    expect(failing.flatMap((check) => check.problems)).toEqual([]);
    expect(readMapFile(JSON.parse(JSON.stringify(file))).ok).toBe(true);
    expect(tunnel).toBe('underground-path');
  });

  it('goes down from the hut further north to the north end of the tunnel, whichever was chosen first', () => {
    const { file, tunnel } = withPath();
    const north = insideOf(file, file.buildings[1])!;
    const south = insideOf(file, file.buildings[0])!;
    const endIn = (entrance: string) => {
      const stairs = stairwellIn(file, entrance)!;
      return file.links![stairs.link].ends[1 - stairs.end];
    };
    expect(endIn(north.id)).toEqual({
      area: tunnel,
      x: 4,
      y: 3,
      toward: 'right',
      look: 'tunnel-stairs',
    });
    expect(endIn(south.id)).toEqual({
      area: tunnel,
      x: 3,
      y: 60,
      toward: 'left',
      look: 'tunnel-stairs',
    });
  });

  it('is the only way across the river, and it goes both ways', () => {
    const { file } = withPath();
    const composed = composeMapFile(file);
    const links = linkTable(searchedLinks(composed.doorways), composed.width);
    const north = file.dropIns[0];
    const south = file.exits[0];
    expect(
      stepDistances(composed.layers.collision, north, new Set(), links)[south.y][south.x],
    ).toBeGreaterThan(0);
    expect(
      stepDistances(composed.layers.collision, north, new Set(), linkTable([], composed.width))[
        south.y
      ][south.x],
    ).toBe(-1);
    expect(
      stepDistances(composed.layers.collision, south, new Set(), links)[north.y][north.x],
    ).toBeGreaterThan(0);
  });

  it('is gone down by pressing left beside the stairwell, and up by pressing towards the stairs at either end', () => {
    const { file, tunnel } = withPath();
    const composed = composeMapFile(file);
    const rect = (id: string) => composed.areas.find((area) => area.id === id)!.rect;
    const north = insideOf(file, file.buildings[1])!;
    const down = composed.doorways.find(
      (doorway) =>
        doorway.look === 'stairwell' &&
        doorway.from.x === rect(north.id).x + 7 &&
        doorway.from.y === rect(north.id).y + 4,
    )!;
    expect(down.toward).toBe('left');
    expect(down.to).toEqual({ x: rect(tunnel).x + 4, y: rect(tunnel).y + 3 });
    const up = composed.doorways.find(
      (doorway) => doorway.look === 'tunnel-stairs' && doorway.from.y === rect(tunnel).y + 60,
    )!;
    expect(up.toward).toBe('left');
    const south = insideOf(file, file.buildings[0])!;
    expect(up.to).toEqual({ x: rect(south.id).x + 7, y: rect(south.id).y + 4 });
  });

  it("lays the tunnel's floor and walls cell for cell as FireRed's own", () => {
    const { file, tunnel } = withPath();
    const composed = composeMapFile(file);
    const { x, y } = composed.areas.find((area) => area.id === tunnel)!.rect;
    // The planks at the north end, the blue, the red, and the rivets of the walls.
    const floor: readonly (readonly [number, number])[] = [
      [2, 6],
      [3, 15],
      [3, 25],
      [3, 40],
      [1, 30],
    ];
    const walls: readonly (readonly [number, number])[] = [
      [0, 0],
      [7, 1],
      [0, 62],
      [7, 30],
    ];
    for (const [cells, weave] of [
      [floor, AREA_WEAVES['tunnel.floor']],
      [walls, AREA_WEAVES['tunnel.wall']],
    ] as const) {
      for (const [cx, cy] of cells) {
        expect(composed.layers.ground.tiles[y + cy][x + cx]).toBe(areaTile(weave[cy][cx]));
      }
    }
  });

  it('is refused from a hut to itself, from a hut that has its path, and from anything but a hut', () => {
    expect(makeUndergroundPath(splitByARiver(), 0, 0)).toMatchObject({ made: false });
    const { file } = withPath();
    expect(makeUndergroundPath(file, 0, 1)).toEqual({
      made: false,
      reason: 'That hut has its path already.',
    });
    const notAHut = {
      ...splitByARiver(),
      buildings: [{ kind: 'house' as const, x: 8, y: 8 }, splitByARiver().buildings[0]],
    };
    expect(makeUndergroundPath(notAHut, 0, 1)).toMatchObject({ made: false });
  });

  it('keeps the floor of an entrance clear for its stairwell, or says so', () => {
    const inside = makeInside(splitByARiver(), 1);
    if (!inside.made) {
      throw new Error(inside.reason);
    }
    const cluttered = {
      ...inside.file,
      itemSpots: [{ area: inside.area, x: 6, y: 4 }],
    };
    const refused = makeUndergroundPath(cluttered, 0, 1);
    expect(refused.made).toBe(false);
    expect(refused.made ? '' : refused.reason).toMatch(/where its stairs go down/);
  });

  it("taken away by a hut leaves the tunnel to the other, and the tunnel taken away leaves both huts' entrances", () => {
    const { file, tunnel } = withPath();
    const lessAHut = removeBuilding(file, 0);
    // Hut 0's entrance was made first.
    expect(lessAHut.areas!.map((area) => area.id)).toEqual(['path-entrance-2', tunnel]);
    expect(lessAHut.links).toHaveLength(2);
    const lessTheTunnel = removeArea(file, tunnel);
    expect(lessTheTunnel.areas!.map((area) => area.kind)).toEqual(['inside', 'inside']);
    expect(lessTheTunnel.links).toHaveLength(2);
  });
});

describe("the Underground Path's ways through, checked", () => {
  it("a tunnel has only its stairs, and its stairs are only a tunnel's", () => {
    const { file, tunnel } = withPath();
    const matInTheTunnel = {
      ...file,
      links: file.links!.map((link) =>
        link.ends[1].area === tunnel && link.ends[1].y === 60
          ? { ends: [link.ends[0], { ...link.ends[1], look: 'mat' as const }] as const }
          : link,
      ),
    };
    expect(
      checkMapFile(matInTheTunnel)
        .find((check) => check.id === 'doors')!
        .problems.join(' '),
    ).toMatch(/cannot be in a tunnel: its ways out are its stairs up/);
  });

  it("a stairwell is the Underground Path's entrance's", () => {
    const { file } = withPath();
    const asHouse = {
      ...file,
      areas: file.areas!.map((area) =>
        area.kind === 'inside' ? { ...area, style: 'house' as const } : area,
      ),
    };
    expect(
      checkMapFile(asHouse)
        .find((check) => check.id === 'doors')!
        .problems.join(' '),
    ).toMatch(/is the Underground Path's: give the room the Gatehouse look/);
  });

  it('a tunnel is the size FireRed made it', () => {
    const { file, tunnel } = withPath();
    const longer = {
      ...file,
      areas: file.areas!.map((area) =>
        area.id === tunnel
          ? { ...area, height: 64, ground: [...area.ground, area.ground[area.ground.length - 1]] }
          : area,
      ),
    };
    const read = readMapFile(JSON.parse(JSON.stringify(longer)));
    expect(read.ok).toBe(false);
    expect(read.ok ? [] : read.problems.join(' ')).toMatch(/8x63 tiles, the size FireRed made it/);
  });

  it('is painted with its own floor and wall, and furnished with nothing of a house', () => {
    expect(brushesFor('tunnel').map((brush) => brush.label)).toEqual(['Floor', 'Wall']);
    expect(furnitureFor('underground')).toEqual([]);
  });
});
