import { describe, expect, it } from 'vitest';
import { getItemById, useFieldItem, type ItemId } from '../items';
import { hunterThreatFor } from '../world/hunterThreat';
import { Pokemon, computePokemonStats, experienceForLevel } from './Pokemon';
import {
  EVOLUTIONS,
  evolutionByStone,
  evolutionFamily,
  evolutionOnLevel,
  evolvesInto,
} from './evolution';
import { RAZOR_LEAF, SUPER_SONIC, THUNDERBOLT, VINE_WHIP } from './moves';
import {
  BULBASAUR,
  CHARMANDER,
  IVYSAUR,
  JIGGLYPUFF,
  PIDGEY,
  PIKACHU,
  RAICHU,
  SPECIES_BY_ID,
  SQUIRTLE,
  VENUSAUR,
  WIGGLYTUFF,
  getSpeciesById,
} from './species';

/** Enough experience to stand a Pokemon exactly at `level`. */
const experienceTo = (pokemon: Pokemon, level: number): number =>
  experienceForLevel(level) - pokemon.experience;

describe('the evolution table', () => {
  /**
   * Pinned in full, because every line of it is sourced rather than designed:
   * Unity carries no evolution data at all, so this is PokeAPI's
   * `/evolution-chain/` read on 2026-09-19 and nothing else. A change here is a
   * change to canon and should have to be typed out.
   */
  it('is exactly the canon rules for the species this game ships', () => {
    expect(
      EVOLUTIONS.map((rule) => [
        rule.from,
        rule.to,
        rule.trigger.kind === 'level' ? `level ${rule.trigger.level}` : rule.trigger.itemId,
      ]),
    ).toEqual([
      ['bulbasaur', 'ivysaur', 'level 16'],
      ['ivysaur', 'venusaur', 'level 32'],
      ['charmander', 'charmeleon', 'level 16'],
      ['charmeleon', 'charizard', 'level 36'],
      ['squirtle', 'wartortle', 'level 16'],
      ['wartortle', 'blastoise', 'level 36'],
      ['pidgey', 'pidgeotto', 'level 18'],
      ['pidgeotto', 'pidgeot', 'level 36'],
      ['pikachu', 'raichu', 'thunder-stone'],
      ['jigglypuff', 'wigglytuff', 'moon-stone'],
    ]);
  });

  it('names only species the game actually has, and leaves Butterfree alone', () => {
    for (const rule of EVOLUTIONS) {
      expect(getSpeciesById(rule.from), `${rule.from} is not a shipped species`).toBeDefined();
      expect(getSpeciesById(rule.to), `${rule.to} is not a shipped species`).toBeDefined();
    }
    // Butterfree is already the end of the Caterpie line.
    expect(EVOLUTIONS.some((rule) => rule.from === 'butterfree')).toBe(false);
  });

  /**
   * The Moon Stone rule ships without a Moon Stone. Jigglypuff is only ever a
   * trainer's Pokemon today, so nothing a player can own would answer to one,
   * and an item that can never do anything is a worse find than no item. Pinned
   * so that the day Jigglypuff is catchable, this test is what says the stone
   * has to arrive with it.
   */
  it('ships an item for every stone a player could spend one on, and no others', () => {
    const ownable = new Set(Object.keys(SPECIES_BY_ID).filter((id) => id !== 'jigglypuff'));
    for (const rule of EVOLUTIONS) {
      if (rule.trigger.kind !== 'stone') {
        continue;
      }
      const item = getItemById(rule.trigger.itemId);
      expect(Boolean(item), `${rule.trigger.itemId} exists as an item`).toBe(
        ownable.has(rule.from),
      );
      if (item) {
        expect(item.effect.type).toBe('evolution-stone');
      }
    }
  });

  it('answers what a species becomes, and refuses what it does not', () => {
    expect(evolutionOnLevel('bulbasaur', 15)).toBeUndefined();
    expect(evolutionOnLevel('bulbasaur', 16)).toBe(IVYSAUR);
    expect(evolutionOnLevel('pidgey', 17)).toBeUndefined();
    expect(evolutionOnLevel('pikachu', 100)).toBeUndefined();
    expect(evolutionByStone('pikachu', 'thunder-stone')).toBe(RAICHU);
    expect(evolutionByStone('pikachu', 'moon-stone')).toBeUndefined();
    expect(evolutionByStone('bulbasaur', 'thunder-stone')).toBeUndefined();
  });

  it('knows which way a line runs', () => {
    expect(evolvesInto('bulbasaur', 'venusaur')).toBe(true);
    expect(evolvesInto('venusaur', 'bulbasaur')).toBe(false);
    expect(evolvesInto('bulbasaur', 'bulbasaur')).toBe(false);
    expect(evolvesInto('bulbasaur', 'charizard')).toBe(false);
  });

  it('gathers a whole line from any point on it', () => {
    expect(evolutionFamily('ivysaur').map((species) => species.id).sort()).toEqual([
      'bulbasaur',
      'ivysaur',
      'venusaur',
    ]);
    expect(evolutionFamily('butterfree').map((species) => species.id)).toEqual(['butterfree']);
  });
});

