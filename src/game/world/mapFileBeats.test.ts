import { describe, expect, it } from 'vitest';
import { buildFileMap, BUILT_IN_MAP_FILE_LIMITS, beatSpots, MAP_FILE_FORMAT, readMapFile, type MapFile } from './mapFile';
import { checkMapFile } from './mapFileChecks';
import { MAX_CALL_LENGTH } from './villageCalls';

/** A lawn with a way out and a place to land. */
const lawn = (extra: Partial<MapFile> = {}): MapFile => ({
  format: MAP_FILE_FORMAT,
  id: 'beats',
  name: 'Beats',
  maker: 'Test',
  width: 24,
  height: 24,
  ground: Array.from({ length: 24 }, () => '.'.repeat(24)),
  buildings: [],
  dropIns: [{ x: 4, y: 4, name: 'Here', description: 'Here.' }],
  exits: [{ x: 20, y: 20, name: 'Out', opens: { when: 'always' } }],
  itemSpots: [],
  wildlife: 'meadow',
  ...extra,
});

const walker = (beat: unknown, calls?: unknown) => ({
  people: [{ x: 10, y: 10, name: 'Walker', look: 'boy', facing: 'down', lines: ['Hello.'], beat, ...(calls ? { calls } : {}) }],
}) as unknown as Partial<MapFile>;

const read = (file: MapFile, limits = BUILT_IN_MAP_FILE_LIMITS) => readMapFile(file, { limits });

describe('a figure in a map file keeping a beat', () => {
  it('is only for the game’s own maps: a player’s map cannot be sent one', () => {
    const file = lawn(walker({ everyMs: 3000, roam: [[1, 0]] }));
    expect(readMapFile(file).ok).toBe(false);
    expect(read(file).ok).toBe(true);
  });

  it('walks its tiles one step from another, because a beat is walked', () => {
    expect(read(lawn(walker({ everyMs: 3000, roam: [[1, 0], [2, 0], [2, 1]] }))).ok).toBe(true);
    expect(read(lawn(walker({ everyMs: 3000, roam: [[3, 0]] }))).ok).toBe(false);
    expect(read(lawn(walker({ everyMs: 100 }))).ok).toBe(false);
    expect(read(lawn(walker({ everyMs: 3000, roam: Array.from({ length: 9 }, (_, i) => [i + 1, 0]) }))).ok).toBe(false);
  });

  it('becomes the schedule the world keeps, its steps made tiles', () => {
    const reading = read(lawn(walker({ everyMs: 3000, roam: [[1, 0], [1, 1]], glances: ['left'] })));
    if (!reading.ok) throw new Error(reading.problems.join(' '));
    const map = buildFileMap(reading.file, 'player-beats', BUILT_IN_MAP_FILE_LIMITS);
    const person = map.entities.find((entity) => entity.design === 'boy');
    expect(person?.idle).toEqual({ beatMs: 3000, roam: [{ x: 11, y: 10 }, { x: 11, y: 11 }], glances: ['left'] });
  });

  it('is a wall on every tile of it for what the checks ask', () => {
    // A wall across the map with one gap, and the walker's beat in the gap.
    const ground = Array.from({ length: 24 }, (_, y) => (y === 12 ? 'CCCCCCCCCCC.CCCCCCCCCCCC' : '.'.repeat(24)));
    const shut = lawn({
      ground,
      people: [{ x: 11, y: 11, name: 'Walker', look: 'boy', facing: 'down', lines: ['Hello.'], beat: { everyMs: 3000, roam: [[0, 1]] } }],
    });
    const way = checkMapFile(shut, { limits: BUILT_IN_MAP_FILE_LIMITS }).find((check) => check.id === 'way-out');
    expect(way?.passed).toBe(false);
    const stoodAside = lawn({
      ground,
      people: [{ x: 10, y: 11, name: 'Walker', look: 'boy', facing: 'down', lines: ['Hello.'], beat: { everyMs: 3000, roam: [[-1, 0]] } }],
    });
    expect(checkMapFile(stoodAside, { limits: BUILT_IN_MAP_FILE_LIMITS }).find((check) => check.id === 'way-out')?.passed).toBe(true);
  });

  it('counts its own tile and every other for where it may stand', () => {
    expect(beatSpots({ x: 3, y: 4, beat: { everyMs: 1000, roam: [[1, 0]] } })).toEqual([
      { x: 3, y: 4, beat: { everyMs: 1000, roam: [[1, 0]] } },
      { x: 4, y: 4 },
    ]);
  });
});

describe('a person in a map file calling out', () => {
  it('is only for the game’s own maps, and only a few words', () => {
    const file = lawn(walker(undefined, ['Fresh apples!']));
    expect(readMapFile(file).ok).toBe(false);
    expect(read(file).ok).toBe(true);
    expect(read(lawn(walker(undefined, ['x'.repeat(MAX_CALL_LENGTH + 1)]))).ok).toBe(false);
  });

  it('reaches the world, and is held to the word filter with everything else said', () => {
    const reading = read(lawn(walker(undefined, ['Fresh apples!'])));
    if (!reading.ok) throw new Error(reading.problems.join(' '));
    expect(buildFileMap(reading.file, 'player-beats', BUILT_IN_MAP_FILE_LIMITS).entities.find((entity) => entity.design === 'boy')?.calls).toEqual(['Fresh apples!']);
  });

  it('keeps nothing else: a field no format has does not ride in on a call or a beat', () => {
    const reading = read(lawn(walker({ everyMs: 3000, sneak: 'x' }, ['Hello.'])));
    if (!reading.ok) throw new Error(reading.problems.join(' '));
    expect(reading.file.people?.[0].beat).toEqual({ everyMs: 3000 });
  });
});
