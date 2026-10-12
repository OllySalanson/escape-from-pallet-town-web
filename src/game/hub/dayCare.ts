import { experienceForLevel, type ExperienceResult, type Pokemon } from '../pokemon/Pokemon';
import type { RaidInFlight } from '../run/raidInFlight';
import { copyPokemon, raidsDeployed, type RaidProgress } from '../save/SaveManager';
import type { DayCareStay, Stash } from '../stash/Stash';

/**
 * THE DAY-CARE: leave one Pokémon with the Day-Care Man and it grows while you
 * raid without it.
 *
 * It is FireRed's Route 5 Day-Care, which raises one Pokémon at a time
 * (`route5DayCareMon`, pret/pokefirered `src/daycare.c`), with its words
 * (`data/maps/Route5_PokemonDayCare/text.inc`) and its rules wherever this
 * game has the same thing to decide:
 *
 * - **What it grows by.** FireRed pays one experience point a step walked. A
 *   raid is the step here: every raid that ends while the Pokémon is in his
 *   care pays it **half the experience between the level it is at and the next**
 *   (`DAY_CARE_SHARE_OF_A_LEVEL`), so two raids are a level on every growth
 *   curve and at every level. A flat amount, FireRed's shape, was tabulated and
 *   refused: at the levels this game is played at, 250 a raid took a level-3
 *   catch to level 11 in three raids and did nothing at all past level 20. The
 *   share is a third to a half of what the lead of a raid party earns by
 *   fighting at the levels the maps are played at, so it helps a Pokémon left
 *   on the bench keep up and never stands in for taking it out.
 * - **Nothing is stored but the Pokémon and when it was left.** The growth is a
 *   function of how many raids have ended since (`raidsCompleted`), exactly as
 *   FireRed keeps the Pokémon as it was handed over plus a step count and works
 *   the level out whenever it is asked. A reload cannot pay it twice.
 * - **It grows as FireRed's does**, through the same level-ups a fight makes
 *   (`Pokemon.gainExperience`), learning each level's moves from its learnset -
 *   and **never evolves there**: FireRed's `ApplyDaycareExperience` only
 *   increments the level, so a Pokémon taken back evolves at its next level-up
 *   in a fight. One difference, on purpose: FireRed pushes the oldest move out
 *   to make room for a new one, and this game's rule is that a level-up never
 *   forgets a move, so a move with no room is queued and asked about at base
 *   like any other.
 * - **It is out of the vault while it is there**, so a wipe cannot touch it,
 *   no raid can deploy it, Brock cannot be paid with it and the secure
 *   container never fills with it. It keeps its stash id and, if it is the
 *   partner, its place as the partner, and comes back under both.
 * - **It is not a heal.** FireRed's Day-Care hands a Pokémon back at full
 *   health, because a Pokémon in a box has no HP to keep. Here healing is Nurse
 *   Joy's and costs raid time (`recovery.ts`), and a free bed would price her
 *   at nothing - so it comes back as hurt as it was left, the way a level is
 *   never a revive. That is also why he **will not take a fainted one**, which
 *   FireRed does: there it comes back revived, here it would be raised fainted.
 * - **It is free.** FireRed charges ₽100 and ₽100 a level gained. Money here
 *   is loot and Bill is where it goes, and a fee is a second sink the trader's
 *   faucet was not measured against, so that is left for another change.
 */

/** The share of a level each ended raid pays a Pokémon in the Day-Care. */
export const DAY_CARE_SHARE_OF_A_LEVEL = 1 / 2;

const MAX_LEVEL = 100;

/** What he says, from FireRed's Route 5 Day-Care. */
export const DAY_CARE_MAN = 'DAY-CARE MAN';
export const DAY_CARE_NAME = 'DAY-CARE';

/**
 * How many raids this save has seen end: every raid deployed, less the one
 * still being played if there is one. A raid that is abandoned is settled as
 * lost (`run/raidInFlight.ts`), so every raid deployed is one that ends.
 */
export function raidsCompleted(progress: RaidProgress, raidInFlight?: RaidInFlight | null): number {
  return Math.max(0, raidsDeployed(progress) - (raidInFlight ? 1 : 0));
}

/** The level a total of experience reaches on a growth curve. */
function levelAt(experience: number, pokemon: Pokemon): number {
  let level = pokemon.level;
  while (level < MAX_LEVEL && experience >= experienceForLevel(level + 1, pokemon.base.growthRate)) {
    level += 1;
  }
  return level;
}

/** Experience one ended raid pays a Pokémon that has this much and is at this level. */
function oneRaidsPay(level: number, pokemon: Pokemon): number {
  if (level >= MAX_LEVEL) {
    return 0;
  }
  const curve = pokemon.base.growthRate;
  const span = experienceForLevel(level + 1, curve) - experienceForLevel(level, curve);
  // Rounded up, so two raids from the start of a level always make the next.
  return Math.ceil(span * DAY_CARE_SHARE_OF_A_LEVEL);
}

/**
 * The experience a stay of `raids` ended raids has earned a Pokémon. Each raid
 * pays a share of the level the Pokémon has reached by then, so a long stay is
 * paid level by level, never in one sum at the level it was left at. It stops at
 * level 100, as FireRed's does.
 */
