import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS, ITEMS, type ItemId } from '../items/items';
import { SEARCH_ROWS } from './cacheSearch';
import { RACE_COURSES } from './races';
import { TRADER_BARTERS } from '../hub/trader';
import { MAP_FILE_LANDMARKS } from './mapFile';
import { WORLD_POIS } from './pois';
import { STAKE_SUPPLIES } from './raidStake';
import { getWorldMap } from '../worldMap';
import { builtInFileMaps } from './playerMaps';
import { createRunTrainerEncounters } from './trainers';
import {
  BAG_KITS,
  bagLabel,
  bagSeed,
  FIND_ODDS,
  FIND_TIERS,
  HUNTER_KITS,
  KIT_FOR_DESIGN,
  kitFor,
  rollBagContents,
  standingOf,
  travellingLightLine,
  VETERAN_LEVEL,
  type BagKit,
  type BagOwner,
  type BagRow,
} from './trainerBags';

const KITS: readonly BagKit[] = [...Object.values(BAG_KITS), ...Object.values(HUNTER_KITS)];
const rowsOf = (kit: BagKit): readonly BagRow[] => [...kit.signature, ...kit.extras, ...FIND_TIERS.flatMap((tier) => kit.finds[tier])];
const most = (row: BagRow): number => (typeof row.quantity === 'number' ? row.quantity : (row.quantity?.[1] ?? 1));
const owner = (kit: BagKit, standing: BagOwner['standing'], id = 'someone'): BagOwner => ({ id, name: 'HIKER PELL', kit, standing });

/** Every bag a few thousand raids drop for one owner. */
function bagsOver(of: BagOwner, raids = 4000) {
  return Array.from({ length: raids }, (_, seed) => rollBagContents(of, seed + 1));
}

