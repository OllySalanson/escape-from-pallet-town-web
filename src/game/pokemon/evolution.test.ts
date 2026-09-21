import { describe, expect, it } from 'vitest';
import { getItemById, useFieldItem, type ItemId } from '../items';
import { hunterThreatFor } from '../world/hunterThreat';
import { HUNTER_TIERS } from '../world/hunter';
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
   * The ten lines the game shipped with, pinned as they were before the import
   * widened the table to all 151: every one of them is sourced rather than
   * designed, so a change here is a change to canon and should have to be
   * typed out. The whole table is generated - `generated/evolutionRules.ts` -
   * and what generation III had is the generator's filtering, which
   * `speciesImport.test.ts` holds.
   */
  it('is exactly the canon rules for the species the game shipped with', () => {
    const shipped = [
      'bulbasaur', 'ivysaur', 'charmander', 'charmeleon', 'squirtle', 'wartortle',
      'pidgey', 'pidgeotto', 'pikachu', 'jigglypuff',
    ];
    expect(
      EVOLUTIONS.filter((rule) => shipped.includes(rule.from)).map((rule) => [
        rule.from,
        rule.to,
        rule.trigger.kind === 'level'
          ? `level ${rule.trigger.level}`
          : rule.trigger.kind === 'stone'
            ? rule.trigger.itemId
            : 'trade',
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
   * **All five stones ship, and every stone rule in the table is reachable.**
   * Four of them were named by a rule here and by nothing a player could own
   * until the maps were given something worth being greedy about: a stone is
   * the one change this game makes that nothing can take back, which is what
   * makes it the prize a raid can be *for* - see `world/loot.ts` for the rule
   * and `worldMap.ts` for the place each is seated in.
   *
   * Pinned as the whole list, so a sixth is a decision somebody made and a
   * stone that stops being an item is caught here rather than in a playtest.
   */
  it('gives every stone it ships an evolution-stone effect, and ships them all', () => {
    const stones = new Set(
      EVOLUTIONS.flatMap((rule) => (rule.trigger.kind === 'stone' ? [rule.trigger.itemId] : [])),
    );
    expect([...stones].sort()).toEqual([
      'fire-stone', 'leaf-stone', 'moon-stone', 'thunder-stone', 'water-stone',
    ]);
    for (const stone of stones) {
      const item = getItemById(stone);
      expect(Boolean(item), `${stone} exists as an item`).toBe(true);
      expect(item?.effect.type).toBe('evolution-stone');
    }
  });

  /**
   * What the four new stones bought, counted rather than claimed: every line
   * the table has that a stone crosses is now a line a player can cross.
   */
  it('has a live line for every stone, and a Pokemon on a shipped table to read it', () => {
    const byStone = new Map<string, string[]>();
    for (const rule of EVOLUTIONS) {
      if (rule.trigger.kind !== 'stone') continue;
      byStone.set(rule.trigger.itemId, [...(byStone.get(rule.trigger.itemId) ?? []), rule.from]);
    }
    expect(
      [...byStone].map(([stone, from]) => `${stone}: ${from.sort().join(', ')}`).sort(),
    ).toEqual([
      'fire-stone: eevee, growlithe, vulpix',
      'leaf-stone: exeggcute, gloom, weepinbell',
      'moon-stone: clefairy, jigglypuff, nidorina, nidorino',
      'thunder-stone: eevee, pikachu',
      'water-stone: eevee, poliwhirl, shellder, staryu',
    ]);
  });

  /** Nothing asks for a trade, so the four trade lines can never be crossed. */
  it('cannot be triggered by a trade rule', () => {
    const trades = EVOLUTIONS.filter((rule) => rule.trigger.kind === 'trade');
    expect(trades.map((rule) => rule.from).sort()).toEqual([
      'graveler', 'haunter', 'kadabra', 'machoke',
    ]);
    for (const rule of trades) {
      expect(evolutionOnLevel(rule.from, 100)).toBeUndefined();
      expect(evolutionByStone(rule.from, 'thunder-stone')).toBeUndefined();
      // The family still runs through it, which is the whole reason it is kept.
      expect(evolvesInto(rule.from, rule.to)).toBe(true);
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
    // The import brought the rest of the line with it: Butterfree used to be
    // a family of one because Caterpie and Metapod did not exist.
    expect(evolutionFamily('butterfree').map((species) => species.id).sort()).toEqual([
      'butterfree',
      'caterpie',
      'metapod',
    ]);
    // A trade line is still one family, which is what keeps a save's moves
    // readable and an Alakazam three stages tall in the pack.
    expect(evolutionFamily('alakazam').map((species) => species.id).sort()).toEqual([
      'abra',
      'alakazam',
      'kadabra',
    ]);
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
    // A Pikachu at 20 knows the last four of its own list, Double Team included.
    expect(pikachu.moves.map((move) => move.base.name)).toEqual([
      'Tackle',
      'Growl',
      'Thunder Wave',
      'Double Team',
    ]);
    // ...and learns nothing later either, because Raichu's learnset is level 1
    // only. That is the cost of using the stone early, and it is canon.
    expect(pikachu.gainExperience(experienceTo(pikachu, 50)).learnedMoves).toEqual([]);
    expect(RAICHU.learnset.map((entry) => entry.move)).toContain(THUNDERBOLT);
  });

  it('answers a stone that ships and refuses one that does not', () => {
    expect(evolutionByStone('jigglypuff', 'moon-stone')).toBe(WIGGLYTUFF);
    expect(getItemById('moon-stone')?.effect.type).toBe('evolution-stone');
    // Generation III has no Ice Stone and this game ships none either, so a
    // Vulpix reads the Fire Stone and nothing else.
    expect(getItemById('ice-stone')).toBeUndefined();
    expect(evolutionByStone('jigglypuff', 'leaf-stone')).toBeUndefined();
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
    // Sixteen is the first evolution and the fourth rung opens at exactly that
    // level, so evolving draws the rung that was added to answer it - it used to
    // draw the top of a three-rung ladder and then have nothing left to climb.
    expect(after.tierOffset).toBe(HUNTER_TIERS.length - 1);
    expect(after.openingTier.party.length).toBe(4);
  });

  it('charges nothing for a stone, which is the level it did not cost you', () => {
    const pikachu = new Pokemon(PIKACHU, 12);
    const before = hunterThreatFor([pikachu]);
    useFieldItem(getItemById('thunder-stone')!, pikachu);

    expect(hunterThreatFor([pikachu]).tierOffset).toBe(before.tierOffset);
  });
});
