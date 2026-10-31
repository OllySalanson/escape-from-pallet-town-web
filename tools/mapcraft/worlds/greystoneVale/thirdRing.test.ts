import { describe, expect, it } from 'vitest';
import { beatSpots } from '../../../../src/game/world/mapFile';
import { stepDistances } from '../../../../src/game/world/mapStructure';
import { getWorldMap } from '../../../../src/game/worldMap';
import { greystonePeaks } from './greystonePeaks';
import { orchardTerraces } from './orchardTerraces';
import { pineHollow } from './pineHollow';
import { KEEPER, sunkenQuarter } from './sunkenQuarter';
import { smugglersCove } from './smugglersCove';
import { tanglewood } from './tanglewood';

/**
 * The third ring out from Mill Square, in the terms it was filled to: every
 * screen a place with somebody there. A fill that keeps the roads and loses the
 * people still passes every rule a map is held to.
 */
const SCREEN = { width: 25, height: 16 };
const OUTDOORS = (spot: { readonly area?: string }) => spot.area === undefined;

/** How many figures a screen holds on average round every tile of a district, and the screens with nobody on them. */
function screensOf(file: ReturnType<typeof tanglewood>['file']) {
  const figures = [...(file.people ?? []), ...(file.pokemon ?? []), ...(file.trainers ?? [])].filter(OUTDOORS);
  let total = 0;
  let screens = 0;
  const empty: string[] = [];
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      if ('TCWFB#'.includes(file.ground[y]?.[x] ?? 'T')) continue;
      const left = Math.max(0, Math.min(64 - SCREEN.width, x - 12));
      const top = Math.max(0, Math.min(64 - SCREEN.height, y - 8));
      const inView = figures.filter(
        (one) => one.x >= left && one.x < left + SCREEN.width && one.y >= top && one.y < top + SCREEN.height,
      ).length;
      total += inView;
      screens += 1;
      if (inView === 0) empty.push(`${x},${y}`);
    }
  }
  return { mean: total / screens, empty };
}

describe('the third ring out from Mill Square', () => {
  const districts = {
    tanglewood: tanglewood().file,
    "smugglers' cove": smugglersCove().file,
    'greystone peaks': greystonePeaks().file,
    'orchard terraces': orchardTerraces().file,
    'the sunken quarter': sunkenQuarter().file,
    'pine hollow': pineHollow().file,
  };

  it.each(Object.entries(districts))('has somebody on every screen of %s', (_name, file) => {
    const { mean, empty } = screensOf(file);
    expect(empty).toEqual([]);
    // The harbour shows 4.9 at a time; this ring showed 1.7 before it was filled.
    expect(mean).toBeGreaterThan(4);
  });

  it.each(Object.entries(districts))('keeps every moving figure off the roads of %s', (name, file) => {
    // The farmyard is trodden bare from wall to wall, and the hens have the run of it.
    const yard = (spot: { x: number; y: number }) =>
      name === 'orchard terraces' && spot.x >= 18 && spot.x < 38 && spot.y >= 12 && spot.y < 17;
    const onRoad = [...(file.people ?? []), ...(file.pokemon ?? [])]
      .filter((one) => OUTDOORS(one) && (one.beat?.roam?.length ?? 0) > 0)
      .flatMap((figure) =>
        beatSpots(figure)
          .filter((spot) => file.ground[spot.y][spot.x] === 'd' && !yard(spot))
          .map((spot) => `${spot.x},${spot.y}`),
      );
    expect(onRoad).toEqual([]);
  });

  it('opens the doors a place tells you about, with somebody or something behind each', () => {
    for (const file of Object.values(districts)) {
      for (const area of (file.areas ?? []).filter((one) => one.kind !== 'cave' && one.kind !== 'tower')) {
        const held = [...(file.people ?? []), ...file.itemSpots, ...(file.pokemon ?? [])].filter((spot) => spot.area === area.id);
        expect(`${area.name}: ${held.length > 0}`).toBe(`${area.name}: true`);
      }
    }
  });

  it('names its places, none big enough to be a hunter’s patch', () => {
    for (const file of Object.values(districts)) {
      expect((file.districts ?? []).length).toBeGreaterThanOrEqual(3);
      // The drowned town was already one, behind its keeper.
      for (const place of (file.districts ?? []).filter((one) => one.name !== 'THE DROWNED TOWN')) {
        expect(Math.min(place.width, place.height)).toBeLessThan(32);
      }
    }
  });

  it('keeps each place’s one idea', () => {
    // Nobody signs the trails in Pine Hollow: its people tell you, grudgingly.
    expect(districts['pine hollow'].signs ?? []).toEqual([]);
    // The pub is called The Way Out, and it is not.
    expect(districts.tanglewood.areas?.map((area) => area.name)).toContain('The Way Out');
    // The keeper still holds the Quarter's two doors, and only those.
    const doors = (districts['the sunken quarter'].doors ?? []).filter((door) => door.kind === 'boss');
    expect(doors.map((door) => door.name)).toEqual(['Street Barricade', 'Shingle Barricade']);
    expect(doors.every((door) => door.keeper === KEEPER)).toBe(true);
    // The tarn and the dew pond are not rectangles any more.
    const water = (file: typeof districts.tanglewood, y: number) => file.ground[y].split('').filter((letter) => letter === 'W').length;
    expect(water(districts['greystone peaks'], 7)).toBeLessThan(water(districts['greystone peaks'], 9));
  });
});

describe('the third ring, walked in the stitched vale', () => {
  const inCell = (column: number, row: number) => (x: number, y: number) => ({ x: (column + 1) * 64 + x, y: (row + 1) * 64 + y });
  const wood = inCell(2, 1);
  const farm = inCell(2, 2);
  const cove = inCell(0, 3);
  const quarter = inCell(1, 3);
  const map = getWorldMap('greystone-vale');
  const fromSquare = stepDistances(map.collision, { x: 64 + 30, y: 128 + 32 }, undefined, map.links);
  const steps = ({ x, y }: { x: number; y: number }) => fromSquare[y][x];

  it('reaches every new place on foot from Mill Square with every gate shut', () => {
    const places = {
      Mislaid: wood(38, 13),
      'the mushroom ring': wood(8, 8),
      'the shrine glade': wood(41, 27),
      'the cavers’ camp': wood(55, 23),
      'the broken cart': wood(57, 43),
      'the Old Oak': wood(50, 50),
      'the windfalls': wood(36, 58),
      'the farmyard': farm(26, 14),
      'the honesty box': farm(58, 31),
      'the slip': farm(47, 53),
      'the Old Quay': quarter(40, 15),
    };
    for (const [name, tile] of Object.entries(places)) {
      expect(`${name}: ${steps(tile) > 0}`).toBe(`${name}: true`);
    }
  });

  it('keeps the road through Tanglewood the short way: leaving it is what costs', () => {
    // The east end of the road, against the pub in the middle of the maze.
    expect(steps(wood(62, 40))).toBeGreaterThan(0);
    expect(steps(wood(38, 13))).toBeGreaterThan(steps(wood(38, 35)));
  });

  it('leaves the smugglers’ skiff and boat where the plan sails them', () => {
    const run = map.sailings?.find((sailing) => sailing.name === "The Smugglers' Run");
    expect(run?.ends[0].landing).toEqual(cove(22, 41));
    expect(steps(cove(22, 41))).toBeGreaterThan(0);
    expect(steps(cove(1, 41))).toBeGreaterThan(0);
  });
});
