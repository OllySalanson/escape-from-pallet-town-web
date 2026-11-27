import type { Direction } from '../movement/gridMovement';
import { trainerChallengeLine } from '../pokemon/battle/battleFlow';

/**
 * What the player is asked before an authored trainer fight starts.
 *
 * An authored trainer is the one battle in the game with no exit: the wild
 * escape is a roll that always terminates, the hunter's is priced in raid time
 * and never fails, and a trainer has neither. That commitment is the design
 * rather than a fault - a trainer is the toll on a fast route.
 *
 * Walking into a watch (`./trainerSight`) is answered by the caption over the
 * shaded ground, read before the step that starts the fight. Speaking to a
 * trainer is answered by a question, because pressing the interact key is
 * the whole of the player's commitment: the safe option is the one selected,
 * so the fight is never started by the same key that opened the conversation.
 *
 * The question is FireRed's own words and nothing else. It read "SCOUT TAM: 2
 * Pokémon, lead Lv 3 to your Lv 12." and "A trainer battle cannot be fled.",
 * a stat card and a rule FireRed never shows (the Millbrook critic, 26 Nov
 * 2026, under the captain's rule that a message is one the original games
 * would show). How strong a trainer is shows on the field, once it is taken.
 */

/** The same fact, as a caption line over the ground a watch covers. */
export const TRAINER_WATCH_WARNING = 'CANNOT BE FLED';

export const CHALLENGE_OPTION = 'CHALLENGE';
export const BACK_AWAY_OPTION = 'BACK AWAY';

export interface TrainerChallengePrompt {
  readonly lines: readonly string[];
  readonly options: readonly string[];
  /** Which option is highlighted first. Always the one that costs nothing. */
  readonly selected: number;
}

/**
 * Which of a trainer's intro lines they say themselves: the first with a small
 * letter in it, since a line all in capitals is told ("MAYA HAS THE ROAD IN
 * SIGHT.") rather than spoken. -1 when none is.
 */
export function spokenLineIndex(introLines: readonly string[]): number {
  return introLines.findIndex((line) => line !== line.toUpperCase());
}

/**
 * The prompt shown when the player presses the interact key at a trainer: the
 * trainer's own first line, as FireRed's trainer says it when spoken to, and
 * the choice. Taken, the rest of what they say follows and the fight opens on
 * FireRed's "X would like to battle!"; a trainer with nothing to say asks in
 * those words.
 */
export function trainerChallengePrompt(trainerName: string, firstLine?: string): TrainerChallengePrompt {
  return {
    lines: [firstLine ? `${trainerName}: ${firstLine}` : trainerChallengeLine(trainerName)],
    options: [CHALLENGE_OPTION, BACK_AWAY_OPTION],
    selected: 1,
  };
}

/**
 * The way a watching trainer faces, as a whole word. It was a lone letter
 * (`WATCHING W`), which reads as a word cut off rather than as a heading; the
 * whole word costs no width, because `FACING NORTH` is still narrower in the
 * game's face than the `CANNOT BE FLED` under it.
 */
const FACING_WORD: Readonly<Record<Direction, string>> = {
  up: 'NORTH',
  down: 'SOUTH',
  left: 'WEST',
  right: 'EAST',
};

/**
 * The caption over a watching trainer: who they are, which way they face, and
 * what walking into it commits the player to.
 */
export function trainerWatchCaption(trainerName: string, facing: Direction): string {
  return `${trainerName}\nFACING ${FACING_WORD[facing]}\n${TRAINER_WATCH_WARNING}`;
}
