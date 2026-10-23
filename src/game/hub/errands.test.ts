import { describe, expect, it } from 'vitest';
import { getItemById, isErrandItem, isFoundOnly, ITEMS, type ItemId } from '../items';
import { packGrid } from '../items/packs';
import { getSpeciesById } from '../pokemon';
import { availableInsertionIds, frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { FIRST_CONTRACT_ID } from '../objectives/contracts';
import { CONTRACT_REWARD_INSERTIONS, DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { districtsForMap } from '../world/districts';
import { stepDistances } from '../world/mapStructure';
import { getWorldMap } from '../worldMap';
import {
  clampErrandRecords,
  ERRANDS,
  errandBeat,
  errandForItem,
  errandLoot,
  errandOf,
  errandOpen,
  errandPlace,
  errandSquares,
  errandsToLay,
  withErrandAsked,
  withErrandCompleted,
  withErrandFound,
  withErrandLossesHeard,
  type ErrandProgress,
} from './errands';

const FRESH: ErrandProgress = DEFAULT_RAID_PROGRESS;
const OPENED: ErrandProgress = {
  ...DEFAULT_RAID_PROGRESS,
  completedContracts: [FIRST_CONTRACT_ID],
  unlockedInsertions: ['floodplain-relay', ...CONTRACT_REWARD_INSERTIONS],
};
const nothing = (): number => 0;

describe('errands', () => {
  it('gives one errand to each of the four people at base, and only theirs', () => {
    expect(ERRANDS.map((errand) => errand.giver).sort()).toEqual(['lab', 'stash', 'trader', 'workshop']);
    expect(new Set(ERRANDS.map((errand) => errand.id)).size).toBe(ERRANDS.length);
    for (const errand of ERRANDS) {
      expect(errandOf(errand.giver)).toBe(errand);
      expect(errandForItem(errand.itemId)).toBe(errand);
    }
  });

  it('asks for a real thing that is found, never packed, and takes squares in the smallest pack', () => {
    const satchel = packGrid('satchel')!;
    for (const errand of ERRANDS) {
      const item = getItemById(errand.itemId);
      expect(item?.effect.type).toBe('errand');
      expect(isErrandItem(errand.itemId)).toBe(true);
      // Found-only: lost with the pack, kept only if the container held room.
      expect(isFoundOnly(errand.itemId)).toBe(true);
      expect(item!.footprint.width).toBeLessThanOrEqual(satchel.width);
      expect(item!.footprint.height).toBeLessThanOrEqual(satchel.height);
    }
    // Different weights, so each favour costs the pack something different.
    expect(ERRANDS.map(errandSquares).sort()).toEqual([1, 2, 2, 4]);
  });

  it('says where the thing is and how big it is in the giver’s own words, and both are true', () => {
    for (const errand of ERRANDS) {
      const place = errandPlace(errand);
      expect(place, `${errand.id} lies in no district`).not.toBe('');
      expect(errand.asks.join(' '), `${errand.id} asks without naming ${place}`).toContain(place);
      expect(errand.lost.join(' '), `${errand.id} is lost without naming ${place}`).toContain(place);
      const squares = errandSquares(errand);
      expect(errand.asks.join(' ')).toContain(`${squares} ${squares === 1 ? 'square' : 'squares'}`);
    }
  });

  it('lies in a place that can be walked to from its map’s front door with every door still shut', () => {
    for (const errand of ERRANDS) {
      const map = getWorldMap(errand.mapId, []);
      const door = frontDoorFor(errand.mapId)!;
      const steps = stepDistances(map.collision, door.position);
      const areas = districtsForMap(errand.mapId).find((district) => district.id === errand.district)!.areas;
      const standing = areas.flatMap((area) =>
        Array.from({ length: area.width * area.height }, (_, index) => ({
          x: area.x + (index % area.width),
          y: area.y + Math.floor(index / area.width),
        })),
      ).filter(
        ({ x, y }) => (steps[y]?.[x] ?? -1) >= 0 && map.layers.canopy.tiles[y][x] < 0,
      );
      expect(standing.length, `${errand.id} has nowhere to lie`).toBeGreaterThan(0);
    }
  });

  it('pays something that exists, and says what it paid', () => {
    for (const errand of ERRANDS) {
      expect(errand.reward.items.length + (errand.reward.pokemon?.length ?? 0)).toBeGreaterThan(0);
      for (const { itemId } of errand.reward.items) {
        expect(ITEMS[itemId], itemId).toBeDefined();
        expect(isErrandItem(itemId)).toBe(false);
      }
      for (const { speciesId } of errand.reward.pokemon ?? []) {
        expect(getSpeciesById(speciesId), speciesId).toBeDefined();
      }
      expect(errand.reward.received).toMatch(/^You received /);
    }
  });

  it('is only asked once its map can be dropped into', () => {
    for (const errand of ERRANDS) {
      expect(errandOpen(errand, FRESH)).toBe(false);
      expect(errandOpen(errand, OPENED)).toBe(true);
      expect(availableInsertionIds(OPENED)).toContain(frontDoorFor(errand.mapId)!.id);
      expect(errandBeat(errand.giver, FRESH, nothing)).toBeUndefined();
    }
  });

  it('asks, then waits, thanks when the thing is home, and asks after it when it was found and lost', () => {
    const brock = errandOf('workshop')!;
    expect(errandBeat('workshop', OPENED, nothing)).toEqual({ kind: 'ask', errand: brock });

    let errands = withErrandAsked(undefined, brock.id);
    // Asked twice is asked once.
    expect(withErrandAsked(errands, brock.id)).toBe(errands);
    expect(errandBeat('workshop', { ...OPENED, errands }, nothing)).toBeUndefined();

    // Picked up in a raid that did not bring it home.
    errands = withErrandFound(errands, brock.id);
    expect(errandBeat('workshop', { ...OPENED, errands }, nothing)).toEqual({ kind: 'lost', errand: brock });
    errands = withErrandLossesHeard(errands, brock.id);
    expect(errandBeat('workshop', { ...OPENED, errands }, nothing)).toBeUndefined();

    // Picked up again and banked: it is in the vault.
    errands = withErrandFound(errands, brock.id);
    const inVault = (itemId: ItemId): number => (itemId === brock.itemId ? 1 : 0);
    expect(errandBeat('workshop', { ...OPENED, errands }, inVault)).toEqual({ kind: 'thanks', errand: brock });

    errands = withErrandCompleted(errands, brock.id);
    expect(errandBeat('workshop', { ...OPENED, errands }, inVault)).toBeUndefined();
    expect(errandBeat('workshop', { ...OPENED, errands }, nothing)).toBeUndefined();
  });

  it('lays only the things still out there: asked, not done, and not already home', () => {
    const [oak, joy, brock] = ERRANDS;
    let errands = withErrandAsked(withErrandAsked(withErrandAsked(undefined, oak.id), joy.id), brock.id);
    errands = withErrandCompleted(errands, oak.id);
    const joyHome = (itemId: ItemId): number => (itemId === joy.itemId ? 1 : 0);
    expect(errandsToLay({ errands }, joyHome)).toEqual([brock]);
    // A find is only counted for an errand in hand.
    expect(withErrandFound(errands, oak.id)).toEqual(errands);
  });

  it('is laid by the raid in its own place, as a prize, without moving any other roll', () => {
    const brock = errandOf('workshop')!;
    const without = generateRunPlan(7, undefined, 'town-square', undefined);
    const withIt = generateRunPlan(
      7, undefined, 'town-square', undefined, undefined, [], {}, [], [], false, [], [errandLoot(brock)],
    );
    const laid = withIt.loot['pallet-town'].filter((piece) => piece.itemId === brock.itemId);
    expect(laid).toHaveLength(1);
    const areas = districtsForMap('pallet-town').find((district) => district.id === brock.district)!.areas;
    expect(
      areas.some(
        (area) =>
          laid[0].position.x >= area.x &&
          laid[0].position.x < area.x + area.width &&
          laid[0].position.y >= area.y &&
          laid[0].position.y < area.y + area.height,
      ),
    ).toBe(true);
    expect(laid[0].chance).toBe(1);
    expect(withIt.loot['pallet-town'].filter((piece) => piece.itemId !== brock.itemId)).toEqual(
      without.loot['pallet-town'],
    );
    expect(withIt.trainers).toEqual(without.trainers);
    expect(withIt.hunter).toEqual(without.hunter);
  });

  it('reads a save back as errands that exist, once each, never more heard than found', () => {
    expect(clampErrandRecords(undefined)).toEqual([]);
    expect(
      clampErrandRecords([
        { id: 'brocks-crate', status: 'started', found: 2, lossesHeard: 9 },
        { id: 'brocks-crate', status: 'completed', found: 0, lossesHeard: 0 },
        { id: 'nobody', status: 'started', found: 0, lossesHeard: 0 },
        { id: 'old-amber', status: 'lost', found: 0, lossesHeard: 0 },
        { id: 'oaks-parcel', status: 'completed', found: -1, lossesHeard: 'x' },
        'nonsense',
      ]),
    ).toEqual([
      { id: 'brocks-crate', status: 'started', found: 2, lossesHeard: 2 },
      { id: 'oaks-parcel', status: 'completed', found: 0, lossesHeard: 0 },
    ]);
  });
});
