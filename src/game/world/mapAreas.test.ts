import { afterEach, describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { generateRunPlan } from '../run/runGeneration';
import { getWorldMap, getWarpAt } from '../worldMap';
import { districtAt } from './districts';
import { gateKey } from './gates';
import { collisionBlocker, findHunterPursuitPath, findHunterSpawnTile } from './hunter';
import { composeMapFile, doorwayOf } from './mapAreas';
import { wayTowards } from './areaRoutes';
import {
  buildPlayerMap,
  doorFront,
  MAP_FILE_HABITATS,
  readMapFile,
  sketchMapFile,
  type MapFile,
  type MapFileArea,
  type MapFileLink,
  type MapFileLinkEnd,
} from './mapFile';
import { checkMapFile, type MapCheckId } from './mapFileChecks';
import { addFloorBelow, addUpstairs, makeInside } from '../maker/areas';
import { areaTile } from './tileset/areaSheet';
import { registerPlayerMap, unregisterPlayerMap } from './playerMaps';
import { buildMapLayers } from './tiles';
import { PLAYER_MAP_TILESET } from './tileset/playerMapTileset';

const SAMPLE = sampleLane as MapFile;

/** Old Tam's house, the open-door house at the top of the lane: a room of FireRed's, eleven by eight. */
const TAMS_HOUSE: MapFileArea = {
  id: 'tams-house',
  name: "Tam's House",
  kind: 'inside',
  style: 'house',
  width: 11,
  height: 8,
  ground: ['BBBBBBBBBBB', 'BBBBBBBBBBB', ...Array.from({ length: 6 }, () => 'PPPPPPPPPPP')],
  buildings: [
    { kind: 'bed', x: 1, y: 2 },
    { kind: 'table', x: 6, y: 3 },
    { kind: 'house-plant', x: 0, y: 6 },
    { kind: 'house-plant', x: 10, y: 6 },
  ],
};

const HOUSE = SAMPLE.buildings[0];
const FRONT = doorFront(HOUSE)!;

const DOOR: MapFileLink = {
  ends: [
    { x: FRONT.x, y: FRONT.y, toward: 'up', look: 'door' },
    { area: 'tams-house', x: 5, y: 7, toward: 'down', look: 'mat' },
  ],
};

/** The sample lane with Tam's house opened up, and something to find in it. */
const WITH_HOUSE: MapFile = {
  ...SAMPLE,
  areas: [TAMS_HOUSE],
  links: [DOOR],
  itemSpots: [...SAMPLE.itemSpots, { area: 'tams-house', x: 8, y: 5 }],
  people: [
    ...(SAMPLE.people ?? []),
    {
      area: 'tams-house',
      x: 3,
      y: 5,
      name: 'Tam',
      look: 'old-woman',
      facing: 'down',
      lines: ['Wipe your feet.'],
    },
  ],
};

const failing = (value: unknown): readonly MapCheckId[] =>
  checkMapFile(value)
    .filter((check) => !check.passed)
    .map((check) => check.id);

const problems = (value: unknown, id: MapCheckId): readonly string[] =>
  checkMapFile(value).find((check) => check.id === id)?.problems ?? [];

describe('a map with the inside of a building', () => {
  afterEach(() => unregisterPlayerMap('player-sample-lane-inside'));

  it('reads, and passes every check, the two about insides among them', () => {
    expect(readMapFile(WITH_HOUSE).ok).toBe(true);
    const checks = checkMapFile(WITH_HOUSE);
    expect(checks.map((check) => check.id)).toContain('doors');
    expect(checks.map((check) => check.id)).toContain('areas');
    expect(failing(WITH_HOUSE)).toEqual([]);
  });

  it('asks a map with no insides nothing about them', () => {
    const ids = checkMapFile(SAMPLE).map((check) => check.id);
    expect(ids).not.toContain('doors');
    expect(ids).not.toContain('areas');
  });

  it('is laid out as one grid: the outdoors where it always was, the house beside it in the dark', () => {
    const composed = composeMapFile(WITH_HOUSE);
    expect(composed.areas.map((area) => [area.id, area.rect])).toEqual([
      [undefined, { x: 0, y: 0, width: 32, height: 24 }],
      ['tams-house', { x: 33, y: 0, width: 11, height: 8 }],
    ]);
    expect([composed.width, composed.height]).toEqual([44, 24]);
    // The column of dark between them is solid all the way down.
    expect(composed.layers.collision.every((row) => row[32])).toBe(true);
    // And the outdoors is drawn exactly as the file alone would draw it,
    // but for the one thing the house's inside changes: its door is the way
    // through now, and you press into it rather than stand in it.
    const alone = buildMapLayers(sketchMapFile(SAMPLE), PLAYER_MAP_TILESET);
    const door = doorwayOf(DOOR.ends[0]);
    expect(alone.collision[door.y][door.x]).toBe(false);
    expect(composed.layers.collision[door.y][door.x]).toBe(true);
    for (let y = 0; y < 24; y += 1) {
      expect(composed.layers.ground.tiles[y].slice(0, 32)).toEqual(alone.ground.tiles[y]);
      expect(composed.layers.detail.tiles[y].slice(0, 32)).toEqual(alone.detail.tiles[y]);
      const cells = composed.layers.collision[y].slice(0, 32);
      expect(cells.filter((solid, x) => solid !== alone.collision[y][x] && !(x === door.x && y === door.y))).toEqual([]);
    }
  });

  it('draws a mat under the way out, three tiles wide with the way out in the middle', () => {
    const composed = composeMapFile(WITH_HOUSE);
    const room = composed.areas[1].rect;
    const matRow = room.y + 7;
    for (const x of [room.x + 4, room.x + 5, room.x + 6]) {
      expect(composed.layers.detail.tiles[matRow][x]).toBeGreaterThan(0);
      expect(composed.layers.collision[matRow][x]).toBe(false);
    }
  });

  it('goes through the door both ways: up into the door, out onto the mat; down off the mat, out in front of the door', () => {
    const map = buildPlayerMap({ ...WITH_HOUSE, id: 'sample-lane-inside' });
    registerPlayerMap(map);
    const world = getWorldMap(map.id);
    const mat = { x: 33 + 5, y: 7 };
    const inward = getWarpAt(world, FRONT, 'push', 'up');
    expect(inward).toMatchObject({ destination: mat, facing: 'up', destinationMapId: map.id });
    const outward = getWarpAt(world, mat, 'push', 'down');
    expect(outward).toMatchObject({ destination: FRONT, facing: 'down' });
    // Pressing any other way from either side is a wall.
    expect(getWarpAt(world, FRONT, 'push', 'left')).toBeUndefined();
    expect(getWarpAt(world, mat, 'push', 'up')).toBeUndefined();
  });

  it("keeps the lane's Cut tree shut until it is cut, and the house's door working either way", () => {
    // A tile of open grass beside the lane, with nothing placed on it.
    const lane = composeMapFile(WITH_HOUSE);
    const taken = new Set(
      [...SAMPLE.dropIns, ...SAMPLE.exits, ...SAMPLE.itemSpots, ...(SAMPLE.people ?? [])].map(
        (spot) => `${spot.x},${spot.y}`,
      ),
    );
    const grass = SAMPLE.ground
      .flatMap((row, y) => [...row].map((letter, x) => ({ letter, x, y })))
      .find(
        ({ letter, x, y }) =>
          letter === '.' && !lane.layers.collision[y][x] && !taken.has(`${x},${y}`),
      )!;
    const map = buildPlayerMap({
      ...WITH_HOUSE,
      id: 'sample-lane-inside',
      doors: [{ kind: 'cut-tree', x: grass.x, y: grass.y, width: 1, height: 1 }],
    });
    registerPlayerMap(map);
    const shut = getWorldMap(map.id);
    expect(shut.gates).toHaveLength(1);
    expect(shut.collision[grass.y][grass.x]).toBe(true);
    const cut = getWorldMap(map.id, [gateKey(shut.gates[0])]);
    expect(cut.collision[grass.y][grass.x]).toBe(false);
    for (const world of [shut, cut]) {
      expect(getWarpAt(world, FRONT, 'push', 'up')).toMatchObject({ destination: { x: 38, y: 7 } });
      expect(world.areas?.map((placed) => placed.name)).toEqual([SAMPLE.name, "Tam's House"]);
    }
  });

  it('puts everything placed in the house where the house is', () => {
    const map = buildPlayerMap({
      ...WITH_HOUSE,
      id: 'sample-lane-inside',
      pokemon: [{ area: 'tams-house', x: 6, y: 6, species: 'eevee' }],
    });
    expect(map.loot.at(-1)?.position).toEqual({ x: 33 + 8, y: 5 });
    expect(map.entities.find((entity) => entity.dialogLines[0] === 'Wipe your feet.')?.position).toEqual({
      x: 33 + 3,
      y: 5,
    });
    expect(map.entities.find((entity) => entity.pokemon === 'eevee')?.position).toEqual({ x: 33 + 6, y: 6 });
  });

  it('names the house as you walk in, and the lane again as you walk out', () => {
    const map = buildPlayerMap({ ...WITH_HOUSE, id: 'sample-lane-inside' });
    registerPlayerMap(map);
    expect(districtAt(map.id, { x: 38, y: 4 })?.name).toBe("TAM'S HOUSE");
    expect(districtAt(map.id, FRONT)?.name).toBe('SAMPLE LANE');
    // A district the maker drew still wins its own ground.
    expect(districtAt(map.id, { x: 5, y: 5 })?.name).toBe('THE POND');
  });

  it('lets the hunter follow the player through the door, and arrive through it', () => {
    const map = buildPlayerMap({ ...WITH_HOUSE, id: 'sample-lane-inside' });
    registerPlayerMap(map);
    const world = getWorldMap(map.id);
    const bounds = { width: world.width, height: world.height, links: world.links };
    const isBlocked = collisionBlocker(world.collision);
    // The player is in the house; the hunter is out on the sand road.
    const player = { x: 33 + 8, y: 4 };
    const path = findHunterPursuitPath({ x: 15, y: 12 }, player, bounds, isBlocked);
    expect(path).toContainEqual(FRONT);
    expect(path).toContainEqual({ x: 33 + 5, y: 7 });
    expect(Math.abs(path.at(-1)!.x - player.x) + Math.abs(path.at(-1)!.y - player.y)).toBeLessThanOrEqual(1);
    // Without the door the house is an island it cannot reach.
    const islanded = findHunterPursuitPath({ x: 15, y: 12 }, player, { width: world.width, height: world.height }, isBlocked);
    expect(islanded.some((tile) => tile.x > 32)).toBe(false);
    // And it can arrive outside, five steps away, for a player in the hall.
    const spawn = findHunterSpawnTile({ x: 33 + 5, y: 6 }, bounds, isBlocked);
    expect(spawn).not.toBeNull();
  });

  it('lays the loot inside the house, and can open a way out inside it, on a raid that starts outside', () => {
    const map = buildPlayerMap({
      ...WITH_HOUSE,
      id: 'sample-lane-inside',
      exits: [...WITH_HOUSE.exits, { area: 'tams-house', x: 9, y: 3, name: 'Back Door', opens: { when: 'always' } }],
    });
    registerPlayerMap(map);
    const inside = { x: 33 + 8, y: 5 };
    let laid = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const plan = generateRunPlan(seed, undefined, `${map.id}/south-road`);
      laid += plan.loot[map.id].some((piece) => piece.position.x === inside.x && piece.position.y === inside.y) ? 1 : 0;
      expect(plan.extractionPoints.map((point) => point.label)).toContain('BACK DOOR');
    }
    // Laid on some raids and not others, as every spot is: never left out for
    // being behind a door.
    expect(laid).toBeGreaterThan(0);
  });

  it('points at the door for anything on the far side of it', () => {
    const map = buildPlayerMap({ ...WITH_HOUSE, id: 'sample-lane-inside' });
    registerPlayerMap(map);
    const world = getWorldMap(map.id);
    // From the hall, the North Stile is out through the door: south.
    expect(wayTowards(world, { x: 33 + 5, y: 4 }, { x: 16, y: 0 })).toEqual({ x: 38, y: 8 });
    // From the lane, the house's item spot is through the door: up at it.
    expect(wayTowards(world, { x: 15, y: 12 }, { x: 41, y: 5 })).toEqual(doorwayOf(DOOR.ends[0]));
    // Inside one place, it is straight there.
    expect(wayTowards(world, { x: 15, y: 12 }, { x: 16, y: 0 })).toEqual({ x: 16, y: 0 });
  });
});

