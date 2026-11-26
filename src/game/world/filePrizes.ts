import { isMaterial, type ItemId } from '../items';
import type { WorldMapId } from '../worldMap';
import type { WorldLoot } from './loot';
import type { MapFile, MapFileSpot } from './mapFile';

/**
 * What is found only in one place of a shipped map drawn as a file.
 *
 * A map file's item spots hold what the game's rotation gives them, so a
 * player's map can never name the best things in the game. A shipped map is
 * the game's own, and a far place on one is built to be the only place a
 * thing is found - Frostreef's NeverMeltIce. Each is a prize as a shipped
 * map's own are (`loot.ts`): rolled on its own odds and seated, every raid, on
 * a free tile of the named place it is found in, where its light shows it. The
 * place is named as the file names it, and the tile it falls back to is the
 * first item spot the file draws there, so nothing here knows a coordinate.
 */
export interface FilePrize {
  readonly itemId: ItemId;
  readonly quantity: number;
  readonly chance: number;
  /** The named place it is found in, as the file's districts name it. */
  readonly place: string;
}

export const BUILT_IN_FILE_PRIZES: Readonly<Partial<Record<WorldMapId, readonly FilePrize[]>>> = {
  'greystone-vale': [
    // Frostreef's: out on the frozen lagoon, which only Berg Cave reaches. As
    // rare as a prize may be and still be one (`loot.test.ts`): a raid that
    // finds it there has found the one in the game.
    { itemId: 'never-melt-ice', quantity: 1, chance: 0.3, place: 'THE FROZEN LAGOON' },
    // Ember Isle's: in the crater, which only the Lava Tube reaches, and the
    // crater is ash every step of which is a wild Pokemon's.
    { itemId: 'charcoal', quantity: 1, chance: 0.3, place: 'THE CRATER' },
    // Packs, as every map lays them: rolled, never certain (`packs.test.ts`).
    // A Raid pack left at the salvage camp by somebody who rowed out to the
    // wreck and did not row back; and a Ranger pack in the drowned quarter,
    // behind Boatswain Cragg's barricades, where only a raid that beat him goes.
    { itemId: 'raid-pack', quantity: 1, chance: 0.25, place: 'THE WRECK' },
    { itemId: 'ranger-pack', quantity: 1, chance: 0.2, place: 'THE DROWNED TOWN' },
    // THE HARBOUR BOUTIQUE's raid finds (`look/wearables.ts`): the colours it
    // keeps for the legends and the shinies, never on a shelf. A legend's is
    // where that legend is in the vale, a shiny's where its Pokemon would be,
    // and every one is rarer than any find but the Bicycle.
    { itemId: 'articuno-wave', quantity: 1, chance: 0.06, place: 'THE FROZEN LAGOON' },
    { itemId: 'zapdos-jacket', quantity: 1, chance: 0.06, place: 'THE POWER STATION' },
    { itemId: 'moltres-tee', quantity: 1, chance: 0.06, place: 'THE CRATER' },
    { itemId: 'mewtwo-robe', quantity: 1, chance: 0.06, place: 'THE POWER STATION' },
    { itemId: 'mew-dress', quantity: 1, chance: 0.06, place: 'STORMCROWN' },
    { itemId: 'legend-knit-hat', quantity: 1, chance: 0.06, place: 'THE CAIRN' },
    { itemId: 'shiny-charizard-jacket', quantity: 1, chance: 0.08, place: 'THE CRATER' },
    { itemId: 'shiny-gyarados-cap', quantity: 1, chance: 0.08, place: 'REEDMERE' },
    { itemId: 'shiny-pikachu-crop', quantity: 1, chance: 0.08, place: 'PINE HOLLOW' },
    { itemId: 'shiny-mew-hair', quantity: 1, chance: 0.08, place: 'THE OLD BLOOM' },
    { itemId: 'shiny-onix-trousers', quantity: 1, chance: 0.08, place: 'GREYSTONE PEAKS' },
    { itemId: 'shiny-rocket-tunic', quantity: 1, chance: 0.08, place: 'THE DROWNED TOWN' },
    // The machines the open vale lays, each where the place explains the move
    // and each on the odds a TM was laid at on the maps before it (a quarter):
    // read in a raid and lost with the pack, so each is a find, not a stock.
    // TM28 Dig in THE DIGGINGS, the caves' sand room where the diggers live,
    // for the Sandshrew or Diglett that wants a Ground hit.
    { itemId: 'tm28-dig', quantity: 1, chance: 0.25, place: 'THE DIGGINGS' },
    // The two weather discs, both in ground open from the first raid, because
    // each is an answer to a gym rather than a reward for one: Sunny Day in the
    // orchard that lives on sun, and Rain Dance in Reedmere's long drain.
    { itemId: 'tm11-sunny-day', quantity: 1, chance: 0.25, place: 'THE NORTH ORCHARD' },
    { itemId: 'tm18-rain-dance', quantity: 1, chance: 0.25, place: 'THE LONG DRAIN' },
    // The first district's two, somewhere in Millbrook - its first spot is
    // the dug allotments, where the Digger chases off the Oddish - a
    // starter's first attack beyond Scratch, Tackle and Growl. Early fights were "slow fights with nothing in them" - a
    // Charmander scratching at a Jigglypuff for twenty turns, an Oddish with
    // Absorb alone until 15 - and teaching the wild side to fight back made
    // the first raids deadlier, so the answer is the player's to read (critic's
    // review, problem 19; firstmate's call, 26 Nov 2026). Dig for Charmander
    // and Squirtle, Bullet Seed for Bulbasaur and the allotment's own Oddish.
    // As common as a prize may be (`loot.test.ts`), rather than a quarter:
    // these answer the first hour's fights, and at three raids in ten a
    // starter's own disc is found in five raids by five players in six.
    { itemId: 'tm28-dig', quantity: 1, chance: 0.3, place: 'MILLBROOK' },
    { itemId: 'tm09-bullet-seed', quantity: 1, chance: 0.3, place: 'MILLBROOK' },
  ],
};

