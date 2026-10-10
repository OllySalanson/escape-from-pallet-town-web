import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import {
  doorFront,
  MAP_FILE_BUILDINGS,
  MAP_FILE_FURNITURE,
  readMapFile,
  type MapFile,
} from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import {
  addFloorBelow,
  addUpstairs,
  doorwaysIn,
  focusArea,
  insideOf,
  ladderDownIn,
  makeInside,
  moveBuilding,
  moveDoorway,
  PLACED,
  removeArea,
  removeBuilding,
  resizeArea,
  stairsUpIn,
  withFocusedArea,
} from './areas';
import { makerScreen, type MakerViewState } from './makerView';
import {
  extendMap,
  moveThing,
  paintWith,
  placeBuilding,
  placeSpot,
  removeThing,
  shiftThings,
} from './draft';
import { brushesFor, furnitureFor, INSIDE_BRUSHES } from './palette';

const SAMPLE = { ...(sampleLane as MapFile), maker: 'Probe' };

/** The sample with the inside of its house made. */
function withHouse(): { file: MapFile; area: string } {
  const made = makeInside(SAMPLE, 0);
  if (!made.made) {
    throw new Error(made.reason);
  }
  return { file: made.file, area: made.area };
}

describe("a building's inside, as the maker makes it", () => {
  it('has words for its furniture that no outdoor thing has, so a word in a file means one thing', () => {
    const outdoors = new Set(Object.keys(MAP_FILE_BUILDINGS));
    expect(Object.keys(MAP_FILE_FURNITURE).filter((word) => outdoors.has(word))).toEqual([]);
  });

  it("makes FireRed's own house downstairs, its door linked to a mat at the west end, by the door", () => {
    const { file, area } = withHouse();
    const inside = file.areas?.find((candidate) => candidate.id === area);
    expect(inside).toMatchObject({ name: 'House', style: 'house', width: 12, height: 9 });
    expect(inside?.buildings.map((piece) => piece.kind)).toEqual([
      'kitchen-sink',
      'cupboard',
      'television',
      'window',
      'dining-table',
      'potted-plant',
      'potted-plant',
    ]);
    expect(file.links).toEqual([
      {
        ends: [
          { ...doorFront(SAMPLE.buildings[0])!, toward: 'up', look: 'door' },
          { area, x: 3, y: 8, toward: 'down', look: 'mat' },
        ],
      },
    ]);
    expect(insideOf(file, file.buildings[0])?.id).toBe(area);
    // A map with a house to walk into still passes every check.
    expect(checkMapFile(file).filter((check) => !check.passed)).toEqual([]);
  });

  it('opens the inside it already has rather than making a second', () => {
    const { file } = withHouse();
    const again = makeInside(file, 0);
    expect(again.made && again.file).toBe(file);
  });

  it('makes the inside a Pokemon Center and a Mart open into, each its own room', () => {
    let file: MapFile = SAMPLE;
    for (const [kind, x, y] of [
      ['pokemon-center', 22, 12],
      ['poke-mart', 4, 16],
    ] as const) {
      const placed = placeBuilding(file, kind, { x, y });
      file = placed.placed ? placed.file : file;
    }
    for (const index of [1, 2, 3]) {
      const made = makeInside(file, index);
      file = made.made ? made.file : file;
    }
    expect(file.areas?.map((area) => [area.id, area.name, area.style])).toEqual([
      ['pokemon-center', 'Pokémon Center', 'center'],
      ['poke-mart', 'Poké Mart', 'mart'],
    ]);
    // The sign has no door to give an inside to.
    expect(makeInside(file, 1)).toMatchObject({ made: false });
    expect(readMapFile(file).ok).toBe(true);
  });

  it('gives the shed, the blue-roof cottage and the timber house an inside of their own', () => {
    let file: MapFile = SAMPLE;
    for (const [kind, x, y] of [
      ['shed', 4, 15],
      ['blue-cottage', 22, 12],
      ['timber-house', 4, 2],
    ] as const) {
      const placed = placeBuilding(file, kind, { x, y });
      if (!placed.placed) {
        throw new Error(`${kind}: ${placed.reason}`);
      }
      file = placed.file;
      const made = makeInside(file, file.buildings.length - 1);
      if (!made.made) {
        throw new Error(made.reason);
      }
      file = made.file;
    }
    expect(file.areas?.map((area) => [area.name, area.style])).toEqual([
      ['Shed', 'warehouse'],
      ['Cottage', 'cottage'],
      ['House', 'house'],
    ]);
    expect(readMapFile(file).ok).toBe(true);
  });

  it('names a second house House 2, and gives it an id of its own', () => {
    const { file } = withHouse();
    const placed = placeBuilding(file, 'house', { x: 22, y: 12 });
    if (!placed.placed) {
      throw new Error(placed.reason);
    }
    const made = makeInside(placed.file, placed.file.buildings.length - 1);
    expect(made.made && made.file.areas?.map((area) => [area.id, area.name])).toEqual([
      ['house', 'House'],
      ['house-2', 'House 2'],
    ]);
  });
});