describe("a beaten trainer's bag", () => {
  it('holds only what a trainer would carry and a crate does not decide: never money, a key, a stone, an HM or somebody\'s errand', () => {
    const never = new Set(['currency', 'key', 'evolution-stone', 'errand', 'relic', 'wearable']);
    for (const kit of KITS) {
      for (const row of rowsOf(kit)) {
        const item = ITEMS[row.itemId];
        expect(item, `${kit.id}: ${row.itemId}`).toBeDefined();
        expect(never.has(item.effect.type), `${kit.id} carries ${row.itemId}`).toBe(false);
        // An HM is a field move's key to a door, never a find.
        expect(row.itemId.startsWith('hm'), `${kit.id} carries ${row.itemId}`).toBe(false);
      }
    }
  });

  it('keeps gear, machines and the bigger packs to the treasure tier, so the bag worth telling somebody about stays rare', () => {
    for (const kit of KITS) {
      for (const row of [...kit.signature, ...kit.extras, ...kit.finds.uncommon, ...kit.finds.rare]) {
        const { type } = ITEMS[row.itemId].effect;
        // A machine is "the only sentence this game has for 'this mattered'"
        // (docs/agents/battle.md): never an everyday find.
        expect(type === 'held' || type === 'machine' || (type === 'pack' && row.itemId !== 'raid-pack'), `${kit.id}: ${row.itemId}`).toBe(false);
      }
    }
  });

  // The pit's gifts (`base/pitCoins.ts`) are not here: they are the commoner
  // furniture, handed back for coins in a row that never ends, not a prize
  // that is the one way to its thing.
  it("never holds a thing another reward is the one way to: Brock's TM39, Oak's Hauler frame, a race's trophies", () => {
    const givenElsewhere = [
      'tm39-rock-tomb',
      'hauler-frame',
      ...RACE_COURSES.flatMap((race) => [race.trophy, race.perfectTrophy].filter((id): id is ItemId => id !== undefined)),
    ];
    for (const kit of KITS) {
      for (const itemId of givenElsewhere) {
        expect(rowsOf(kit).map((row) => row.itemId), `${kit.id} holds ${itemId}`).not.toContain(itemId);
      }
    }
  });

  it('never repeats a thing it already holds as its find, and marks the find with its tier', () => {
    for (const kit of KITS) {
      for (const bag of bagsOver(owner(kit, 'boss'), 400)) {
        const ids = bag!.reward.map((piece) => piece.itemId);
        expect(new Set(ids).size, `${kit.id}: ${ids.join(', ')}`).toBe(ids.length);
        expect(bag!.reward.at(-1)?.find, kit.id).toBe(bag!.best);
        expect(bag!.reward.slice(0, -1).every((piece) => piece.find === undefined)).toBe(true);
      }
    }
  });

  it('never holds more pieces than the search panel has rows for', () => {
    for (const kit of KITS) {
      const signature = Math.max(...kit.signature.map(most));
      const extra = Math.max(0, ...kit.extras.map(most));
      const find = Math.max(0, ...FIND_TIERS.flatMap((tier) => kit.finds[tier].map(most)));
      expect(signature + extra + find, kit.id).toBeLessThanOrEqual(SEARCH_ROWS);
    }
  });

  it('gives every trainer the game ships who has a look of their own a kit of their kind', () => {
    const trainers = [...createRunTrainerEncounters(), ...builtInFileMaps().flatMap((map) => map.trainers())];
    for (const encounter of trainers) {
      if (encounter.design !== undefined) {
        expect(KIT_FOR_DESIGN[encounter.design], `${encounter.trainer.name} (${encounter.design})`).toBeDefined();
      }
    }
  });

  it('is the same bag for the same trainer in the same raid, and its own bag for each trainer', () => {
    const kit = BAG_KITS.rucksack;
    expect(rollBagContents(owner(kit, 'veteran', 'a'), 42)).toEqual(rollBagContents(owner(kit, 'veteran', 'a'), 42));
    expect(bagSeed(42, 'a')).not.toBe(bagSeed(42, 'b'));
    expect(bagSeed(42, 'a')).not.toBe(bagSeed(43, 'a'));
  });

  it("never names a crate's own thing or a tree's as a rare find or a treasure: the bag worth the fight is not a cache's Great Balls", () => {
    const vale = getWorldMap('greystone-vale');
    const crateItems = new Set<string>([
      ...[...WORLD_POIS, ...vale.pois, ...Object.values(MAP_FILE_LANDMARKS)].flatMap((poi) => poi.reward.map((row) => row.itemId)),
      ...STAKE_SUPPLIES.map((row) => row.itemId),
      // And every berry: they grow on the maps' trees, ripe every raid and
      // picked with one press (`world/berries.ts`).
      ...ITEM_DEFINITIONS.filter((item) => item.holdable === true).map((item) => item.id),
    ]);
    for (const kit of KITS) {
      for (const row of [...kit.finds.rare, ...kit.finds.treasure]) {
        expect(crateItems.has(row.itemId), `${kit.id} prizes ${row.itemId}, which a crate gives`).toBe(false);
      }
    }
  });

  it("never prizes less than two materials' worth of what Bill sells a regular: a marked trainer's find is worth the detour", () => {
    // A single Lockpick, Repel or Old Rod is one material at his counter, any
    // day; as a RARE FIND with the prize sound it would teach that the mark lies.
    const cheap = new Map(
      TRADER_BARTERS.filter((barter) => !barter.once && barter.standing !== 'trusted' && barter.standing !== 'partner').map((barter) => [
        barter.gives.itemId,
        barter.takes.reduce((sum, take) => sum + take.quantity, 0) / barter.gives.quantity,
      ]),
    );
    for (const kit of KITS) {
      for (const row of [...kit.finds.rare, ...kit.finds.treasure]) {
        const least = typeof row.quantity === 'number' ? row.quantity : (row.quantity?.[0] ?? 1);
        const cost = cheap.get(row.itemId);
        if (cost !== undefined) {
          expect(least * cost, `${kit.id} prizes ${least} ${row.itemId}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('is carried as often as the kit says, and always by a boss and a hunter', () => {
    const swimmer = bagsOver(owner(BAG_KITS.beach, 'rookie'));
    expect(swimmer.filter(Boolean).length / swimmer.length).toBeCloseTo(BAG_KITS.beach.carried, 1);
    expect(bagsOver(owner(BAG_KITS.beach, 'boss')).every(Boolean)).toBe(true);
    expect(bagsOver(owner(HUNTER_KITS.agatha, 'hunter')).every(Boolean)).toBe(true);
    // Nor does a trainer on a new save's first raid travel light: no way to meet bags.
    expect(bagsOver(owner(BAG_KITS.beach, 'newcomer')).every(Boolean)).toBe(true);
  });

  it('turns up a find of each tier at its standing\'s odds, and always the signature piece first', () => {
    for (const standing of ['rookie', 'veteran', 'hunter', 'boss', 'roadside', 'newcomer'] as const) {
      const bags = bagsOver(owner(BAG_KITS.duffel, standing)).filter((bag) => bag !== null);
      for (const tier of FIND_TIERS) {
        const share = bags.filter((bag) => bag.best === tier).length / bags.length;
        expect(Math.abs(share - FIND_ODDS[standing][tier]), `${standing} ${tier}`).toBeLessThan(0.025);
      }
      const signature = new Set<ItemId>(BAG_KITS.duffel.signature.map((row) => row.itemId));
      for (const bag of bags) {
        expect(signature.has(bag.reward[0].itemId)).toBe(true);
      }
    }
  });

  it("finds every kit's rare tier and treasure as often as the odds say: no tier is eaten by a find it may not repeat", () => {
    for (const kit of KITS) {
      const bags = bagsOver(owner(kit, 'hunter'), 2000);
      const share = (tier: string) => bags.filter((bag) => bag!.best === tier).length / bags.length;
      expect(share('rare'), kit.id).toBeGreaterThan(FIND_ODDS.hunter.rare * 0.8);
      expect(share('treasure'), kit.id).toBeGreaterThan(FIND_ODDS.hunter.treasure * 0.6);
    }
  });

  it('always gives up a boss\'s treasure: a fight once a save must not miss its prize for the whole save', () => {
    for (const kit of [BAG_KITS.mistysBag, BAG_KITS.kogasPouch, BAG_KITS.seaBag]) {
      expect(bagsOver(owner(kit, 'boss'), 300).every((bag) => bag!.best === 'treasure'), kit.id).toBe(true);
    }
  });

  it('pays a roadside trainer\'s bag its signature piece and nothing else: walking straight out pays almost nothing', () => {
    for (const kit of KITS) {
      const signature = new Set<ItemId>(kit.signature.map((row) => row.itemId));
      for (const bag of bagsOver(owner(kit, 'roadside'), 300)) {
        if (bag === null) continue;
        expect(bag.reward, kit.id).toHaveLength(1);
        expect(signature.has(bag.reward[0].itemId), kit.id).toBe(true);
        expect(bag.best).toBe('basic');
      }
    }
  });

  it('reads a trainer\'s standing off their best Pokemon, and a boss is a boss', () => {
    expect(standingOf([5, VETERAN_LEVEL - 1], false)).toBe('rookie');
    expect(standingOf([5, VETERAN_LEVEL], false)).toBe('veteran');
    expect(standingOf([9], true)).toBe('boss');
  });

  it("names the bag after its owner and its kind, so a player learns whose bags are worth a fight", () => {
    expect(bagLabel({ name: 'HIKER PELL', kit: kitFor('hiker') })).toBe("HIKER PELL'S RUCKSACK");
    expect(kitFor('rocket-grunt').noun).toBe('DUFFEL');
    expect(kitFor(undefined)).toBe(BAG_KITS.bag);
    expect(travellingLightLine('SWIMMER NELL')).toBe('SWIMMER NELL was travelling light: no bag to search.');
  });
});
