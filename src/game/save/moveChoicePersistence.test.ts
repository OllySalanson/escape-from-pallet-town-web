import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BULBASAUR, Pokemon, TACKLE, WATER_GUN, experienceForLevel } from '../pokemon';
import type { LearnableMove } from '../pokemon/PokemonBase';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { Stash } from '../stash';
import { SaveManager } from './SaveManager';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem = (key: string): string | null => this.values.get(key) ?? null;
  public setItem = (key: string, value: string): void => void this.values.set(key, value);
  public removeItem = (key: string): void => void this.values.delete(key);
}

/** Bulbasaur is the closest shipped species: four moves by level 7. Give it a fifth for the test. */
const learnset = BULBASAUR.learnset as LearnableMove[];
const fifth: LearnableMove = { level: 8, move: WATER_GUN };
beforeEach(() => learnset.push(fifth));
afterEach(() => learnset.splice(learnset.indexOf(fifth), 1));

const stashWithFullMoveset = (): { stash: Stash; saves: SaveManager } => {
  const stash = new Stash();
  stash.addPokemon(new Pokemon(BULBASAUR, 7), 'bulbasaur-1');
  return { stash, saves: new SaveManager(new MemoryStorage()) };
};

const write = (saves: SaveManager, stash: Stash): void => {
  saves.save({
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 1, y: 1 },
    items: [],
    bag: new Bag({}),
    stash,
  });
};

describe('a queued move survives a save', () => {
  it('reloads the moves it forgot and the ones it kept, and the queue itself', () => {
    const { stash, saves } = stashWithFullMoveset();
    const bulbasaur = stash.listPokemon()[0].pokemon;
    bulbasaur.gainExperience(experienceForLevel(8) - bulbasaur.experience);
    expect(bulbasaur.pendingMoves).toEqual([WATER_GUN]);
    write(saves, stash);

    const queued = saves.load()?.stash.listPokemon()[0].pokemon;
    expect(queued?.pendingMoves).toEqual([WATER_GUN]);
    expect(queued?.moves).toHaveLength(4);

    // Forgetting persists, and the queue is empty afterwards.
    bulbasaur.resolvePendingMove(WATER_GUN, 0);
    write(saves, stash);
    const reloaded = saves.load()?.stash.listPokemon()[0].pokemon;
    expect(reloaded?.moves.map((move) => move.base.name)).not.toContain(TACKLE.name);
    expect(reloaded?.moves.map((move) => move.base.name)).toContain(WATER_GUN.name);
    expect(reloaded?.pendingMoves).toEqual([]);
  });

  it('a declined move stays declined after a reload', () => {
    const { stash, saves } = stashWithFullMoveset();
    const bulbasaur = stash.listPokemon()[0].pokemon;
    const before = bulbasaur.moves.map((move) => move.base.name);
    bulbasaur.gainExperience(experienceForLevel(8) - bulbasaur.experience);
    bulbasaur.resolvePendingMove(WATER_GUN, null);
    write(saves, stash);

    const reloaded = saves.load()?.stash.listPokemon()[0].pokemon;
    expect(reloaded?.moves.map((move) => move.base.name)).toEqual(before);
    expect(reloaded?.pendingMoves).toEqual([]);
  });
});

describe('a raid that settles', () => {
  it('carries the choice the raid made rather than re-deriving the level-up', () => {
    const { stash } = stashWithFullMoveset();
    const target = experienceForLevel(8);
    stash.applyRaidCondition([
      {
        id: 'bulbasaur-1',
        currentHp: 10,
        primaryStatus: null,
        experience: target,
        moves: ['Super Sonic', 'Growl', 'Vine Whip', 'Water Gun'],
        pendingMoves: [],
        heldItemId: null,
      },
    ]);
    const settled = stash.listPokemon()[0].pokemon;
    expect(settled.moves.map((move) => move.base.name)).toEqual([
      'Super Sonic',
      'Growl',
      'Vine Whip',
      'Water Gun',
    ]);
    expect(settled.pendingMoves).toEqual([]);
  });

  it('with nobody asked, queues the move for base instead of dropping or forgetting anything', () => {
    const { stash } = stashWithFullMoveset();
    const before = stash.listPokemon()[0].pokemon.moves.map((move) => move.base.name);
    stash.applyRaidCondition([
      {
        id: 'bulbasaur-1',
        currentHp: 10,
        primaryStatus: null,
        experience: experienceForLevel(8),
        heldItemId: null,
      },
    ]);
    const settled = stash.listPokemon()[0].pokemon;
    expect(settled.moves.map((move) => move.base.name)).toEqual(before);
    expect(settled.pendingMoves).toEqual([WATER_GUN]);
  });
});