describe('the lists of a map file that stand in its places', () => {
  it('holds every list whose entries each stand in one place, and nothing else', () => {
    // Every key of a file is named, so a list added to the format does not
    // compile until it says whether its entries stand in an area - left out,
    // they would show in every place's view and be written back into the wrong one.
    const stands: { readonly [K in keyof Required<MapFile>]: boolean } = {
      format: false,
      id: false,
      name: false,
      maker: false,
      width: false,
      height: false,
      ground: false,
      wildlife: false,
      // The outdoors' own: an inside's furniture is the area's.
      buildings: false,
      // A Cut tree and Surf water stand outdoors.
      doors: false,
      areas: false,
      links: false,
      dropIns: true,
      exits: true,
      itemSpots: true,
      people: true,
      signs: true,
      landmarks: true,
      districts: true,
      trainers: true,
      pokemon: true,
    };
    expect([...PLACED].sort()).toEqual(
      (Object.keys(stands) as (keyof MapFile)[]).filter((key) => stands[key]).sort(),
    );
  });
});

describe('editing one place of the map', () => {
  it('shows an inside as a map of its own: its ground, its furniture and what stands in it', () => {
    const { file, area } = withHouse();
    const placed = { ...file, itemSpots: [...file.itemSpots, { area, x: 8, y: 5 }] };
    const view = focusArea(placed, area);
    expect([view.width, view.height]).toEqual([12, 9]);
    expect(view.itemSpots).toEqual([{ x: 8, y: 5 }]);
    expect(view.buildings.map((piece) => piece.kind)).toContain('dining-table');
    // The outdoors' view has everything else.
    expect(focusArea(placed, undefined).itemSpots).toEqual(SAMPLE.itemSpots);
  });

  it('writes an edit back into the file, leaving every other place and the order of every list alone', () => {
    const { file, area } = withHouse();
    const before: MapFile = {
      ...file,
      dropIns: [file.dropIns[0], { area, x: 2, y: 6, name: 'Hall' }, file.dropIns[1]],
    };
    const view = focusArea(before, area);
    const placed = placeSpot(view, 'item', { x: 4, y: 6 });
    if (!placed.placed) {
      throw new Error(placed.reason);
    }
    const moved = moveThing(placed.file, { kind: 'drop-in', index: 0 }, { x: 3, y: 6 });
    if (!moved.placed) {
      throw new Error(moved.reason);
    }
    const after = withFocusedArea(before, area, paintWith(moved.file, [{ x: 1, y: 6 }], INSIDE_BRUSHES[1]));
    // The front door is still the front door, and the hall's drop-in moved in its own place.
    expect(after.dropIns.map((spot) => [spot.name, spot.x, spot.area])).toEqual([
      ['South Road', 15, undefined],
      ['Hall', 3, area],
      ['Pond Side', 3, undefined],
    ]);
    expect(after.itemSpots.at(-1)).toEqual({ area, x: 4, y: 6 });
    expect(after.areas?.[0].ground[6][1]).toBe('B');
    expect(after.ground).toEqual(file.ground);
    // Taking something out of the house takes only that.
    const taken = withFocusedArea(after, area, removeThing(focusArea(after, area), { kind: 'drop-in', index: 0 }));
    expect(taken.dropIns.map((spot) => spot.name)).toEqual(['South Road', 'Pond Side']);
  });

  it('puts the mat back against the wall when the room is made smaller or larger', () => {
    const { file, area } = withHouse();
    const smaller = resizeArea(file, area, 3, 6);
    expect(smaller.areas?.[0]).toMatchObject({ width: 6, height: 6 });
    expect(doorwaysIn(smaller, area)[0].at).toMatchObject({ x: 3, y: 5, toward: 'down' });
    const deeper = resizeArea(file, area, 12, 11);
    expect(deeper.areas?.[0].ground.slice(9)).toEqual(['PPPPPPPPPPPP', 'PPPPPPPPPPPP']);
    expect(doorwaysIn(deeper, area)[0].at).toMatchObject({ x: 3, y: 10 });
    expect(checkMapFile(deeper).filter((check) => !check.passed)).toEqual([]);
    // Never smaller than a room can be.
    expect(resizeArea(file, area, 2, 2).areas?.[0]).toMatchObject({ width: 6, height: 5 });
  });

  it('moves the mat along its wall and nowhere else', () => {
    const { file, area } = withHouse();
    const moved = moveDoorway(file, { link: 0, end: 1 }, { x: 2, y: 3 });
    expect(doorwaysIn(moved, area)[0].at).toMatchObject({ x: 2, y: 8 });
    // A building's door end moves with its building, not on its own.
    expect(moveDoorway(file, { link: 0, end: 0 }, { x: 2, y: 3 })).toBe(file);
  });
});

