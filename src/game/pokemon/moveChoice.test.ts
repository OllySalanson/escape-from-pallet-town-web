import { describe, expect, it } from 'vitest';
import { Pokemon, experienceForLevel } from './Pokemon';
import { PokemonBase } from './PokemonBase';
import { PokemonType } from './PokemonType';
import { EMBER, GROWL, SCRATCH, TACKLE, WATER_GUN, WING_ATTACK } from './moves';
import { CHARMELEON } from './species';
import { Stash } from '../stash';

/** No shipped species knows more than four moves, so the fifth is built here. */
const CRAMMED = new PokemonBase({
  id: 'crammed',
  name: 'Crammed',
  primaryType: PokemonType.Normal,
  baseStats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: SCRATCH },
    { level: 1, move: GROWL },
    { level: 1, move: EMBER },
    { level: 6, move: WATER_GUN },
  ],
  frontSprite: '',
  backSprite: '',
});

const levelToSix = (pokemon: Pokemon) =>
  pokemon.gainExperience(experienceForLevel(6) - pokemon.experience);

describe('a fifth move', () => {
  it('is queued rather than taking a slot, and nothing is forgotten by levelling', () => {
    const pokemon = new Pokemon(CRAMMED, 5);
    const before = pokemon.moves.map((move) => move.base);
    expect(before).toHaveLength(4);

    const result = levelToSix(pokemon);

    expect(result.learnedMoves).toEqual([]);
    expect(result.movesToChoose).toEqual([WATER_GUN]);
    expect(pokemon.pendingMoves).toEqual([WATER_GUN]);
    expect(pokemon.moves.map((move) => move.base)).toEqual(before);
  });

  it('still learns straight into a free slot', () => {
    const pokemon = new Pokemon(CRAMMED, 5);
    pokemon.moves.pop();
    const result = levelToSix(pokemon);
    expect(result.learnedMoves).toEqual([WATER_GUN]);
    expect(result.movesToChoose).toEqual([]);
    expect(pokemon.pendingMoves).toEqual([]);
  });

  it('replaces exactly the chosen slot, with full PP, and leaves the others alone', () => {
    const pokemon = new Pokemon(CRAMMED, 5);
    levelToSix(pokemon);
    pokemon.moves[0].use();
    pokemon.moves[3].use();

    const result = pokemon.resolvePendingMove(WATER_GUN, 1);

    expect(result?.forgotten).toBe(SCRATCH);
    expect(pokemon.moves.map((move) => move.base)).toEqual([TACKLE, WATER_GUN, GROWL, EMBER]);
    expect(pokemon.moves[1].pp).toBe(WATER_GUN.pp);
    expect(pokemon.moves[0].pp).toBe(TACKLE.pp - 1);
    expect(pokemon.moves[3].pp).toBe(EMBER.pp - 1);
    expect(pokemon.pendingMoves).toEqual([]);
  });

  it('declining leaves all four moves and their PP untouched', () => {
    const pokemon = new Pokemon(CRAMMED, 5);
    levelToSix(pokemon);
    pokemon.moves[2].use();
    const before = pokemon.moves.map((move) => [move.base, move.pp]);

    expect(pokemon.resolvePendingMove(WATER_GUN, null)?.forgotten).toBeNull();

    expect(pokemon.moves.map((move) => [move.base, move.pp])).toEqual(before);
    expect(pokemon.pendingMoves).toEqual([]);
  });

  it('refuses a move that was never offered or a slot that does not exist', () => {
    const pokemon = new Pokemon(CRAMMED, 5);
    levelToSix(pokemon);
    expect(pokemon.resolvePendingMove(EMBER, 0)).toBeUndefined();
    expect(pokemon.resolvePendingMove(WATER_GUN, 4)).toBeUndefined();
    expect(pokemon.resolvePendingMove(WATER_GUN, -1)).toBeUndefined();
    expect(pokemon.pendingMoves).toEqual([WATER_GUN]);
  });

  it('is not queued twice by the same level being replayed', () => {
    const pokemon = new Pokemon(CRAMMED, 5);
    levelToSix(pokemon);
    pokemon.experience = experienceForLevel(5);
    pokemon.level = 5;
    levelToSix(pokemon);
    expect(pokemon.pendingMoves).toEqual([WATER_GUN]);
  });
});

