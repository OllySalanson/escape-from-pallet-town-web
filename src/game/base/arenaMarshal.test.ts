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
});
