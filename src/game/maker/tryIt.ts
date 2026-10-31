import type { CrowdMood } from '../base/arenaCrowd';
import { activeSaveSlot } from '../dev/playtestMode';
import { createPlaytestGame, createPlaytestStash } from '../dev/playtestSave';
import { Pokemon } from '../pokemon';
import { BULBASAUR, CHARMANDER, SQUIRTLE } from '../pokemon/species';
import type { SaveGameState } from '../save/SaveManager';
import { hunterSpeciesAt } from '../world/hunter';
import {
  buildPlayerMap,
  MAP_FILE_HABITATS,
  floorHabitat,
  trainerTemplate,
  type MapFile,
  type PlayerMap,
} from '../world/mapFile';
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
export function homeAfterRaid(raidMood?: CrowdMood, closeCall?: string):
  | { readonly key: 'mapmaker'; readonly data: { readonly tried: true } }
  | {
      readonly key: 'base';
      readonly data: { readonly arrival: 'raid'; readonly room: 'raid-arena'; readonly raidMood?: CrowdMood; readonly closeCall?: string };
    } {
  return currentTry()
    ? { key: 'mapmaker', data: { tried: true } }
    : { key: 'base', data: { arrival: 'raid', room: 'raid-arena', ...(raidMood ? { raidMood } : {}), ...(closeCall ? { closeCall } : {}) } };
}

/**
 * The level a try is played at. A try used to field the explorer run's
 * level-99 Charizard and two level-50s, so a maker's own trainer and the wild
 * Pokemon in their tall grass fell to one hit and a try could not say whether
 * a map was fair to the players who will raid it (playtest 46). The maker
 * picks the level now, and it starts on the one that suits the map: the
 * highest level anything on it fights at - its wild Pokemon, a cave's, a
 * district's, its trainers' teams and the Pokemon standing on it - so a try
 * meets the map's hardest fight on even terms.
 */
export const TRY_LEVEL_MIN = 5;
export const TRY_LEVEL_MAX = 100;

/** The levels offered, beside the one that suits the map. */
const TRY_LEVEL_STEPS = [5, 10, 15, 20, 25, 30, 40, 50, 70, 100] as const;

const clampLevel = (level: number): number =>
  Math.max(TRY_LEVEL_MIN, Math.min(TRY_LEVEL_MAX, Math.round(level)));

/** The highest level a raid on the map can meet a Pokemon at, at least `TRY_LEVEL_MIN`. */
export function suitedTryLevel(file: MapFile): number {
  const tables = [
    MAP_FILE_HABITATS[file.wildlife],
    ...(file.districts ?? []).flatMap((district) =>
      district.wildlife ? [MAP_FILE_HABITATS[district.wildlife]] : [],
    ),
    // A floor that rolls on every step - a cave's, the ice, the Power Plant's,
    // the hideout's - fights at its own habitat's levels.
    ...(file.areas ?? []).flatMap((area) => {
      const habitat = floorHabitat(area.kind, area.style);
      return habitat ? [MAP_FILE_HABITATS[habitat]] : [];
    }),
  ];
  const levels = [
    ...tables.flatMap((table) => table.entries.map((entry) => entry.maxLevel)),
    ...(file.trainers ?? []).flatMap((trainer) =>
      trainerTemplate(trainer.team).trainer.party.map((pokemon) => pokemon.level),
    ),
    ...(file.pokemon ?? []).flatMap((standing) => (standing.level === undefined ? [] : [standing.level])),
  ];
  return clampLevel(Math.max(TRY_LEVEL_MIN, ...levels));
}

/**
 * Every level the maker can choose, in order: the one that suits the map among
 * them, and the one already chosen, if that is neither.
 */
export function tryLevelChoices(file: MapFile, chosen?: number): readonly number[] {
  return [
    ...new Set([...TRY_LEVEL_STEPS, suitedTryLevel(file), ...(chosen === undefined ? [] : [clampLevel(chosen)])]),
  ].sort((a, b) => a - b);
}

/**
 * The team a try deploys: the three Kanto starters at the chosen level, each
 * evolved as far as that level reaches and knowing what its own learnset
 * teaches by then - the partner a player picked, at the level they would meet
 * the map at, with the other two beside it so no starter's type decides a try.
 */
export function tryTeam(level: number): readonly Pokemon[] {
  const at = clampLevel(level);
  return [CHARMANDER, SQUIRTLE, BULBASAUR].map((first) => new Pokemon(hunterSpeciesAt(first, at), at));
}

/**
 * The save a try is played from: the explorer run's, whose doors are open and
 * vault is full, with the try team as its Pokemon - the first of them the
 * partner, as the explorer run's Charizard is, so it walks at the maker's heel.
 */
export function createTryGame(level: number): SaveGameState {
  const stash = createPlaytestStash();
  for (const stored of stash.listPokemon()) {
    stash.removePokemon(stored.id);
  }
  const ids = tryTeam(level).map((pokemon) => stash.addPokemon(pokemon));
  stash.adoptPartner(ids[0] ?? null);
  return { ...createPlaytestGame(), stash };
}
