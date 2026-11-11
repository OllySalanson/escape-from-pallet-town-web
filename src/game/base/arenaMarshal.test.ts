import { describe, expect, it } from 'vitest';
import { FIRST_WORDS } from '../hub/firstWords';
import { baseGame } from './baseGames.testkit';
import { flowForGame } from './arenaKit';
import { marshalLines } from './arenaMarshal';
import { traderProgressOf } from '../save/SaveManager';

describe("THE RAID ARENA's marshal", () => {
  it('tells a newcomer what the room is for, and every line fits her box', () => {
    const game = baseGame();
    expect(marshalLines(undefined, flowForGame(game), { bill: traderProgressOf(game.raidProgress) })).toEqual(FIRST_WORDS.loadout.lines);
    for (const line of FIRST_WORDS.loadout.lines) {
      expect(line.length).toBeLessThanOrEqual(90);
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
    expect(marshalLines(heard, flow, { bill: traderProgressOf(game.raidProgress) }).join(' ')).toMatch(/bench/);
    flow.togglePokemon(pokemon[0].id);
    flow.setItemQuantity('poke-ball', 0);
    expect(marshalLines(heard, flow, { bill: traderProgressOf(game.raidProgress) }).join(' ')).toMatch(/Poké Ball/);
  });

  it('counts a run of clean landings, once nothing is wrong and it is worth saying', () => {
    const game = baseGame();
    const flow = flowForGame(game);
    if (flow.party.length === 0) {
      flow.togglePokemon(game.stash.listPokemon()[0].id);
    }
    flow.setItemQuantity('poke-ball', 1);
    const heard = ['loadout'];
    const ready = (streak: number): string => marshalLines(heard, flow, { bill: traderProgressOf(game.raidProgress), cleanLandings: streak }).join(' ');
    expect(ready(0)).toMatch(/You look ready/);
    expect(ready(2)).not.toMatch(/landings/);
    expect(ready(4)).toMatch(/4 clean landings/);
    expect(ready(999).length).toBeLessThanOrEqual(80);
    expect(ready(0).length).toBeLessThanOrEqual(80);
    expect(ready(0)).toMatch(/telescope/);
  });
});

describe('the marshal on where Poké Balls come from', () => {
  const noBallsAtBase = (progress = {}) => {
    const game = baseGame({ progress });
    for (const [itemId, quantity] of Object.entries(game.stash.listItems())) {
      if (itemId.endsWith('-ball')) game.stash.removeItem(itemId, quantity);
    }
    const flow = flowForGame(game);
    if (flow.party.length === 0) flow.togglePokemon(game.stash.listPokemon()[0].id);
    return { game, flow };
  };

  it('never sends a stranger to Bill, who sells them nothing (first-hour hunt 2, finding 1)', () => {
    const { game, flow } = noBallsAtBase();
    const said = marshalLines(['loadout'], flow, { bill: traderProgressOf(game.raidProgress) }).join(' ');
    expect(said).not.toMatch(/Bill sells them/);
    expect(said).toMatch(/stranger/);
    expect(said).toMatch(/out there/);
    expect(said).toMatch(/job/);
  });

  it('sends a player Bill will sell to, to Bill', () => {
    const { game, flow } = noBallsAtBase({ standingContractsBanked: 3 });
    expect(marshalLines(['loadout'], flow, { bill: traderProgressOf(game.raidProgress) }).join(' ')).toMatch(/Bill sells them/);
  });
});