describe('carrying the choice through a save and a settlement', () => {
  it('restoreMoveset ignores names the species cannot know and never empties the moveset', () => {
    const pokemon = new Pokemon(CRAMMED, 5);
    const before = pokemon.moves.map((move) => move.base);
    pokemon.restoreMoveset(['Nonsense'], ['Also nonsense']);
    expect(pokemon.moves.map((move) => move.base)).toEqual(before);

    pokemon.restoreMoveset(['Tackle', 'Water Gun', 'Tackle'], ['Water Gun', 'Ember']);
    expect(pokemon.moves.map((move) => move.base)).toEqual([TACKLE, WATER_GUN]);
    // Water Gun is known, so it is not also queued.
    expect(pokemon.pendingMoves).toEqual([EMBER]);
  });
});

describe('a level that evolves, learns a fifth move and finds a held item in place', () => {
  const evolvingIntoFifthMove = () => {
    // Charmeleon at 35 knows four moves; at 36 it becomes Charizard, whose
    // learnset opens Wing Attack on that very level.
    const pokemon = new Pokemon(CHARMELEON, 35);
    pokemon.giveHeldItem('leftovers');
    return pokemon;
  };

  it('reports the evolution and queues the fifth move in one call, forgetting nothing', () => {
    const pokemon = evolvingIntoFifthMove();
    const before = pokemon.moves.map((move) => move.base);
    expect(before).toHaveLength(4);

    const result = pokemon.gainExperience(experienceForLevel(36) - pokemon.experience);

    expect(result.evolutions.map((evolution) => evolution.to.id)).toEqual(['charizard']);
    expect(result.movesToChoose).toEqual([WING_ATTACK]);
    expect(pokemon.base.id).toBe('charizard');
    expect(pokemon.moves.map((move) => move.base)).toEqual(before);
    expect(pokemon.heldItemId).toBe('leftovers');
  });

  it('keeps its gear and its evolved species whichever way the choice goes', () => {
    for (const forget of [0, null]) {
      const pokemon = evolvingIntoFifthMove();
      pokemon.gainExperience(experienceForLevel(36) - pokemon.experience);
      pokemon.resolvePendingMove(WING_ATTACK, forget);
      expect(pokemon.base.id).toBe('charizard');
      expect(pokemon.heldItemId).toBe('leftovers');
      expect(pokemon.moves.some((move) => move.base === WING_ATTACK)).toBe(forget === 0);
    }
  });

  it('carries the answer home through a settlement that replays the evolution', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMELEON, 35), 'charmeleon-1');
    const forgotten = stash.listPokemon()[0].pokemon.moves[0].base.name;
    stash.applyRaidCondition([
      {
        id: 'charmeleon-1',
        currentHp: 10,
        primaryStatus: null,
        experience: experienceForLevel(36),
        speciesId: 'charizard',
        heldItemId: 'leftovers',
        moves: [
          ...stash
            .listPokemon()[0]
            .pokemon.moves.slice(1)
            .map((m) => m.base.name),
          'Wing Attack',
        ],
        pendingMoves: [],
      },
    ]);
    const settled = stash.listPokemon()[0].pokemon;
    expect(settled.base.id).toBe('charizard');
    expect(settled.moves.map((move) => move.base.name)).toContain('Wing Attack');
    expect(settled.moves.map((move) => move.base.name)).not.toContain(forgotten);
    expect(settled.pendingMoves).toEqual([]);
    expect(settled.heldItemId).toBe('leftovers');
  });
});
