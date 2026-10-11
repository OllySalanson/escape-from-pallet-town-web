import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { interiorAt } from './interiors';
import { stepRolls } from './localEncounters';

/**
 * Which steps roll for wildlife is one rule, asked by the raid on every step and
 * by the drop-in screen of the ground a place is graded on (`hub/dropIn.ts`), so
 * the two cannot disagree about where anything is met.
 */
describe('where a step rolls for wildlife', () => {
  const tiles = (map: ReturnType<typeof getWorldMap>) =>
    map.collision.flatMap((row, y) => row.flatMap((blocked, x) => (blocked ? [] : [{ x, y }])));

  it('rolls in tall grass and nowhere else in the open', () => {
    const map = getWorldMap('viridian-forest');
    const open = tiles(map).filter((tile) => interiorAt(map.id, tile) === undefined);
    expect(open.some((tile) => stepRolls(map, tile))).toBe(true);
    for (const tile of open) {
      expect(stepRolls(map, tile)).toBe(map.tallGrass[tile.y][tile.x]);
    }
  });

  it('rolls on every step of a floor that rolls, with no grass on it', () => {
    const map = getWorldMap('pallet-town');
    const floor = tiles(map).filter((tile) => interiorAt(map.id, tile)?.floorRolls === true);
    expect(floor.length).toBeGreaterThan(0);
    expect(floor.every((tile) => stepRolls(map, tile))).toBe(true);
  });
});
