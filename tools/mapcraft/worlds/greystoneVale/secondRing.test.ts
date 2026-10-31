import { describe, expect, it } from 'vitest';
import { beatSpots } from '../../../../src/game/world/mapFile';
import { getWorldMap } from '../../../../src/game/worldMap';
import { stepDistances } from '../../../../src/game/world/mapStructure';
import { greystonePeaks } from './greystonePeaks';
import { gullStrand } from './gullStrand';
import { highMoor } from './highMoor';
import { reedmere } from './reedmere';
import { tanglewood } from './tanglewood';
import { theCrossing } from './theCrossing';

/**
 * The second ring out from Mill Square, in the terms it was filled to: the rule
 * Millbrook was redrawn by, every screen a place with somebody there. A fill that
 * keeps the roads and loses the people still passes every rule a map is held to.
 */
const SCREEN = { width: 25, height: 16 };
const OUTDOORS = (spot: { readonly area?: string }) => spot.area === undefined;

/** How many figures a screen holds on average round every tile of a stretch, and the screens with nobody on them. */
function screensOf(
  file: ReturnType<typeof reedmere>['file'],
  { x: x0, y: y0, width, height }: { x: number; y: number; width: number; height: number },
) {
  const figures = [...(file.people ?? []), ...(file.pokemon ?? []), ...(file.trainers ?? [])].filter(OUTDOORS);
  let total = 0;
  let screens = 0;
  const empty: string[] = [];
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      if ('TCWF#'.includes(file.ground[y]?.[x] ?? 'T')) continue;
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

describe('the second ring out from Mill Square', () => {
  const districts = {
    reedmere: { file: reedmere().file, stretch: { x: 4, y: 4, width: 56, height: 52 } },
    'the crossing': { file: theCrossing().file, stretch: { x: 22, y: 4, width: 40, height: 56 } },
    'high moor': { file: highMoor().file, stretch: { x: 20, y: 2, width: 40, height: 52 } },
    'gull strand': { file: gullStrand().file, stretch: { x: 2, y: 4, width: 60, height: 42 } },
  };

  it.each(Object.entries(districts))('has somebody on every screen of %s', (_name, { file, stretch }) => {
    const { mean, empty } = screensOf(file, stretch);
    expect(empty).toEqual([]);
    // The harbour shows 4.9 at a time; the vale as a whole showed 0.9 before this.
    expect(mean).toBeGreaterThan(3);
  });

  it.each(Object.entries(districts))('keeps every figure off the boards and the streets of %s', (_name, { file }) => {
    const onRoad = [...(file.people ?? []), ...(file.pokemon ?? [])]
      .filter((one) => OUTDOORS(one) && (one.beat?.roam?.length ?? 0) > 0)
      .flatMap((figure) =>
        beatSpots(figure)
          .filter((spot) => spot.y >= 0 && file.ground[spot.y][spot.x] === 'd')
          .map((spot) => `${spot.x},${spot.y}`),
      );
    expect(onRoad).toEqual([]);
  });

  it('opens the doors a place tells you about, with somebody or something behind each', () => {
    for (const { file } of Object.values(districts)) {
      for (const area of (file.areas ?? []).filter((one) => one.kind !== 'cave' && one.kind !== 'tower')) {
        const held = [...(file.people ?? []), ...file.itemSpots, ...(file.pokemon ?? [])].filter((spot) => spot.area === area.id);
        expect(`${area.name}: ${held.length > 0}`).toBe(`${area.name}: true`);
      }
    }
  });

  it('names its places, so a raid knows where it has got to', () => {
    for (const { file } of Object.values(districts)) {
      expect((file.districts ?? []).length).toBeGreaterThanOrEqual(7);
      // Each is small enough never to be a hunter's patch of its own (`huntingGrounds`).
      for (const place of file.districts ?? []) expect(Math.min(place.width, place.height)).toBeLessThan(32);
    }
  });

  it('fills the feet of the peaks and the edge of the wood as well', () => {
    expect(greystonePeaks().file.people?.filter(OUTDOORS).length).toBeGreaterThanOrEqual(6);
    expect(tanglewood().file.people?.filter(OUTDOORS).length).toBeGreaterThanOrEqual(5);
  });
});

describe('Reedmere, walked in the stitched vale', () => {
  // Reedmere is the plan's cell [0, 2].
  const at = (x: number, y: number) => ({ x: 64 + x, y: 192 + y });
  const map = getWorldMap('greystone-vale');
  const fromSquare = stepDistances(map.collision, { x: 64 + 30, y: 128 + 32 }, undefined, map.links);
  const { file } = reedmere();

  it('lays the way round in boards, over the water and the reeds alike', () => {
    const boards = file.ground.join('').split('_').length - 1;
    expect(boards).toBeGreaterThan(200);
    for (const tile of [at(46, 12), at(46, 24), at(38, 44), at(20, 46), at(12, 36)]) {
      expect(map.terrain?.[tile.y][tile.x]).toBe('boards');
    }
  });

  it('keeps the dry way the long way: straight across the reeds is shorter than round the boards', () => {
    const hummock = at(24, 12);
    const boardsOnly = stepDistances(
      map.collision.map((row, y) => row.map((solid, x) => solid || map.tallGrass[y][x])),
      at(46, 12),
      undefined,
      map.links,
    );
    const wading = stepDistances(map.collision, at(46, 12), undefined, map.links);
    // The walk to the west end of the marsh, dry and wet.
    const west = at(12, 30);
    expect(boardsOnly[west.y][west.x]).toBeGreaterThan(wading[west.y][west.x]);
    expect(fromSquare[hummock.y][hummock.x]).toBeGreaterThan(0);
  });

  it('reaches Duck Island by the punt and no other way', () => {
    const island = at(24, 31);
    expect(fromSquare[island.y][island.x]).toBe(-1);
    const punt = map.sailings?.find((sailing) => sailing.name === 'The Mere Punt');
    expect(punt?.craft).toBe('punt');
    expect(punt?.ends[0].landing).toEqual(at(40, 30));
    expect(punt?.ends[1].landing).toEqual(at(27, 30));
    // A boat sailing the whole of a raid: nobody is stranded on the island.
    expect(punt?.runsFromMs).toBe(0);
    expect(punt?.runsUntilMs).toBe(300_000);
  });
});
