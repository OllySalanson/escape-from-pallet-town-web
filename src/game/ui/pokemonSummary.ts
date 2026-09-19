import { MoveCategory, experienceForLevel } from '../pokemon';
import type { MoveBase } from '../pokemon';

/**
 * The two questions a Pokemon's summary screen answers, worked out once.
 *
 * Neither could be asked anywhere in the game: a level was a number with
 * nothing behind it, and a move was a name with a PP count. Both are pure
 * functions of what the Pokemon already carries - level is a function of
 * experience through `experienceForLevel`, and everything a move does is on its
 * `MoveBase` - so this module derives them rather than storing anything, and is
 * Phaser-free so the wording is held in `pokemonSummary.test.ts` instead of
 * being eyeballed on a screen.
 *
 * It is deliberately not `describeMoveGuidance` in `battlePresentation.ts`.
 * That answers "what will this move do to the Pokemon in front of me" and is
 * about a fight in progress; this answers "what is this move", which is a
 * different question and is asked at base, where there is nothing in front of
 * anybody.
 */

/** The width of an experience bar's fill, in game pixels. Matches `HP_BAR_WIDTH`. */
export const XP_BAR_WIDTH = 48;

export interface ExperienceProgress {
  readonly level: number;
  /** Experience earned since this level began. */
  readonly intoLevel: number;
  /** What this level costs from its own start to the next one. */
  readonly levelSpan: number;
  /** What is still to earn. Zero at the top of the curve. */
  readonly toNextLevel: number;
  /** How far along the level the Pokemon is, 0 to 1. */
  readonly fraction: number;
  /** True where there is no next level to walk towards. */
  readonly atTopOfCurve: boolean;
}

/**
 * `experienceForLevel` clamps at the top of the curve, so a level whose next
 * level costs no more than it does is the last one. Nothing here needs to know
 * what that level is, which keeps the cap a fact of the curve rather than a
 * second copy of it.
 */
export function experienceProgress(pokemon: {
  readonly level: number;
  readonly experience: number;
}): ExperienceProgress {
  const start = experienceForLevel(pokemon.level);
  const next = experienceForLevel(pokemon.level + 1);
  const levelSpan = Math.max(0, next - start);
  if (levelSpan === 0) {
    return {
      level: pokemon.level,
      intoLevel: 0,
      levelSpan: 0,
      toNextLevel: 0,
      fraction: 1,
      atTopOfCurve: true,
    };
  }
  const intoLevel = Math.max(0, Math.min(levelSpan, pokemon.experience - start));
  return {
    level: pokemon.level,
    intoLevel,
    levelSpan,
    toNextLevel: levelSpan - intoLevel,
    fraction: intoLevel / levelSpan,
    atTopOfCurve: false,
  };
}

/** Thousands separated, because five-figure experience totals start at level 22. */
export const formatExperience = (value: number): string =>
  Math.round(value).toLocaleString('en-GB');

/** What is left of this level, in the words the screen says it in. */
export function experienceLine(progress: ExperienceProgress): string {
  if (progress.atTopOfCurve) {
    return 'Fully grown.';
  }
  return `${formatExperience(progress.toNextLevel)} XP to Lv ${progress.level + 1}`;
}

/** The fill of an experience bar, in whole game pixels. */
export function experienceBarFill(progress: ExperienceProgress): number {
  if (progress.fraction <= 0) {
    return 0;
  }
  // Anything earned at all shows a pixel: a bar reading empty after a win is
  // the screen disagreeing with the line beside it.
  return Math.max(1, Math.min(XP_BAR_WIDTH, Math.round(progress.fraction * XP_BAR_WIDTH)));
}

export interface MoveSummary {
  readonly name: string;
  readonly type: string;
  /** Type, category and the numbers, on one line. */
  readonly detail: string;
  /** What the move does, in the words authored on the move itself. */
  readonly description: string;
  readonly pp: number;
  readonly maxPp: number;
}

/**
 * One move as the summary screen lists it.
 *
 * Accuracy is said for every move, including the ones that never miss: a player
 * who is told 100 on three moves and nothing on the fourth learns what the
 * fourth one costs them, and a blank there reads as missing data.
 */
export function moveSummary(move: {
  readonly base: MoveBase;
  readonly pp: number;
}): MoveSummary {
  const { base } = move;
  const power =
    base.category === MoveCategory.Status || base.power <= 0
      ? 'NO DAMAGE'
      : `POWER ${base.power}`;
  return {
    name: base.name,
    type: base.type,
    detail: `${base.type.toUpperCase()} · ${base.category.toUpperCase()} · ${power} · ACC ${base.accuracy} · PP ${move.pp}/${base.pp}`,
    description: base.description || 'No description on record.',
    pp: move.pp,
    maxPp: base.pp,
  };
}

/** `3 of 4 known`, for the moves window's note. */
export function moveSlotNote(known: number, slots = 4): string {
  return `${known} of ${slots} known`;
}
