import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { makeInside } from '../maker/areas';
import { checkMapFile, type MapCheckId, type MapFault } from './mapFileChecks';
import type { MapFile } from './mapFile';

/**
 * Where each thing the checks say is wrong is (`MapCheck.faults`), so the map
 * maker can take its maker there: every fault that is about something on the
 * map names its tile - and its inside - the one to look at first, and says
 * what kind of thing it is about, so a run of one kind reads as one line.
 */

const SAMPLE = sampleLane as MapFile;

const edited = (changes: Partial<Record<keyof MapFile, unknown>>): MapFile =>
  ({ ...SAMPLE, ...changes }) as MapFile;

const faultsOf = (file: unknown, id: MapCheckId): readonly MapFault[] =>
  checkMapFile(file).find((check) => check.id === id)?.faults ?? [];

/** The sample's ground with some tiles changed. */
function painted(changes: readonly (readonly [number, number, string])[]): string[] {
  return SAMPLE.ground.map((row, y) =>
    [...row]
      .map((letter, x) => changes.find(([cx, cy]) => cx === x && cy === y)?.[2] ?? letter)
      .join(''),
  );
}

describe('the faults the checks find, and where they are', () => {
  it('are the problems the checks say, in order, one for one', () => {
    const broken = edited({
      dropIns: [{ ...SAMPLE.dropIns[0], x: 0, y: 23 }, SAMPLE.dropIns[1]],
      itemSpots: [...SAMPLE.itemSpots, { x: SAMPLE.exits[0].x, y: SAMPLE.exits[0].y }],
    });
    for (const check of checkMapFile(broken)) {
      expect(check.faults.map((fault) => fault.text)).toEqual(check.problems);
    }
  });

  it('say what a thing on something solid is standing on, and where it is', () => {
    const file = edited({
      berryTrees: [
        { x: 0, y: 23, berry: 'oran' },
        { x: 5, y: 9, berry: 'pecha' },
      ],
      people: [{ ...SAMPLE.people![0], x: 20, y: 4 }],
    });
    expect(faultsOf(file, 'standing')).toEqual([
      {
        text: 'Old Tam at 20,4 stands on the house.',
        group: 'people',
        says: 'stand on the house',
        places: [{ x: 20, y: 4 }],
      },
      {
        text: 'Oran Berry tree at 0,23 stands in the trees.',
        group: 'berry trees',
        says: 'stand in the trees',
        places: [{ x: 0, y: 23 }],
      },
      {
        text: 'Pecha Berry tree at 5,9 stands in deep water.',
        group: 'berry trees',
        says: 'stand in deep water',
        places: [{ x: 5, y: 9 }],
      },
    ]);
  });

  it('say what else a thing can be standing on', () => {
    const ground = painted([
      [6, 4, 'C'],
      [7, 4, 'F'],
      [8, 4, 'B'],
      [9, 4, '#'],
      [10, 4, 'o'],
    ]);
    const file = edited({
      ground,
      doors: [{ kind: 'cut-tree', x: 11, y: 4, width: 1, height: 1 }],
      itemSpots: [6, 7, 8, 9, 10, 11].map((x) => ({ x, y: 4 })),
    });
    expect(
      faultsOf(file, 'standing').map((fault) =>
        fault.text.replace(/^Item spot \d+ at \d+,\d+ /, ''),
      ),
    ).toEqual([
      'stands on rock.',
      'stands on a fence.',
      'stands in a wall.',
      'stands in a hedge.',
      'stands on a bush.',
      'stands on a small tree.',
    ]);
  });

  it('name the inside a thing is in, and say it stands in the wall of the room', () => {
    const made = makeInside(SAMPLE, 0);
    if (!made.made) {
      throw new Error(made.reason);
    }
    const file = {
      ...made.file,
      itemSpots: [...made.file.itemSpots, { x: 9, y: 0, area: made.area }],
    };
    expect(faultsOf(file, 'standing')).toEqual([
      {
        text: `Item spot 8 at 9,0 in ${made.file.areas![0].name} stands in the room's wall.`,
        group: 'item spots',
        says: "stand in the room's wall",
        places: [{ x: 9, y: 0, area: made.area }],
      },
    ]);
  });

  it('put two things on one tile at that tile', () => {
    const shared = edited({ itemSpots: [{ x: SAMPLE.exits[0].x, y: SAMPLE.exits[0].y }] });
    expect(faultsOf(shared, 'apart')).toEqual([
      {
        text: 'Exit North Stile and Item spot 1 share the tile 16,0.',
        group: 'tiles',
        says: 'hold two things at once',
        places: [{ x: 16, y: 0 }],
      },
    ]);
  });

  it('put a thing nobody can walk to at itself, by its kind', () => {
    const behind = edited({
      exits: [
        { x: 16, y: 1, name: 'North Stile', opens: { when: 'always' } },
        { x: 17, y: 1, name: 'North Gap', opens: { when: 'always' } },
      ],
      itemSpots: [{ x: 16, y: 0 }],
    });
    expect(faultsOf(behind, 'reachable')).toEqual([
      {
        text: 'Item spot 1 at 16,0 cannot be walked to from any drop-in.',
        group: 'item spots',
        says: 'cannot be walked to from any drop-in',
        places: [{ x: 16, y: 0 }],
      },
    ]);
  });

  it('put a drop-in with no way out at the drop-in', () => {
    const ground = painted([
      [2, 11, 'C'],
      [3, 11, 'C'],
      [4, 11, 'C'],
      [2, 12, 'C'],
      [4, 12, 'C'],
    ]);
    const walledIn = faultsOf(edited({ ground }), 'way-out');
    expect(walledIn).toEqual([
      {
        text: 'Drop-in Pond Side cannot walk to any exit.',
        group: 'drop-ins',
        says: 'cannot walk to any exit',
        places: [{ x: 3, y: 12 }],
      },
    ]);
  });

  it('put a trainer who watches a way in or out at the trainer first, then at what they see', () => {
    const watching = edited({
      trainers: [{ ...SAMPLE.trainers![0], x: 15, y: 17, facing: 'down', sight: 3 }],
    });
    const [fault] = faultsOf(watching, 'watch');
    expect(fault.group).toBe('trainers');
    expect(fault.places[0]).toEqual({ x: 15, y: 17 });
    expect(fault.places.slice(1)).toEqual([{ x: 15, y: 20 }]);
  });

  it('put an inside nobody can walk into at the doors into it', () => {
    const made = makeInside(SAMPLE, 0);
    if (!made.made) {
      throw new Error(made.reason);
    }
    // The house's doorstep walled off with rock.
    const step = made.file.links![0].ends[0];
    const sealed = {
      ...made.file,
      ground: made.file.ground.map((row, y) =>
        [...row]
          .map((letter, x) =>
            Math.abs(x - step.x) + Math.abs(y - step.y) === 1 && y >= step.y ? 'C' : letter,
          )
          .join(''),
      ),
    };
    const [fault] = faultsOf(sealed, 'areas');
    expect(fault).toMatchObject({ group: 'insides', places: [{ x: step.x, y: step.y }] });
  });

  it('say nothing about where a fault with the whole file is', () => {
    const unloadable = checkMapFile({ ...SAMPLE, format: 9 });
    expect(unloadable.flatMap((check) => check.faults)).toEqual([
      {
        text: 'The file is format 9; this game reads format 1.',
        places: [],
        group: 'problems with the file',
      },
    ]);
  });
});
