import { describe, expect, it } from 'vitest';
import { FIRST_WORDS } from '../hub/firstWords';
import { baseGame } from './baseGames.testkit';
import { flowForGame } from './arenaKit';
import { marshalLines } from './arenaMarshal';

describe("THE RAID ARENA's marshal", () => {
  it('tells a newcomer what the room is for, and every line fits her box', () => {
    const game = baseGame();
    expect(marshalLines(undefined, flowForGame(game))).toEqual(FIRST_WORDS.loadout.lines);
    for (const line of [...FIRST_WORDS.loadout.lines, ...FIRST_WORDS.check.lines]) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it('after that says the one thing wrong with the raid being got ready', () => {
    const game = baseGame();
    const flow = flowForGame(game);
    const heard = ['loadout'];
    const pokemon = game.stash.listPokemon();
    // A vault's lone Pokemon is on the bench already; off it, the bench is what is wrong.
    if (flow.party.length > 0) {
      flow.togglePokemon(flow.party[0].id);
    }
    expect(marshalLines(heard, flow).join(' ')).toMatch(/bench/);
    flow.togglePokemon(pokemon[0].id);
    flow.setItemQuantity('poke-ball', 0);
    expect(marshalLines(heard, flow).join(' ')).toMatch(/Poké Ball/);
  });

  it('counts a run of clean landings, once nothing is wrong and it is worth saying', () => {
    const game = baseGame();
    const flow = flowForGame(game);
    if (flow.party.length === 0) {
      flow.togglePokemon(game.stash.listPokemon()[0].id);
    }
    flow.setItemQuantity('poke-ball', 1);
    const heard = ['loadout'];
    const ready = (streak: number): string => marshalLines(heard, flow, streak).join(' ');
    expect(ready(0)).toMatch(/You look ready/);
    expect(ready(2)).not.toMatch(/landings/);
    expect(ready(4)).toMatch(/4 clean landings/);
    expect(ready(999).length).toBeLessThanOrEqual(80);
    expect(ready(0).length).toBeLessThanOrEqual(80);
    expect(ready(0)).toMatch(/telescope/);
  });
});
