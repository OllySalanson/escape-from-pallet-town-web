import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { ITEMS } from '../items/items';
import { buildPlayerMap, readMapFile, type MapFile } from '../world/mapFile';
import { checkMapFile, mapFileGrid } from '../world/mapFileChecks';
import { registerPlayerMap, unregisterPlayerMap } from '../world/playerMaps';
import { isBlockedAt } from '../world/mapStructure';
import {
  extractionCaption,
  isExtractionAvailable,
} from '../world/extractionPoints';
import { BERRY_IDS, BERRY_TREE_FRAME_HEIGHT, berryItemId, berryTreeFrames } from '../world/berries';
import { MATERIAL_CHARS } from '../world/tileset/materials';
import {
  blankMap,
  keepOnMap,
  placeSpot,
  setExitOpens,
  shiftThings,
  updateThing,
  type SpotKind,
} from './draft';

/** A map with its front door, a way out, and whatever `add` puts on it. */
function mapWith(add: (file: MapFile) => MapFile): MapFile {
  let file: MapFile = { ...blankMap(30, 20, 'Dig'), maker: 'Tester' };
  for (const [kind, at] of [
    ['drop-in', { x: 4, y: 4 }],
    ['exit', { x: 25, y: 15 }],
  ] as const) {
    const outcome = placeSpot(file, kind, at);
    file = outcome.placed ? outcome.file : file;
  }
  return add(file);
}

const place = (file: MapFile, kind: SpotKind, x: number, y: number) => {
  const outcome = placeSpot(file, kind, { x, y });
  if (!outcome.placed) {
    throw new Error(outcome.reason);
  }
  return outcome;
};

/** The map cut in two by a wall down column 15, with one gap in it at row 10. */
function walledOff(file: MapFile): MapFile {
  const wall = MATERIAL_CHARS.wall;
  return {
    ...file,
    ground: file.ground.map((row, y) =>
      y >= 2 && y <= 17 && y !== 10 ? `${row.slice(0, 15)}${wall}${row.slice(16)}` : row,
    ),
  };
}

const problemsOf = (file: MapFile, id: string): readonly string[] =>
  checkMapFile(file).find((check) => check.id === id)!.problems;

const registered: string[] = [];
afterEach(() => {
  for (const id of registered.splice(0)) {
    unregisterPlayerMap(id as never);
  }
});

describe('a berry tree', () => {
  it('is planted with a berry, and a file naming a berry the game has not got does not load', () => {
    const planted = place(mapWith((start) => start), 'berry-tree', 8, 8);
    expect(planted.file.berryTrees).toEqual([{ x: 8, y: 8, berry: 'oran' }]);
    const sitrus = updateThing(planted.file, planted.thing, { berry: 'sitrus' });
    expect(readMapFile(sitrus).ok).toBe(true);
    expect(readMapFile({ ...sitrus, berryTrees: [{ x: 8, y: 8, berry: 'enigma' }] }).ok).toBe(false);
  });

  it('stands in the world carrying its berry, which is medicine the game already uses', () => {
    const file = place(mapWith((start) => start), 'berry-tree', 8, 8).file;
    const tree = buildPlayerMap(file).entities.find((entity) => entity.berry);
    expect(tree).toMatchObject({ position: { x: 8, y: 8 }, berry: 'oran' });
    for (const berry of BERRY_IDS) {
      expect(ITEMS[berryItemId(berry)].category).toBe('medicine');
    }
  });

  it('is a wall to the checks, as a person is', () => {
    const file = place(mapWith((start) => start), 'berry-tree', 15, 10).file;
    expect(problemsOf(walledOff(file), 'way-out')).toEqual([
      'Drop-in Drop-in 1 cannot walk to any exit.',
    ]);
  });

  it('is cut from a sheet holding every berry, six frames each, and is drawn ripe or bare', () => {
    const png = readFileSync('public/assets/berry-trees.png');
    expect(png.readUInt32BE(16)).toBe(6 * 16);
    expect(png.readUInt32BE(20)).toBe(BERRY_IDS.length * BERRY_TREE_FRAME_HEIGHT);
    expect(berryTreeFrames('oran')).toEqual({ ripe: [4, 5], bare: 0 });
    expect(berryTreeFrames('sitrus')).toEqual({ ripe: [10, 11], bare: 6 });
  });
});

