import { describe, expect, it } from 'vitest';
import { beatSpots } from '../../../../src/game/world/mapFile';
import { stepDistances } from '../../../../src/game/world/mapStructure';
import { playerLinks } from '../../../../src/game/world/sailing';
import { getWorldMap } from '../../../../src/game/worldMap';
import { powerStation } from './powerStation';
import { safariMarsh } from './safariMarsh';
import { theWreck } from './theWreck';

/**
 * The fourth ring out from Mill Square, in the terms it was filled to: every
 * screen a place with somebody there. A fill that keeps the roads and loses the
 * people still passes every rule a map is held to.
 */
const SCREEN = { width: 25, height: 16 };
const OUTDOORS = (spot: { readonly area?: string }) => spot.area === undefined;

/** How many figures a screen holds on average round every tile of a district, and the screens with nobody on them. */
function screensOf(file: ReturnType<typeof theWreck>['file']) {
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

describe('the fourth ring out from Mill Square', () => {
  const districts = {
    'the power station': powerStation().file,
    'safari marsh': safariMarsh().file,
    'the wreck': theWreck().file,
  };

  it.each(Object.entries(districts))('has somebody on every screen of %s', (_name, file) => {
    const { mean, empty } = screensOf(file);
    expect(empty).toEqual([]);
    // The harbour shows 4.9 at a time; this ring showed 0.7 to 2.1 before it was filled.
    expect(mean).toBeGreaterThan(4);
  });

  it.each(Object.entries(districts))('keeps every moving figure off the roads of %s', (_name, file) => {
    const onRoad = [...(file.people ?? []), ...(file.pokemon ?? [])]
      .filter((one) => OUTDOORS(one) && (one.beat?.roam?.length ?? 0) > 0)
      .flatMap((figure) =>
        beatSpots(figure)
          .filter((spot) => file.ground[spot.y][spot.x] === 'd')
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
      expect((file.districts ?? []).filter(OUTDOORS).length).toBeGreaterThanOrEqual(8);
      for (const place of (file.districts ?? []).filter(OUTDOORS)) {
        expect(Math.min(place.width, place.height)).toBeLessThan(32);
      }
    }
  });

  it('keeps each place’s one idea', () => {
    // The station's doors are the ones they always were, and the card still opens the gate.
    const station = districts['the power station'];
    expect(station.exits.find((exit) => exit.name === 'Service Gate')?.opens).toEqual({ when: 'key' });
    expect(station.exits.find((exit) => exit.name === "Linesmen's Track")?.opens).toEqual({ when: 'landmark', landmark: 'Relay Mast' });
    // The reserve's rarest still stand where its paths go past them.
    const reserve = (districts['safari marsh'].pokemon ?? []).map((one) => one.species);
    expect(reserve).toEqual(expect.arrayContaining(['kangaskhan', 'chansey', 'pinsir', 'scyther', 'tauros']));
    // The wreck is the point of the cape, and it can be boarded.
    expect(districts['the wreck'].areas?.map((area) => area.name)).toContain('The Forward Hold');
  });
});

describe('the fourth ring, walked in the stitched vale', () => {
  const inCell = (column: number, row: number) => (x: number, y: number) => ({ x: (column + 1) * 64 + x, y: (row + 1) * 64 + y });
  const station = inCell(3, 0);
  const marsh = inCell(3, 1);
  const cape = inCell(3, 2);
  const map = getWorldMap('greystone-vale');
  const fromSquare = stepDistances(map.collision, { x: 64 + 30, y: 128 + 32 }, undefined, map.links);
  const steps = ({ x, y }: { x: number; y: number }) => fromSquare[y][x];

  it('reaches every new place on foot from Mill Square with every gate shut', () => {
    const places = {
      'the picket': station(31, 27),
      'the company shops': station(16, 27),
      'Turbine Row': station(10, 36),
      'the allotments': station(11, 40),
      'the switchyard': station(31, 33),
      'the tip': station(16, 43),
      'the bus stop': station(24, 48),
      'the road mender': station(29, 56),
      'the gauge house': station(41, 57),
      'the sailing club': station(41, 8),
      'the linesmen': station(56, 7),
      'the north stile': marsh(31, 7),
      'the hide': marsh(24, 18),
      'the nursery': marsh(46, 27),
      'the rangers’ camp': marsh(55, 31),
      'the great pool': marsh(46, 42),
      'the tour': marsh(22, 35),
      'the wallow': marsh(27, 50),
      'the south planks': marsh(21, 58),
      'the piano': cape(22, 8),
      'the viewpoint': cape(37, 29),
      'the signal station': cape(53, 24),
      'the camp': cape(42, 38),
      'the Lido': cape(24, 41),
      'the salvage stage': cape(26, 52),
    };
    for (const [name, tile] of Object.entries(places)) {
      expect(`${name}: ${steps(tile) > 0}`).toBe(`${name}: true`);
    }
  });

  it('keeps the valve tower to whoever takes the club’s dinghy: the hunter cannot walk there', () => {
    const stage = station(31, 11);
    expect(steps(stage)).toBeLessThan(0);
    const ashore = stepDistances(map.collision, { x: 64 + 30, y: 128 + 32 }, undefined, playerLinks(map));
    expect(ashore[stage.y][stage.x]).toBeGreaterThan(0);
    const dinghy = map.sailings?.find((sailing) => sailing.name === 'The Club Dinghy');
    expect(dinghy?.craft).toBe('punt');
    expect(dinghy?.ends[1].landing).toEqual(stage);
  });

  it('boards the wreck through the hole in her side, from the stage', () => {
    const hold = map.areas?.find((area) => area.name === 'The Forward Hold');
    expect(hold).toBeDefined();
    expect(steps(cape(26, 52))).toBeGreaterThan(steps(cape(27, 44)));
    // The launch's pier and its boat are where the plan sails them.
    const run = map.sailings?.find((sailing) => sailing.name === 'The Ice Run');
    expect(run?.ends[0].landing).toEqual(cape(56, 41));
  });
});
