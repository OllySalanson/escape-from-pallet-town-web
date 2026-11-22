import type { Direction } from '../movement/gridMovement';

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

/** One Pokemon as the prompt counts it: only its level and whether it can fight. */
export interface ChallengeSide {
  readonly level: number;
  readonly isFainted: boolean;
}

/**
 * What the player can see of the fight before they commit to it: the trainer's
 * party and how many it fields at once, and the player's own.
 */
export interface ChallengeOdds {
  readonly trainerParty: readonly ChallengeSide[];
  /** `TrainerBattle.unitCount`: absent is one. */
  readonly trainerUnitCount?: number;
  readonly playerParty: readonly ChallengeSide[];
}

/**
 * The line that says how strong the trainer is, in the words the rim already
 * uses for a hunter (`hunterThreat.ts`: 'lead Lv 9 to your Lv 7').
 *
 * The prompt used to name the trainer and the fact that the fight could not be
 * fled, and nothing about what was in it, so a newcomer's first CHALLENGE was a
 * level-5 starter against two Pokemon two levels up, and a gym leader's was a
 * level-9 Charmander walked into a double battle at level 15 (the 22 Nov AI
 * playtest lost a pack that way a dozen times). Whether it is two at once is
 * decided the way `createTrainerBattleState` decides it: the trainer asks for
 * two and has two, and the player has two able to fight.
 */
export function challengeOddsLine(trainerName: string, odds: ChallengeOdds): string {
  const lead = odds.trainerParty[0];
  const playerLead = odds.playerParty.find((pokemon) => !pokemon.isFainted);
  const count = odds.trainerParty.length;
  const strength = lead
    ? `${count} Pokémon, lead Lv ${lead.level}${playerLead ? ` to your Lv ${playerLead.level}` : ''}`
    : `${count} Pokémon`;
  return `${trainerName}: ${strength}.`;
}

/** Whether this fight will be two a side, by the engine's own rule. */
export function challengeIsDouble(odds: ChallengeOdds): boolean {
  const ableOnPlayerSide = odds.playerParty.filter((pokemon) => !pokemon.isFainted).length;
  return (odds.trainerUnitCount ?? 1) > 1 && odds.trainerParty.length > 1 && ableOnPlayerSide > 1;
}

/**
 * Said in place of the commitment line when the fight will be two a side. It
 * says who goes out, because 'Two on two' left a level-2 catch walked out
 * beside the starter and knocked out on turn one (AI playtest, 22 Nov 2026):
 * the answer, a team of one, is the player's to take.
 */
export const TRAINER_DOUBLE_COMMITMENT_LINE = 'Your first two go out together. It cannot be fled.';

/** The prompt shown when the player presses the interact key at a trainer. */
export function trainerChallengePrompt(
  trainerName: string,
  odds?: ChallengeOdds,
): TrainerChallengePrompt {
  return {
    lines: odds
      ? [
          challengeOddsLine(trainerName, odds),
          challengeIsDouble(odds) ? TRAINER_DOUBLE_COMMITMENT_LINE : TRAINER_COMMITMENT_LINE,
        ]
      : [`${trainerName} will take your challenge.`, TRAINER_COMMITMENT_LINE],
    options: [CHALLENGE_OPTION, BACK_AWAY_OPTION],
    selected: 1,
  };
}

/** Said when the player declines, so backing off is visibly a decision taken. */
export function trainerDeclinedMessage(trainerName: string): string {
  return `You keep your distance from ${trainerName}.`;
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
