import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gatesForMap } from './gates';
import { WORLD_POIS } from './pois';
import { trainerSightTiles } from './trainerSight';
import { createRunTrainerEncounters } from './trainers';
import { cheapestWalk, exitTile, steps } from './redrawnMaps.testkit';

const MAP = 'viridian-forest';
const IVY = 'forest-warden-ivy';
const PELL = 'forest-ridge-keeper-pell';
const MOTT = 'forest-quarry-keeper-mott';
const DILL = 'forest-drive-carter-dill';
const NELL = 'forest-blowdown-forager-nell';
/** The lookout beaten: both ends of the ridge open. */
const WON = ['forest-ridge-keeper'];
/** Every door on the map: both keepers beaten and the coppice ride cut. */
const ALL_OPEN = ['forest-ridge-keeper', 'forest-quarry-keeper', 'forest-coppice-ride'];
/** Nobody beaten: what a fresh save walks into. */
const FRESH = { standing: [IVY, PELL, MOTT, DILL, NELL] };
const landing = RUN_INSERTIONS['viridian-forest'].position;
const ridge = RUN_INSERTIONS['viridian-ridge'].position;
const burn = RUN_INSERTIONS['viridian-burn'].position;
const sawpit = RUN_INSERTIONS['viridian-sawpit'].position;
const kilns = RUN_INSERTIONS['viridian-kilns'].position;
const tower = WORLD_POIS.find((poi) => poi.id === 'forest-fire-tower')!.position;
const cache = RAID_CONTRACTS.find((contract) => contract.id === 'wardens-resupply')!.markers[0].position;

