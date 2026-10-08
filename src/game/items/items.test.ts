import { describe, expect, it } from 'vitest';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BULBASAUR, Pokemon } from '../pokemon';
import { MINIMUM_SUPPLIES } from '../stash';
import { WORLD_MAPS } from '../worldMap';
import {
  ITEM_DEFINITIONS,
  ItemCategory,
  MACHINE_ITEM_IDS,
  EVOLUTION_STONE_IDS,
  MATERIAL_IDS,
  getItemById,
  isMaterial,
  useFieldItem,
} from './items';

describe('medicine in the field', () => {
  /**
   * Playtests 13 and 29: a fainted Charmander drank a Potion out of the raid
   * pack and came back on 16 HP, which is the Pokemon Center's revive at the
   * price of a Potion. Every heal and every cure is refused on a fainted
   * Pokemon, and nothing is spent or changed.
   */
  it('never revives a fainted Pokemon, whatever the medicine', () => {
    const medicine = ITEM_DEFINITIONS.filter(
      (item) => item.effect.type === 'heal' || item.effect.type === 'cure-status',
    );
    expect(medicine.map((item) => item.id)).toContain('potion');
    for (const item of medicine) {
      const pokemon = new Pokemon(BULBASAUR, 5);
      pokemon.takeDamage(pokemon.maxHp);
      if (item.effect.type === 'cure-status') {
        pokemon.primaryStatus = item.effect.status;
      }
      const status = pokemon.primaryStatus;
      const result = useFieldItem(item, pokemon);
      expect(result.used, item.id).toBe(false);
      expect(pokemon.isFainted).toBe(true);
      expect(pokemon.currentHp).toBe(0);
      expect(pokemon.primaryStatus).toBe(status);
    }
  });

  it('still heals a Pokemon that is only hurt', () => {
    const pokemon = new Pokemon(BULBASAUR, 5);
    pokemon.takeDamage(pokemon.maxHp - 1);
    expect(useFieldItem(getItemById('potion')!, pokemon).used).toBe(true);
    expect(pokemon.currentHp).toBe(pokemon.maxHp);
  });
});

describe('materials', () => {
  it('are a handful, each in the Other pocket and each named by a rung that wants it', () => {
    expect(MATERIAL_IDS.length).toBeGreaterThanOrEqual(4);
    expect(MATERIAL_IDS.length).toBeLessThanOrEqual(6);
    const wanted = new Set(WORKSHOP_UPGRADES.flatMap((upgrade) => upgrade.cost.supplies.map(({ itemId }) => itemId)));
    for (const id of MATERIAL_IDS) {
      expect(getItemById(id)?.category).toBe(ItemCategory.Misc);
      expect(wanted.has(id), `${id} is asked for by no rung`).toBe(true);
    }
    // Nothing else lives in that pocket but the five evolution stones and the
    // eight machines, both of which are spent on a Pokemon rather than at
    // Brock's, and the money, which is spent at Bill's counter and
    // nowhere else.
    expect(ITEM_DEFINITIONS.filter((item) => item.category === ItemCategory.Misc).map((item) => item.id).sort()).toEqual(
      [...MATERIAL_IDS, ...MACHINE_ITEM_IDS, ...EVOLUTION_STONE_IDS, 'money'].sort(),
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
