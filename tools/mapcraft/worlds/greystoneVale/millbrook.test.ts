import { describe, expect, it } from 'vitest';
import { stepDistances } from '../../../../src/game/world/mapStructure';
import { beatSpots } from '../../../../src/game/world/mapFile';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import { getWorldMap } from '../../../../src/game/worldMap';
import { millbrook } from './millbrook';
import { valeSolid, walkDistrict } from './walkedTwoAbreast.testkit';

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

  it('has nobody walking on the pond: the jetty\u2019s right-hand plank stops a row short', () => {
    const map = getWorldMap('greystone-vale');
    expect(map.collision[138 + 1][109]).toBe(true);
    expect(map.collision[138][109]).toBe(false);
    const wick = file.people?.find((person) => person.name === 'Old Wick');
    expect(map.collision[128 + (wick?.y ?? 0)][64 + (wick?.x ?? 0)]).toBe(false);
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
  const landing = at(32, 33);
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

/**
 * The captain, 11 Nov 2026, of the vale after it was filled: "when you're
 * walking around, there's just often things in your way, and it's quite fiddly
 * to get through places". So the village a new game lands in is held to walking
 * two abreast: a walker two tiles wide - which is what a street is - gets from
 * where you land to every way out, door, sign, landmark, berry tree, person and
 * find, to within the one last step a door's porch or a way out's pocket is. A
 * figure counts as standing on every tile of its beat, because that is where a
 * walker meets it. A prop dropped in the middle of a walking line, a figure in a
 * gateway or a tree just inside one, and a gap one tile wide where people walk
 * each fail it, by name.
 */
describe('Millbrook, walked two abreast', () => {
  const LANDING = { x: 32, y: 33 };
  // Millbrook is the plan's cell [0, 1].
  const walked = walkDistrict(file, valeSolid({ x: 64, y: 128 }), [LANDING]);

  // What is narrow on purpose, and only this: the old jetty Wick fishes off, the
  // stepping stones to the island, and Hazel's garden behind the Cut tree.
  const NARROW_ON_PURPOSE = new Set(['Old Wick', 'the island', 'Hazel\u2019s garden']);
  const hazels = (x: number, y: number) => x <= 15 && y >= 53;
  const island = (x: number, y: number) => x >= 27 && x <= 30 && y >= 46 && y <= 48;
  const places = () =>
    walked.places().filter(({ name, x, y }) => {
      const why = hazels(x, y) ? 'Hazel\u2019s garden' : island(x, y) ? 'the island' : name;
      return !NARROW_ON_PURPOSE.has(why);
    });

  it('lands you with room to walk off two abreast', () => {
    expect(walked.twoAbreast(LANDING.x, LANDING.y)).toBe(0);
  });

  it('reaches every way out, door, sign, landmark, berry tree, person and find two abreast', () => {
    const snagged = places()
      .filter((place) => place.steps < 0)
      .map((place) => `${place.name} (${place.x},${place.y})`);
    expect(snagged).toEqual([]);
  });

  it('never makes a pair walk further than one walker would to a way out or a door', () => {
    expect(walked.longerTwoAbreast()).toEqual([]);
  });

  it('keeps every street clear: nothing stands on a street', () => {
    expect(walked.blockedOn(',d')).toEqual([]);
  });
});