describe('evolving on a level', () => {
  it('changes the species, the stats and the learnset the next level reads', () => {
    const starter = new Pokemon(BULBASAUR, 15);
    const result = starter.gainExperience(experienceTo(starter, 16));

    expect(result.evolutions).toEqual([{ from: BULBASAUR, to: IVYSAUR, level: 16 }]);
    expect(starter.base).toBe(IVYSAUR);
    expect(starter.level).toBe(16);
    expect(starter.stats).toEqual(computePokemonStats(IVYSAUR.baseStats, 16));
    // Stronger on every axis, which is the whole reward.
    expect(starter.stats.spAttack).toBeGreaterThan(
      computePokemonStats(BULBASAUR.baseStats, 16).spAttack,
    );

    // And Razor Leaf is Ivysaur's to teach, not Bulbasaur's. All four slots are
    // taken, so it waits for the player's choice instead of pushing one out.
    const before = starter.moves.map((move) => move.base);
    const result22 = starter.gainExperience(experienceTo(starter, 22));
    expect(result22.movesToChoose).toContain(RAZOR_LEAF);
    expect(starter.moves.map((move) => move.base)).toEqual(before);
    starter.resolvePendingMove(RAZOR_LEAF, 0);
    expect(starter.moves.map((move) => move.base)).toContain(RAZOR_LEAF);
  });

  it('keeps the moves it already knew, including ones only its old species teaches', () => {
    const starter = new Pokemon(BULBASAUR, 15);
    expect(starter.moves.map((move) => move.base)).toContain(SUPER_SONIC);

    starter.gainExperience(experienceTo(starter, 16));

    expect(starter.moves.map((move) => move.base)).toContain(SUPER_SONIC);
    expect(starter.moves.map((move) => move.base)).toContain(VINE_WHIP);
  });

  it('is not a heal: the damage taken on the way there is still there', () => {
    const starter = new Pokemon(SQUIRTLE, 15);
    const maximumBefore = starter.maxHp;
    starter.takeDamage(10);

    starter.gainExperience(experienceTo(starter, 16));

    expect(starter.base.id).toBe('wartortle');
    // Exactly the maximum's own gain is added, as a level adds it - never a top-up.
    expect(starter.currentHp).toBe(maximumBefore - 10 + (starter.maxHp - maximumBefore));
    expect(starter.currentHp).toBeLessThan(starter.maxHp);
  });

  it('is not a revive either', () => {
    const starter = new Pokemon(CHARMANDER, 15);
    starter.takeDamage(starter.maxHp);

    starter.gainExperience(experienceTo(starter, 16));

    expect(starter.base.id).toBe('charmeleon');
    expect(starter.currentHp).toBe(0);
    expect(starter.isFainted).toBe(true);
  });

  it('crosses two thresholds of one line in a single award, in order', () => {
    const starter = new Pokemon(BULBASAUR, 5);

    const result = starter.gainExperience(experienceTo(starter, 34));

    expect(result.evolutions.map((evolution) => evolution.to.id)).toEqual(['ivysaur', 'venusaur']);
    expect(starter.base).toBe(VENUSAUR);
  });

  it('happens once and never again, however often the same experience is replayed', () => {
    const starter = new Pokemon(BULBASAUR, 15);
    starter.gainExperience(experienceTo(starter, 16));
    const settled = starter.experience;

    // A replay hands over what is already there, so the gain is nothing.
    const replay = starter.gainExperience(Math.max(0, settled - starter.experience));

    expect(replay.evolutions).toEqual([]);
    expect(starter.base).toBe(IVYSAUR);
  });

  it('refuses to run backwards, sideways or in place', () => {
    const ivysaur = new Pokemon(IVYSAUR, 20);

    expect(ivysaur.evolveInto(BULBASAUR)).toBeNull();
    expect(ivysaur.evolveInto(IVYSAUR)).toBeNull();
    expect(ivysaur.evolveInto(RAICHU)).toBeNull();
    expect(ivysaur.base).toBe(IVYSAUR);
  });
});

