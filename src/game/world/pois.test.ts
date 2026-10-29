import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { RunManager } from '../run/RunManager';
import { BUILT_IN_MAP_IDS, getWorldMap } from '../worldMap';
import { WORLD_POIS, poisForMap, lockedCrateLines, openPoi, type WorldPoi } from './pois';
import { searchPieces } from './cacheSearch';

const worldSceneSource = await readFile(new URL('../scenes/WorldScene.ts', import.meta.url), 'utf8');

// Oak's field station, by id rather than by position in the list: it is the
// one landmark that is a cache *and* an exit switch, so it is what the
// activation rules are exercised against, and the list is authored map by map.
const fieldStation = WORLD_POIS.find((poi) => poi.id === 'oak-field-station-relay')!;

describe('world POIs', () => {
  it('only opens a fixed POI once during an active run, and hands nothing over by opening', () => {
    const activated = new Set<string>();
    expect(openPoi(fieldStation, true, activated)).toBe('opened');
    expect(activated).toEqual(new Set([fieldStation.id]));
    expect(openPoi(fieldStation, true, activated)).toBe('unavailable');
  });

  it('remains opened when battle return recreates the scene state', () => {
    const activatedBeforeBattle = new Set([fieldStation.id]);
    const activatedAfterBattle = new Set([...activatedBeforeBattle]);

    expect(openPoi(fieldStation, true, activatedAfterBattle)).toBe('unavailable');
    expect(activatedAfterBattle).toEqual(activatedBeforeBattle);
  });

  it('cannot be opened outside a raid', () => {
    const activated = new Set<string>();
    expect(openPoi(fieldStation, false, activated)).toBe('unavailable');
    expect(activated).toEqual(new Set());
  });

  /**
   * A cache is searched, a piece at a time (`cacheSearch.ts`), so what is in
   * it reaches the run's ledger only as each piece is taken - and is at risk
   * until extraction exactly as a ground find is.
   */
  it('keeps what is taken from a cache temporary until extraction and loses it on wipe', () => {
    const takeEverything = (manager: RunManager) => {
      expect(openPoi(fieldStation, true, new Set())).toBe('opened');
      for (const piece of searchPieces(fieldStation.reward)) {
        manager.registerFoundItem(piece.itemId, 1);
      }
    };
    const extracted = new RunManager();
    extracted.startRun({ party: [], items: [] }, { mapId: 'route-1', durationMs: 60_000 });
    takeEverything(extracted);
    expect(extracted.resolveEscape().bankedItems).toEqual([
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ]);

    const wiped = new RunManager();
    wiped.startRun({ party: [], items: [] }, { mapId: 'route-1', durationMs: 60_000 });
    takeEverything(wiped);
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
      const map = getWorldMap(poi.mapId);
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
      expect(`${poi.id} stands on walkable ground: ${getWorldMap(poi.mapId).collision[poi.position.y][poi.position.x] === false}`)
        .toBe(`${poi.id} stands on walkable ground: true`);
    }
    expect(worldSceneSource).toContain(
      'const spoken = pickup === null ? this.tryActivatePoiAt(this.currentTile) : [pickup];',
    );
  });
});

/**
 * **A cache pays what its place is.**
 *
 * Forty-one named caches across four maps used to pay the same five things
 * between them - a ball, a better ball, a Potion, a Super Potion, an Antidote -
 * and four of them paid character for character the same two. As destinations
 * they were interchangeable: only the distance and the danger told them apart,
 * which is the same as saying the map's names meant nothing. The wildlife
 * tables already worked the other way (`world/districts.ts`: Krabby only on
 * Pallet's shore, Vulpix only on Route 1's west verge), and so did the
 * materials in the ground loot; the caches were the layer that did not.
 *
 * These hold the shape of that rather than the contents, which are authored
 * judgement and belong in the file rather than in an assertion.
 */
