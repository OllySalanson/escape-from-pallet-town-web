import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { RunManager } from '../run/RunManager';
import { WORLD_MAPS } from '../worldMap';
import { WORLD_POIS, cacheRefusalLine, tryActivatePoi } from './pois';

const worldSceneSource = await readFile(new URL('../scenes/WorldScene.ts', import.meta.url), 'utf8');

const fieldStation = WORLD_POIS[0];

describe('world POIs', () => {
  it('only activates a fixed POI once during an active run', () => {
    const activated = new Set<string>();
    const grants: string[] = [];

    expect(
      tryActivatePoi(
        fieldStation,
        true,
        activated,
        (itemId, quantity) => {
          grants.push(`${itemId}:${quantity}`);
          return true;
        },
        () => true,
      ),
    ).toBe('activated');
    expect(activated).toEqual(new Set([fieldStation.id]));
    expect(grants).toEqual(['poke-ball:2', 'potion:1']);
    expect(tryActivatePoi(fieldStation, true, activated, () => true, () => true)).toBe('unavailable');
  });

  it('remains consumed when battle return recreates the scene state', () => {
    const activatedBeforeBattle = new Set([fieldStation.id]);
    const activatedAfterBattle = new Set([...activatedBeforeBattle]);

    expect(tryActivatePoi(fieldStation, true, activatedAfterBattle, () => true, () => true)).toBe('unavailable');
    expect(activatedAfterBattle).toEqual(activatedBeforeBattle);
  });

  it('cannot grant the cache outside a raid or when the bag rejects it', () => {
    const activated = new Set<string>();

    expect(tryActivatePoi(fieldStation, false, activated, () => true, () => true)).toBe('unavailable');
    expect(tryActivatePoi(fieldStation, true, activated, () => false, () => false)).toBe('bag-full');
    expect(activated).toEqual(new Set());
  });

  /**
   * A refused cache is whole or it is nothing. Handed over a piece at a time,
   * the two Poke Balls that fit stayed in the pack while the Potion that did
   * not left the landmark unworked - so stepping on it again paid the balls out
   * a second time, and the exit it opens was hostage to the pack.
   */
  it('takes nothing at all when the whole cache will not fit', () => {
    const grants: string[] = [];
    const activated = new Set<string>();

    const result = tryActivatePoi(
      fieldStation,
      true,
      activated,
      (itemId, quantity) => {
        grants.push(`${itemId}:${quantity}`);
        return true;
      },
      () => false,
    );

    expect(result).toBe('bag-full');
    expect(grants).toEqual([]);
    expect(activated).toEqual(new Set());
  });

  it('names the cache and its price in squares, the way ground loot does', () => {
    // "Bag is full" is a wall; this is a decision, and the pack is one key
    // away from where the player is standing.
    expect(cacheRefusalLine(fieldStation)).toBe(
      'No room for 2\u00d7 POKÉ BALL and 1\u00d7 POTION - the cache needs 3 squares.',
    );
  });

  /**
   * Every landmark whose cache can be refused: what the refusal says has to
   * name what would be taken, and on a landmark that also opens an exit it has
   * to say that the exit did not open either - the one fact a player standing
   * there cannot see.
   */
  it('has a refusal line for every landmark that pays out', () => {
    const paying = WORLD_POIS.filter((poi) => poi.reward.length > 0);
    expect(paying.length).toBeGreaterThan(0);
    for (const poi of paying) {
      expect(cacheRefusalLine(poi)).toMatch(/^No room for .+ - the cache needs \d+ squares?\.$/);
    }
    // Route 1's relay is both a cache and the STATION RELAY exit's switch, so
    // a full pack there refuses an exit as well as a reward.
    expect(
      paying.some((poi) => poi.effect === 'unlock-extraction' && poi.unlockedExtractionLabel),
    ).toBe(true);
  });

  it('keeps the marked cache temporary until extraction and loses it on wipe', () => {
    const extracted = new RunManager();
    extracted.startRun({ party: [], items: [] }, { mapId: 'route-1', durationMs: 60_000 });
    const extractedPoiIds = new Set<string>();
    tryActivatePoi(
      fieldStation,
      true,
      extractedPoiIds,
      (itemId, quantity) => {
        extracted.registerFoundItem(itemId, quantity);
        return true;
      },
      () => true,
    );

    expect(extracted.resolveEscape().bankedItems).toEqual([
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ]);

    const wiped = new RunManager();
    wiped.startRun({ party: [], items: [] }, { mapId: 'route-1', durationMs: 60_000 });
    tryActivatePoi(
      fieldStation,
      true,
      new Set(),
      (itemId, quantity) => {
        wiped.registerFoundItem(itemId, quantity);
        return true;
      },
      () => true,
    );

    const wipeResult = wiped.resolveWipe();
    expect(wipeResult.bankedItems).toEqual([]);
    expect(wipeResult.lostItems).toEqual([
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ]);
  });

  /**
   * Movement has no free turn onto walkable ground, so a landmark can only be
   * faced from beside it when some lane runs *into* that neighbouring tile
   * pointing at it. On the map Pallet Town first shipped with, the Sluice Wheel
   * had no such lane - it sat between a hedge and the leat - so the West Culvert
   * it opens had never been openable. Rather than reshape a signed-off map
   * around an input rule, standing on a landmark now works it, which is also
   * how loot and contract stops already behave.
   *
   * The redrawn town stands the wheel on the sluice's own stone with a way up
   * to it, so today no landmark fails the facing rule. The list is still
   * pinned, empty: a redraw that takes a lane away is told so here, and is
   * told that standing on the landmark is what keeps it workable.
   */
  it('lets a landmark be worked by standing on it, not only by facing it', () => {
    const facedFromBeside = (poi: (typeof WORLD_POIS)[number]): boolean => {
      const map = WORLD_MAPS[poi.mapId];
      const free = (x: number, y: number): boolean => map.collision[y]?.[x] === false;
      return [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) =>
        free(poi.position.x - dx, poi.position.y - dy) &&
        free(poi.position.x - dx * 2, poi.position.y - dy * 2),
      );
    };

    expect(WORLD_POIS.filter((poi) => !facedFromBeside(poi)).map((poi) => poi.id))
      .toEqual([]);
    // Every landmark stands on ground the player can reach, so stepping on it
    // is an approach that no map geometry can take away.
    for (const poi of WORLD_POIS) {
      expect(`${poi.id} stands on walkable ground: ${WORLD_MAPS[poi.mapId].collision[poi.position.y][poi.position.x] === false}`)
        .toBe(`${poi.id} stands on walkable ground: true`);
    }
    expect(worldSceneSource).toContain(
      'const spoken = pickup === null ? this.tryActivatePoiAt(this.currentTile) : [pickup];',
    );
  });
});
