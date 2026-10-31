import { describe, expect, it } from 'vitest';
import { allPassed, hardChecks } from '../../checks';
import { caveLadders, caveMouthLink, greystoneCaves } from './greystoneCaves';
import { pineHollow } from './pineHollow';
import { tanglewood } from './tanglewood';

/**
 * Pine Hollow, Tanglewood and the Greystone Caves, held to their checks while
 * they wait to be stitched into the vale (they are reached only through The
 * Crossing): each district file passes every hard check played on its own.
 */
describe("Greystone Vale's woods and caves", () => {
  it.each([
    ['Pine Hollow', pineHollow],
    ['Tanglewood', tanglewood],
  ])('%s passes every hard check on its own', (_name, draw) => {
    const { file, limits } = draw();
    const checks = hardChecks(file, { limits });
    expect(checks.filter((check) => !check.passed)).toEqual([]);
    expect(allPassed(checks)).toBe(true);
  });

  it('carries the five cave floors and every ladder in Tanglewood, with the wood mouth', () => {
    const cave = greystoneCaves();
    const file = tanglewood().file;
    expect(file.areas?.map((area) => area.id)).toEqual(cave.areas.map((area) => area.id));
    expect(cave.areas).toHaveLength(5);
    expect(file.links).toHaveLength(caveLadders(cave).length + 1);
    expect(file.buildings.filter((building) => building.kind === 'cave-mouth')).toHaveLength(1);
  });

  it('opens each mouth onto a floor of its own, and moves no floor when another mouth is planted', () => {
    const cave = greystoneCaves();
    const floors = (['peaks', 'wood', 'sea'] as const).map(
      (mouth) => caveMouthLink(cave, mouth, [10, 10]).ends[1].area,
    );
    expect(new Set(floors).size).toBe(3);
    expect(caveMouthLink(cave, 'peaks', [10, 10]).ends[0]).toMatchObject({ x: 10, y: 11 });
    expect(greystoneCaves().areas).toEqual(cave.areas);
  });
});
