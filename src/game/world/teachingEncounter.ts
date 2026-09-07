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
 * Pidgey level 3 is deliberate: it knows only Tackle, so every line of dialogue
 * in the fight is one attack and one number, with no status effect or stat drop
 * to explain away. Normal typing also keeps it neutral against all three
 * starters, so no starter is favoured or punished by the teaching fight itself.
 */
export const TEACHING_ENCOUNTER: WildEncounter = { speciesId: 'pidgey', level: 3 };

/**
 * Only raids still carrying the first contract get the authored opening, and
 * only once. Ordinary encounter rolls resume from the second grass step.
 */
export const hasTeachingEncounter = (session: ActiveRunSession | undefined): boolean =>
  Boolean(session?.plan?.contract) && session?.teachingEncounterUsed !== true;

export const consumeTeachingEncounter = (
  session: ActiveRunSession | undefined,
): WildEncounter | null => {
  if (!hasTeachingEncounter(session)) {
    return null;
  }
  session!.teachingEncounterUsed = true;
  return { ...TEACHING_ENCOUNTER };
};
