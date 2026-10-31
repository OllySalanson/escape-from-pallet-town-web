import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { createStartingStash, getStarterSpecies, Stash, type StarterSpeciesId } from '../stash';
import { deserializeGame, serializeGame, type RestoredGame, type SaveGameState, type SaveManager } from './SaveManager';

/** The save every new game starts from, whoever it holds. */
function newGameState(stash: Stash, starterSpeciesId: StarterSpeciesId | null): SaveGameState {
  return {
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    items: [],
    bag: new Bag(),
    stash,
    starterSpeciesId,
  };
}

/**
 * The game a new player stands on in Oak's Lab before they have chosen: an empty
 * vault and nothing in storage, read through the same loader as any save so every
 * screen's assumptions about a game hold of it. It is never written, which is
 * what makes walking away from the table cost nothing.
 */
export function gameBeforeChoosing(): RestoredGame {
  const game = deserializeGame(JSON.parse(JSON.stringify(serializeGame(newGameState(new Stash(), null)))));
  if (!game) {
    throw new Error('an empty new game does not read back');
  }
  return game;
}

/**
 * Starts the game on this partner: written, then read back, so what the harbour
 * reads is the saved game whole. Null when the browser would not keep it, which
 * is the one thing every later screen could not survive.
 */
export function startNewGame(saveManager: SaveManager, starter: StarterSpeciesId): RestoredGame | null {
  const state = newGameState(createStartingStash(getStarterSpecies(starter)), starter);
  return saveManager.save(state) ? saveManager.load() : null;
}
