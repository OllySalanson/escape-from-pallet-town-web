import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { doorFront, readMapFile, type MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import {
  doorwaysIn,
  focusArea,
  insideOf,
  makeInside,
  moveBuilding,
  moveDoorway,
  PLACED,
  removeArea,
  removeBuilding,
  resizeArea,
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
import { furnitureFor, INSIDE_BRUSHES } from './palette';

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
  it('makes a furnished room with its door linked to a mat in the middle of its south wall', () => {
    const { file, area } = withHouse();
    const inside = file.areas?.find((candidate) => candidate.id === area);
    expect(inside).toMatchObject({ name: 'House', style: 'house', width: 11, height: 8 });
    expect(file.links).toEqual([
      {
        ends: [
          { ...doorFront(SAMPLE.buildings[0])!, toward: 'up', look: 'door' },
          { area, x: 5, y: 7, toward: 'down', look: 'mat' },
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
      ['poke-mart', 'Poké Mart', 'lab'],
    ]);
    // The sign has no door to give an inside to.
    expect(makeInside(file, 1)).toMatchObject({ made: false });
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
    expect([view.width, view.height]).toEqual([11, 8]);
    expect(view.itemSpots).toEqual([{ x: 8, y: 5 }]);
    expect(view.buildings.map((piece) => piece.kind)).toContain('bed');
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
    const smaller = resizeArea(file, area, 6, 6);
    expect(smaller.areas?.[0]).toMatchObject({ width: 6, height: 6 });
    expect(doorwaysIn(smaller, area)[0].at).toMatchObject({ x: 5, y: 5, toward: 'down' });
    const deeper = resizeArea(file, area, 11, 10);
    expect(deeper.areas?.[0].ground.slice(8)).toEqual(['PPPPPPPPPPP', 'PPPPPPPPPPP']);
    expect(doorwaysIn(deeper, area)[0].at).toMatchObject({ x: 5, y: 9 });
    expect(checkMapFile(deeper).filter((check) => !check.passed)).toEqual([]);
    // Never smaller than a room can be.
    expect(resizeArea(file, area, 2, 2).areas?.[0]).toMatchObject({ width: 6, height: 5 });
  });

  it('moves the mat along its wall and nowhere else', () => {
    const { file, area } = withHouse();
    const moved = moveDoorway(file, { link: 0, end: 1 }, { x: 2, y: 3 });
    expect(doorwaysIn(moved, area)[0].at).toMatchObject({ x: 2, y: 7 });
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
    expect(markup).toContain('data-building="bed"');
    expect(markup).toContain('data-building="desk"');
    // A lab's shelves carry the lab's floor in them, so a house does not offer them.
    expect(markup).not.toContain('data-building="shelves-books"');
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
});
