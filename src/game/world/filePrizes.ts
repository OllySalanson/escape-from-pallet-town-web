import type { ItemId } from '../items';
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
    // Frostreef's: out on the frozen lagoon, which only Berg Cave reaches.
    // Getting there is the price, so it is always there.
    { itemId: 'never-melt-ice', quantity: 1, chance: 1, place: 'THE FROZEN LAGOON' },
  ],
};

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
