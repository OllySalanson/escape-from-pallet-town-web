/**
 * What the player is told before an authored trainer fight starts.
 *
 * An authored trainer is the one battle in the game with no exit: the wild
 * escape is a roll that always terminates, the hunter's is priced in raid time
 * and never fails, and a trainer has neither. That commitment is the design
 * rather than a fault - a trainer is the toll on a fast route, and a toll you
 * can decline after seeing the bill is not a toll at all, which would make the
 * checkpoint free and the long way round pointless. `docs/product-direction.md`
 * rules out unavoidable punishment, not commitment: what it asks for is that
 * threats are "readable and counterable" and that the player gets "choices that
 * let players assess danger and respond before committing".
 *
 * So the fault is the silence, and it is answered on both roads into the fight,
 * in the same words, from here:
 *
 * - walking into a watch (`./trainerSight`) is answered by the caption over the
 *   shaded ground, which is read before the step that starts the fight. It is a
 *   caption and not a prompt on purpose: a prompt there arrives after the step
 *   the watch charges for, and declining it would refund the toll.
 * - speaking to a trainer is answered by a prompt, because pressing the interact
 *   key is the whole of the player's commitment and nothing on screen says what
 *   it will cost. The safe option is the one selected, so the fight is never
 *   started by the same key that opened the conversation.
 */

/** The fact both surfaces are built on, in one place so they cannot drift. */
export const TRAINER_COMMITMENT_LINE = 'A trainer battle cannot be fled.';

/** The same fact, shortened to a caption line over the ground it applies to. */
export const TRAINER_WATCH_WARNING = 'CANNOT BE FLED';

export const CHALLENGE_OPTION = 'CHALLENGE';
export const BACK_AWAY_OPTION = 'BACK AWAY';

export interface TrainerChallengePrompt {
  readonly lines: readonly string[];
  readonly options: readonly string[];
  /** Which option is highlighted first. Always the one that costs nothing. */
  readonly selected: number;
}

/** The prompt shown when the player presses the interact key at a trainer. */
export function trainerChallengePrompt(trainerName: string): TrainerChallengePrompt {
  return {
    lines: [`${trainerName} will take your challenge.`, TRAINER_COMMITMENT_LINE],
    options: [CHALLENGE_OPTION, BACK_AWAY_OPTION],
    selected: 1,
  };
}

/** Said when the player declines, so backing off is visibly a decision taken. */
export function trainerDeclinedMessage(trainerName: string): string {
  return `You keep your distance from ${trainerName}.`;
}

/**
 * The caption over a watching trainer: who they are, where they are looking,
 * and what walking into it commits the player to.
 */
export function trainerWatchCaption(trainerName: string, bearing: string): string {
  return `${trainerName}\nWATCHING ${bearing}\n${TRAINER_WATCH_WARNING}`;
}