describe('a building with an inside', () => {
  it('takes its inside with it when it is removed, and nothing else', () => {
    const { file } = withHouse();
    const with_ = { ...file, itemSpots: [...file.itemSpots, { area: 'house', x: 8, y: 5 }] };
    const removed = removeBuilding(with_, 0);
    expect(removed.buildings.map((building) => building.kind)).toEqual(['sign']);
    expect(removed.areas).toEqual([]);
    expect(removed.links).toEqual([]);
    expect(removed.itemSpots).toEqual(SAMPLE.itemSpots);
    expect(readMapFile(removed).ok).toBe(true);
  });

  it('carries the way through its door when it is moved', () => {
    const { file } = withHouse();
    const moved = moveBuilding(file, 0, { x: 3, y: 16 });
    if (!moved.placed) {
      throw new Error(moved.reason);
    }
    expect(moved.file.links?.[0].ends[0]).toMatchObject(doorFront(moved.file.buildings[0])!);
    expect(insideOf(moved.file, moved.file.buildings[0])?.id).toBe('house');
  });

  it('can have its inside removed on its own, shutting the door again', () => {
    const { file, area } = withHouse();
    const removed = removeArea(file, area);
    expect(removed.buildings).toEqual(SAMPLE.buildings);
    expect(removed.links).toEqual([]);
    expect(checkMapFile(removed).map((check) => check.id)).not.toContain('doors');
  });
});

describe('growing a map with an inside', () => {
  it('moves the door and the way through it with the outdoors, and leaves the inside as it was', () => {
    const { file, area } = withHouse();
    const withFind = {
      ...file,
      itemSpots: [...file.itemSpots, { area, x: 3, y: 4 }],
    };
    const grown = withFocusedArea(
      withFind,
      undefined,
      extendMap(focusArea(withFind, undefined), { left: 4, top: 2, right: 0, bottom: 0 }),
    );
    const [outdoor, inside] = grown.links![0].ends;
    const [wasOutdoor, wasInside] = withFind.links![0].ends;
    expect(outdoor).toEqual({ ...wasOutdoor, x: wasOutdoor.x + 4, y: wasOutdoor.y + 2 });
    expect(inside).toEqual(wasInside);
    expect(grown.buildings[0]).toMatchObject({ x: file.buildings[0].x + 4, y: file.buildings[0].y + 2 });
    expect(grown.itemSpots.at(-1)).toEqual({ area, x: 3, y: 4 });
    expect(grown.areas).toBe(withFind.areas);
    expect(checkMapFile(grown).filter((check) => !check.passed)).toEqual([]);
  });

  it('moves only what stands outdoors when the whole file is moved', () => {
    const { file, area } = withHouse();
    const withFind = { ...file, itemSpots: [{ area, x: 3, y: 4 }, ...file.itemSpots] };
    const moved = shiftThings(withFind, { x: 2, y: 0 });
    expect(moved.itemSpots[0]).toEqual({ area, x: 3, y: 4 });
    expect(moved.itemSpots[1]).toMatchObject({ x: withFind.itemSpots[1].x + 2 });
    expect(moved.links![0].ends[1]).toEqual(withFind.links![0].ends[1]);
  });
});

