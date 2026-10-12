import { describe, expect, it } from 'vitest';
import type { MapFile } from '../../src/game/world/mapFile';
import { MapProgram } from './program';
import { measureMoves } from './measures';
import { patternAdvice } from './patterns';

/** A small route: a road east-west between a three-deep border, and whatever `draw` adds. */
function route(draw: (p: MapProgram) => void): MapFile {
  const p = new MapProgram(40, 20);
  p.meadow(0, 4, 40, 12);
  p.road([
    [0, 9],
    [38, 9],
  ]);
  draw(p);
  return p.toFile({
    id: 'measure-test',
    name: 'Measure test',
    dropIns: [{ x: 1, y: 9, name: 'West', description: 'The west end.' }],
    exits: [{ x: 39, y: 9, name: 'East', opens: { when: 'always' } }],
  });
}

const advice = (file: MapFile, id: string) => patternAdvice(file).find((entry) => entry.id === id);

describe('measureMoves', () => {
  it('reads the border, the road and the lawn', () => {
    const moves = measureMoves(route(() => undefined));
    expect(moves.frameDepth).toBe(4);
    expect(moves.roadShare).toBeCloseTo(80 / 480, 2);
    expect(moves.plainShare).toBeCloseTo(400 / 480, 2);
  });

  it('counts ledge pieces, how long they run and whether they stack', () => {
    const moves = measureMoves(
      route((p) => {
        p.ledge(4, 8, 6).ledge(4, 8, 13).ledge(20, 32, 6);
      }),
    );
    expect(moves.ledges).toBe(3);
    expect(moves.ledgeLen).toBe(5);
    expect(moves.ledgeParallel).toBeCloseTo(2 / 3, 2);
  });

  it('measures only the part of the map it is asked about', () => {
    const file = route((p) => p.bed(24, 4, 6, 4));
    expect(measureMoves(file, { x: 0, y: 0, width: 20, height: 20 }).tallShare).toBe(0);
    expect(measureMoves(file).tallShare).toBeGreaterThan(0);
  });
});

describe('patternAdvice', () => {
  it('asks for a road where there is none', () => {
    const p = new MapProgram(40, 20);
    p.meadow(0, 4, 40, 12);
    const file = p.toFile({
      id: 'no-road',
      name: 'No road',
      dropIns: [{ x: 1, y: 9, name: 'West', description: 'The west end.' }],
      exits: [{ x: 39, y: 9, name: 'East', opens: { when: 'always' } }],
    });
    expect(advice(file, 'road')?.ok).toBe(false);
    expect(advice(file, 'open-ground')?.ok).toBe(false);
  });

  it('calls a ruled ledge long and a ledge that saves nothing idle', () => {
    const ruled = route((p) => p.ledge(2, 30, 6));
    expect(advice(ruled, 'short-ledges')?.ok).toBe(false);
    // Two tiles of ledge in open lawn: walking round it is three steps longer than the hop.
    const idle = route((p) => p.ledge(10, 11, 6));
    expect(advice(idle, 'ledge-jobs')?.ok).toBe(false);
    expect(advice(idle, 'ledge-jobs')?.found).toMatch(/row 6 x 10-11/);
  });

  it('finds a road that stops in the open, and passes one that reaches the way out', () => {
    const stub = route((p) =>
      p
        .road([
          [20, 10],
          [20, 12],
        ])
        .road([
          [12, 13],
          [16, 13],
        ]),
    );
    expect(advice(stub, 'path-ends')?.ok).toBe(false);
    expect(
      advice(
        route(() => undefined),
        'path-ends',
      )?.ok,
    ).toBe(true);
  });

  it('notices the same copse stamped twice', () => {
    const stamped = route((p) => {
      p.meadow(0, 2, 40, 2);
      p.wood(6, 4, 4, 2).wood(6, 6, 2, 2);
      p.wood(24, 4, 4, 2).wood(24, 6, 2, 2);
    });
    expect(advice(stamped, 'unique-copses')?.ok).toBe(false);
    const varied = route((p) => {
      p.meadow(0, 2, 40, 2);
      p.wood(6, 4, 4, 2).wood(6, 6, 2, 2);
      p.wood(24, 4, 4, 2).wood(26, 6, 2, 2);
    });
    expect(advice(varied, 'unique-copses')?.ok).toBe(true);
  });
});
