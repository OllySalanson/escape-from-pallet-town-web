import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gatesForMap } from './gates';
import { WORLD_POIS } from './pois';
import { cheapestWalk, exitTile, steps } from './redrawnMaps.testkit';

const MAP = 'viridian-forest';
const IVY = 'forest-warden-ivy';
const PELL = 'forest-ridge-keeper-pell';
/** The lookout beaten: both ends of the ridge open. */
const WON = ['forest-ridge-keeper'];
const landing = RUN_INSERTIONS['viridian-forest'].position;
const ridge = RUN_INSERTIONS['viridian-ridge'].position;
const tower = WORLD_POIS.find((poi) => poi.id === 'forest-fire-tower')!.position;
const cache = RAID_CONTRACTS.find((contract) => contract.id === 'wardens-resupply')!.markers[0].position;

describe('Viridian Forest', () => {
  /**
   * The forest's rule, and the reason the resupply contract is decided at the
   * loadout screen: there is no fast lane. Every clearing is dry and every
   * trail between two clearings is tall grass, so distance here is priced in
   * fights and nothing on the map can be reached for free.
   */
  it('has no dry way to anywhere: every exit, the tower and the cache are all through grass', () => {
    const map = getWorldMap(MAP);
    expect(map.tallGrass[landing.y][landing.x]).toBe(false);
    const destinations = [
      ...EXTRACTION_POINTS.filter((point) => point.mapId === MAP).map((point) => [point.label, point.position] as const),
      ['FIRE TOWER', tower] as const,
      ['the cache', cache] as const,
    ];
    for (const [what, tile] of destinations) {
      // Asked with the ridge open, because the rule is about the forest, not
      // about a door: even with the one dry road in the wood unlocked, nothing
      // on this map is reached without walking grass.
      expect(`${what}: ${steps(MAP, landing, tile, { beaten: WON, dry: true })}`).toBe(`${what}: -1`);
      expect(`${what}: ${steps(MAP, landing, tile, { beaten: WON, standing: [IVY] }) > 0}`).toBe(`${what}: true`);
    }
    // The Ridge Gap is the lookout's own way off, so a fresh save has three
    // exits and never that one.
    expect(steps(MAP, landing, exitTile(MAP, 'RIDGE GAP'), { standing: [IVY, PELL] })).toBe(-1);
  });

  /**
   * Viridian's one boss, and what beating him buys. It is not a short cut: the
   * ridge is *longer* than the trails it runs above. It is the only ground in
   * this forest with no tall grass on it, and this map prices distance in
   * fights rather than steps - so the walk from the fire tower to the stair it
   * lights costs ten grass steps through the wood and two along the top.
   */
  it('makes the ridge the one road in the forest that costs no fights', () => {
    const towerSteps = exitTile(MAP, 'TOWER STEPS');
    expect(cheapestWalk(MAP, [], tower, towerSteps)).toEqual({ grass: 10, steps: 25 });
    expect(cheapestWalk(MAP, WON, tower, towerSteps)).toEqual({ grass: 2, steps: 33 });
    // Nothing is dry from the landing (above), but the ridge itself is dry end
    // to end: a raid that drops in on it can leave without a single roll.
    expect(cheapestWalk(MAP, WON, ridge, exitTile(MAP, 'RIDGE GAP'))).toEqual({ grass: 0, steps: 3 });
    expect(cheapestWalk(MAP, WON, ridge, towerSteps)).toEqual({ grass: 0, steps: 13 });
  });

  /**
   * The same shape every boss in this game holds: the door in front of the
   * player - the nub at the fire tower's foot, which until now was one step of
   * ground that went nowhere - and a second that opens onto ground they know.
   */
  it('gives the ridge a way back that is shorter than the way in', () => {
    const gate = gatesForMap(MAP).find((candidate) => candidate.id === 'forest-ridge-gate')!.tiles;
    const stair = gatesForMap(MAP).find((candidate) => candidate.id === 'forest-ridge-stair')!.tiles;

    expect(steps(MAP, landing, ridge, { standing: [IVY, PELL] })).toBe(-1);
    expect({
      inByTheGate: steps(MAP, ridge, exitTile(MAP, 'TOWER STEPS'), { beaten: WON, without: stair }),
      backByTheStair: steps(MAP, ridge, exitTile(MAP, 'TOWER STEPS'), { beaten: WON, without: gate }),
    }).toEqual({ inByTheGate: 33, backByTheStair: 13 });
  });

  /**
   * Lighting the Fire Tower is a detour on the way in that buys the way out:
   * the Tower Steps are the near exit to the cache that is there from the
   * moment it is lit, where The Clearing keeps you waiting and the Brook Ford
   * is the whole forest away.
   */
  it('makes the Fire Tower a detour that pays for itself on the way home', () => {
    const walk = { standing: [IVY, PELL] };
    expect({
      straightIn: steps(MAP, landing, cache, walk),
      byTheTower: steps(MAP, landing, tower, walk) + steps(MAP, tower, cache, walk),
      outByTheSteps: steps(MAP, cache, exitTile(MAP, 'TOWER STEPS'), walk),
      outByTheClearing: steps(MAP, cache, exitTile(MAP, 'FOREST CLEARING'), walk),
      outByTheFord: steps(MAP, cache, exitTile(MAP, 'BROOK FORD'), walk),
    }).toEqual({ straightIn: 43, byTheTower: 47, outByTheSteps: 21, outByTheClearing: 18, outByTheFord: 47 });
  });

  it('lets Ivy be walked round: she stands in a hub, never in a door', () => {
    const map = getWorldMap(MAP);
    const open = map.collision.flatMap((row, y) => row.flatMap((blocked, x) => (blocked ? [] : [{ x, y }])));
    const cutOff = open.filter(
      (tile) =>
        steps(MAP, landing, tile, { beaten: WON, standing: [IVY] }) < 0 &&
        steps(MAP, landing, tile, { beaten: WON }) >= 0,
    );
    // Her own tile is the only ground she takes.
    expect(cutOff).toHaveLength(1);
  });
});
