import { describe, expect, it } from 'vitest';
import { readMapFile, type MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import {
  addDistrict,
  updateThing,
  blankMap,
  buildingSize,
  describeDropIn,
  extendMap,
  GROW_MARGIN,
  growthRoom,
  growToFit,
  fillRegion,
  line,
  moveThing,
  paintWith,
  placeBuilding,
  placeSpot,
  rectangle,
  removeThing,
  renameMap,
  renamePlace,
  resizeMap,
  setExitOpens,
  sizeFromField,
  setMaker,
  shiftThings,
  thingAt,
} from './draft';
import {
  loadMakerStore,
  mapFileText,
  newDraftKey,
  saveMakerStore,
  walkedVersion,
  withDraft,
  withoutDraft,
} from './drafts';
import { EditHistory } from './history';
import { BUILDING_CHOICES, GROUND_BRUSHES, groundBrush, joinLedges } from './palette';
import { MAP_FILE_BUILDINGS, MAP_FILE_LIMITS } from '../world/mapFile';

const brush = (id: string) => groundBrush(id)!;

/** Places something and hands back the map, failing the test if it was refused. */
function placed(outcome: ReturnType<typeof placeSpot>): MapFile {
  if (!outcome.placed) {
    throw new Error(outcome.reason);
  }
  return outcome.file;
}

/** A small map that works: a drop-in at one end of a lane and an exit at the other. */
function working(): MapFile {
  let file = setMaker(blankMap(24, 20, 'Test Lane'), 'Tester');
  file = placed(placeSpot(file, 'drop-in', { x: 4, y: 10 }));
  file = placed(placeSpot(file, 'exit', { x: 18, y: 10 }));
  return file;
}

describe('a new map', () => {
  it('is grass in a ring of whole trees, with nothing on it, and readable as a draft', () => {
    const file = blankMap(24, 20);
    expect(file.ground[0]).toBe('T'.repeat(24));
    expect(file.ground[10]).toBe(`TT${'.'.repeat(20)}TT`);
    expect(readMapFile(file, { draft: true }).ok).toBe(true);
  });

  it('fails the checks until it has a maker, a way in and a way out, and then passes them', () => {
    const fresh = blankMap(24, 20);
    expect(checkMapFile(fresh).find((check) => check.id === 'loads')?.problems).toEqual([
      "The map needs its maker's name.",
      'A map needs at least 1 drop-in.',
      'A map needs at least 1 exit.',
    ]);
    expect(checkMapFile(working()).every((check) => check.passed)).toBe(true);
  });

  it('is only ever a size a file can be', () => {
    expect([blankMap(3, 400).width, blankMap(3, 400).height]).toEqual([
      MAP_FILE_LIMITS.minWidth,
      MAP_FILE_LIMITS.maxHeight,
    ]);
  });
});

describe('painting', () => {
  it('writes a brush onto every tile of a stroke, and returns the same map when nothing changed', () => {
    const file = blankMap(24, 20);
    const painted = paintWith(file, line({ x: 3, y: 5 }, { x: 8, y: 5 }), brush('sand'));
    expect(painted.ground[5].slice(3, 9)).toBe('dddddd');
    expect(paintWith(painted, [{ x: 3, y: 5 }], brush('sand'))).toBe(painted);
  });

  it('leaves no gap in a fast stroke', () => {
    expect(line({ x: 0, y: 0 }, { x: 4, y: 2 })).toHaveLength(5);
  });

  it('fills a rectangle either way round', () => {
    expect(rectangle({ x: 3, y: 3 }, { x: 1, y: 2 })).toHaveLength(6);
  });

  it('fills joined ground of one kind and nothing beyond it', () => {
    let file = blankMap(24, 20);
    file = paintWith(file, rectangle({ x: 10, y: 2 }, { x: 10, y: 17 }), brush('water'));
    const region = fillRegion(file, { x: 5, y: 5 });
    expect(region.length).toBe(8 * 16);
    expect(region.every((tile) => tile.x < 10)).toBe(true);
  });

  it('draws flowers and a bush on whatever ground they are painted over', () => {
    let file = paintWith(blankMap(24, 20), [{ x: 5, y: 5 }], brush('turf'));
    file = paintWith(
      file,
      [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ],
      brush('flowers'),
    );
    expect(file.ground[5].slice(5, 7)).toBe('rf');
    file = paintWith(file, [{ x: 5, y: 6 }], brush('paving'));
    file = paintWith(file, [{ x: 5, y: 6 }], brush('bush'));
    expect(file.ground[6][5]).toBe('k');
  });

  it('joins a ledge up: a west end, a run and an east end, however it was drawn', () => {
    expect(joinLedges('..====..=..==.')).toBe('..<==>..=..<>.');
    let file = paintWith(blankMap(24, 20), line({ x: 4, y: 8 }, { x: 9, y: 8 }), brush('ledge'));
    expect(file.ground[8].slice(3, 11)).toBe('.<====>.');
    // Cutting the middle out of a ledge gives both halves their ends.
    file = paintWith(file, [{ x: 6, y: 8 }], brush('grass'));
    expect(file.ground[8].slice(3, 11)).toBe('.<>.<=>.');
    expect(readMapFile(file, { draft: true }).ok).toBe(true);
  });

  it('only offers brushes the file can say', () => {
    for (const candidate of GROUND_BRUSHES) {
      const file = paintWith(blankMap(24, 20), [{ x: 5, y: 5 }], candidate);
      expect(readMapFile(file, { draft: true })).toMatchObject({ ok: true });
    }
  });
});

describe('placing things', () => {
  it('names each drop-in and exit in turn, opens a new exit from the start, and puts one thing on a tile', () => {
    let file = blankMap(24, 20);
    file = placed(placeSpot(file, 'drop-in', { x: 4, y: 4 }));
    file = placed(placeSpot(file, 'drop-in', { x: 5, y: 4 }));
    file = placed(placeSpot(file, 'exit', { x: 6, y: 4 }));
    expect(file.dropIns.map((spot) => spot.name)).toEqual(['Drop-in 1', 'Drop-in 2']);
    expect(file.exits[0]).toMatchObject({ name: 'Exit 1', opens: { when: 'always' } });
    expect(placeSpot(file, 'item', { x: 4, y: 4 })).toEqual({
      placed: false,
      reason: 'Something is already on that tile.',
    });
  });

  it('plants a building only where the whole of it fits and no other building stands', () => {
    let file = blankMap(24, 20);
    const size = buildingSize('house');
    expect(size).toEqual({ width: 5, height: 4 });
    file = placed(placeBuilding(file, 'house', { x: 5, y: 5 }));
    expect(placeBuilding(file, 'house', { x: 7, y: 6 })).toMatchObject({ placed: false });
    expect(placeBuilding(file, 'house', { x: 22, y: 5 })).toMatchObject({ placed: false });
    expect(thingAt(file, { x: 9, y: 8 })).toEqual({ kind: 'building', index: 0 });
    expect(thingAt(file, { x: 10, y: 8 })).toBeUndefined();
  });

  it('chooses the place on a tile before the building it stands in front of', () => {
    let file = placed(placeBuilding(blankMap(24, 20), 'house-door', { x: 5, y: 5 }));
    file = placed(placeSpot(file, 'item', { x: 6, y: 8 }));
    expect(thingAt(file, { x: 6, y: 8 })).toEqual({ kind: 'item', index: 0 });
  });

  it('moves, renames and removes, keeping everything else about a thing', () => {
    let file = working();
    file = setExitOpens(file, 0, { when: 'after', seconds: 60 });
    file = renamePlace(file, { kind: 'exit', index: 0 }, 'East Stile');
    const moved = moveThing(file, { kind: 'exit', index: 0 }, { x: 18, y: 12 });
    file = placed(moved);
    expect(file.exits[0]).toEqual({
      x: 18,
      y: 12,
      name: 'East Stile',
      opens: { when: 'after', seconds: 60 },
    });
    expect(moveThing(file, { kind: 'exit', index: 0 }, { x: 4, y: 10 })).toMatchObject({
      placed: false,
    });
    expect(removeThing(file, { kind: 'exit', index: 0 }).exits).toEqual([]);
  });

  it('moves a building whole, and keeps it where it was drawn in the list', () => {
    let file = placed(placeBuilding(blankMap(30, 20), 'house', { x: 3, y: 3 }));
    file = placed(placeBuilding(file, 'cottage', { x: 12, y: 3 }));
    file = placed(moveThing(file, { kind: 'building', index: 0 }, { x: 3, y: 10 }));
    expect(file.buildings.map((building) => [building.kind, building.x, building.y])).toEqual([
      ['house', 3, 10],
      ['cottage', 12, 3],
    ]);
  });

  it('gives a drop-in words of its own, and takes them away again', () => {
    let file = describeDropIn(working(), 0, 'Where the lane starts.');
    expect(file.dropIns[0].description).toBe('Where the lane starts.');
    file = describeDropIn(file, 0, '  ');
    expect(file.dropIns[0]).not.toHaveProperty('description');
  });

  it('offers every building the file can name, and only those', () => {
    expect(BUILDING_CHOICES.map((choice) => choice.kind).sort()).toEqual(
      Object.keys(MAP_FILE_BUILDINGS).sort(),
    );
  });
});

describe('the map itself', () => {
  it('takes its id from its name', () => {
    expect(renameMap(blankMap(), "Bill's Cape!").id).toBe('bill-s-cape');
    expect(renameMap(blankMap(), '!!!').id).toBe('map');
  });

  it('grows with trees, and shrinks dropping whatever no longer fits', () => {
    let file = placed(placeBuilding(working(), 'house', { x: 15, y: 14 }));
    const grown = resizeMap(file, 30, 22);
    expect(grown.ground[21]).toBe('T'.repeat(30));
    expect(grown.ground[10].endsWith('TTTTTTTT')).toBe(true);
    file = placed(placeSpot(file, 'item', { x: 22, y: 5 }));
    file = resizeMap(file, 20, 16);
    expect(file.itemSpots).toEqual([]);
    expect(file.buildings).toEqual([]);
    expect([file.dropIns.length, file.exits.length]).toEqual([1, 1]);
    expect(readMapFile(file, { draft: true }).ok).toBe(true);
  });

  // Playtest 46: a new 40x30 map typed down to 24x18 kept its trees on the
  // north and west and stood open grass on the east and south edges.
  it('keeps the ring of trees on every side when a map is cut down', () => {
    const shrunk = resizeMap(blankMap(40, 30), 24, 18);
    expect(shrunk).toEqual(blankMap(24, 18));
    const lane = { ...blankMap(40, 30), ground: blankMap(40, 30).ground.map((row) => `${row.slice(0, 39)}.`) };
    expect(resizeMap(lane, 24, 30).ground[10]).toBe(`TT${'.'.repeat(22)}`);
  });

  // Playtests 23 C2, 26 #18 and 31 bug 1: a person left at 30,20 on a 20x16
  // map made the whole draft unreadable, and the next load deleted it.
  it('takes everyone and everything off the ground it cut away, and cuts a district to fit', () => {
    let file = working();
    file = placed(placeSpot(file, 'person', { x: 21, y: 17 }));
    file = placed(placeSpot(file, 'person', { x: 6, y: 6 }));
    file = placed(placeSpot(file, 'sign', { x: 21, y: 4 }));
    file = placed(placeSpot(file, 'landmark', { x: 4, y: 17 }));
    file = placed(placeSpot(file, 'trainer', { x: 22, y: 8 }));
    file = placed(addDistrict(file, { x: 2, y: 2 }, { x: 22, y: 6 }));
    file = placed(addDistrict(file, { x: 21, y: 15 }, { x: 22, y: 17 }));
    const shrunk = resizeMap(file, 20, 16);
    expect(shrunk.people?.map((person) => [person.x, person.y])).toEqual([[6, 6]]);
    expect([shrunk.signs, shrunk.landmarks, shrunk.trainers]).toEqual([[], [], []]);
    expect(shrunk.districts).toEqual([{ name: 'District 1', x: 2, y: 2, width: 18, height: 5 }]);
    expect(readMapFile(shrunk, { draft: true }).ok).toBe(true);
    expect(checkMapFile(shrunk).find((check) => check.id === 'loads')?.passed).toBe(true);
  });

  it('reads an emptied size field as no change rather than the smallest map', () => {
    expect(sizeFromField('', 40)).toBe(40);
    expect(sizeFromField('  ', 40)).toBe(40);
    expect(sizeFromField('e', 40)).toBe(40);
    expect(sizeFromField('24', 40)).toBe(24);
    const file = working();
    expect(resizeMap(file, sizeFromField('', file.width), file.height)).toBe(file);
  });
});

describe('undo', () => {
  it('steps back and forward through whole maps, and a new edit forgets what was undone', () => {
    const history = new EditHistory('a');
    history.push('b');
    history.push('c');
    expect(history.undo()).toBe('b');
    expect(history.redo()).toBe('c');
    history.undo();
    history.push('d');
    expect(history.canRedo).toBe(false);
    expect([history.undo(), history.undo(), history.undo()]).toEqual(['b', 'a', 'a']);
  });
});

describe('drafts in this browser', () => {
  const memory = (): {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  } => {
    const held = new Map<string, string>();
    return {
      getItem: (key) => held.get(key) ?? null,
      setItem: (key, value) => void held.set(key, value),
    };
  };

  it('keeps drafts newest first and opens the last one worked on', () => {
    const storage = memory();
    let store = withDraft({ drafts: [] }, { key: 'a', file: blankMap(), updatedAt: 1 });
    store = withDraft(store, { key: 'b', file: working(), updatedAt: 2 });
    expect(saveMakerStore(store, storage)).toBe(true);
    const loaded = loadMakerStore(storage);
    expect(loaded.drafts.map((draft) => draft.key)).toEqual(['b', 'a']);
    expect(loaded.current).toBe('b');
    expect(withoutDraft(loaded, 'b')).toEqual({ drafts: [loaded.drafts[1]] });
  });

  it('leaves out a draft it cannot open rather than refusing them all', () => {
    const storage = memory();
    storage.setItem(
      'escape-from-pallet-town.maker.v1',
      JSON.stringify({
        drafts: [
          { key: 'bad', file: { format: 1 } },
          { key: 'good', file: blankMap() },
        ],
      }),
    );
    expect(loadMakerStore(storage).drafts.map((draft) => draft.key)).toEqual(['good']);
    expect(loadMakerStore(undefined)).toEqual({ drafts: [] });
  });

  // A draft is somebody's work: one this editor cannot open is kept, as it
  // was stored, through every later save - never deleted by the next autosave.
  it('keeps a draft it cannot open, and writes it back with every save', () => {
    const storage = memory();
    const bad = { key: 'bad', file: { format: 1 } };
    storage.setItem(
      'escape-from-pallet-town.maker.v1',
      JSON.stringify({ drafts: [bad, { key: 'good', file: blankMap() }], current: 'good' }),
    );
    const loaded = loadMakerStore(storage);
    expect(loaded.unreadable).toEqual([bad]);
    const edited = withDraft(
      withoutDraft(loaded, 'nothing'),
      { key: 'good', file: renameMap(blankMap(), 'Edited'), updatedAt: 3 },
    );
    saveMakerStore(edited, storage);
    const again = loadMakerStore(storage);
    expect(again.unreadable).toEqual([bad]);
    expect(again.drafts.map((draft) => draft.file.name)).toEqual(['Edited']);

    storage.setItem('escape-from-pallet-town.maker.v1', 'not json');
    expect(loadMakerStore(storage)).toEqual({ drafts: [], unreadable: ['not json'] });
  });

  it('opens a draft an older editor left with things off the map, without them', () => {
    const storage = memory();
    const file = {
      ...blankMap(30, 20),
      buildings: [{ x: 28, y: 10, kind: 'gym' }],
      people: [{ x: 30, y: 20, name: 'Stray', look: 'boy', facing: 'down', lines: [] }],
    };
    storage.setItem(
      'escape-from-pallet-town.maker.v1',
      JSON.stringify({ drafts: [{ key: 'old', file }], current: 'old' }),
    );
    const loaded = loadMakerStore(storage);
    expect(loaded.unreadable).toBeUndefined();
    expect(loaded.drafts[0].file.buildings).toEqual([]);
    expect(loaded.drafts[0].file.people).toEqual([]);
  });

  it('never gives two drafts one key', () => {
    const store = withDraft(
      { drafts: [] },
      { key: newDraftKey({ drafts: [] }, 99), file: blankMap(), updatedAt: 0 },
    );
    expect(newDraftKey(store, 99)).not.toBe(store.drafts[0].key);
  });

  it('remembers a walk through a rename but not through a change to the ground', () => {
    const file = working();
    expect(walkedVersion(renameMap(file, 'Another Name'))).toBe(walkedVersion(file));
    expect(walkedVersion(renamePlace(file, { kind: 'exit', index: 0 }, 'Home'))).toBe(
      walkedVersion(file),
    );
    expect(walkedVersion(paintWith(file, [{ x: 10, y: 10 }], brush('rock')))).not.toBe(
      walkedVersion(file),
    );
    expect(walkedVersion(setExitOpens(file, 0, { when: 'after', seconds: 30 }))).not.toBe(
      walkedVersion(file),
    );
  });

  it('downloads as the file the game reads', () => {
    const file = working();
    expect(readMapFile(JSON.parse(mapFileText(file)))).toEqual({ ok: true, file });
  });
});

describe('people, signs, landmarks, trainers and districts', () => {
  it('places each with plain defaults, and one thing a tile', () => {
    let file = working();
    file = placed(placeSpot(file, 'person', { x: 6, y: 6 }));
    file = placed(placeSpot(file, 'sign', { x: 7, y: 6 }));
    file = placed(placeSpot(file, 'landmark', { x: 8, y: 6 }));
    file = placed(placeSpot(file, 'trainer', { x: 9, y: 6 }));
    expect(file.people).toEqual([{ x: 6, y: 6, name: 'Person 1', look: 'boy', facing: 'down', lines: [] }]);
    expect(file.signs).toEqual([{ x: 7, y: 6, lines: [] }]);
    expect(file.landmarks).toEqual([{ x: 8, y: 6, name: 'Landmark 1', kind: 'spring' }]);
    expect(file.trainers?.[0]).toMatchObject({ name: 'Trainer 1', team: 'scout', sight: 0 });
    expect(placeSpot(file, 'item', { x: 9, y: 6 })).toMatchObject({ placed: false });
    expect(readMapFile(file)).toMatchObject({ ok: true });
  });

  it('changes, moves and removes them like anything else', () => {
    let file = placed(placeSpot(working(), 'trainer', { x: 9, y: 6 }));
    const trainer = { kind: 'trainer', index: 0 } as const;
    file = updateThing(file, trainer, { team: 'drover', facing: 'left', sight: 3, lines: ['Halt.'] });
    file = placed(moveThing(file, trainer, { x: 10, y: 7 }));
    expect(file.trainers?.[0]).toMatchObject({ x: 10, y: 7, team: 'drover', facing: 'left', sight: 3, lines: ['Halt.'] });
    expect(thingAt(file, { x: 10, y: 7 })).toEqual(trainer);
    expect(removeThing(file, trainer).trainers).toEqual([]);
  });

  it('marks out a district either way round, kept on the map, and chosen below what stands in it', () => {
    let file = placed(addDistrict(working(), { x: 30, y: 12 }, { x: 15, y: 5 }));
    expect(file.districts).toEqual([{ name: 'District 1', x: 15, y: 5, width: 9, height: 8 }]);
    expect(thingAt(file, { x: 16, y: 6 })).toEqual({ kind: 'district', index: 0 });
    expect(thingAt(file, { x: 18, y: 10 })).toEqual({ kind: 'exit', index: 0 });
    file = updateThing(file, { kind: 'district', index: 0 }, { wildlife: 'wetland', name: 'The Pond' });
    expect(file.districts?.[0]).toMatchObject({ name: 'The Pond', wildlife: 'wetland' });
    file = updateThing(file, { kind: 'district', index: 0 }, { wildlife: undefined });
    expect(file.districts?.[0]).not.toHaveProperty('wildlife');
    file = placed(moveThing(file, { kind: 'district', index: 0 }, { x: 40, y: 40 }));
    expect([file.districts?.[0].x, file.districts?.[0].y]).toEqual([15, 12]);
    expect(readMapFile(file)).toMatchObject({ ok: true });
  });
});

describe('growing a map by drawing past its edge', () => {
  /** A map with one of everything on it, so a test can see each move. */
  const furnished = (): MapFile => {
    let file = working();
    file = placed(placeSpot(file, 'person', { x: 6, y: 6 }));
    file = placed(placeSpot(file, 'sign', { x: 7, y: 6 }));
    file = placed(placeSpot(file, 'landmark', { x: 8, y: 6 }));
    file = placed(placeSpot(file, 'trainer', { x: 9, y: 6 }));
    file = placed(placeBuilding(file, 'house', { x: 14, y: 12 }));
    file = placed(addDistrict(file, { x: 4, y: 4 }, { x: 12, y: 9 }));
    return file;
  };
  /** Every x and y on everything standing on the map, in a fixed order. */
  const positions = (file: MapFile): string[] => {
    const found: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${path}[${index}]`));
      } else if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (typeof record.x === 'number' && typeof record.y === 'number') {
          found.push(`${path} ${record.x},${record.y}`);
        }
        for (const [key, inner] of Object.entries(record)) {
          walk(inner, `${path}.${key}`);
        }
      }
    };
    walk({ ...file, ground: [] }, 'file');
    return found;
  };

  it('grows west two tiles at a time, with a whole tree of wood past what was drawn, and moves everything with its ground', () => {
    const file = furnished();
    const { file: grown, shift } = growToFit(file, [{ x: -1, y: 10 }]);
    expect(shift).toEqual({ x: 4, y: 0 });
    expect([grown.width, grown.height]).toEqual([file.width + 4, file.height]);
    // The old ground, where it was, a tile of the new ground and the wood west of it.
    expect(grown.ground.map((row) => row.slice(4))).toEqual(file.ground);
    expect(grown.ground[10].slice(0, 4)).toBe('TTTT');
    // Every place on the map moved with it, and nothing else about anything changed.
    const moved = positions(file).map((entry) =>
      entry.replace(/ (\d+),(\d+)$/, (_, x, y) => ` ${Number(x) + 4},${y}`),
    );
    expect(positions(grown)).toEqual(moved);
    expect(shiftThings(grown, { x: -4, y: 0 })).toEqual({
      ...file,
      width: grown.width,
      height: grown.height,
      ground: grown.ground,
    });
    expect(readMapFile(grown).ok).toBe(true);
  });

  it('grows east and south without moving anything, and north two tiles at a time', () => {
    const file = furnished();
    const east = growToFit(file, [{ x: file.width + 2, y: file.height }]);
    expect(east.shift).toEqual({ x: 0, y: 0 });
    expect([east.file.width, east.file.height]).toEqual([file.width + 5, file.height + 3]);
    expect(positions(east.file)).toEqual(positions(file));
    const north = growToFit(file, [{ x: 3, y: -3 }]);
    expect(north.shift).toEqual({ x: 0, y: 6 });
    expect(north.file.height).toBe(file.height + 6);
  });

  it('leaves a map that already holds every tile as it is', () => {
    const file = furnished();
    expect(growToFit(file, [{ x: 0, y: 0 }, { x: file.width - 1, y: file.height - 1 }])).toEqual({
      file,
      shift: { x: 0, y: 0 },
    });
  });

  it('never grows past the biggest map there may be: the wood gives way first, then the furthest tiles', () => {
    const wide = resizeMap(blankMap(), MAP_FILE_LIMITS.maxWidth - 3, 30);
    const ringless = growToFit(wide, [{ x: wide.width + 2, y: 5 }]);
    expect(ringless.file.width).toBe(MAP_FILE_LIMITS.maxWidth);
    const both = growToFit(wide, [
      { x: -10, y: 5 },
      { x: wide.width + 10, y: 5 },
    ]);
    expect(both.file.width).toBeLessThanOrEqual(MAP_FILE_LIMITS.maxWidth);
    expect(both.shift.x % 2).toBe(0);
    const full = resizeMap(blankMap(), MAP_FILE_LIMITS.maxWidth, 30);
    expect(growToFit(full, [{ x: -5, y: 5 }]).file).toBe(full);
  });

  it('says how far past each edge a maker may draw: a screenful, or what is left of the biggest map', () => {
    expect(growthRoom(blankMap(40, 30))).toEqual({
      left: GROW_MARGIN,
      top: GROW_MARGIN,
      right: GROW_MARGIN,
      bottom: GROW_MARGIN,
    });
    const nearly = resizeMap(blankMap(), MAP_FILE_LIMITS.maxWidth - 5, 30);
    expect(growthRoom(nearly)).toMatchObject({ left: 4, right: 5 });
    expect(growthRoom(resizeMap(blankMap(), MAP_FILE_LIMITS.maxWidth, 30))).toMatchObject({
      left: 0,
      right: 0,
    });
  });

  it('refuses to grow west or north an odd number of tiles, which would redraw every tree', () => {
    expect(() => extendMap(blankMap(), { left: 1, top: 0, right: 0, bottom: 0 })).toThrow();
  });
});