describe('what a cache pays', () => {
  const paying = WORLD_POIS.filter((poi) => poi.reward.length > 0);
  const recipe = (poi: (typeof WORLD_POIS)[number]): string =>
    poi.reward
      .map(({ itemId, quantity }) => `${quantity}x ${itemId}`)
      .sort()
      .join(' + ');

  it('is not the same handful of supplies over and over', () => {
    // Every cache in the game, and the number of distinct payouts among them.
    // It was eighteen shapes across thirty-six paying caches, and four of the
    // best ones - the quarry adit, the forest adit, the osier store and the
    // stranded barge - were one payout repeated four times.
    const shapes = new Set(paying.map(recipe));
    expect(`${shapes.size} of ${paying.length} caches pay something of their own`).toBe(
      `${paying.length} of ${paying.length} caches pay something of their own`,
    );
  });

  it('draws on the whole catalogue rather than on medicine and balls', () => {
    const kinds = new Set(paying.flatMap((poi) => poi.reward.map(({ itemId }) => itemId)));
    // The five supplies plus the six Brock materials: a place that works
    // pays what working it produces, which is what makes a raid a trip for
    // something rather than a lap.
    expect([...kinds].sort()).toEqual([
      'antidote',
      'cable-coil',
      'great-ball',
      'lamp-oil',
      'linen-roll',
      'mooring-rope',
      'parts-crate',
      'poke-ball',
      'potion',
      'radio-valve',
      'super-potion',
    ]);
  });

  it('never pays money, so Bill\'s prices stay set against the ground', () => {
    // The money faucet is measured off each map's loot pool alone
    // (`hub/trader.test.ts`), and a cache is a *guaranteed* pickup rather than
    // a pooled one, so money out of one would be an unmeasured second faucet.
    for (const poi of WORLD_POIS) {
      expect(poi.reward.every(({ itemId }) => itemId !== 'money')).toBe(true);
    }
  });

  it('gives every map a character of its own in what it pays', () => {
    const byMap = new Map<string, Set<string>>();
    for (const poi of paying) {
      const kinds = byMap.get(poi.mapId) ?? new Set<string>();
      poi.reward.forEach(({ itemId }) => kinds.add(itemId));
      byMap.set(poi.mapId, kinds);
    }
    // No map pays everything, and no two maps pay the same list: where you go
    // decides what you come home with.
    for (const [mapId, kinds] of byMap) {
      expect(`${mapId}: ${kinds.size}`).not.toBe(`${mapId}: 11`);
    }
    const lists = [...byMap.values()].map((kinds) => [...kinds].sort().join(','));
    expect(new Set(lists).size).toBe(lists.length);
  });
});

/**
 * A locked crate: a cache with a lock on it, which a Lockpick opens and is
 * spent opening. Most locks in the game are these.
 */
describe('a locked crate', () => {
  // Asked of each map through `poisForMap`, which a map drawn as a file
  // answers too: Greystone Vale's crate is its file's strongroom.
  const everyPoi = BUILT_IN_MAP_IDS.flatMap((mapId) => poisForMap(mapId));
  const locked = everyPoi.filter((poi) => poi.locked);
  const unitsIn = (poi: WorldPoi) => poi.reward.reduce((total, { quantity }) => total + quantity, 0);
  const picks = (count: number) => {
    let held = count;
    return { count: () => held, spend: () => (held -= 1), held: () => held };
  };

  it('stands on every shipped map, once, and opens no exit', () => {
    expect(locked.map((poi) => poi.mapId).sort()).toEqual([...BUILT_IN_MAP_IDS].sort());
    for (const poi of locked) {
      expect(poi.effect, poi.label).toBeUndefined();
    }
  });

  it('pays more than any open cache on its own map, for the pick and the square it cost', () => {
    for (const poi of locked) {
      const open = everyPoi.filter((other) => other.mapId === poi.mapId && !other.locked);
      for (const other of open) {
        expect(unitsIn(poi), `${poi.label} against ${other.label}`).toBeGreaterThanOrEqual(unitsIn(other));
      }
    }
  });

  it('refuses a raid with no Lockpick and opens nothing', () => {
    const [crate] = locked;
    const activated = new Set<string>();
    expect(openPoi(crate, true, activated)).toBe('locked');
    expect(activated.has(crate.id)).toBe(false);
  });

  it('spends one pick to open it, once a raid', () => {
    const [crate] = locked;
    const activated = new Set<string>();
    const pack = picks(2);
    expect(openPoi(crate, true, activated, pack)).toBe('opened');
    expect(pack.held()).toBe(1);
    expect(openPoi(crate, true, activated, pack)).toBe('unavailable');
    expect(pack.held()).toBe(1);
  });

  it('says it is locked in FireRed\'s words, and what would open it', () => {
    expect(lockedCrateLines(locked[0])[0]).toBe(`${locked[0].label}: the crate is locked…`);
    expect(lockedCrateLines(locked[0])[1]).toContain('Lockpick');
  });
});
