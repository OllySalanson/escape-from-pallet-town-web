import { describe, expect, it } from 'vitest';
import { sketchViridianCity } from '../../src/game/world/maps/viridianCity';
import type { MapFile } from '../../src/game/world/mapFile';
import { allPassed, hardChecks } from './checks';
import { MapProgram } from './program';
import { reportOn } from './report';
import { shippedRows } from './shipped';
import viridianSouth from './examples/viridianSouth';

function strip(draw: (p: MapProgram) => void = () => undefined): MapFile {
  const p = new MapProgram(32, 16);
  p.meadow(0, 4, 32, 8).road([
    [0, 7],
    [30, 7],
  ]);
  draw(p);
  return p.toFile({
    id: 'checks-test',
    name: 'Checks test',
    dropIns: [{ x: 1, y: 7, name: 'West', description: 'The west end.' }],
    exits: [{ x: 31, y: 7, name: 'East', opens: { when: 'always' } }],
  });
}

const check = (file: MapFile, id: string, options = {}) =>
  hardChecks(file, options).find((entry) => entry.id === id);

describe('hardChecks', () => {
  it("passes a plain strip, the game's checks first", () => {
    const checks = hardChecks(strip());
    expect(checks[0].id).toBe('game:loads');
    expect(allPassed(checks)).toBe(true);
  });

  it('finds open ground nobody can walk to', () => {
    // Two tiles of lawn walled in by the border above and rock on three sides.
    const island = strip((p) => p.rock(10, 4, 6, 3).meadow(12, 4, 2, 1));
    expect(check(island, 'one-piece')?.passed).toBe(false);
  });

  it('walks through a door or a cave to ground no road reaches', () => {
    // The same walled-in lawn, reached through a cave: in by a mouth on the
    // road, out by a way onto the lawn - Stormcrown, reached only from below.
    const island = strip((p) => p.rock(10, 4, 6, 3).meadow(12, 4, 2, 1));
    const cave = {
      id: 'cave',
      name: 'Cave',
      kind: 'cave' as const,
      style: 'cave' as const,
      width: 8,
      height: 6,
      ground: ['BBBBBBBB', 'BPPPPPPB', 'BPPPPPPB', 'BPPPPPPB', 'BPPPPPPB', 'BBBBBBBB'],
      buildings: [],
    };
    const through = {
      ...island,
      areas: [cave],
      links: [
        { ends: [{ x: 4, y: 7, toward: 'up' as const, look: 'door' as const }, { area: 'cave', x: 2, y: 4, toward: 'down' as const, look: 'cave-exit' as const }] },
        { ends: [{ area: 'cave', x: 5, y: 2, toward: 'up' as const, look: 'ladder-up' as const }, { x: 12, y: 4, toward: 'down' as const, look: 'door' as const }] },
      ],
    };
    expect(check(through, 'one-piece')?.passed).toBe(true);
  });

  it('finds a half-drawn tree, but only where it is asked to look', () => {
    const file = strip();
    const hand = {
      ...file,
      ground: file.ground.map((row, y) =>
        y === 10 ? `${row.slice(0, 20)}T${row.slice(21)}` : row,
      ),
    };
    expect(check(hand, 'whole-trees')?.passed).toBe(false);
    expect(
      check(hand, 'whole-trees', { trees: { x: 0, y: 0, width: 16, height: 16 } })?.passed,
    ).toBe(true);
  });

  it('measures a shortcut in steps: a hop that saves five steps is not one that saves six', () => {
    // A four-tile ledge under the road: hopping it is one step, walking round it six.
    const ledged = strip((p) => p.ledge(14, 17, 9));
    const rule = (by: number) => [
      {
        kind: 'shortcut' as const,
        label: 'down by the ledge',
        from: [15, 8] as const,
        to: [15, 10] as const,
        by,
      },
    ];
    expect(check(ledged, 'rule:down by the ledge', { rules: rule(5) })?.passed).toBe(true);
    expect(check(ledged, 'rule:down by the ledge', { rules: rule(6) })?.passed).toBe(false);
  });
});

describe('the Viridian City south example', () => {
  it('reads the shipped town rows back with their stamps and buildings', () => {
    const town = shippedRows(sketchViridianCity(), 44, 12);
    // Flowers on grass and on turf are stamps in the sketch, letters in the file.
    expect(town.ground[1]).toBe(
      'TT...........ddd......TT.f...f......PPPPP"r"r"r"""""PPPPTTTTTTTTggggggTT',
    );
    expect(town.buildings).toEqual([
      { x: 24, y: 5, kind: 'house' },
      { x: 41, y: 5, kind: 'house-flowers' },
      { x: 52, y: 5, kind: 'house' },
    ]);
  });

  it('passes every hard check and keeps its brief', () => {
    const result = viridianSouth();
    const report = reportOn(result);
    expect(
      report.checks
        .filter((entry) => !entry.passed)
        .map((entry) => `${entry.label}: ${entry.problems.join(' ')}`),
    ).toEqual([]);
    expect(report.notes).toEqual([]);
  });

  it('makes the moves FireRed routes make', () => {
    const { advice } = reportOn(viridianSouth());
    expect(advice.filter((entry) => !entry.ok).map((entry) => entry.id)).toEqual([]);
  });
});
