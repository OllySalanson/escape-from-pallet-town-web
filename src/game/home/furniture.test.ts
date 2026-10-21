import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS, ItemCategory, getItemById, isFoundOnly, type SupplyItemId } from '../items';
import { ITEM_ICONS } from '../ui/icons';
import { isPrize } from '../world/loot';
import { getWorldMap, worldMapIds } from '../worldMap';
import { districtsForMap } from '../world/districts';
import { buildWipeSettlement, raidSupplyDelta } from '../run/raidSettlement';
import { RunManager } from '../run/RunManager';
import { BULBASAUR, Pokemon } from '../pokemon';
import { baseGame } from '../base/baseGames.testkit';
import { ownedFurniture } from './arrangement';
import { FOUND_FURNITURE, FURNITURE, dollId, furnitureNamed } from './furniture';
import { FURNITURE_PIECES } from './generated/furniturePieces';

/**
 * The furniture catalogue against everything it leans on: the art it is cut
 * from, the items a raid carries it home as, and the maps it is found on.
 */

const shippedLoot = () =>
  worldMapIds()
    .filter((id) => !id.startsWith('player-'))
    .flatMap((id) => getWorldMap(id).loot.map((loot) => ({ mapId: id, loot })));

describe('the furniture catalogue', () => {
  it('draws every piece on whole tiles of its own art, its tiles matching it in every facing', () => {
    for (const definition of FURNITURE) {
      expect(definition.facings.length).toBeGreaterThan(0);
      expect(definition.cells).toHaveLength(definition.height);
      for (const row of definition.cells) {
        expect([definition.id, row.length, /^[#.T]+$/.test(row)]).toEqual([definition.id, definition.width, true]);
      }
      for (const art of definition.facings) {
        if (art.kind === 'sheet') {
          const at = FURNITURE_PIECES[art.piece];
          expect([definition.id, at.width, at.height]).toEqual([definition.id, definition.width, definition.height]);
        } else {
          expect([definition.id, definition.width, definition.height]).toEqual([definition.id, 1, 1]);
        }
      }
      // A mat lies flat and something may stand on it; anything else is in the way.
      if (definition.layer === 'floor') {
        expect(definition.cells.join('')).toMatch(/\./);
      }
    }
  });

  it('says "An EKANS doll" and "A PIDGEY doll", never "A EKANS"', () => {
    expect(furnitureNamed(dollId(23))?.line).toBe('An EKANS doll, for the first EKANS you ever brought home.');
    expect(furnitureNamed(dollId(16))?.line).toBe('A PIDGEY doll, for the first PIDGEY you ever brought home.');
  });

  it('has a doll for each of the 151, and every other piece once', () => {
    expect(FURNITURE.filter((definition) => definition.source.kind === 'doll')).toHaveLength(151);
    expect(new Set(FURNITURE.map((definition) => definition.id)).size).toBe(FURNITURE.length);
  });

  it('carries every find home as an item of its own, in the Furniture pocket, with its own icon', () => {
    for (const definition of FOUND_FURNITURE) {
      const item = getItemById(definition.id);
      expect([definition.id, item?.category, item?.effect.type]).toEqual([definition.id, ItemCategory.Furniture, 'furniture']);
      expect(isFoundOnly(definition.id)).toBe(true);
      expect(definition.id in ITEM_ICONS).toBe(true);
      expect(existsSync(`public/assets/icons/${definition.id}.png`)).toBe(true);
    }
    // And the other way: no furniture item a piece does not stand for.
    for (const item of ITEM_DEFINITIONS.filter((each) => each.effect.type === 'furniture')) {
      expect(furnitureNamed(item.id)?.source).toEqual({ kind: 'found', itemId: item.id });
    }
  });

  it('is never a supply anything that repeats could hand out', () => {
    // A compile-time fact, asked at run time too: furniture is not a SupplyItemId.
    const supply: SupplyItemId[] = ['potion'];
    expect(supply.some((id) => getItemById(id)?.category === ItemCategory.Furniture)).toBe(false);
  });

  it('is found on the maps, the common pieces as ordinary loot and the super-rare ones as prizes in a place of their own', () => {
    const loot = shippedLoot();
    for (const definition of FOUND_FURNITURE) {
      const rows = loot.filter((row) => row.loot.itemId === definition.id);
      expect([definition.id, rows.length > 0]).toEqual([definition.id, true]);
      for (const { mapId, loot: row } of rows) {
        expect([definition.id, isPrize(row)]).toEqual([definition.id, definition.rare === true]);
        if (!definition.rare) {
          // Re-seated anywhere a raid can walk, like any supply: a pool row
          // tied to a district behind a shut door would be no row at all.
          expect([definition.id, row.district]).toEqual([definition.id, undefined]);
          continue;
        }
        // Rarer than every prize but the Bicycle, which is the longest odds of all (`world/bicycle.ts`).
        expect(row.chance).toBeLessThanOrEqual(0.06);
        // Seated in its district, its fallback tile inside it.
        const district = districtsForMap(mapId).find((each) => each.id === row.district);
        expect([definition.id, district !== undefined]).toEqual([definition.id, true]);
        const inside = district!.areas.some(
          (area) =>
            row.position.x >= area.x &&
            row.position.x < area.x + area.width &&
            row.position.y >= area.y &&
            row.position.y < area.y + area.height,
        );
        expect([definition.id, inside]).toEqual([definition.id, true]);
      }
    }
    // One super-rare piece a map.
    const rares = loot.filter((row) => furnitureNamed(row.loot.itemId)?.rare);
    expect(new Set(rares.map((row) => row.mapId)).size).toBe(rares.length);
  });
});

describe('a find coming home', () => {
  it('is lost with the pack on a wipe, and owned once it is banked', () => {
    // Found in the field and still in the pack when the raid was lost.
    const wipe = buildWipeSettlement([], { 'surf-mat': 1, 'glitter-mat': 1 });
    expect(wipe.securedItems).toEqual([]);
    expect(wipe.destroyedItems).toEqual(
      expect.arrayContaining([
        { itemId: 'surf-mat', quantity: 1 },
        { itemId: 'glitter-mat', quantity: 1 },
      ]),
    );
    // Carried out, it is banked with the rest of the haul...
    const manager = new RunManager();
    manager.startRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] }, { mapId: 'pallet-town', durationMs: 60_000 });
    expect(raidSupplyDelta(manager.snapshot(), { 'surf-mat': 1 })).toEqual([{ itemId: 'surf-mat', quantity: 1 }]);
    // ...and the house owns it from then on.
    const game = baseGame();
    expect(ownedFurniture(game).get('surf-mat')).toBeUndefined();
    game.stash.addItem('surf-mat', 1);
    expect(ownedFurniture(game).get('surf-mat')).toBe(1);
  });
});
