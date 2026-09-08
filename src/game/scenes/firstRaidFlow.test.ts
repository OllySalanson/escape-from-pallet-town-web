import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createTestLabBattleScenario } from '../dev/testLabRoutes';
import { battleOpeningMessages } from '../pokemon/battle/battleFlow';
import { isHunterEligibleForFirstContract } from '../world/hunter';
import { FIRST_CONTRACT } from '../objectives';
import { generateRunPlan } from '../run/runGeneration';
import { createActiveRunSession } from '../run/RunSession';
import type { RunManager } from '../run/RunManager';
import { TEACHING_ENCOUNTER, consumeTeachingEncounter } from '../world/teachingEncounter';

const worldSceneSource = await readFile(new URL('./WorldScene.ts', import.meta.url), 'utf8');

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

  it('hands the authored teaching fight to the first grass step of a first raid', () => {
    const session = createActiveRunSession(
      {} as RunManager,
      {},
      {},
      [],
      [],
      [],
      generateRunPlan(1234, undefined, 'floodplain-relay', FIRST_CONTRACT),
    );

    expect(consumeTeachingEncounter(session)).toEqual(TEACHING_ENCOUNTER);
    expect(consumeTeachingEncounter(session)).toBeNull();
    // WorldScene must prefer the authored fight over the rolled encounter and
    // flag it, or BattleScene cannot show the one-off explanation.
    expect(worldSceneSource).toContain('const teaching = consumeTeachingEncounter(this.runSession);');
    expect(worldSceneSource).toMatch(/teaching \?\?\s*rollEncounter\(/);
    expect(worldSceneSource).toContain('teachingBattle: teaching !== null,');
  });

  it("delays the first hunter until the player reaches the contract's area or a landmark", () => {
    expect(isHunterEligibleForFirstContract('pallet-town', 'floodplain-relay', false)).toBe(false);
    expect(isHunterEligibleForFirstContract('floodplain-relay', 'floodplain-relay', false)).toBe(true);
    expect(isHunterEligibleForFirstContract('pallet-town', 'floodplain-relay', true)).toBe(true);
    expect(isHunterEligibleForFirstContract('pallet-town', undefined, false)).toBe(true);
  });
});
