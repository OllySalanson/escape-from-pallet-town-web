import { FIRST_CONTRACT_ID } from '../objectives/contracts';
import type { ActiveRunSession } from '../run/RunSession';
import type { WildEncounter } from './wildEncounters';

/**
 * The authored opening fight.
 *
 * The Unity project fought Pallet Town's grass with a level-10 Jigglypuff lead;
 * the web game deploys a level-5 starter into the same table, where 60% of rolls
 * are a level-7 Bulbasaur that beats every starter. This encounter replaces the
 * first roll of a first-contract raid with an opponent the player is favoured
 * against, so the opening teaches the battle screen instead of ending the raid.
 *
 * Pidgey is deliberate: it knows only Tackle, so every line of dialogue in the
 * fight is one attack and one number, with no status effect or stat drop to
 * explain away. Normal typing also keeps it neutral against all three starters.
 *
 * Level 2 is measured, not chosen: Tackle carries Pidgey's same-type bonus, so
 * at level 3 it did 5-6 a hit into Charmander's 16 HP against Scratch's 4-5
 * into its 14, one critical hit decided the fight, and a Charmander player lost
 * their first raid to it about one time in eight (playtest 45). At level 2 every
 * starter wins it by attacking at least 99 times in 100.
 */
export const TEACHING_ENCOUNTER: WildEncounter = { speciesId: 'pidgey', level: 2 };

/**
 * Only raids still carrying the *first* contract get the authored opening, and
 * only once. Ordinary encounter rolls resume from the second grass step. Later
 * contracts are taken by players who have already been taught the battle
 * screen, so handing them a level-2 Pidgey would only be free experience.
 */
export const hasTeachingEncounter = (session: ActiveRunSession | undefined): boolean =>
  session?.plan?.contract?.id === FIRST_CONTRACT_ID && session?.teachingEncounterUsed !== true;

export const consumeTeachingEncounter = (
  session: ActiveRunSession | undefined,
): WildEncounter | null => {
  if (!hasTeachingEncounter(session)) {
    return null;
  }
  session!.teachingEncounterUsed = true;
  return { ...TEACHING_ENCOUNTER };
};
