import { describe, expect, it } from 'vitest';
import { mapFileGrid, spotPlacer } from '../../../../src/game/world/mapFileChecks';
import { stepDistances } from '../../../../src/game/world/mapStructure';
import type { GridPosition } from '../../../../src/game/movement/gridMovement';
import { CRATER_MOUTH, emberIsle, FLANK_MOUTH, HOARD, HOARD_SPOTS, LANDING } from './emberIsle';

/**
 * Ember Isle is hard to get into the way the plan says (`plan.ts`'s reach):
 * the skiff lands at the jetty, and the crater is reached only through the
 * Lava Tube. Asked of the district's own grid, walked from the jetty.
 */
const file = emberIsle().file;
const { composed, collision, links } = mapFileGrid(file);
const at = spotPlacer(composed);
const jetty: GridPosition = { x: LANDING[0], y: LANDING[1] };
const reached = (field: readonly Int32Array[] | readonly number[][], tile: GridPosition) => (field[tile.y]?.[tile.x] ?? -1) >= 0;
const withTube = stepDistances(collision, jetty, undefined, links);
const withoutTube = stepDistances(collision, jetty);
const crater: GridPosition = { x: CRATER_MOUTH[0], y: CRATER_MOUTH[1] + 1 };
const hoard = HOARD_SPOTS.map(([x, y]) => ({ x, y }));

describe('Ember Isle', () => {
  it('lands the skiff on the jetty, and walks from it to the tube and the Cinder Boat', () => {
    expect(file.ground[LANDING[1]][LANDING[0]]).toBe('M');
    expect(reached(withoutTube, { x: FLANK_MOUTH[0], y: FLANK_MOUTH[1] + 1 })).toBe(true);
    const boat = file.exits.find((exit) => exit.name === 'Cinder Boat')!;
    expect(reached(withoutTube, boat)).toBe(true);
  });

  it('reaches the crater and the hoard only through the Lava Tube', () => {
    expect(reached(withTube, crater)).toBe(true);
    expect(reached(withoutTube, crater)).toBe(false);
    for (const spot of hoard) {
      expect(reached(withTube, spot), `${spot.x},${spot.y}`).toBe(true);
      expect(reached(withoutTube, spot), `${spot.x},${spot.y}`).toBe(false);
    }
  });

  it('reaches every find on the island, in the tube and in the hoard', () => {
    for (const spot of file.itemSpots) {
      expect(reached(withTube, at(spot)), `${spot.area ?? 'outdoors'} ${spot.x},${spot.y}`).toBe(true);
    }
  });

  it("names the crater and the hoard, and the crater's ash rolls on every step", () => {
    const places = new Map((file.districts ?? []).map((place) => [place.name, place]));
    expect(places.get('THE HOARD')).toMatchObject({ ...HOARD, floorRolls: true, wildlife: 'volcano' });
    expect(places.get('THE CRATER')).toMatchObject({ floorRolls: true, wildlife: 'volcano' });
    expect(file.wildlife).toBe('volcano');
    for (const spot of hoard) {
      const holds = (place: { x: number; y: number; width: number; height: number }) =>
        spot.x >= place.x && spot.y >= place.y && spot.x < place.x + place.width && spot.y < place.y + place.height;
      expect(holds(HOARD)).toBe(true);
    }
  });

  it('dresses the tube as Mt. Ember', () => {
    expect(file.areas?.map((area) => [area.id, area.kind, area.style])).toEqual([['lava-tube', 'cave', 'ember']]);
  });
});
