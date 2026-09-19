import { describe, expect, it } from 'vitest';
import { OUTFITTER_UPGRADES } from '../hub/outfitter';
import { BULBASAUR, Pokemon } from '../pokemon';
import { MINIMUM_SUPPLIES } from '../stash';
import { WORLD_MAPS } from '../worldMap';
import {
  ITEM_DEFINITIONS,
  ItemCategory,
  MACHINE_ITEM_IDS,
  MATERIAL_IDS,
  getItemById,
  isMaterial,
  useFieldItem,
} from './items';

describe('materials', () => {
  it('are a handful, each in the Other pocket and each named by a rung that wants it', () => {
    expect(MATERIAL_IDS.length).toBeGreaterThanOrEqual(4);
    expect(MATERIAL_IDS.length).toBeLessThanOrEqual(6);
    const wanted = new Set(OUTFITTER_UPGRADES.flatMap((upgrade) => upgrade.cost.supplies.map(({ itemId }) => itemId)));
    for (const id of MATERIAL_IDS) {
      expect(getItemById(id)?.category).toBe(ItemCategory.Misc);
      expect(wanted.has(id), `${id} is asked for by no rung`).toBe(true);
    }
    // Nothing else lives in that pocket but the evolution stone and the six
    // machines, both of which are spent on a Pokemon rather than at the
    // Outfitter, and the scrip, which is spent at the Ferryman's counter and
    // nowhere else.
    expect(ITEM_DEFINITIONS.filter((item) => item.category === ItemCategory.Misc).map((item) => item.id).sort()).toEqual(
      [...MATERIAL_IDS, ...MACHINE_ITEM_IDS, 'thunder-stone', 'scrip'].sort(),
    );
  });

  it('cannot be used anywhere: not in the field, and never part of the kit', () => {
    const pokemon = new Pokemon(BULBASAUR, 5);
    pokemon.takeDamage(3);
    const hp = pokemon.currentHp;
    for (const id of MATERIAL_IDS) {
      expect(useFieldItem(getItemById(id)!, pokemon).used).toBe(false);
      expect(isMaterial(id)).toBe(true);
      expect(MINIMUM_SUPPLIES).not.toHaveProperty(id);
    }
    expect(pokemon.currentHp).toBe(hp);
    expect(isMaterial('potion')).toBe(false);
  });

  it('are field loot on every map, and not the same ones on each', () => {
    const kindsByMap = Object.values(WORLD_MAPS).map((map) => ({
      id: map.id,
      kinds: new Set(map.loot.map((item) => item.itemId).filter((itemId) => isMaterial(itemId))),
    }));
    for (const { id, kinds } of kindsByMap) {
      expect(kinds.size, `${id} holds no material`).toBeGreaterThan(0);
    }
    const everywhere = new Set(kindsByMap.flatMap(({ kinds }) => [...kinds]));
    expect([...everywhere].sort()).toEqual([...MATERIAL_IDS].sort());
    expect(kindsByMap.some(({ kinds }) => kinds.size < MATERIAL_IDS.length)).toBe(true);
  });
});
