import { describe, expect, it } from 'vitest';
import { Move } from './Move';
import { MoveBase, MoveCategory } from './MoveBase';
import { experienceAwardForDefeat, experienceForLevel, Pokemon } from './Pokemon';
import { PokemonBase } from './PokemonBase';
import { PokemonParty } from './PokemonParty';
import { PokemonType } from './PokemonType';
import { POISON_POWDER, TACKLE, VINE_WHIP } from './moves';
import { BULBASAUR, BUTTERFREE, CHARMANDER, PIDGEY } from './species';

const expectedHp = (baseHp: number, level: number): number =>
  Math.floor((baseHp * level) / 100) + level + 10;
const expectedBattleStat = (baseStat: number, level: number): number =>
  Math.floor((baseStat * level) / 100) + 5;

describe('Unity Pokemon data port', () => {
  it('preserves the authored species stats and learnsets', () => {
    expect(BULBASAUR.baseStats).toEqual({
      hp: 45,
      attack: 49,
      defense: 49,
      spAttack: 65,
      spDefense: 65,
      speed: 45,
    });
    expect(BUTTERFREE.primaryType).toBe(PokemonType.Bug);
    expect(BUTTERFREE.secondaryType).toBe(PokemonType.Flying);
    expect(BUTTERFREE.learnset).toContainEqual({ level: 10, move: POISON_POWDER });
  });

  it('preserves the authored move values', () => {
    expect(VINE_WHIP).toMatchObject({
      type: PokemonType.Grass,
      power: 45,
      accuracy: 100,
      pp: 20,
      category: MoveCategory.Special,
    });
  });
});

describe('Pokemon stat computation', () => {
  it('matches the documented formulas at low and mid levels', () => {
    const lowLevelBulbasaur = new Pokemon(BULBASAUR, 5);
    const midLevelBulbasaur = new Pokemon(BULBASAUR, 50);

    expect(lowLevelBulbasaur.stats.hp).toBe(expectedHp(BULBASAUR.baseStats.hp, 5));
    expect(lowLevelBulbasaur.stats.attack).toBe(expectedBattleStat(BULBASAUR.baseStats.attack, 5));
    expect(lowLevelBulbasaur.stats.speed).toBe(expectedBattleStat(BULBASAUR.baseStats.speed, 5));

    expect(midLevelBulbasaur.stats.hp).toBe(expectedHp(BULBASAUR.baseStats.hp, 50));
    expect(midLevelBulbasaur.stats.spAttack).toBe(
      expectedBattleStat(BULBASAUR.baseStats.spAttack, 50),
    );
  });

  it('keeps HP scaling distinct from non-HP stats', () => {
    const bulbasaur = new Pokemon(BULBASAUR, 12);

    expect(bulbasaur.stats.hp).toBe(expectedHp(BULBASAUR.baseStats.hp, 12));
    expect(bulbasaur.stats.hp).not.toBe(expectedBattleStat(BULBASAUR.baseStats.hp, 12));
  });
});

describe('Pokemon experience and leveling', () => {
  it('uses an N cubed total experience curve and awards defeated level cubed XP', () => {
    expect(experienceForLevel(1)).toBe(1);
    expect(experienceForLevel(5)).toBe(125);
    expect(experienceForLevel(10)).toBe(1000);
    expect(experienceAwardForDefeat(10)).toBe(1000);
  });

  it('levels up by recomputing stats and preserving the gained maximum HP', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    const initialMaxHp = charmander.maxHp;
    charmander.takeDamage(3);

    const result = charmander.gainExperience(experienceForLevel(6) - charmander.experience);

    expect(result.levelsGained).toEqual([6]);
    expect(charmander.level).toBe(6);
    expect(charmander.stats).toEqual({
      hp: expectedHp(CHARMANDER.baseStats.hp, 6),
      attack: expectedBattleStat(CHARMANDER.baseStats.attack, 6),
      defense: expectedBattleStat(CHARMANDER.baseStats.defense, 6),
      spAttack: expectedBattleStat(CHARMANDER.baseStats.spAttack, 6),
      spDefense: expectedBattleStat(CHARMANDER.baseStats.spDefense, 6),
      speed: expectedBattleStat(CHARMANDER.baseStats.speed, 6),
    });
    expect(charmander.currentHp).toBe(charmander.maxHp - 3);
    expect(charmander.maxHp).toBeGreaterThan(initialMaxHp);
  });

  it('learns moves that unlock during a level-up', () => {
    const charmander = new Pokemon(CHARMANDER, 6);

    const result = charmander.gainExperience(experienceForLevel(7) - charmander.experience);

    expect(result.levelsGained).toEqual([7]);
    expect(result.learnedMoves.map((move) => move.name)).toEqual(['Ember']);
    expect(charmander.moves.map((move) => move.base.name)).toEqual(['Scratch', 'Growl', 'Ember']);
  });
});

