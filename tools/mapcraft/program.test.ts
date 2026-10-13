import { describe, expect, it } from 'vitest';
import { plantedProp, readMapFile } from '../../src/game/world/mapFile';
import { buildingSize, MapProgram, seeded } from './program';
import { readTiles, walkable } from './tiles';

describe('MapProgram', () => {
  it('grows a mostly drawn tree whole and clears a stray corner', () => {
    const p = new MapProgram(8, 4, '.');
    p.block(0, 0, 2, 1, 'T').put(0, 1, 'T'); // three quarters of a tree
    p.put(5, 1, 'T'); // one corner of a tree
    const rows = p.compile();
    expect(rows[0].slice(0, 2)).toBe('TT');
    expect(rows[1].slice(0, 2)).toBe('TT');
    expect(rows[1][5]).toBe('.');
  });

  it('gives every ledge run its two ends', () => {
    const p = new MapProgram(10, 3, '.');
    p.block(1, 1, 5, 1, '=').put(8, 1, '<');
    expect(p.compile()[1]).toBe('.<===>..=.');
  });

  it('lays a sketch a letter a lattice cell, so a lane drawn in it is never eaten', () => {
    const p = new MapProgram(8, 6, 'T');
    p.cells(['T.T', ' g'], 1, 0);
    const rows = p.compile();
    expect(rows.slice(0, 4)).toEqual(['TTTT..TT', 'TTTT..TT', 'TTTTggTT', 'TTTTggTT']);
  });

  it('leaves locked ground alone, in strokes and in compiling', () => {
    const p = new MapProgram(6, 4, '.');
    p.put(0, 0, 'T').lock(0, 0, 6, 2);
    p.meadow(0, 0, 6, 4, 'g');
    const rows = p.compile();
    expect(rows[0]).toBe('T.....');
    expect(rows[2]).toBe('gggggg');
  });

  it("plants a building on a lot the size of the game's own prop", () => {
    const p = new MapProgram(12, 10, 'T');
    p.building('cottage-door', 2, 2);
    const prop = plantedProp('cottage-door');
    expect(buildingSize('cottage-door')).toEqual({ width: prop.width, height: prop.height });
    const rows = p.compile();
    for (let y = 2; y < 2 + prop.height; y += 1)
      expect(rows[y].slice(2, 2 + prop.width)).toBe('.'.repeat(prop.width));
    expect(p.buildings).toEqual([{ x: 2, y: 2, kind: 'cottage-door' }]);
  });

  it("leaves a building's blank cells to the ground under them, as the game does", () => {
    // The Power Plant's top row is four chimney caps with gaps between them,
    // which on Route 10 are the cliff it stands against.
    const p = new MapProgram(13, 12, '.');
    p.block(0, 0, 13, 3, 'C');
    p.building('power-plant', 2, 2);
    p.block(2, 2, 9, 1, 'C');
    const map = readTiles(p.toFile({ id: 'plant', name: 'Plant', dropIns: [{ x: 1, y: 11, name: 'In' }], exits: [] }));
    expect(map.kinds[2][2]).toBe('rock');
    expect(walkable(map, 2, 2)).toBe(false);
    expect(map.kinds[3][3]).toBe('building');
  });

  it('refuses a letter the map file does not have, and a road that is not straight', () => {
    const p = new MapProgram(6, 6);
    expect(() => p.put(1, 1, 'Q')).toThrow(/not a map file ground letter/);
    expect(() =>
      p.road([
        [0, 0],
        [3, 3],
      ]),
    ).toThrow(/not straight/);
  });

  it('notes a road narrower than FireRed draws one and grass too small to be a bed', () => {
    const p = new MapProgram(10, 10, '.');
    p.road(
      [
        [0, 0],
        [5, 0],
      ],
      { width: 1 },
    ).bed(6, 6, 2, 2);
    expect(p.notes).toHaveLength(2);
  });

  it('lays terraces of short, stacked pieces, each stopped by a bush', () => {
    const p = new MapProgram(40, 16, '.');
    p.terraces(2, 36, 3, 3, seeded(7));
    const rows = p.compile();
    const runs = rows.flatMap((row) => row.match(/<=*>/g) ?? []);
    expect(runs.length).toBeGreaterThan(3);
    expect(runs.every((run) => run.length >= 3 && run.length <= 6)).toBe(true);
    for (const row of rows)
      for (const match of row.matchAll(/>/g)) expect(row[(match.index ?? 0) + 1]).toBe('o');
  });

  it('compiles to a map file the game reads', () => {
    const p = new MapProgram(24, 16);
    p.frame(0, 0, 24, 16, { depth: 3 });
    p.meadow(4, 4, 16, 8).road([
      [0, 7],
      [22, 7],
    ]);
    const file = p.toFile({
      id: 'program-test',
      name: 'Program test',
      dropIns: [{ x: 2, y: 7, name: 'West', description: 'The west end.' }],
      exits: [{ x: 23, y: 7, name: 'East', opens: { when: 'always' } }],
    });
    const reading = readMapFile(file);
    expect(reading.ok).toBe(true);
  });
});
