import { describe, expect, it } from 'vitest';
import { COAST_WILDLIFE } from '../pokemon/encounters';
import { WeatherId } from '../pokemon/battle/weather';
import { requireInsertion } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { districtAt, districtsForMap, weatherAt } from './districts';
import { extractionPointsOn } from './extractionPoints';
import { gatesForMap } from './gates';
import { stepDistances } from './mapStructure';
import { builtInFileMap } from './playerMaps';
import { createRunTrainerEncounters } from './trainers';
import { MISTY_BOSS_ID, quarterOfPlace, VALE_QUARTERS } from './valeQuarters';

/**
 * THE COAST fights like Misty (the gyms plan's step 3): the quarter her gym
 * holds is wet and fast everywhere, not only in her hall. Its places are in the
 * rain and roll the Coast's own swimmers; its trainers fight her way past her
 * doors; the keeper inside sits above her (`quarterPuzzle.test.ts` measures
 * all three); and each of her two doors has a guard and a notice that say so
 * before it costs anything.
 */

const VALE = 'greystone-vale' as const;
const COAST = VALE_QUARTERS.find((quarter) => quarter.gym?.bossId === MISTY_BOSS_ID)!;
const places = () => districtsForMap(VALE);
/** Everybody past her doors who is not a keeper: two from the start, five more since the coast hunt. */
const COAST_TRAINERS = createRunTrainerEncounters()
  .filter((one) => one.mapId === VALE && one.bossId === undefined)
  .filter((one) => {
    const place = districtAt(VALE, one.position);
    return place !== undefined && quarterOfPlace(place, places()) === COAST;
  })
  .map((one) => one.trainer.id);
/** The outdoor places of the vale and whether each lies in the Coast. */
const outdoorPlaces = () =>
  places()
    .filter((place) => quarterOfPlace(place, places()) !== undefined)
    .map((place) => ({ place, coast: quarterOfPlace(place, places()) === COAST }));

const encounter = (id: string) => createRunTrainerEncounters().find((one) => one.trainer.id === id)!;

describe('THE COAST, past Misty', () => {
  it('rains over every place of it, and rolls the Coast’s own wildlife there and nowhere else', () => {
    const coast = outdoorPlaces().filter((entry) => entry.coast);
    expect(coast.map((entry) => entry.place.name).sort()).toEqual(
      [
        'FISHER’S ROW',
        'SMUGGLERS\' COVE',
        'THE BOATYARD',
        'THE BOAT SHED',
        'THE CONTRABAND',
        'THE CUT',
        'THE DROWNED TOWN',
        'THE EEL POOL',
        'THE LANDING STAGE',
        'THE OLD QUAY',
        'THE REVENUE POST',
        'THE SUNKEN QUARTER',
      ].sort(),
    );
    for (const { place } of coast) {
      expect(`${place.name} ${place.weather}`).toBe(`${place.name} ${WeatherId.Rain}`);
      expect(place.encounters, place.name).toBe(COAST_WILDLIFE);
    }
    const elsewhere = outdoorPlaces().filter((entry) => !entry.coast && entry.place.encounters === COAST_WILDLIFE);
    expect(elsewhere.map((entry) => entry.place.name)).toEqual([]);
  });

  it('fights its keeper and its trainers in the rain, and Misty only in the rain she makes', () => {
    for (const id of ['vale-quay-keeper-cragg', ...COAST_TRAINERS]) {
      const { position } = encounter(id);
      expect(`${id} ${weatherAt(VALE, position)}`).toBe(`${id} ${WeatherId.Rain}`);
      expect(quarterOfPlace(districtAt(VALE, position)!, places())).toBe(COAST);
    }
    expect(weatherAt(VALE, encounter('vale-gym-misty').position)).toBeNull();
  });

  /**
   * Off the road, so a wrong team walks round them: with all of them standing
   * where they stand, no walk from either of the Coast's landings to any of its
   * ways out is a step longer than with the ground clear.
   */
  it('stands its trainers off the road, playing her combo, two on two', () => {
    expect(COAST_TRAINERS.length).toBeGreaterThanOrEqual(7);
    const map = getWorldMap(VALE, [MISTY_BOSS_ID]);
    const blocked = new Set(COAST_TRAINERS.map((id) => `${encounter(id).position.x},${encounter(id).position.y}`));
    for (const id of COAST_TRAINERS) {
      const { position, trainer, sightRange } = encounter(id);
      expect(map.collision[position.y][position.x], id).toBe(false);
      expect(trainer.ai).toBe('gym');
      expect(trainer.unitCount).toBe(2);
      expect(sightRange ?? 0).toBe(0);
    }
    const exits = extractionPointsOn(VALE).filter((exit) => {
      const place = districtAt(VALE, exit.position);
      return place && quarterOfPlace(place, places()) === COAST;
    });
    expect(exits.length).toBeGreaterThan(0);
    for (const landing of COAST.landings) {
      const from = requireInsertion(landing as Parameters<typeof requireInsertion>[0]).position;
      const clear = stepDistances(map.collision, from, new Set(), map.links);
      const stood = stepDistances(map.collision, from, blocked, map.links);
      for (const exit of exits) {
        const { x, y } = exit.position;
        expect(`${landing} to ${exit.label}: ${stood[y][x]}`).toBe(`${landing} to ${exit.label}: ${clear[y][x]}`);
      }
    }
  });

  /**
   * FireRed's Route 23 keeps its badge gates with a guard who says which badge
   * opens them; here each of Misty's doors has one, on the open side, with the
   * quarter's notice beside him saying what lies past it.
   */
  it('has a guard and a notice at each of Misty’s doors, saying the badge and the rain', () => {
    const file = builtInFileMap(VALE)!.file;
    const doors = gatesForMap(VALE).filter((gate) => 'bossId' in gate && gate.bossId === MISTY_BOSS_ID);
    expect(doors).toHaveLength(2);
    const near = (spot: { x: number; y: number }, tiles: readonly { x: number; y: number }[]) =>
      tiles.some((tile) => Math.abs(tile.x - spot.x) + Math.abs(tile.y - spot.y) <= 8);
    for (const door of doors) {
      const guards = (file.people ?? []).filter(
        (person) => person.area === undefined && near(person, door.tiles) && person.lines.join(' ').includes('CASCADE BADGE'),
      );
      const notices = (file.signs ?? []).filter(
        (sign) => sign.area === undefined && near(sign, door.tiles) && sign.lines[0].startsWith('THE COAST'),
      );
      expect(`${door.label} ${guards.length} ${notices.length}`).toBe(`${door.label} 1 1`);
      // Both stand outside the quarter, where a save without the badge reads them.
      for (const spot of [...guards, ...notices]) {
        expect(quarterOfPlace(districtAt(VALE, spot)!, places())).not.toBe(COAST);
      }
      expect(notices[0].lines.join(' ')).toMatch(/Rain.*swimmers move first/);
    }
  });
});
