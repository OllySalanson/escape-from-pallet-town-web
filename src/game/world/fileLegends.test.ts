import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { BUILT_IN_MAP_FILE_LIMITS, buildFileMap, MAP_FILE_LIMITS, readMapFile, type MapFile } from './mapFile';
import { Pokemon } from '../pokemon/Pokemon';
import { getSpeciesById } from '../pokemon/species';
import { LEGENDARY_KINDS, legendCaught } from './legends';

const SAMPLE = sampleLane as MapFile;

/** The sample with one standing Pokemon on a tile of its lane. */
const standing = (pokemon: Record<string, unknown>): Record<string, unknown> => ({
  ...SAMPLE,
  pokemon: [{ x: 16, y: 2, ...pokemon }],
});

const problems = (value: unknown, limits = BUILT_IN_MAP_FILE_LIMITS): readonly string[] => {
  const reading = readMapFile(value, { limits });
  return reading.ok ? [] : reading.problems;
};

/**
 * A legend a map file stands (`MapFilePokemon.legendary`): Greystone Vale's
 * Mew on Stormcrown. It is a legend exactly as the shipped four are - the
 * figure says so, and the Pokedex says whether it still stands - and only the
 * game's own maps may stand one.
 */
describe('a legend on a map file', () => {
  it('is Kanto’s four and Mew, and nothing else may be marked legendary', () => {
    expect(LEGENDARY_KINDS).toEqual(['articuno', 'zapdos', 'moltres', 'mewtwo', 'mew']);
    expect(problems(standing({ species: 'mew', level: 50, legendary: true }))).toEqual([]);
    expect(problems(standing({ species: 'pidgey', level: 50, legendary: true }))).toEqual([
      'Pokémon 1 is legendary, which only a legend that fights may be.',
    ]);
    expect(problems(standing({ species: 'mew', legendary: true }))).toEqual([
      'Pokémon 1 is legendary, which only a legend that fights may be.',
    ]);
    expect(problems(standing({ species: 'mew', level: 50, legendary: 'yes' }))).toEqual([
      'Pokémon 1 is legendary or says nothing about it.',
    ]);
  });

  it('may stand only on a map the game draws, never on a player’s', () => {
    expect(problems(standing({ species: 'mew', level: 50, legendary: true }), MAP_FILE_LIMITS)).toEqual([
      'A legend may stand only on a map the game draws.',
    ]);
    // An ordinary Mew a maker places is still a Mew anybody may place.
    expect(problems(standing({ species: 'mew', level: 50 }), MAP_FILE_LIMITS)).toEqual([]);
  });

  it('stands in the world marked legendary, and is caught off the Pokedex like the four', () => {
    const file = readMapFile(standing({ species: 'mew', level: 50, legendary: true }), {
      limits: BUILT_IN_MAP_FILE_LIMITS,
    });
    if (!file.ok) throw new Error(file.problems.join(' '));
    const map = buildFileMap(file.file, 'greystone-vale', BUILT_IN_MAP_FILE_LIMITS);
    const mew = map.entities.find((entity) => entity.pokemon === 'mew');
    expect(mew).toMatchObject({ legendary: true, wildLevel: 50 });
    expect(legendCaught(mew!, [])).toBe(false);
    expect(legendCaught(mew!, ['mew'])).toBe(true);
  });

  it('fights as Mew at 50 with a full kit, and its one throw is FireRed’s catch rate 45', () => {
    const mew = new Pokemon(getSpeciesById('mew')!, 50);
    expect(mew.moves).toHaveLength(4);
    expect(mew.moves.some((move) => move.base.power > 0)).toBe(true);
    // Mew is caught far more easily than the four (rate 3): canon, and the climb is the price.
    expect(getSpeciesById('mew')!.catchRate).toBe(45);
  });
});
