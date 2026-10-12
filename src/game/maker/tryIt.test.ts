import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import type { MapFile } from '../world/mapFile';
import { blankMap } from './draft';
import { createTryGame, suitedTryLevel, tryLevelChoices, tryTeam } from './tryIt';

const SAMPLE = sampleLane as MapFile;

describe('the level a try is played at', () => {
  it('suits the map: the highest level anything on it fights at', () => {
    // A blank map's meadow tops out at Lv 6.
    expect(suitedTryLevel(blankMap())).toBe(6);
    // The sample's Bug Kid fields a scout team, Lv 5 and 6, in a meadow.
    expect(suitedTryLevel(SAMPLE)).toBe(6);
    expect(suitedTryLevel({ ...SAMPLE, wildlife: 'woodland' })).toBe(8);
    expect(
      suitedTryLevel({ ...SAMPLE, pokemon: [{ x: 3, y: 3, species: 'snorlax', level: 30 }] }),
    ).toBe(30);
    expect(
      suitedTryLevel({ ...SAMPLE, trainers: [{ ...SAMPLE.trainers![0], team: 'netter' }] }),
    ).toBe(8);
  });

  it('is never under the level a starter is chosen at', () => {
    expect(suitedTryLevel({ ...blankMap(), wildlife: 'field' })).toBe(5);
  });

  it('is offered among the levels a maker can choose, in order', () => {
    const choices = tryLevelChoices({ ...SAMPLE, wildlife: 'woodland' });
    expect(choices).toContain(8);
    expect(choices[0]).toBe(5);
    expect(choices.at(-1)).toBe(100);
    expect([...choices].sort((a, b) => a - b)).toEqual(choices);
    expect(tryLevelChoices(SAMPLE, 36)).toContain(36);
    expect(tryLevelChoices(SAMPLE, 500)).not.toContain(500);
  });
});

describe('the team a try fields', () => {
  it('is the three starters at the chosen level, each evolved as far as it reaches', () => {
    expect(tryTeam(5).map((pokemon) => [pokemon.base.name, pokemon.level])).toEqual([
      ['Charmander', 5],
      ['Squirtle', 5],
      ['Bulbasaur', 5],
    ]);
    expect(tryTeam(36).map((pokemon) => pokemon.base.name)).toEqual(['Charizard', 'Blastoise', 'Venusaur']);
    expect(tryTeam(20).map((pokemon) => pokemon.base.name)).toEqual(['Charmeleon', 'Wartortle', 'Ivysaur']);
  });

  it('knows what its own learnset teaches by then, and is at full health', () => {
    for (const pokemon of tryTeam(12)) {
      expect(pokemon.moves.length).toBeGreaterThan(0);
      expect(pokemon.currentHp).toBe(pokemon.maxHp);
    }
  });

  it('is the vault of the save a try is played from, the first of them its partner', () => {
    const stash = createTryGame(7).stash!;
    const kept = stash.listPokemon();
    expect(kept.map((stored) => stored.pokemon.level)).toEqual([7, 7, 7]);
    expect(stash.partner()?.id).toBe(kept[0].id);
  });
});