describe('the maker screen with an inside', () => {
  const state = (file: MapFile, area?: string): MakerViewState => ({
    file,
    ...(area ? { area } : {}),
    tool: 'select',
    brushId: 'grass',
    place: { kind: 'drop-in' },
    selected: undefined,
    zoom: 16,
    overview: true,
    checks: [],
    canUndo: false,
    canRedo: false,
    drafts: [],
    draftKey: 'probe',
    panel: 'map',
    sending: { step: 'checking' },
    sent: { step: 'loading' },
    review: { step: 'checking' },
    reviewing: undefined,
  });

  it('shows no strip of places on a map that is one place', () => {
    expect(makerScreen(state(SAMPLE))).not.toContain('maker-areas');
  });

  it('offers to make an inside for a house, and to go into one it has', () => {
    const shut = makerScreen({ ...state(SAMPLE), selected: { kind: 'building', index: 0 } });
    expect(shut).toContain('data-go-inside="0"');
    expect(shut).toContain('Make its inside');
    const { file } = withHouse();
    const open = makerScreen({ ...state(file), selected: { kind: 'building', index: 0 } });
    expect(open).toContain('Go inside');
    expect(open).toContain('Its door leads into House.');
    // A sign has no door.
    expect(makerScreen({ ...state(SAMPLE), selected: { kind: 'building', index: 1 } })).not.toContain(
      'data-go-inside',
    );
  });

  it("shows an inside with its own brushes, the furniture of its room and its own settings", () => {
    const { file, area } = withHouse();
    const markup = makerScreen(state(file, area));
    expect(markup).toContain('data-area="house"');
    expect(markup).toMatch(/maker-area is-selected" data-area="house"/);
    expect(markup).toContain('data-brush="floor"');
    expect(markup).not.toContain('data-brush="tall-grass"');
    expect(markup).toContain('data-building="single-bed"');
    expect(markup).toContain('data-building="rug"');
    // A lab's shelves and Bill's desk carry their own room's floor in them, so
    // a house does not offer them.
    expect(markup).not.toContain('data-building="shelves-books"');
    expect(markup).not.toContain('data-building="desk"');
    expect(markup).toContain('This inside');
    expect(markup).toContain('data-area-style');
    // A field move's doors stand outdoors.
    for (const kind of ['cut-tree', 'smash-rock', 'surf']) {
      expect(markup).not.toContain(`data-place="${kind}"`);
    }
    expect(furnitureFor('lab').map((choice) => choice.kind)).toContain('shelves-books');
  });

  it('names the way out when it is chosen', () => {
    const { file, area } = withHouse();
    const markup = makerScreen({ ...state(file, area), doorway: { link: 0, end: 1 } });
    expect(markup).toContain('Way out');
    expect(markup).toContain('back outside');
  });

  it("offers a cave mouth its cave, and shows a cave with a cave's brushes, pieces and settings", () => {
    const lane = laneWithARockFace();
    const index = lane.buildings.length - 1;
    const shut = makerScreen({ ...state(lane), selected: { kind: 'building', index } });
    expect(shut).toContain('Make its cave');
    expect(shut).toContain('It leads nowhere yet.');
    const { file, area } = withCave();
    expect(makerScreen({ ...state(file), selected: { kind: 'building', index } })).toContain('It leads into Cave.');
    const markup = makerScreen(state(file, area));
    expect(markup).toContain('This cave');
    expect(markup).toContain('Add a floor below');
    expect(markup).toContain('data-brush="sand"');
    expect(markup).toContain('data-building="boulder"');
    // No house furniture in a cave, and no field-move doors indoors at all.
    expect(markup).not.toContain('data-building="single-bed"');
    expect(markup).not.toContain('data-place="cut-tree"');
    // A cave has one look, so there is no choosing it.
    expect(markup).not.toContain('data-area-style');
    const exit = makerScreen({ ...state(file, area), doorway: { link: file.links!.length - 1, end: 1 } });
    expect(exit).toContain('daylight in its south wall');
    expect(exit).toContain('data-go-end');
    // Outdoors, the same way through is the cave's mouth.
    const mouth = makerScreen({ ...state(file), doorway: { link: file.links!.length - 1, end: 0 } });
    expect(mouth).toContain('Cave mouth');
    expect(mouth).toContain('The mouth of Cave.');
  });

  it('asks where a passage comes out while it waits, and offers a second mouth a cave there is', () => {
    const { file } = withCave();
    const lane = {
      ...file,
      buildings: [...file.buildings, { kind: 'cave-mouth' as const, x: 7, y: 6 }],
    };
    const second = makerScreen({ ...state(lane), selected: { kind: 'building', index: lane.buildings.length - 1 } });
    expect(second).toContain('data-lead-into');
    expect(second).toContain('Into a cave you have');
    const waiting = makerScreen({
      ...state(lane),
      passage: { from: { x: 7, y: 7, toward: 'up', look: 'door' }, to: 'cave-exit' },
    });
    expect(waiting).toContain('Where does it come out?');
    expect(waiting).toContain("a cave's south wall");
    expect(waiting).toContain('data-cancel-passage');
  });
});

/** The sample with a rock face east of its fenced field and a cave mouth cut into its foot. */
function laneWithARockFace(): MapFile {
  const ground = SAMPLE.ground.map((row, y) =>
    y >= 10 && y <= 14 ? `${row.slice(0, 26)}CCCC${row.slice(30)}` : row,
  );
  return {
    ...SAMPLE,
    ground,
    itemSpots: SAMPLE.itemSpots.map((spot) => (spot.x === 28 && spot.y === 12 ? { x: 25, y: 13 } : spot)),
    buildings: [...SAMPLE.buildings, { kind: 'cave-mouth', x: 27, y: 14 }],
  };
}

function withCave(): { file: MapFile; area: string } {
  const lane = laneWithARockFace();
  const made = makeInside(lane, lane.buildings.length - 1);
  if (!made.made) {
    throw new Error(made.reason);
  }
  return { file: made.file, area: made.area };
}

describe('a cave, as the maker makes it', () => {
  it('rings it in rock, with its way out in the middle of the south wall', () => {
    const { file, area } = withCave();
    const cave = file.areas!.find((candidate) => candidate.id === area)!;
    expect(cave).toMatchObject({ name: 'Cave', kind: 'cave', style: 'cave' });
    expect(cave.ground[0]).toBe('B'.repeat(20));
    expect(cave.ground.at(-1)).toBe('B'.repeat(20));
    expect(doorwaysIn(file, area).map((doorway) => doorway.at)).toEqual([
      { area, x: 10, y: 14, toward: 'down', look: 'cave-exit' },
    ]);
  });

  it('keeps its ring of rock when it is made bigger or smaller, and its way out in the south wall', () => {
    const { file, area } = withCave();
    for (const [width, height] of [
      [26, 20],
      [12, 9],
    ] as const) {
      const resized = resizeArea(file, area, width, height);
      const cave = resized.areas!.find((candidate) => candidate.id === area)!;
      expect(cave.ground).toHaveLength(height);
      expect(cave.ground.at(-1)).toBe('B'.repeat(width));
      expect(cave.ground.every((row) => row.length === width && row.at(-1) === 'B' && row[0] === 'B')).toBe(true);
      expect(doorwaysIn(resized, area)[0].at).toMatchObject({ y: height - 2, look: 'cave-exit' });
      expect(checkMapFile(resized).find((check) => check.id === 'doors')?.problems).toEqual([]);
    }
  });

  it('moves its way out along the south wall, and a ladder anywhere on the floor', () => {
    const { file, area } = withCave();
    const exit = { link: file.links!.length - 1, end: 1 as const };
    const along = moveDoorway(file, exit, { x: 4, y: 7 });
    expect(along.links!.at(-1)!.ends[1]).toMatchObject({ x: 4, y: 14 });
    const below = addFloorBelow(file, area);
    if (!below.made) {
      throw new Error(below.reason);
    }
    const ladder = { link: below.file.links!.length - 1, end: 0 as const };
    const moved = moveDoorway(below.file, ladder, { x: 6, y: 9 });
    expect(moved.links!.at(-1)!.ends[0]).toMatchObject({ x: 6, y: 9, look: 'ladder-down' });
    expect(checkMapFile(moved).filter((check) => !check.passed)).toEqual([]);
  });

  it('digs a floor below with a ladder down to it, once, and names each floor deeper than the last', () => {
    const { file, area } = withCave();
    const below = addFloorBelow(file, area);
    if (!below.made) {
      throw new Error(below.reason);
    }
    expect(below.file.areas!.at(-1)).toMatchObject({ name: 'Cave B1F', kind: 'cave' });
    expect(ladderDownIn(below.file, area)).toBeDefined();
    expect(addFloorBelow(below.file, area)).toMatchObject({ made: false });
    const deeper = addFloorBelow(below.file, below.area);
    expect(deeper.made && deeper.file.areas!.at(-1)?.name).toBe('Cave B2F');
    const house = withHouse();
    expect(addFloorBelow(house.file, house.area)).toMatchObject({ made: false });
  });

  it('paints a cave with its floor, its rock and its sand, and furnishes it with its own pieces', () => {
    expect(brushesFor('cave').map((brush) => brush.id)).toEqual(['floor', 'wall', 'sand']);
    expect(furnitureFor('cave').map((choice) => choice.kind)).toEqual([
      'boulder',
      'rocks',
      'crater',
      'dripping-water',
    ]);
    expect(furnitureFor('house').map((choice) => choice.kind)).not.toContain('boulder');
  });
});

describe('a house with an upstairs', () => {
  it('builds a bedroom above, with stairs up against the east end of the back wall and stairs down above them', () => {
    const { file, area } = withHouse();
    const made = addUpstairs(file, area);
    if (!made.made) {
      throw new Error(made.reason);
    }
    const up = made.file.areas?.find((candidate) => candidate.id === made.area);
    expect(up).toMatchObject({ name: 'House 2F', style: 'house', width: 12, height: 9 });
    expect(made.file.links?.at(-1)).toEqual({
      ends: [
        { area, x: 9, y: 2, toward: 'right', look: 'stairs-up' },
        { area: made.area, x: 9, y: 2, toward: 'left', look: 'stairs-down' },
      ],
    });
    expect(stairsUpIn(made.file, area)?.link).toBe(1);
    expect(checkMapFile(made.file).filter((check) => !check.passed)).toEqual([]);
    // Once is enough, and only a house has stairs.
    expect(addUpstairs(made.file, area)).toMatchObject({ made: false });
    expect(addUpstairs(made.file, 'nowhere')).toMatchObject({ made: false });
  });

  it('finds the nearest stretch of the back wall with room when the east end is taken', () => {
    const { file, area } = withHouse();
    const crowded: MapFile = {
      ...file,
      areas: file.areas?.map((inside) =>
        inside.id === area ? { ...inside, buildings: [...inside.buildings, { kind: 'bookshelf', x: 10, y: 0 }] } : inside,
      ),
    };
    const made = addUpstairs(crowded, area);
    expect(made.made && made.file.links?.at(-1)?.ends[0]).toMatchObject({ x: 7, y: 2 });
  });

  it("never stands a third floor's stairs on the second's, and says what to clear when there is no room", () => {
    const { file, area } = withHouse();
    const second = addUpstairs(file, area);
    if (!second.made) {
      throw new Error(second.reason);
    }
    // The bedroom's back wall is its desk, drawers, shelves and the stairs down.
    expect(addUpstairs(second.file, second.area)).toEqual({
      made: false,
      reason: 'Clear a stretch of the back wall three tiles wide for the stairs first.',
    });
    const cleared: MapFile = {
      ...second.file,
      areas: second.file.areas?.map((inside) =>
        inside.id === second.area
          ? { ...inside, buildings: inside.buildings.filter((piece) => piece.kind !== 'bookshelf') }
          : inside,
      ),
    };
    const third = addUpstairs(cleared, second.area);
    if (!third.made) {
      throw new Error(third.reason);
    }
    expect(third.file.links?.at(-1)?.ends[0]).toMatchObject({ area: second.area, x: 4, y: 2 });
    expect(checkMapFile(third.file).filter((check) => !check.passed)).toEqual([]);
  });

  it('goes with the house: taking the inside away takes the floor above it too', () => {
    const { file, area } = withHouse();
    const made = addUpstairs(file, area);
    if (!made.made) {
      throw new Error(made.reason);
    }
    const removed = removeBuilding(made.file, 0);
    expect(removed.areas).toEqual([]);
    expect(removed.links).toEqual([]);
  });

  it('refuses stairs that do not stand against the back wall', () => {
    const { file, area } = withHouse();
    const made = addUpstairs(file, area);
    if (!made.made) {
      throw new Error(made.reason);
    }
    const loose: MapFile = {
      ...made.file,
      links: made.file.links?.map((link, index) =>
        index === 1 ? { ends: [{ ...link.ends[0], y: 7 }, link.ends[1]] } : link,
      ),
    };
    const doors = checkMapFile(loose).find((check) => check.id === 'doors');
    expect(doors?.problems.join(' ')).toMatch(/stand against the back wall/);
  });
});
