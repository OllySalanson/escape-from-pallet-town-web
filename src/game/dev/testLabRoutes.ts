import { Pokemon, PokemonParty, CHARMANDER } from '../pokemon';
import { BULBASAUR } from '../pokemon/species';

export function createTestLabBattleScenario() {
  return {
    party: new PokemonParty([new Pokemon(CHARMANDER, 12)]),
    wild: { speciesId: BULBASAUR.id, level: 10 },
    returnScene: 'test-lab',
  };
}
