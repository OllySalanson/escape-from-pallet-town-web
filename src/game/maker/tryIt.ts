import { activeSaveSlot } from '../dev/playtestMode';
import { buildPlayerMap, type MapFile, type PlayerMap } from '../world/mapFile';
import { loadMakerStore, saveMakerStore, walkedVersion } from './drafts';

/**
 * TRY IT: a raid on the draft in the map maker, played by the real game.
 *
 * The draft is registered as a map like any other (`world/playerMaps.ts`) under
 * one id kept for it, and a raid is deployed onto it with a ready-made team in
 * a save of its own (`TRY_IT_SAVE_KEY`), so nothing a try does reaches the
 * player's game or their explorer run. Two ways to try it, as the plan agreed:
 * **walk** it under the explorer run's rules - nobody faints, every exit is
 * open, the clock never ends it - or **raid** it under the game's own, with the
 * clock and the hunter.
 *
 * Walking out of an exit is what the last check asks of a maker before a map
 * can be sent in, so a try that ends through an exit records the version of the
 * map it was (`walkedVersion`) against the draft. Any later edit that changes
 * the walk takes the tick away again; a rename does not.
 *
 * Which try is running is a module variable and nothing stored, like the save
 * slot it travels with: a reload lands on the title screen, which puts the
 * game back to its ordinary save, and a try nobody can get back to is simply
 * forgotten.
 */

/** The id the draft being tried is registered under, beside every published map's. */
export const TRY_IT_MAP_ID = 'try-it';

export type TryRules = 'walk' | 'raid';

export interface TryingMap {
  readonly draftKey: string;
  readonly version: string;
  readonly rules: TryRules;
  readonly map: PlayerMap;
}

let trying: TryingMap | undefined;

/** The try in progress, while the game is playing one. */
export function currentTry(): TryingMap | undefined {
  return activeSaveSlot() === 'try-it' ? trying : undefined;
}

/** The game's view of a draft, under the id a try is played on. */
export function tryItMap(file: MapFile): PlayerMap {
  return buildPlayerMap({ ...file, id: TRY_IT_MAP_ID });
}

export function beginTry(draftKey: string, file: MapFile, rules: TryRules): TryingMap {
  trying = { draftKey, version: walkedVersion(file), rules, map: tryItMap(file) };
  return trying;
}

export function endTry(): void {
  trying = undefined;
}

/**
 * Records that the maker walked out of this version of the draft. Kept on the
 * draft in this browser's drafts, so the check stays ticked across a reload.
 */
export function recordWalkedOut(attempt: TryingMap): void {
  const store = loadMakerStore();
  const draft = store.drafts.find((candidate) => candidate.key === attempt.draftKey);
  if (!draft) {
    return;
  }
  saveMakerStore({
    ...store,
    drafts: store.drafts.map((candidate) =>
      candidate.key === attempt.draftKey ? { ...candidate, walkedOut: attempt.version } : candidate,
    ),
  });
}

/**
 * Where a raid's ending goes: back to the map maker from a try, to the base
 * from anything else. One answer for the three scenes a raid can end in.
 */
export function homeAfterRaid():
  | { readonly key: 'mapmaker'; readonly data: { readonly tried: true } }
  | {
      readonly key: 'base';
      readonly data: { readonly arrival: 'raid' };
    } {
  return currentTry()
    ? { key: 'mapmaker', data: { tried: true } }
    : { key: 'base', data: { arrival: 'raid' } };
}