describe('Viridian Forest', () => {
  /**
   * The forest's rule, and the reason the resupply contract is decided at the
   * loadout screen: there is no fast lane. Every clearing is dry and every
   * trail between two clearings is tall grass, so distance here is priced in
   * fights and nothing on the map can be reached for free.
   *
   * It is asked of the whole of the wood now rather than of a quarter of it,
   * which is the one thing the expansion could most easily have lost: the burn
   * has earth in it, the kilns have a stone yard and the south has a made road,
   * and not one of them can be reached from the landing without walking grass.
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
      // Asked with every door open, because the rule is about the forest, not
      // about a door: even with the ridge, the coppice and the quarry unlocked,
      // nothing on this map is reached without walking grass.
      expect(`${what}: ${steps(MAP, landing, tile, { beaten: ALL_OPEN, dry: true })}`).toBe(`${what}: -1`);
      expect(`${what}: ${steps(MAP, landing, tile, { beaten: ALL_OPEN, standing: [IVY, DILL, NELL] }) > 0}`).toBe(`${what}: true`);
    }
    // The Ridge Gap and the Crag Path are the lookout's own ways off and the
    // Quarry Adit is the quarryman's, so a fresh save has six exits and never
    // one of those three.
    for (const sealed of ['RIDGE GAP', 'CRAG PATH', 'QUARRY ADIT']) {
      expect(`${sealed}: ${steps(MAP, landing, exitTile(MAP, sealed), FRESH)}`).toBe(`${sealed}: -1`);
    }
  });

  /**
   * What the map is *for*, in the one measurement that says it: a raid that
   * drops in anywhere has a way home a few seconds of clock away, and the map
   * is nonetheless four times bigger than one raid can walk. The vastness is in
   * what you did not get to, never in the walk back to the door.
   *
   * These are the walks a fresh save has - nothing beaten, everybody standing -
   * at `STEP_DURATION_MS` a tile, against a five-minute raid.
   */
  it('gives every landing a way out inside a few seconds of a five-minute clock', () => {
    const nearest = (from: { x: number; y: number }): number =>
      Math.min(
        ...EXTRACTION_POINTS.filter((point) => point.mapId === MAP)
          .map((point) => steps(MAP, from, point.position, FRESH))
          .filter((walk) => walk >= 0),
      );
    expect({
      northLanding: nearest(landing),
      theRidge: nearest(ridge),
      theBurn: nearest(burn),
      theSawpit: nearest(sawpit),
      charcoalBurn: nearest(kilns),
    }).toEqual({ northLanding: 24, theRidge: 3, theBurn: 12, theSawpit: 21, charcoalBurn: 18 });
  });

  /**
   * Viridian's first boss, and what beating him buys. It is not a short cut:
   * the ridge is *longer* than the trails it runs above. It is the only ground
   * in this forest with no tall grass on it, and this map prices distance in
   * fights rather than steps - so the walk from the fire tower to the stair it
   * lights costs ten grass steps through the wood and two along the top.
   *
   * What the bigger map added is the length of it: the shelf carries on east
   * over the whole new wood to Raven Crag, so the ridge is now a fifty-step
   * road with a door at each end and not one roll on it.
   */
  it('makes the ridge the one road in the forest that costs no fights', () => {
    const towerSteps = exitTile(MAP, 'TOWER STEPS');
    expect(cheapestWalk(MAP, [], tower, towerSteps)).toEqual({ grass: 10, steps: 25 });
    expect(cheapestWalk(MAP, WON, tower, towerSteps)).toEqual({ grass: 2, steps: 33 });
    // Nothing is dry from the landing (above), but the ridge itself is dry end
    // to end: a raid that drops in on it can leave by either door without a
    // single roll, and cross the whole wood between them without one either.
    expect(cheapestWalk(MAP, WON, ridge, exitTile(MAP, 'RIDGE GAP'))).toEqual({ grass: 0, steps: 3 });
    expect(cheapestWalk(MAP, WON, ridge, towerSteps)).toEqual({ grass: 0, steps: 13 });
    expect(cheapestWalk(MAP, WON, ridge, exitTile(MAP, 'CRAG PATH'))).toEqual({ grass: 0, steps: 51 });
  });

  /**
   * The same shape every boss in this game holds: the door in front of the
   * player - the nub at the fire tower's foot, which until now was one step of
   * ground that went nowhere - and a second that opens onto ground they know.
   */
  it('gives the ridge a way back that is shorter than the way in', () => {
    const gate = gatesForMap(MAP).find((candidate) => candidate.id === 'forest-ridge-gate')!.tiles;
    const stair = gatesForMap(MAP).find((candidate) => candidate.id === 'forest-ridge-stair')!.tiles;

    expect(steps(MAP, landing, ridge, FRESH)).toBe(-1);
    expect({
      inByTheGate: steps(MAP, ridge, exitTile(MAP, 'TOWER STEPS'), { beaten: WON, without: stair }),
      backByTheStair: steps(MAP, ridge, exitTile(MAP, 'TOWER STEPS'), { beaten: WON, without: gate }),
    }).toEqual({ inByTheGate: 33, backByTheStair: 13 });
  });

  /**
   * Viridian's second boss, on the other side of a map four times the size, and
   * the same shape read in the other direction: the gate is the way in from
   * Stone Row and the stair drops out of the floor of the working onto Beech
   * Flat, which halves the walk home from the best cache on the map.
   */
  it('gives the quarry a way home that is half the way out by its own gate', () => {
    const gate = gatesForMap(MAP).find((candidate) => candidate.id === 'forest-quarry-gate')!.tiles;
    const stair = gatesForMap(MAP).find((candidate) => candidate.id === 'forest-quarry-stair')!.tiles;
    const adit = exitTile(MAP, 'QUARRY ADIT');

    expect(steps(MAP, sawpit, adit, FRESH)).toBe(-1);
    expect({
      inByTheGate: steps(MAP, sawpit, adit, { beaten: ALL_OPEN, without: stair }),
      homeByTheStair: steps(MAP, adit, exitTile(MAP, 'SOUTH GATE'), { beaten: ALL_OPEN, without: gate }),
      homeByTheGate: steps(MAP, adit, exitTile(MAP, 'SOUTH GATE'), { beaten: ALL_OPEN, without: stair }),
    }).toEqual({ inByTheGate: 38, homeByTheStair: 34, homeByTheGate: 64 });
  });

  /**
   * The one toll on the new ground, and the only trainer on this map with a
   * watch. Carter Dill stands off the long drive with the ride running across
   * in front of her, so what she prices is the fast ground rather than the only
   * ground: the way round exists and it is nearly twice as long.
   */
  it('prices the long drive rather than shutting it', () => {
    const map = getWorldMap(MAP, ALL_OPEN);
    const dill = createRunTrainerEncounters().find((one) => one.trainer.id === DILL)!;
    const watched = trainerSightTiles(dill, (tile) => map.collision[tile.y]?.[tile.x] !== false);
    const rookery = { x: 53, y: 66 };

    expect(watched).toHaveLength(4);
    expect({
      byTheDrive: steps(MAP, kilns, rookery, { beaten: ALL_OPEN }),
      roundHerWatch: steps(MAP, kilns, rookery, { beaten: ALL_OPEN, without: [dill.position, ...watched] }),
    }).toEqual({ byTheDrive: 48, roundHerWatch: 90 });
  });

  /**
   * Lighting the Fire Tower is a detour on the way in that buys the way out:
   * the Tower Steps are the near exit to the cache that is there from the
   * moment it is lit, where The Clearing keeps you waiting and the Brook Ford
   * is the whole forest away. Unchanged by the expansion on purpose - the
   * contract is walked on the ground it was authored on.
   */
  it('makes the Fire Tower a detour that pays for itself on the way home', () => {
    expect({
      straightIn: steps(MAP, landing, cache, FRESH),
      byTheTower: steps(MAP, landing, tower, FRESH) + steps(MAP, tower, cache, FRESH),
      outByTheSteps: steps(MAP, cache, exitTile(MAP, 'TOWER STEPS'), FRESH),
      outByTheClearing: steps(MAP, cache, exitTile(MAP, 'FOREST CLEARING'), FRESH),
      outByTheFord: steps(MAP, cache, exitTile(MAP, 'BROOK FORD'), FRESH),
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