describe('a Strength boulder', () => {
  it('is placed on a tile and stands in the world as a boulder', () => {
    const file = place(mapWith((start) => start), 'boulder', 9, 9).file;
    expect(file.boulders).toEqual([{ x: 9, y: 9 }]);
    expect(readMapFile(file).ok).toBe(true);
    expect(buildPlayerMap(file).entities.find((entity) => entity.boulder)).toMatchObject({
      position: { x: 9, y: 9 },
      boulder: true,
    });
  });

  it('shuts the way out, because nobody has to bring Strength to leave', () => {
    const open = walledOff(mapWith((start) => start));
    expect(isBlockedAt(mapFileGrid(open).collision, 15, 9)).toBe(true);
    expect(isBlockedAt(mapFileGrid(open).collision, 15, 10)).toBe(false);
    expect(problemsOf(open, 'way-out')).toEqual([]);
    const blocked = place(open, 'boulder', 15, 10).file;
    expect(problemsOf(blocked, 'way-out')).toEqual(['Drop-in Drop-in 1 cannot walk to any exit.']);
  });

  it('but moves aside for what can be reached, as a door opens', () => {
    const blocked = place(walledOff(mapWith((start) => start)), 'boulder', 15, 10).file;
    const withItem = place(blocked, 'item', 20, 4).file;
    expect(problemsOf(withItem, 'reachable')).toEqual([]);
  });

  it('moves with the map when the map grows, and is dropped when it is cut off', () => {
    const file = place(mapWith((start) => start), 'boulder', 9, 9).file;
    expect(shiftThings(file, { x: 2, y: 0 }).boulders).toEqual([{ x: 11, y: 9 }]);
    expect(keepOnMap({ ...file, boulders: [{ x: 99, y: 9 }] }).boulders).toEqual([]);
  });
});

describe('an exit under rubble', () => {
  const dugFile = (): MapFile => {
    const file = place(mapWith((start) => start), 'exit', 20, 4).file;
    return setExitOpens(file, 1, { when: 'dug' });
  };

  it('is written to the file, and becomes an exit only a dug-out list opens', () => {
    const file = dugFile();
    expect(file.exits[1].opens).toEqual({ when: 'dug' });
    expect(readMapFile(file).ok).toBe(true);
    const map = buildPlayerMap(file);
    const buried = map.exits[1];
    expect(buried.requirement).toEqual({ kind: 'dug' });
    expect(isExtractionAvailable(buried, 999_000, new Set())).toBe(false);
    expect(isExtractionAvailable(buried, 0, new Set(), new Set([buried.label]))).toBe(true);
    expect(extractionCaption(buried, false, 0)).toBe(`${buried.label}\nUNDER RUBBLE\nNEEDS A PICKAXE`);
  });

  it('is never the way out, because nobody has to bring a Pickaxe either', () => {
    const file = dugFile();
    expect(problemsOf(file, 'way-out')).toEqual([]);
    const onlyBuried = setExitOpens(file, 0, { when: 'dug' });
    expect(problemsOf(onlyBuried, 'way-out')).toEqual([
      'Drop-in Drop-in 1 cannot walk to any exit without a Pickaxe.',
    ]);
  });

  it('is laid in every raid the map is played, buried', () => {
    const map = buildPlayerMap(dugFile());
    registerPlayerMap(map);
    registered.push(map.id);
    const plan = generateRunPlan(7, undefined, frontDoorFor(map.id)!.id);
    const buried = plan.extractionPoints.find(
      (point) => point.mapId === map.id && point.requirement?.kind === 'dug',
    );
    expect(buried?.position).toEqual({ x: 20, y: 4 });
  });
});
