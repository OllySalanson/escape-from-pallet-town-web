import { partyOf, type MeasuredParty } from '../world/trainerMeasure';
import { DOJO_LEVEL } from './boutRules';

/**
 * The teams THE BATTLE ARENA's ladder is measured against (`arenaLadder.test.ts`,
 * `tools/arena/ladder.mts`): what a player walks in with at each point of the
 * game, three a side at the dojo's level - the three starters as they are
 * caught, the same three once evolved, and a raid team of the vale's own
 * catches. A class is harder when every one of them wins it less often.
 */
export const DOJO_REFERENCE_TEAMS: readonly MeasuredParty[] = [
  partyOf('starters', ['bulbasaur', DOJO_LEVEL], ['charmander', DOJO_LEVEL], ['squirtle', DOJO_LEVEL]),
  partyOf('evolved starters', ['ivysaur', DOJO_LEVEL], ['charmeleon', DOJO_LEVEL], ['wartortle', DOJO_LEVEL]),
  partyOf('raid team', ['pidgeotto', DOJO_LEVEL], ['raticate', DOJO_LEVEL], ['pikachu', DOJO_LEVEL]),
];
