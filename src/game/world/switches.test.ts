import { describe, expect, it } from 'vitest';
import { blankMap, placeSpot } from '../maker/draft';
import {
  BUILT_IN_MAP_FILE_LIMITS,
  buildPlayerMap,
  readMapFile,
  type MapFile,
  type MapFileArea,
} from './mapFile';
import { checkMapFile } from './mapFileChecks';
import { onlyMapFileFields } from './mapFileRebuild';
import { barriersOpenedBy, isBarrierOpen, type WorldSwitch } from './switches';

const plate = (id: string, opens = 'gate'): WorldSwitch => ({
  id,
  mapId: 'player-test',
  position: { x: 0, y: 0 },
  kind: 'plate',
  opens,
});

describe('a barrier and its switches', () => {
  const switches = [plate('a'), plate('b'), plate('c', 'other')];

  it('opens only once every switch that opens it is thrown', () => {
    expect(isBarrierOpen('gate', switches, [])).toBe(false);
    expect(isBarrierOpen('gate', switches, ['a'])).toBe(false);
    expect(isBarrierOpen('gate', switches, ['a', 'b'])).toBe(true);
    expect(isBarrierOpen('other', switches, ['a', 'b'])).toBe(false);
    // A barrier nothing opens is never open.
    expect(isBarrierOpen('nowhere', switches, ['a', 'b', 'c'])).toBe(false);
  });

  it('says which barrier the last of its switches lifts, and nothing for one thrown twice', () => {
    expect(barriersOpenedBy(switches[0], switches, [])).toEqual([]);
    expect(barriersOpenedBy(switches[1], switches, ['a'])).toEqual(['gate']);
    expect(barriersOpenedBy(switches[1], switches, ['a', 'b'])).toEqual([]);
    expect(barriersOpenedBy(switches[2], switches, ['a'])).toEqual(['other']);
  });
});

/** A map with a cave reached from outside, and a barrier across the cave. */
function caveMap(cave: Partial<MapFileArea> = {}): MapFile {
  let file: MapFile = { ...blankMap(30, 20, 'Switches'), maker: 'Tester' };
  for (const [kind, at] of [
    ['drop-in', { x: 4, y: 4 }],
    ['exit', { x: 25, y: 15 }],
  ] as const) {
    const outcome = placeSpot(file, kind, at);
    file = outcome.placed ? outcome.file : file;
  }
  const area: MapFileArea = {
    id: 'cave',
    name: 'Cave',
    kind: 'cave',
    style: 'cave',
    width: 10,
    height: 8,
    ground: ['BBBBBBBBBB', 'BPPPPBPPPB', 'BPPPPBPPPB', 'BPPPPPPPPB', 'BPPPPBPPPB', 'BPPPPBPPPB', 'BPPPPBPPPB', 'BBBBBBBBBB'],
    buildings: [],
    switches: [{ x: 2, y: 2, kind: 'plate', opens: 'rocks' }],
    barriers: [{ id: 'rocks', x: 5, y: 3, width: 1, height: 1 }],
    ...cave,
  };
  return { ...file, areas: [area] };
}

describe('switches in a map file', () => {
  it('are read, kept through a rebuild, and stand in the world as a barrier and a switch', () => {
    const file = caveMap();
    const reading = readMapFile(file);
    expect(reading.ok).toBe(true);
    expect(onlyMapFileFields(file).areas?.[0]).toMatchObject({
      switches: file.areas![0].switches,
      barriers: file.areas![0].barriers,
    });
    const built = buildPlayerMap(file);
    expect(built.switches).toEqual([
      expect.objectContaining({ kind: 'plate', opens: 'rocks', id: `${built.id}/switch-cave-1` }),
    ]);
    expect(built.entities.filter((entity) => entity.barrier)).toEqual([
      expect.objectContaining({ barrier: { id: 'rocks', top: true } }),
    ]);
  });

  it('refuses a switch that opens nothing and a barrier nothing opens', () => {
    const orphan = readMapFile(caveMap({ switches: [{ x: 2, y: 2, kind: 'plate', opens: 'elsewhere' }] }));
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) {
      expect(orphan.problems).toContain("A switch opens 'elsewhere', and the map has no barrier called that.");
      expect(orphan.problems).toContain("The barrier 'rocks' has no switch to open it.");
    }
    expect(readMapFile(caveMap({ switches: [{ x: 2, y: 2, kind: 'button' as never, opens: 'rocks' }] })).ok).toBe(
      false,
    );
  });

  it('keeps its switch and barrier on floor and off each other', () => {
    const onRock = checkMapFile(caveMap({ barriers: [{ id: 'rocks', x: 5, y: 2, width: 1, height: 1 }] }));
    expect(onRock.find((check) => check.id === 'standing')?.passed).toBe(false);
  });
});

describe('a prize spot', () => {
  it('holds its own find at its own odds, out of the rotation', () => {
    let file: MapFile = { ...blankMap(30, 20, 'Prize'), maker: 'Tester' };
    for (const [kind, at] of [
      ['drop-in', { x: 4, y: 4 }],
      ['exit', { x: 25, y: 15 }],
    ] as const) {
      const outcome = placeSpot(file, kind, at);
      file = outcome.placed ? outcome.file : file;
    }
    file = { ...file, itemSpots: [{ x: 8, y: 8, prize: 'miracle-seed' }, { x: 9, y: 9 }] };
    // A prize is gear, so only the game's own map may lay one (`maxPrizes`).
    const limits = BUILT_IN_MAP_FILE_LIMITS;
    expect(readMapFile(file, { limits }).ok).toBe(true);
    expect(readMapFile(file).ok).toBe(false);
    const [prize, ordinary] = buildPlayerMap(file, limits).loot;
    expect(prize).toMatchObject({ itemId: 'miracle-seed', chance: 0.25 });
    expect(ordinary.chance).toBeUndefined();
    expect(readMapFile({ ...file, itemSpots: [{ x: 8, y: 8, prize: 'potion' as never }] }, { limits }).ok).toBe(false);
  });
});
