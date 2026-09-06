import { describe, expect, it } from 'vitest';
import { createTestLabBattleScenario } from '../dev/testLabRoutes';
import { battleOpeningMessages } from '../pokemon/battle/battleFlow';
import { isHunterEligibleForFirstContract } from '../world/hunter';

describe('first raid flow regressions', () => {
  it('launches the Test Lab battle with a playable party and returns to the lab', () => {
    const scenario = createTestLabBattleScenario();

    expect(scenario.party.getHealthyPokemon()?.base.id).toBe('charmander');
    expect(scenario.wild).toEqual({ speciesId: 'bulbasaur', level: 10 });
    expect(scenario.returnScene).toBe('test-lab');
  });

  it('introduces an ordinary trainer battle before showing its action menu', () => {
    expect(battleOpeningMessages('RIVAL HUNTER', 'Charmander', 'Pidgey')).toEqual([
      'RIVAL HUNTER wants to battle!',
      'Go, CHARMANDER!',
    ]);
  });

  it('delays the first hunter until the player reaches Route 1 or the field station', () => {
    expect(isHunterEligibleForFirstContract('pallet-town', true, false)).toBe(false);
    expect(isHunterEligibleForFirstContract('route-1', true, false)).toBe(true);
    expect(isHunterEligibleForFirstContract('pallet-town', true, true)).toBe(true);
    expect(isHunterEligibleForFirstContract('pallet-town', false, false)).toBe(true);
  });
});
