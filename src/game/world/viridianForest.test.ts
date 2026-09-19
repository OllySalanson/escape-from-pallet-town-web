import { describe, expect, it } from 'vitest';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import { WORLD_POIS } from './pois';
import { exitTile, steps } from './redrawnMaps.testkit';

const MAP = 'viridian-forest';
const IVY = 'forest-warden-ivy';
const landing = RUN_INSERTIONS['viridian-forest'].position;
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
      expect(`${what}: ${steps(MAP, landing, tile, { dry: true })}`).toBe(`${what}: -1`);
      expect(`${what}: ${steps(MAP, landing, tile, { standing: [IVY] }) > 0}`).toBe(`${what}: true`);
    }
  });

  /**
   * Lighting the Fire Tower is a detour on the way in that buys the way out:
   * the Tower Steps are the near exit to the cache that is there from the
   * moment it is lit, where The Clearing keeps you waiting and the Brook Ford
   * is the whole forest away.
   */
  it('makes the Fire Tower a detour that pays for itself on the way home', () => {
    const walk = { standing: [IVY] };
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
      (tile) => steps(MAP, landing, tile, { standing: [IVY] }) < 0 && steps(MAP, landing, tile) >= 0,
    );
    // Her own tile is the only ground she takes.
    expect(cutOff).toHaveLength(1);
  });
});
