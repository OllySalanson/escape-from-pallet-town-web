import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';
import { walksLengthenedBy } from './mapStructure';
import { MAP_STRUCTURE_PARTS, mapStateNames } from './mapStructure.testkit';

/**
 * The rules every map is held to live in `mapStructure.testkit.ts` and are
 * asked by one `mapStructure.*.test.ts` file per map, or per slice of a map's
 * gate states, so that vitest can run them side by side. What is held here is
 * that the split lost nothing: every gate state of every map is asked about by
 * exactly one file, and every file named really does ask.
 */
describe('map structure files', () => {
  it('ask about every gate state of every map, each exactly once', () => {
    for (const mapId of Object.keys(WORLD_MAPS) as WorldMapId[]) {
      const parts = MAP_STRUCTURE_PARTS.filter((part) => part.mapId === mapId);
      const states = mapStateNames(mapId);
      const askedBy = states.map(
        (name, index) =>
          `${name}: ${parts.filter((part) => index % part.of === part.part - 1).length} file(s)`,
      );
      expect(askedBy).toEqual(states.map((name) => `${name}: 1 file(s)`));
      // Slices of one map have to agree on how many there are, or two of them
      // could take the same states and leave others to nobody.
      expect(new Set(parts.map((part) => part.of)).size).toBe(1);
      expect(parts.map((part) => part.part).sort()).toEqual(parts.map((_, index) => index + 1));
    }
  });

  it.each(MAP_STRUCTURE_PARTS.map((part) => [part.file, part] as const))(
    '%s exists and asks its part',
    (file, part) => {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source).toContain(`describeMapStructure('${part.name}');`);
    },
  );
});

describe('walks lengthened by an exit', () => {
  const grid = (rows: readonly string[]) => rows.map((row) => [...row].map((cell) => cell === '#'));
  const at = (what: string, ...tiles: [number, number][]) => ({ what, tiles: tiles.map(([x, y]) => ({ x, y })) });

  it('fails an exit on the short side of a ring, which cuts nothing off', () => {
    // The exit at 2,0 strands no ground - the long way round is still there -
    // which is exactly what the passage rule cannot see.
    const ring = grid(['.....', '.###.', '.###.', '.....']);
    expect(walksLengthenedBy(ring, new Set(['2,0']), [at('west', [0, 0]), at('east', [4, 0])])).toEqual([
      'west -> east: 4 steps, 10 without crossing an exit',
    ]);
  });

  it('says so when the only way is over the exit', () => {
    const neck = grid(['...']);
    expect(walksLengthenedBy(neck, new Set(['1,0']), [at('court', [0, 0]), at('causeway', [2, 0])])).toEqual([
      'court -> causeway: 2 steps, no way without crossing an exit',
    ]);
  });

  it('lets an exit stand at the side of a two-tile lane, and in a pocket off one', () => {
    const lane = grid(['..#', '...', '..#']);
    const ends = [at('north', [0, 0], [1, 0]), at('south', [0, 2], [1, 2])];
    expect(walksLengthenedBy(lane, new Set(['0,1']), ends)).toEqual([]);
    expect(walksLengthenedBy(lane, new Set(['2,1']), ends)).toEqual([]);
  });

  it('asks again with a detour forced, where the way round is the only way', () => {
    const lane = grid(['..#', '...', '..#']);
    const ends = [at('north', [0, 0], [1, 0]), at('south', [0, 2], [1, 2])];
    expect(walksLengthenedBy(lane, new Set(['0,1']), ends, new Set(['1,1']))).toEqual([
      'north -> south: 2 steps, no way without crossing an exit',
    ]);
  });
});
