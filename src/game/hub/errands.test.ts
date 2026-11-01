import { describe, expect, it } from 'vitest';
import { getItemById, isErrandItem, isFoundOnly, ITEMS, type ItemId } from '../items';
import { packGrid } from '../items/packs';
import { getSpeciesById } from '../pokemon';
import { availableInsertionIds, frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { FIRST_CONTRACT_ID } from '../objectives/contracts';
import { CONTRACT_REWARD_INSERTIONS, DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { HARBOUR_PEOPLE, harbourLifeAt } from '../base/harbourLife';
import { stepDistances } from '../world/mapStructure';
import { getWorldMap } from '../worldMap';
import {
  clampErrandRecords,
  declineErrand,
  ERRANDS,
  errandBeat,
  errandDistrict,
  errandLines,
  errandToSay,
  FAVOUR_ANSWERS,
  forgetDeclinedErrands,
  harbourGiver,
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
/** A new save with one raid behind it, which is when anybody first asks a favour. */
const BEEN_OUT: ErrandProgress = { ...DEFAULT_RAID_PROGRESS, raidRecord: { 'greystone-vale': { deployed: 1, extracted: 0, wiped: 1 } } };
/** A save that can drop into Greystone Vale, where every favour lies. */
const OPENED: ErrandProgress = {
  ...DEFAULT_RAID_PROGRESS,
  completedContracts: [FIRST_CONTRACT_ID],
  unlockedInsertions: ['floodplain-relay', ...CONTRACT_REWARD_INSERTIONS, 'greystone-vale'],
};
const nothing = (): number => 0;

describe('errands', () => {
  it('gives one errand to each of the four people at base, and some to people about the harbour', () => {
    const keepers = ERRANDS.map((errand) => errand.giver).filter((giver) => !giver.startsWith('harbour:'));
    expect(keepers.sort()).toEqual(['lab', 'stash', 'trader', 'workshop']);
    expect(new Set(ERRANDS.map((errand) => errand.id)).size).toBe(ERRANDS.length);
    for (const errand of ERRANDS) {
      expect(errandOf(errand.giver)).toBe(errand);
      expect(errandForItem(errand.itemId)).toBe(errand);
    }
  });

  /**
   * The captain's ask: "people walking around ... and they can give you
   * missions". A harbour giver is a person who is out at every hour, so a
   * favour can always be answered and its thing always handed over.
   */
  it('is asked by somebody about the harbour only if they are a person who is out day and night', () => {
    const harbour = ERRANDS.filter((errand) => errand.giver.startsWith('harbour:'));
    expect(harbour.map((errand) => errand.giver).sort()).toEqual([
      harbourGiver('safari-warden'),
      harbourGiver('ss-anne-captain'),
    ]);
    for (const errand of harbour) {
      const person = HARBOUR_PEOPLE.find((each) => harbourGiver(each.id) === errand.giver);
      expect(person, errand.giver).toBeDefined();
      expect(person!.byDayOnly, errand.giver).toBeUndefined();
      expect(harbourLifeAt('night').some((figure) => figure.id === person!.id), errand.giver).toBe(true);
      expect(errand.speaker).toBe(person!.design);
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
    expect(ERRANDS.map(errandSquares).sort()).toEqual([1, 1, 2, 2, 2, 4]);
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
      const steps = stepDistances(map.collision, door.position, new Set(), map.links);
      const areas = errandDistrict(errand)!.areas;
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

  /**
   * A favour is said in the dialogue box, one box a line, before it is
   * answered: the captain's ask was that it be "a normal Pokémon chat", where
   * the old overlay was two or three long sentences over a screen of numbers.
   * The box holds two rows of about 38 characters; 68 leaves room for where
   * the words happen to break.
   */
  it('is said in a few short lines and ends on a question, as a normal Pokémon chat is', () => {
    for (const errand of ERRANDS) {
      for (const lines of [errand.asks, errand.thanks, errand.lost]) {
        expect(lines.length, errand.id).toBeGreaterThan(0);
        expect(lines.length, errand.id).toBeLessThanOrEqual(2);
      }
      for (const line of [...errand.asks, errand.question, errand.accepted, errand.declined, ...errand.thanks, ...errand.lost]) {
        expect(line.length, `${errand.id}: ${line}`).toBeLessThanOrEqual(68);
      }
      expect(errand.question, errand.id).toMatch(/\?$/);
      // The question shares its box with YES and NOT NOW, on the row under it,
      // so it is one row of the box (about 38 characters) or it runs into them.
      expect(errand.question.length, `${errand.id}: ${errand.question}`).toBeLessThanOrEqual(34);
      // NOT NOW says when it will be asked again, which is the rule it keeps.
      expect(errand.declined, errand.id).toContain('after your next raid');
    }
    expect(FAVOUR_ANSWERS).toEqual(['YES', 'NOT NOW']);
  });

  it('says the hand-over as what went across, the thanks and what came back', () => {
    const brock = errandOf('workshop')!;
    expect(errandLines({ kind: 'thanks', errand: brock })).toEqual([
      "You handed over Brock's crate.",
      ...brock.thanks,
      'You received TM39 from Brock.',
    ]);
    expect(errandLines({ kind: 'ask', errand: brock })).toBe(brock.asks);
    expect(errandLines({ kind: 'lost', errand: brock })).toBe(brock.lost);
  });

  it('asks again after the next raid when the favour is turned down, and only the favour', () => {
    forgetDeclinedErrands();
    const brock = errandOf('workshop')!;
    expect(errandToSay('workshop', OPENED, nothing, 3)).toEqual({ kind: 'ask', errand: brock });
    declineErrand(brock.id, 3);
    expect(errandToSay('workshop', OPENED, nothing, 3)).toBeUndefined();
    // The door still says there is a favour to ask: it is not withdrawn.
    expect(errandBeat('workshop', OPENED, nothing)).toEqual({ kind: 'ask', errand: brock });
    expect(errandToSay('workshop', OPENED, nothing, 4)).toEqual({ kind: 'ask', errand: brock });
    // A turn-down holds nothing else back: a thing home is still taken.
    const errands = withErrandFound(withErrandAsked(undefined, brock.id), brock.id);
    const inVault = (itemId: ItemId): number => (itemId === brock.itemId ? 1 : 0);
    expect(errandToSay('workshop', { ...OPENED, errands }, inVault, 3)).toEqual({ kind: 'thanks', errand: brock });
    // Nor does it touch anybody else's favour.
    expect(errandToSay('stash', OPENED, nothing, 3)).toEqual({ kind: 'ask', errand: errandOf('stash')! });
    forgetDeclinedErrands();
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

  /**
   * Every favour was first laid on a map retired on 22 Oct, which left all
   * four closed to a new save and a favour already taken with nowhere to be
   * finished. With the roster as shipped, a new save is asked every one.
   */
  it('is asked of a new save with the shipped roster, on the one map in play', () => {
    retireMapsForTests(RETIRED_MAPS);
    try {
      for (const errand of ERRANDS) {
        expect(errand.mapId).toBe('greystone-vale');
        expect(errandOpen(errand, BEEN_OUT), errand.id).toBe(true);
        expect(errandBeat(errand.giver, BEEN_OUT, nothing)).toEqual({ kind: 'ask', errand });
        // Nobody asks a favour of somebody on their way to their first raid.
        expect(errandOpen(errand, FRESH), errand.id).toBe(false);
      }
    } finally {
      retireMapsForTests([]);
    }
  });

  it('names a place its map has, and lays it in that place by its id', () => {
    for (const errand of ERRANDS) {
      const district = errandDistrict(errand);
      expect(district?.name, errand.id).toBe(errand.place);
      expect(errandLoot(errand).district).toBe(district!.id);
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
    const without = generateRunPlan(7, undefined, 'greystone-vale', undefined);
    const withIt = generateRunPlan(
      7, undefined, 'greystone-vale', undefined, undefined, [], {}, [], [], false, [], [errandLoot(brock)],
    );
    const laid = withIt.loot['greystone-vale'].filter((piece) => piece.itemId === brock.itemId);
    expect(laid).toHaveLength(1);
    const areas = errandDistrict(brock)!.areas;
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
    expect(withIt.loot['greystone-vale'].filter((piece) => piece.itemId !== brock.itemId)).toEqual(
      without.loot['greystone-vale'],
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
