import { describe, expect, it } from 'vitest';
import { Bag, getItemById } from '../items';
import { teachFromMachine } from '../items/teaching';
import { Pokemon, PokemonParty, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { SaveManager } from './SaveManager';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem = (key: string): string | null => this.values.get(key) ?? null;
  public setItem = (key: string, value: string): void => void this.values.set(key, value);
  public removeItem = (key: string): void => void this.values.delete(key);
}

const roundTrip = (pokemon: Pokemon): Pokemon | undefined => {
  const stash = new Stash();
  stash.addPokemon(pokemon, 'pupil-1');
  const saves = new SaveManager(new MemoryStorage());
  saves.save({
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 1, y: 1 },
    items: [],
    bag: new Bag({}),
    stash,
  });
  return saves.load()?.stash.listPokemon()[0]?.pokemon;
};

/** Reads the disc the way the raid's bag does, forgetting the first move when the moveset is full. */
const teach = (discId: string, speciesId: string, level: number): Pokemon => {
  const pokemon = new Pokemon(getSpeciesById(speciesId)!, level);
  const outcome = teachFromMachine(getItemById(discId)!, pokemon);
  if (outcome.kind === 'choose') {
    pokemon.resolvePendingMove(outcome.move, 0);
  } else {
    expect(outcome.kind).toBe('learned');
  }
  return pokemon;
};

const moveNames = (pokemon: Pokemon | undefined): string[] =>
  pokemon?.moves.map((move) => move.base.name) ?? [];

// Playtest 21, finding 1: the loader resolved saved move names through
// learnsets alone, so a move taught from a disc - which no Kanto Pokemon learns
// by levelling - was dropped on the next load, after the disc was spent and the
// move it replaced was forgotten.
describe('a move taught from a machine survives a save', () => {
  it('keeps a TM move that replaced a forgotten one (TM13 Ice Beam on Raticate)', () => {
    const raticate = teach('tm13-ice-beam', 'raticate', 20);
    const taught = moveNames(raticate);
    expect(taught).toContain('Ice Beam');
    expect(taught).toHaveLength(4);

    expect(moveNames(roundTrip(raticate))).toEqual(taught);
  });

  it.each([
    ['hm01-cut', 'Cut', 'bulbasaur', 5],
    ['hm03-surf', 'Surf', 'squirtle', 20],
    ['hm06-rock-smash', 'Rock Smash', 'raticate', 20],
  ])('keeps an HM move (%s teaches %s)', (discId, moveName, speciesId, level) => {
    const pupil = teach(discId, speciesId, level);
    const taught = moveNames(pupil);
    expect(taught).toContain(moveName);

    expect(moveNames(roundTrip(pupil))).toEqual(taught);
  });

  it('keeps a machine move through an evolution after it was taught', () => {
    const squirtle = teach('hm03-surf', 'squirtle', 15);
    expect(squirtle.evolveInto(getSpeciesById('wartortle')!)).not.toBeNull();
    const taught = moveNames(squirtle);
    expect(taught).toContain('Surf');

    expect(moveNames(roundTrip(squirtle))).toEqual(taught);
  });

  it('still refuses a move nothing in the line can know', () => {
    const pidgey = new Pokemon(getSpeciesById('pidgey')!, 10);
    const stash = new Stash();
    stash.addPokemon(pidgey, 'pidgey-1');
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      items: [],
      bag: new Bag({}),
      stash,
    });
    const key = 'escape-from-pallet-town.save.v1';
    const file = JSON.parse(storage.getItem(key)!) as {
      stash: { pokemon: { pokemon: { moves: string[] } }[] };
    };
    const before = file.stash.pokemon[0].pokemon.moves;
    file.stash.pokemon[0].pokemon.moves = ['Hydro Pump', ...before];
    storage.setItem(key, JSON.stringify(file));

    expect(moveNames(saves.load()?.stash.listPokemon()[0]?.pokemon)).toEqual(before);
  });
});