/**
 * A place whose item spots hold what it is, rather than the rotation every
 * other spot of a file is dealt from (`itemSpotContents`): a hoard. Its spots
 * hold its contents in order, each seated in the place every raid it is laid
 * - the pool's own odds, half to all of it, as every piece is - and they are
 * left out of the rotation, so every other spot holds what it always held.
 */
export interface FileHoard {
  /** The named place it is in, as the file's districts name it. */
  readonly place: string;
  /** What its spots hold, the first spot the first: one each, so the file draws a spot for every piece. */
  readonly contents: readonly { readonly itemId: ItemId; readonly quantity: number }[];
}

export const BUILT_IN_FILE_HOARDS: Readonly<Partial<Record<WorldMapId, readonly FileHoard[]>>> = {
  'greystone-vale': [
    // The smugglers' hoard in Ember Isle's crater, the richest ground in the
    // vale: their money, and the rarest of what Brock builds with - radio
    // valves and cable off the boats they stripped, and the lamp oil they run
    // the island's lights on. Its money keeps the whole vale under one berth
    // (`trader.test.ts`): the faucet Bill's prices are set against.
    {
      place: 'THE HOARD',
      contents: [
        { itemId: 'money', quantity: 60 },
        { itemId: 'radio-valve', quantity: 1 },
        { itemId: 'money', quantity: 50 },
        { itemId: 'cable-coil', quantity: 1 },
        { itemId: 'radio-valve', quantity: 1 },
        { itemId: 'lamp-oil', quantity: 1 },
        { itemId: 'money', quantity: 40 },
        { itemId: 'cable-coil', quantity: 1 },
      ],
    },
  ],
};

