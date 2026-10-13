import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { interiorAt } from './interiors';
import { stepRolls } from './localEncounters';
import { districtsForMap } from './districts';

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

/**
 * Ground out of doors that rolls on every step: a named place of a map file
 * that says so (`MapFileDistrict.floorRolls`) - Ember Isle's crater, ash with
 * nothing growing on it and the vale's worst ground all the same.
 */
describe('a place whose every step rolls', () => {
  const map = getWorldMap('greystone-vale');
  const crater = districtsForMap(map.id).find((district) => district.name === 'THE CRATER')!;
  const island = districtsForMap(map.id).find((district) => district.name === 'EMBER ISLE')!;
  const inside = (area: { x: number; y: number; width: number; height: number }, x: number, y: number) =>
    x >= area.x && y >= area.y && x < area.x + area.width && y < area.y + area.height;

  it('is the crater, out of doors, on the volcano', () => {
    expect(crater.floorRolls).toBe(true);
    expect(crater.encounters?.entries.map((entry) => entry.speciesId)).toContain('ponyta');
    expect(island.floorRolls).toBeUndefined();
  });

  it('rolls on every walkable tile of the crater, grass or not, and only in tall grass round it', () => {
    const [area] = crater.areas;
    let ash = 0;
    for (let y = area.y; y < area.y + area.height; y += 1) {
      for (let x = area.x; x < area.x + area.width; x += 1) {
        if (map.collision[y][x]) continue;
        expect(stepRolls(map, { x, y }), `${x},${y}`).toBe(true);
        if (!map.tallGrass[y][x]) ash += 1;
      }
    }
    expect(ash).toBeGreaterThan(100);
    const [shore] = island.areas;
    for (let y = shore.y; y < shore.y + shore.height; y += 1) {
      for (let x = shore.x; x < shore.x + shore.width; x += 1) {
        if (map.collision[y][x] || districtsForMap(map.id).some((place) => place !== island && place.areas.some((a) => inside(a, x, y)))) continue;
        expect(stepRolls(map, { x, y }), `${x},${y}`).toBe(map.tallGrass[y][x]);
      }
    }
  });
});