describe('Pokemon damage, fainting, and healing', () => {
  it('clamps damage and updates fainted state', () => {
    const pidgey = new Pokemon(PIDGEY, 8);
    const maxHp = pidgey.maxHp;

    expect(pidgey.takeDamage(6)).toBe(6);
    expect(pidgey.currentHp).toBe(maxHp - 6);
    expect(pidgey.isFainted).toBe(false);

    expect(pidgey.takeDamage(999)).toBe(maxHp - 6);
    expect(pidgey.currentHp).toBe(0);
    expect(pidgey.isFainted).toBe(true);
  });

  it('supports partial and full healing with proper clamping', () => {
    const charmander = new Pokemon(CHARMANDER, 9);
    const maxHp = charmander.maxHp;

    charmander.takeDamage(maxHp);
    expect(charmander.isFainted).toBe(true);

    expect(charmander.heal(4)).toBe(4);
    expect(charmander.currentHp).toBe(4);
    expect(charmander.isFainted).toBe(false);

    expect(charmander.heal(500)).toBe(maxHp - 4);
    expect(charmander.currentHp).toBe(maxHp);

    charmander.takeDamage(1);
    expect(charmander.heal()).toBe(1);
    expect(charmander.currentHp).toBe(maxHp);
  });
});

describe('Move runtime PP handling', () => {
  it('consumes PP until exhausted and cannot go below zero', () => {
    const move = new Move(TACKLE);

    for (let index = 0; index < TACKLE.pp; index += 1) {
      expect(move.use()).toBe(true);
    }

    expect(move.pp).toBe(0);
    expect(move.canUse()).toBe(false);
    expect(move.use()).toBe(false);
    expect(move.pp).toBe(0);
  });

  it('restores PP partially, fully, and with max clamping', () => {
    const move = new Move(TACKLE);

    move.use();
    move.use();
    expect(move.pp).toBe(TACKLE.pp - 2);

    move.restorePp(1);
    expect(move.pp).toBe(TACKLE.pp - 1);

    move.restorePp(99);
    expect(move.pp).toBe(TACKLE.pp);

    move.use();
    move.restorePp();
    expect(move.pp).toBe(TACKLE.pp);
  });
});

describe('Pokemon move learnset behavior', () => {
  it('caps known moves at four and keeps the latest learned moves', () => {
    const moves = [
      new MoveBase({
        name: 'Move A',
        type: PokemonType.Normal,
        power: 40,
        accuracy: 100,
        pp: 10,
        category: MoveCategory.Physical,
      }),
      new MoveBase({
        name: 'Move B',
        type: PokemonType.Normal,
        power: 40,
        accuracy: 100,
        pp: 10,
        category: MoveCategory.Physical,
      }),
      new MoveBase({
        name: 'Move C',
        type: PokemonType.Normal,
        power: 40,
        accuracy: 100,
        pp: 10,
        category: MoveCategory.Physical,
      }),
      new MoveBase({
        name: 'Move D',
        type: PokemonType.Normal,
        power: 40,
        accuracy: 100,
        pp: 10,
        category: MoveCategory.Physical,
      }),
      new MoveBase({
        name: 'Move E',
        type: PokemonType.Normal,
        power: 40,
        accuracy: 100,
        pp: 10,
        category: MoveCategory.Physical,
      }),
    ];

    const trainingDummy = new PokemonBase({
      id: 'training-dummy',
      name: 'Training Dummy',
      primaryType: PokemonType.Normal,
      baseStats: {
        hp: 50,
        attack: 50,
        defense: 50,
        spAttack: 50,
        spDefense: 50,
        speed: 50,
      },
      learnset: [
        { level: 1, move: moves[0] },
        { level: 2, move: moves[1] },
        { level: 3, move: moves[2] },
        { level: 4, move: moves[3] },
        { level: 5, move: moves[4] },
      ],
      frontSprite: 'sprites/pokemon/training_dummy_front.png',
      backSprite: 'sprites/pokemon/training_dummy_back.png',
    });
    const pokemon = new Pokemon(trainingDummy, 10);

    expect(pokemon.moves).toHaveLength(4);
    expect(pokemon.moves.map((move) => move.base.name)).toEqual(['Move B', 'Move C', 'Move D', 'Move E']);
  });
});

describe('PokemonParty', () => {
  it('returns the first healthy Pokemon and detects all-fainted parties', () => {
    const bulbasaur = new Pokemon(BULBASAUR, 6);
    const pidgey = new Pokemon(PIDGEY, 6);
    const party = new PokemonParty([bulbasaur, pidgey]);

    expect(party.getHealthyPokemon()).toBe(bulbasaur);
    expect(party.isAllFainted()).toBe(false);

    bulbasaur.takeDamage(999);
    expect(party.getHealthyPokemon()).toBe(pidgey);
    expect(party.isAllFainted()).toBe(false);

    pidgey.takeDamage(999);
    expect(party.getHealthyPokemon()).toBeNull();
    expect(party.isAllFainted()).toBe(true);
  });

  it('supports adding and removing party members', () => {
    const party = new PokemonParty();
    const charmander = new Pokemon(CHARMANDER, 5);

    party.addPokemon(charmander);
    expect(party.pokemon).toHaveLength(1);
    expect(party.removePokemon(charmander)).toBe(true);
    expect(party.pokemon).toHaveLength(0);
    expect(party.removePokemon(charmander)).toBe(false);
  });

  it('moves a member to a valid party position', () => {
    const bulbasaur = new Pokemon(BULBASAUR, 6);
    const charmander = new Pokemon(CHARMANDER, 5);
    const pidgey = new Pokemon(PIDGEY, 6);
    const party = new PokemonParty([bulbasaur, charmander, pidgey]);

    expect(party.movePokemon(1, 0)).toBe(true);
    expect(party.pokemon).toEqual([charmander, bulbasaur, pidgey]);
    expect(party.movePokemon(0, 0)).toBe(false);
    expect(party.movePokemon(-1, 1)).toBe(false);
    expect(party.movePokemon(0, 3)).toBe(false);
  });
});