export function dayCareExperience(pokemon: Pokemon, raids: number): number {
  let experience = pokemon.experience;
  const ceiling = experienceForLevel(MAX_LEVEL, pokemon.base.growthRate);
  for (let raid = 0; raid < Math.max(0, Math.floor(raids)); raid += 1) {
    const pay = oneRaidsPay(levelAt(experience, pokemon), pokemon);
    if (pay === 0) break;
    experience = Math.min(ceiling, experience + pay);
  }
  return Math.max(0, experience - pokemon.experience);
}

/** How a stay stands today, without touching the Pokémon in it. */
export interface DayCareReport {
  readonly stay: DayCareStay;
  /** Raids that have ended since it was left. */
  readonly raids: number;
  readonly levelLeft: number;
  readonly levelNow: number;
  readonly experience: number;
}

export function dayCareReport(stay: DayCareStay, raidsNow: number): DayCareReport {
  const raids = Math.max(0, raidsNow - stay.leftAfterRaids);
  const experience = dayCareExperience(stay.pokemon, raids);
  return {
    stay,
    raids,
    levelLeft: stay.pokemon.level,
    levelNow: levelAt(stay.pokemon.experience + experience, stay.pokemon),
    experience,
  };
}

/**
 * The Pokémon as it would come back today: a copy, grown by every raid in the
 * report, so a screen can show its level, stats and moves without anything
 * being taken back.
 */
export function grownToday(report: DayCareReport): Pokemon {
  const copy = copyPokemon(report.stay.pokemon);
  copy.gainExperience(report.experience, { evolve: false });
  return copy;
}

/**
 * His refusal of a fainted Pokémon, which is this game's own rule. FireRed
 * takes one (it asks only that somebody else in the party can still battle)
 * and its `BoxMonToMon` hands it back at full HP with its status cleared, so
 * there it is a revive. Here he heals nothing - healing is Nurse Joy's and
 * costs raid time - so a fainted Pokémon would sit in his pen fainted, growing
 * levels and learning moves it could not have fought for, and come home still
 * needing her. He sends it to her first instead.
 */
function fainted(name: string): string {
  return `Your ${name} has fainted! I can raise it, but I can’t revive it. Take it to the Pokémon Center first.`;
}

/** Why a Pokémon cannot be left, in his words, or undefined when it can. */
export function dayCareRefusal(stash: Stash, pokemonId: string): string | undefined {
  const stored = stash.listPokemon();
  if (stash.dayCare() !== null) {
    return `I’m already raising your ${stash.dayCare()!.pokemon.name}.`;
  }
  if (!stored.some((entry) => entry.id === pokemonId)) {
    return 'That Pokémon isn’t at base.';
  }
  if (stored.length === 1) {
    return 'Oh? You only have one Pokémon.';
  }
  const chosen = stored.find((entry) => entry.id === pokemonId)!.pokemon;
  if (chosen.isFainted) {
    return fainted(chosen.name);
  }
  if (!stored.some((entry) => entry.id !== pokemonId && !entry.pokemon.isFainted)) {
    return 'If you leave me that Pokémon, what will you battle with?';
  }
  return undefined;
}

/** FireRed's lines for leaving one. */
export function leftLines(name: string): readonly string[] {
  return [`Fine, I’ll look after your ${name} for a while.`, 'Come see me in a while.'];
}

/** What he says of a stay when the player comes to see him, before it is taken back. */
export function checkOnLines(report: DayCareReport): readonly string[] {
  const name = report.stay.pokemon.name;
  const grown = report.levelNow - report.levelLeft;
  if (grown <= 0) {
    return [`You’re back already? Your ${name} needs to spend some more time with me.`];
  }
  return [
    `Your ${name} has grown a lot. Yes, quite a lot, I’d say.`,
    `Let me see… By level, it’s grown by ${grown}. Aren’t I great?`,
  ];
}

/** FireRed's lines for taking one back. */
export function takenBackLines(name: string): readonly string[] {
  return ['Thank you! Here’s your Pokémon.', `You got ${name} back from the DAY-CARE MAN.`];
}

/**
 * Takes the Pokémon back into the vault grown by every raid that ended while
 * it was away, and says what it grew by. Null when nobody is in his care.
 */
export function takeBack(
  stash: Stash,
  raidsNow: number,
): { readonly id: string; readonly pokemon: Pokemon; readonly grown: ExperienceResult } | null {
  const stay = stash.dayCare();
  if (!stay) {
    return null;
  }
  const report = dayCareReport(stay, raidsNow);
  // FireRed's `ApplyDaycareExperience` increments the level and learns moves,
  // and never evolves.
  const grown = stay.pokemon.gainExperience(report.experience, { evolve: false });
  const id = stash.takeBackFromDayCare();
  return id === null ? null : { id, pokemon: stay.pokemon, grown };
}

/** The second line of his caption in the yard: who he is raising, or what he does. */
export function dayCareStatusLine(stash: Stash, raidsNow: number): string {
  const stay = stash.dayCare();
  if (!stay) {
    return 'Raises one while you raid';
  }
  return `Raising ${stay.pokemon.name} · Lv ${dayCareReport(stay, raidsNow).levelNow}`;
}
