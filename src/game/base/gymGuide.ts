import { buildContractBoard } from '../hub/contractBoard';
import { errandPlace, errandThing, errandsInHand, type ErrandProgress } from '../hub/errands';
import type { StandingBoardProgress } from '../objectives/standingBoard';

/**
 * What the Gym Guide at the Raid Arena's door says: the day's work, in his own
 * words, a box a line.
 *
 * Every raid starts through that door, so he is the one person a player passes
 * on the way out, and what they are going out for is the thing worth hearing
 * there. The contract board is work from nobody, read off a list in Oak's Lab;
 * here somebody says it - the job on the board, what it pays, and whose
 * favours are in hand and where their things lie - in the ordinary dialogue
 * box, as the captain asked a quest to be ("a normal Pokémon chat"). It is
 * said, never offered: a contract is taken by choosing where to drop in, and
 * nothing here changes what the board asks or pays (`contractBoard.ts` is the
 * one source of every word about a contract).
 *
 * Phaser-free, so `gymGuide.test.ts` holds the words to the board and the
 * favours they describe.
 */
export function gymGuideLines(progress: StandingBoardProgress & ErrandProgress): readonly string[] {
  const board = buildContractBoard(progress);
  const [job] = board.rows;
  const work = job
    ? [
        `Yo, champ! Today's job: ${job.name.toUpperCase()}.`,
        sentence(job.description),
        ...(job.asks ? [sentence(job.asks)] : []),
        sentence(`It pays ${job.reward}`),
        ...(board.rows.length > 1 ? [`There is more on the board in OAK'S LAB.`] : []),
      ]
    : ['Yo, champ! Nothing on the board today. Raid for what the vale holds!'];
  const favours = errandsInHand(progress).map(
    (errand) => `${errand.name} is waiting on ${errandThing(errand).toUpperCase()}, from ${errandPlace(errand)}.`,
  );
  return [...work, ...favours, 'Kit up through that door!'];
}

/** A line as a sentence: a full stop on the end, unless it has one. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
