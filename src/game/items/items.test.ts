import { describe, expect, it } from 'vitest';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BULBASAUR, Pokemon } from '../pokemon';
import { EVOLUTIONS } from '../pokemon/evolution';
import { getSpeciesById } from '../pokemon/species';
import { MINIMUM_SUPPLIES } from '../stash';
import { WORLD_MAPS } from '../worldMap';
import {
  ITEM_DEFINITIONS,
  ItemCategory,
  MACHINE_ITEM_IDS,
  EVOLUTION_STONE_IDS,
  KEY_ITEM_IDS,
  MATERIAL_IDS,
  isErrandItem,
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

  /**
   * FireRed's party menu answers a Potion on a full Pokemon, or an Antidote on
   * one that is not poisoned, with `gText_WontHaveEffect`; this game said
   * "X's HP is already full." and "It will not have any effect.".
   */
  it("says FireRed's 'It won't have any effect.' when medicine would do nothing", () => {
    const full = new Pokemon(BULBASAUR, 5);
    expect(useFieldItem(getItemById('potion')!, full).message).toBe("It won't have any effect.");
    expect(useFieldItem(getItemById('antidote')!, full).message).toBe("It won't have any effect.");
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
    // nine machines, both of which are spent on a Pokemon rather than at
    // Brock's, the money, which is spent at Bill's counter and nowhere else,
    // the Pickaxe, the two rods, the keys and the Bicycle, which are carried
    // and never spent at all, the Lockpick, which a locked crate spends, and
    // the errands' things, which are carried home and handed over
    // (`hub/errands.ts`).
    expect(ITEM_DEFINITIONS.filter((item) => item.category === ItemCategory.Misc).map((item) => item.id).sort()).toEqual(
      [
        ...MATERIAL_IDS,
        ...ITEM_DEFINITIONS.filter((item) => isErrandItem(item.id)).map((item) => item.id),
        ...MACHINE_ITEM_IDS,
        ...EVOLUTION_STONE_IDS,
        ...KEY_ITEM_IDS,
        'money',
        'pickaxe',
        'old-rod',
        'good-rod',
        'lockpick',
        'bicycle',
      ].sort(),
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

describe('evolution stones', () => {
  // A stone's line is the only place a player is told what it is for, at Bill's
  // counter and in the pack. Bill's own errand hands over an Eevee, and three of
  // the stones evolve it, so a line that leaves a reader out sends the player
  // to the wrong stone - or to none.
  it('names every Pokémon that answers to it', () => {
    for (const stoneId of EVOLUTION_STONE_IDS) {
      const description = getItemById(stoneId)!.description;
      const readers = EVOLUTIONS.filter(
        (rule) => rule.trigger.kind === 'stone' && rule.trigger.itemId === stoneId,
      ).map((rule) => getSpeciesById(rule.from)!.name);
      expect(readers.length, stoneId).toBeGreaterThan(0);
      for (const reader of readers) {
        // Nidorina and Nidorino are named together as the Nidoran lines.
        const named = reader.startsWith('Nidor') ? 'Nidoran' : reader;
        expect(description, `${stoneId} leaves out ${reader}`).toContain(named);
      }
    }
  });
});
