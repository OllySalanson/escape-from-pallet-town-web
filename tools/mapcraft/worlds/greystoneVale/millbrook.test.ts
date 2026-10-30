import { describe, expect, it } from 'vitest';
import { stepDistances } from '../../../../src/game/world/mapStructure';
import { beatSpots } from '../../../../src/game/world/mapFile';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import { getWorldMap } from '../../../../src/game/worldMap';
import { millbrook } from './millbrook';

/**
 * What Millbrook is for, in the terms it was redrawn to: a new game lands here,
 * so the rule is the harbour's rule. A redraw that keeps the roads and loses the
 * people still passes every rule a map is held to.
 */
const { file } = millbrook();
const OUTDOORS = (spot: { readonly area?: string }) => spot.area === undefined;
const SCREEN = { width: 25, height: 16 };
const open = (x: number, y: number) => {
  const letter = file.ground[y]?.[x];
  return letter !== undefined && !'TCWF#'.includes(letter);
};

describe('Millbrook, where a new game lands', () => {
  const figures = [...(file.people ?? []), ...(file.pokemon ?? [])].filter(OUTDOORS);

  it('has somebody on every screen a player can stand in the village on', () => {
    const empty: string[] = [];
    let seen = 0;
    let screens = 0;
    for (let y = 8; y < 52; y += 1) {
      for (let x = 8; x < 56; x += 1) {
        if (!open(x, y)) continue;
        const left = Math.max(0, Math.min(64 - SCREEN.width, x - 12));
        const top = Math.max(0, Math.min(64 - SCREEN.height, y - 8));
        const inView = figures.filter(
          (one) => one.x >= left && one.x < left + SCREEN.width && one.y >= top && one.y < top + SCREEN.height,
        ).length;
        seen += inView;
        screens += 1;
        if (inView === 0) empty.push(`${x},${y}`);
      }
    }
    expect(empty).toEqual([]);
    // The harbour shows 4.9 at a time; the vale as a whole showed 0.9.
    expect(seen / screens).toBeGreaterThan(3);
  });

  it('keeps every figure off the streets: a figure is a wall to a walk out', () => {
    const onStreet = figures.flatMap((figure) =>
      beatSpots(figure)
        .filter((spot) => ',d'.includes(file.ground[spot.y][spot.x]))
        .map((spot) => `${spot.x},${spot.y}`),
    );
    expect(onStreet).toEqual([]);
  });

  it('opens doors: every building a player is told about has somebody or something inside', () => {
    const areas = file.areas ?? [];
    expect(areas.map((area) => area.name)).toEqual(
      expect.arrayContaining(['The Mill', 'Millbrook Center', 'Millbrook Mart', 'The Woodshed']),
    );
    for (const area of areas) {
      const held = [...(file.people ?? []), ...file.itemSpots].filter((spot) => spot.area === area.id);
      expect(`${area.name}: ${held.length > 0}`).toBe(`${area.name}: true`);
    }
  });

  it('gives a player things to do besides leave', () => {
    const fights = (file.pokemon ?? []).filter((one) => one.level !== undefined).length;
    expect(fights).toBeGreaterThanOrEqual(3);
    expect((file.berryTrees ?? []).length).toBeGreaterThanOrEqual(5);
    expect(file.itemSpots.filter((spot) => spot.hidden).length).toBeGreaterThanOrEqual(4);
    expect(file.trainers?.every((trainer) => trainer.sight === 0)).toBe(true);
  });
});

describe('Millbrook, walked in the stitched vale', () => {
  // Millbrook is the plan's cell [0, 1], one cell in from the map's west and north edges.
  const at = (x: number, y: number) => ({ x: 64 + x, y: 128 + y });
  const landing = at(30, 32);
  const walk = (opened: readonly string[] = []) => {
    const map = getWorldMap('greystone-vale', opened);
    return stepDistances(map.collision, landing, undefined, map.links);
  };

  it('keeps Hazel’s garden behind the Cut tree, and only behind the Cut tree', () => {
    const door = gatesForMap('greystone-vale').find((gate) =>
      gate.tiles.some((tile) => tile.x === 64 + 16 && tile.y === 128 + 56),
    );
    expect(door).toBeDefined();
    const garden = at(12, 56);
    expect(walk()[garden.y][garden.x]).toBe(-1);
    expect(walk([gateKey(door!)])[garden.y][garden.x]).toBeGreaterThan(0);
  });

  it('leaves all four roads a short walk from the square, with nothing in the way', () => {
    const steps = walk();
    const roads = { north: at(30, 0), east: at(63, 30), south: at(40, 63), west: at(1, 30) };
    for (const [name, tile] of Object.entries(roads)) {
      const distance = steps[tile.y][tile.x];
      expect(`${name}: ${distance > 0 && distance < 60}`).toBe(`${name}: true`);
    }
  });

  it('reaches the island in the pool on foot, over the stones', () => {
    const island = at(28, 47);
    expect(walk()[island.y][island.x]).toBeGreaterThan(0);
  });
});