describe('evolving with a stone', () => {
  const stone = getItemById('thunder-stone' satisfies ItemId)!;

  it('turns the one species that answers to it, and says so', () => {
    const pikachu = new Pokemon(PIKACHU, 12);
    pikachu.takeDamage(5);
    const maximumBefore = pikachu.maxHp;

    const result = useFieldItem(stone, pikachu);

    expect(result).toEqual({ used: true, message: 'Pikachu evolved into Raichu!' });
    expect(pikachu.base).toBe(RAICHU);
    expect(pikachu.level).toBe(12);
    expect(pikachu.stats).toEqual(computePokemonStats(RAICHU.baseStats, 12));
    // Spent on a hurt Pokemon it is still not a heal.
    expect(pikachu.currentHp).toBe(maximumBefore - 5 + (pikachu.maxHp - maximumBefore));
  });

  it('is refused by anything it is not for, and costs nothing when it is', () => {
    for (const species of [BULBASAUR, PIDGEY, JIGGLYPUFF, RAICHU]) {
      const pokemon = new Pokemon(species, 12);

      const result = useFieldItem(stone, pokemon);

      expect(result.used, `${species.name} answered a Thunder Stone`).toBe(false);
      expect(pokemon.base).toBe(species);
    }
  });

  it('hands over everything the new species knows, and nothing it does not', () => {
    const pikachu = new Pokemon(PIKACHU, 20);
    useFieldItem(stone, pikachu);

    // Nothing is learned by evolving - that is the games' own rule - so Raichu
    // fights on with what the Pikachu had...
    expect(pikachu.moves.map((move) => move.base.name)).toEqual(['Tackle', 'Growl', 'Thunder Wave']);
    // ...and learns nothing later either, because Raichu's learnset is level 1
    // only. That is the cost of using the stone early, and it is canon.
    expect(pikachu.gainExperience(experienceTo(pikachu, 50)).learnedMoves).toEqual([]);
    expect(RAICHU.learnset.map((entry) => entry.move)).toContain(THUNDERBOLT);
  });

  it('is no use on a species that has no stone at all', () => {
    // Wigglytuff exists and its rule is authored; the Moon Stone does not ship.
    expect(evolutionByStone('jigglypuff', 'moon-stone')).toBe(WIGGLYTUFF);
    expect(getItemById('moon-stone')).toBeUndefined();
  });
});

/**
 * The condition the progression report set on building this at all: evolution
 * is only a reward rather than a difficulty setting if the thing hunting you
 * reads it. It does, because the hunter is priced off the strongest deployed
 * Pokemon's level - so an evolution that comes with a level raises the hunter
 * with it, and a stone, which comes with no level at all, does not.
 */
describe('what evolving costs you in hunter', () => {
  it('raises the hunter with the level that evolved you', () => {
    const before = hunterThreatFor([new Pokemon(BULBASAUR, 9)]);
    const after = hunterThreatFor([new Pokemon(IVYSAUR, 16)]);

    expect(before.tierOffset).toBeLessThan(after.tierOffset);
    expect(after.tierOffset).toBe(2);
    expect(after.openingTier.party.length).toBe(3);
  });

  it('charges nothing for a stone, which is the level it did not cost you', () => {
    const pikachu = new Pokemon(PIKACHU, 12);
    const before = hunterThreatFor([pikachu]);
    useFieldItem(getItemById('thunder-stone')!, pikachu);

    expect(hunterThreatFor([pikachu]).tierOffset).toBe(before.tierOffset);
  });
});