describe('what a map with insides may not do', () => {
  const withLink = (link: MapFileLink): MapFile => ({ ...WITH_HOUSE, links: [link] });

  it('refuses a door that is not in front of a building', () => {
    const file = withLink({ ends: [{ x: 15, y: 12, toward: 'up', look: 'door' }, DOOR.ends[1]] });
    expect(failing(file)).toContain('doors');
    expect(problems(file, 'doors').join(' ')).toMatch(/not in front of a building's door/);
  });

  it('refuses a mat that is not against the wall of its room', () => {
    const file = withLink({ ends: [DOOR.ends[0], { ...DOOR.ends[1], y: 5 }] });
    expect(problems(file, 'doors').join(' ')).toMatch(/against the room's wall/);
  });

  it("refuses an inside nobody can walk into, naming it", () => {
    const file: MapFile = { ...WITH_HOUSE, links: [] };
    expect(problems(file, 'areas')).toEqual(["Tam's House cannot be walked into from any drop-in."]);
    // And what is in it cannot be reached either.
    expect(problems(file, 'reachable').join(' ')).toMatch(/Item spot 8 at 8,5 in Tam's House/);
  });

  it('refuses a way through that lands on somebody', () => {
    const file: MapFile = {
      ...WITH_HOUSE,
      people: [...(WITH_HOUSE.people ?? []), { ...WITH_HOUSE.people!.at(-1)!, x: 5, y: 7 }],
    };
    expect(failing(file)).toContain('apart');
  });

  it('refuses things placed in an area the map does not have, or off its edge', () => {
    const lost = readMapFile({ ...WITH_HOUSE, itemSpots: [{ area: 'attic', x: 1, y: 1 }] });
    expect(lost.ok ? [] : lost.problems).toEqual(['itemSpots 1 is in an area the map does not have.']);
    const off = readMapFile({ ...WITH_HOUSE, itemSpots: [{ area: 'tams-house', x: 11, y: 1 }] });
    expect(off.ok ? [] : off.problems).toEqual(['itemSpots 1 is not on the map.']);
  });

  it('refuses ground an inside cannot draw, furniture off the room and a way through with one end', () => {
    const reading = readMapFile({
      ...WITH_HOUSE,
      areas: [
        {
          ...TAMS_HOUSE,
          ground: TAMS_HOUSE.ground.map((row, y) => (y === 3 ? `g${row.slice(1)}` : row)),
          buildings: [{ kind: 'bed', x: 10, y: 6 }, { kind: 'house', x: 1, y: 2 }],
        },
      ],
      links: [{ ends: [DOOR.ends[0]] }],
    });
    expect(reading.ok ? [] : reading.problems).toEqual([
      "Area 1's ground row 3 uses letters an inside does not draw: g",
      "Area 1's furniture 1 is not inside it.",
      "Area 1's furniture 2 is not furniture the game has: house.",
      'Way through 1 must have two ends.',
    ]);
  });
});

describe("FireRed's own house, inside", () => {
  const made = makeInside(SAMPLE, 0);
  const house = made.made ? made.file : SAMPLE;

  it('shades its parquet under the back wall and down its west side, and not along the others', () => {
    const composed = composeMapFile(house);
    const room = composed.areas[1].rect;
    const tile = (x: number, y: number): number => composed.layers.ground.tiles[room.y + y][room.x + x];
    const shade = areaTile('house.floorShade');
    const floor = areaTile('house.floor');
    expect(tile(0, 5)).toBe(shade);
    expect(tile(5, 2)).toBe(shade);
    expect(tile(0, 2)).toBe(shade);
    expect(tile(1, 5)).toBe(floor);
    expect(tile(11, 5)).toBe(floor);
    expect(tile(5, 8)).toBe(floor);
    expect(tile(5, 0)).toBe(areaTile('house.wallUpper'));
    expect(tile(5, 1)).toBe(areaTile('house.wallLower'));
  });

  it('stands its stairs where its way up is, and goes up them and back down', () => {
    const up = addUpstairs(house, 'house');
    if (!up.made) {
      throw new Error(up.reason);
    }
    const composed = composeMapFile(up.file);
    const below = composed.areas[1].rect;
    const above = composed.areas[2].rect;
    // The staircase's three rows stand against the back wall, solid, with the
    // rug its way up is stood on beside its middle row - the same tile of
    // both floors, as FireRed's own house has it.
    for (let y = 1; y <= 3; y += 1) {
      expect(composed.layers.detail.tiles[below.y + y][below.x + 10]).toBeGreaterThan(0);
      expect(composed.layers.collision[below.y + y][below.x + 10]).toBe(true);
    }
    expect(composed.layers.collision[below.y + 2][below.x + 9]).toBe(false);
    expect(composed.layers.detail.tiles[below.y + 2][below.x + 9]).toBe(areaTile('house.rugSmall'));
    const upward = composed.doorways.find((doorway) => doorway.look === 'stairs-up');
    expect(upward).toMatchObject({
      from: { x: below.x + 9, y: below.y + 2 },
      toward: 'right',
      to: { x: above.x + 9, y: above.y + 2 },
      arrivalFacing: 'right',
    });
    expect(checkMapFile(up.file).filter((check) => !check.passed)).toEqual([]);
  });
});

/**
 * The sample lane with a rock face cut into the open ground east of the
 * fenced field, and a cave mouth in the foot of it - which is where FireRed
 * cuts every cave mouth it has.
 */
function laneWithARockFace(): MapFile {
  const ground = SAMPLE.ground.map((row, y) =>
    y >= 10 && y <= 14 ? `${row.slice(0, 26)}CCCC${row.slice(30)}` : row,
  );
  return {
    ...SAMPLE,
    ground,
    // The rock covers where one of the lane's finds was.
    itemSpots: SAMPLE.itemSpots.map((spot) => (spot.x === 28 && spot.y === 12 ? { x: 25, y: 13 } : spot)),
    buildings: [...SAMPLE.buildings, { kind: 'cave-mouth', x: 27, y: 14 }],
  };
}

function laneWithACave(): MapFile {
  const lane = laneWithARockFace();
  const made = makeInside(lane, lane.buildings.length - 1);
  if (!made.made) {
    throw new Error(made.reason);
  }
  return made.file;
}

describe('a cave behind a cave mouth', () => {
  afterEach(() => unregisterPlayerMap('player-sample-lane-cave'));

  it('is ringed in rock with its way out cut into the south wall, and passes every check', () => {
    const file = laneWithACave();
    const cave = file.areas!.find((area) => area.kind === 'cave')!;
    expect(cave).toMatchObject({ style: 'cave', width: 20, height: 16 });
    expect(file.links!.at(-1)).toEqual({
      ends: [
        { x: 27, y: 15, toward: 'up', look: 'door' },
        { area: cave.id, x: 10, y: 14, toward: 'down', look: 'cave-exit' },
      ],
    });
    expect(checkMapFile(file).filter((check) => !check.passed)).toEqual([]);
  });

  it('goes in by walking up into the mouth, and out by walking down into the daylight', () => {
    const map = buildPlayerMap({ ...laneWithACave(), id: 'sample-lane-cave' });
    registerPlayerMap(map);
    const world = getWorldMap(map.id);
    const cave = world.areas!.find((area) => area.kind === 'cave')!.rect;
    const landing = { x: cave.x + 10, y: cave.y + 14 };
    expect(getWarpAt(world, { x: 27, y: 15 }, 'push', 'up')).toMatchObject({
      destination: landing,
      facing: 'up',
    });
    expect(getWarpAt(world, landing, 'push', 'down')).toMatchObject({
      destination: { x: 27, y: 15 },
      facing: 'down',
    });
    // The notch is daylight in the rock, and the rock is a wall.
    expect(world.layers.detail.tiles[cave.y + 15][cave.x + 10]).toBe(areaTile('cave.exit', 1, 0));
    expect(world.collision[cave.y + 15][cave.x + 10]).toBe(true);
    expect(districtAt(world.id, landing)?.name).toBe('CAVE');
  });

  it("rolls Mt. Moon's wildlife on its floor", () => {
    const map = buildPlayerMap({ ...laneWithACave(), id: 'sample-lane-cave' });
    registerPlayerMap(map);
    const world = getWorldMap(map.id);
    const cave = world.areas!.find((area) => area.kind === 'cave')!.rect;
    const district = districtAt(world.id, { x: cave.x + 5, y: cave.y + 6 });
    expect(district?.encounters).toBe(MAP_FILE_HABITATS.cave);
  });

  it("draws the rock as Mt. Moon does: its faces, its rim, and FireRed's own joints in the corners", () => {
    const composed = composeMapFile(laneWithACave());
    const cave = composed.areas.find((area) => area.kind === 'cave')!.rect;
    const tile = (x: number, y: number): number => composed.layers.overlay.tiles[cave.y + y][cave.x + x];
    expect(tile(5, 0)).toBe(areaTile('cave.wallUpper'));
    expect(tile(5, 1)).toBe(areaTile('cave.wallLower'));
    expect(tile(0, 6)).toBe(areaTile('cave.faceEast'));
    expect(tile(19, 6)).toBe(areaTile('cave.faceWest'));
    expect(tile(5, 15)).toBe(areaTile('cave.rim'));
    expect(tile(0, 1)).toBe(areaTile('cave.cornerNw'));
    expect(tile(19, 1)).toBe(areaTile('cave.cornerNe'));
    expect(tile(0, 15)).toBe(areaTile('cave.cornerSw'));
    expect(tile(19, 15)).toBe(areaTile('cave.cornerSe'));
    // The sand runs on under the rock and grows its edges only against the floor.
    const ground = (x: number, y: number): number => composed.layers.ground.tiles[cave.y + y][cave.x + x];
    expect(ground(1, 2)).toBe(areaTile('cave.sand'));
    // The drift in the north-west corner steps down to the floor: a corner at
    // the foot of each step, and an inside corner where the step turns.
    expect(ground(4, 2)).toBe(areaTile('cave.sandSe'));
    expect(ground(3, 2)).toBe(areaTile('cave.sandInSe'));
  });

  it('has a floor below, down a ladder, and comes back up it', () => {
    const file = laneWithACave();
    const cave = file.areas!.find((area) => area.kind === 'cave')!;
    const below = addFloorBelow(file, cave.id);
    if (!below.made) {
      throw new Error(below.reason);
    }
    expect(below.file.areas!.at(-1)).toMatchObject({ name: 'Cave B1F', kind: 'cave' });
    expect(checkMapFile(below.file).filter((check) => !check.passed)).toEqual([]);
    const composed = composeMapFile(below.file);
    const down = composed.doorways.find((doorway) => doorway.look === 'ladder-down')!;
    const up = composed.doorways.find((doorway) => doorway.look === 'ladder-up')!;
    // Into the hole from the tile in front of it, out at the ladder's foot; up
    // the ladder from its foot, out in front of the hole.
    expect(down).toMatchObject({ toward: 'up', to: up.from, arrivalFacing: 'down' });
    expect(up).toMatchObject({ toward: 'up', to: down.from, arrivalFacing: 'down' });
    expect(composed.layers.detail.tiles[down.doorway.y][down.doorway.x]).toBe(areaTile('cave.hole'));
    expect(composed.layers.detail.tiles[up.doorway.y][up.doorway.x]).toBe(areaTile('cave.ladder', 0, 0));
    expect(composed.layers.detail.tiles[up.from.y][up.from.x]).toBe(areaTile('cave.ladder', 0, 1));
    expect(composed.layers.collision[up.from.y][up.from.x]).toBe(false);
    // And a floor below that one is B2F.
    const deeper = addFloorBelow(below.file, below.area);
    expect(deeper.made && deeper.file.areas!.at(-1)?.name).toBe('Cave B2F');
  });
});

describe('what a cave may not do', () => {
  it('refuses a cave mouth that is not cut into a rock face, or leads nowhere', () => {
    const lane = laneWithARockFace();
    expect(problems(lane, 'doors')).toEqual(['The cave mouth at 27,14 leads nowhere: make its cave, or take it away.']);
    const loose = {
      ...lane,
      buildings: [...SAMPLE.buildings, { kind: 'cave-mouth' as const, x: 22, y: 6 }],
    };
    const made = makeInside(loose, loose.buildings.length - 1);
    if (!made.made) {
      throw new Error(made.reason);
    }
    expect(problems(made.file, 'doors')).toEqual([
      'The cave mouth at 22,7 to Cave has to be cut into the foot of a rock face, with rock either side of it and above it.',
    ]);
  });

  it('refuses a way out not cut into the south wall, and the ways of a cave anywhere but a cave', () => {
    const file = laneWithACave();
    const cave = file.areas!.find((area) => area.kind === 'cave')!;
    const exit = file.links!.at(-1)!;
    const moved = (end: Partial<MapFileLinkEnd>): MapFile => ({
      ...file,
      links: [...file.links!.slice(0, -1), { ends: [exit.ends[0], { ...exit.ends[1], ...end }] }],
    });
    expect(problems(moved({ y: 10 }), 'doors')).toContain(
      "The way out at 10,10 in Cave to outside has to be cut into the cave's south wall, with rock either side of it.",
    );
    expect(problems(moved({ look: 'mat', y: 15 }), 'doors')).toContain(
      "The way out at 10,15 in Cave to outside belongs in a building: a cave's way out is cut into its south wall.",
    );
    const house = makeInside(file, 0);
    if (!house.made) {
      throw new Error(house.reason);
    }
    const ladderInAHouse: MapFile = {
      ...house.file,
      links: house.file.links!.map((link) =>
        link.ends[1].area === house.area
          ? { ends: [link.ends[0], { ...link.ends[1], look: 'ladder-up', toward: 'up', y: 4 }] }
          : link,
      ),
    };
    const mat = house.file.links!.find((link) => link.ends[1].area === house.area)!.ends[1];
    expect(problems(ladderInAHouse, 'doors')).toContain(
      `The ladder up at ${mat.x},4 in House to outside belongs in a cave.`,
    );
    expect(cave.kind).toBe('cave');
  });

  it("refuses ground a cave does not draw, and a cave the wrong size", () => {
    const file = laneWithACave();
    const cave = file.areas!.find((area) => area.kind === 'cave')!;
    const withGrass = {
      ...file,
      areas: [{ ...cave, ground: [cave.ground[0], cave.ground[1].replace('B', '.'), ...cave.ground.slice(2)] }],
    };
    const reading = readMapFile(withGrass);
    expect(reading.ok ? [] : reading.problems).toContain("Area 1's ground row 1 uses letters a cave does not draw: .");
    expect(readMapFile({ ...file, areas: [{ ...cave, style: 'house' }] }).ok).toBe(false);
  });
});

