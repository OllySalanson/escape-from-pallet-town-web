import { buildContractBoard } from '../hub/contractBoard';
import { errandPlace, errandThing, errandsInHand, type ErrandProgress } from '../hub/errands';
import type { StandingBoardProgress } from '../objectives/standingBoard';
import { nextGym } from '../world/valeQuarters';

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
/** Asked after his day's work, of anybody who has seen the trailer he closes. */
export const GYM_GUIDE_REEL_QUESTION = 'WATCH THE REEL AGAIN?';

export function gymGuideLines(
  progress: StandingBoardProgress & ErrandProgress & { readonly gymsMet?: readonly string[] },
): readonly string[] {
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
  return [...work, ...favours, ...gymAdvice(progress), 'Kit up through that door!'];
}

/**
 * The next gym and the types that do well there, in FireRed's Gym Guide's own
 * manner - the facts, never the answer - once a raid has been gone on (a first
 * raid has nothing on its way that the fall does not need, `hub/firstRaid.ts`).
 * Once the leader has been met, he says they will spar in the hall for nothing.
 */
export function gymAdvice(progress: {
  readonly defeatedBosses: readonly string[];
  readonly gymsMet?: readonly string[];
  readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>>;
}): readonly string[] {
  const raids = Object.values(progress.raidRecord ?? {}).reduce((sum, record) => sum + record.deployed, 0);
  const gym = nextGym(progress.defeatedBosses);
  if (!gym || raids === 0) {
    return [];
  }
  const met = progress.gymsMet?.includes(gym.bossId) ?? false;
  return [
    ...gym.advice,
    met
      ? `You've met ${gym.leader.toUpperCase()}. Now you can spar in the hall for free!`
      : `Meet ${gym.leader.toUpperCase()} once, and you can spar in the hall for free.`,
  ];
}

/** A line as a sentence: a full stop on the end, unless it has one. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