/** The hoard a spot of a file map is in, and its place among the hoard's spots; none for an ordinary spot. */
export function hoardOf(
  id: WorldMapId,
  file: Pick<MapFile, 'districts' | 'itemSpots'>,
): (spot: MapFileSpot) => { readonly district: number; readonly contents: FileHoard['contents'][number] } | undefined {
  const districts = file.districts ?? [];
  const hoards = (BUILT_IN_FILE_HOARDS[id] ?? []).flatMap((hoard) => {
    const district = districts.findIndex((candidate) => candidate.name === hoard.place);
    return district < 0 ? [] : [{ hoard, district, rect: districts[district] }];
  });
  const seen = new Map<number, number>();
  return (spot) => {
    const found = hoards.find(
      ({ rect }) =>
        rect.area === spot.area &&
        spot.x >= rect.x &&
        spot.x < rect.x + rect.width &&
        spot.y >= rect.y &&
        spot.y < rect.y + rect.height,
    );
    if (!found) {
      return undefined;
    }
    const index = seen.get(found.district) ?? 0;
    seen.set(found.district, index + 1);
    const contents = found.hoard.contents[index];
    if (!contents) {
      throw new Error(`${found.hoard.place} has more item spots than its hoard has pieces`);
    }
    return { district: found.district, contents };
  };
}

/** A file map's prizes as its loot pool has them, each in its place. */
export function filePrizes(
  id: WorldMapId,
  file: MapFile,
  at: (spot: MapFileSpot) => { x: number; y: number },
): WorldLoot[] {
  const districts = file.districts ?? [];
  // A place not drawn yet holds nothing yet: the file is written by tools that
  // read the game, and the game reads the file they write.
  return (BUILT_IN_FILE_PRIZES[id] ?? []).flatMap((prize, index) => {
    const home = districts.findIndex((district) => district.name === prize.place);
    const district = districts[home];
    if (!district) {
      return [];
    }
    const spot = file.itemSpots.find(
      (candidate) =>
        candidate.area === district.area &&
        candidate.x >= district.x &&
        candidate.x < district.x + district.width &&
        candidate.y >= district.y &&
        candidate.y < district.y + district.height,
    );
    if (!spot) {
      throw new Error(`${prize.place} has no item spot for its ${prize.itemId} to fall back to`);
    }
    return [
      {
        id: `${id}/prize-${index + 1}`,
        position: at(spot),
        itemId: prize.itemId,
        quantity: prize.quantity,
        chance: prize.chance,
        district: `${id}/district-${home + 1}`,
      },
    ];
  });
}

/**
 * A place whose item spots lean to one material: an ordinary spot there whose
 * turn of the rotation is one of Brock's materials (`isMaterial`) holds this
 * one instead, and supplies are left as they were. The spot still takes its
 * turn, so every other spot on the map holds what it always held.
 *
 * The coast is the one lean, and it is parts crates: what washes up and is
 * salvaged off the wrecks. Nine of Bill's deals and Brock's ladder want them,
 * and a newcomer raids the coast first; across ten raids from the Old Quay the
 * 20 Nov AI playtest found one (#42, #51). Olly's pick of 22 Nov: raise their
 * weight in the coast's pools.
 */
export interface FileLean {
  /** The named places it is in, as the file's districts name them. */
  readonly places: readonly string[];
  readonly itemId: ItemId;
}

export const BUILT_IN_FILE_LEANS: Readonly<Partial<Record<WorldMapId, readonly FileLean[]>>> = {
  'greystone-vale': [{ places: ['THE SUNKEN QUARTER', "SMUGGLERS' COVE", 'GULL STRAND'], itemId: 'parts-crate' }],
};

/** What a spot of a file map holds once its place's lean is applied: its own turn, or the lean's material. */
export function leanOf(
  id: WorldMapId,
  file: Pick<MapFile, 'districts'>,
): (
  spot: MapFileSpot,
  contents: { readonly itemId: ItemId; readonly quantity: number },
) => { readonly itemId: ItemId; readonly quantity: number } {
  const districts = file.districts ?? [];
  const leans = (BUILT_IN_FILE_LEANS[id] ?? []).flatMap((lean) =>
    districts.filter((district) => lean.places.includes(district.name)).map((rect) => ({ lean, rect })),
  );
  return (spot, contents) => {
    if (!isMaterial(contents.itemId)) {
      return contents;
    }
    const found = leans.find(
      ({ rect }) =>
        rect.area === spot.area &&
        spot.x >= rect.x &&
        spot.x < rect.x + rect.width &&
        spot.y >= rect.y &&
        spot.y < rect.y + rect.height,
    );
    return found ? { itemId: found.lean.itemId, quantity: 1 } : contents;
  };
}
