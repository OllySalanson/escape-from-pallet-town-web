import { buildContractBoard } from '../hub/contractBoard';
import type { ErrandProgress } from '../hub/errands';
import { boardContracts, standingJobFits } from '../objectives/standingBoard';
import { RAID_DURATION_MS } from '../run/raidClock';
import { FIRST_WORDS, hasHeard, type FirstWordsId } from '../hub/firstWords';
import { honoursWorn, type HonourId } from '../look/gymHonours';
import type { StandingBoardProgress } from '../objectives/standingBoard';
import { nextGym } from '../world/valeQuarters';

/**
 * What the Gym Guide at the Raid Arena's door says: the day's work, in his own
 * words, a box a line.
 *
 * Every raid starts through that door, so he is the one person a player passes
 * on the way out, and what they are going out for is the thing worth hearing
 * there. The contract board is work from nobody, read off a list in Oak's Lab;
 * here somebody says it - the job on the board that fits one raid, and what
 * it pays, in one line, then the next gym - in the ordinary dialogue box, as
 * the captain asked a quest to be ("a normal Pokémon chat"). It is
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
  progress: StandingBoardProgress &
    ErrandProgress & { readonly gymsMet?: readonly string[]; readonly firstWordsHeard?: readonly string[]; readonly honoursHidden?: readonly string[] },
): readonly string[] {
  // A gym honour he has not seen yet comes first: he cannot help himself.
  const noticed = gymGuideHonourNews(progress);
  // Told what a survey stake is, the board deals survey jobs from this line on
  // (`standingBoard.ts`), so the job he names next is the board as it now stands.
  const explains = gymGuideHasStakesNews(progress);
  const told = explains ? { ...progress, firstWordsHeard: [...(progress.firstWordsHeard ?? []), 'stakes'] } : progress;
  const board = buildContractBoard(told);
  // A job he names is one a raid can do: he named LINE SURVEY while the rim
  // said it needed 6:39 of a 5:00 clock (the harbour critic tour, 26 Nov 2026).
  const contracts = boardContracts(told);
  const job = board.rows.find((row) => {
    const contract = contracts.find((each) => each.id === row.contractId);
    return !contract || standingJobFits(contract, told, RAID_DURATION_MS);
  });
  const greeting = explains || noticed ? '' : 'Yo, champ! ';
  // One line, the job and its pay: he read out the board, every favour in
  // hand and the gym, seventeen boxes before his question (the critic tour).
  // The rest is on Oak's board, and a favour is its giver's to remind.
  const work = job
    ? [`${greeting}Today's job: ${job.name.toUpperCase()}. It pays ${job.reward.replace(/[.!?]$/, '')}.`]
    : [`${greeting}Nothing on the board fits one raid today. Raid for what the vale holds!`];
  return [...(noticed ? FIRST_WORDS[noticed].lines : []), ...(explains ? FIRST_WORDS.stakes.lines : []), ...work, ...gymAdvice(told)];
}

/**
 * Whether the Gym Guide has survey stakes to explain: once a raid has been gone
 * on (a first raid has no job, `hub/firstRaid.ts`) and until he has said it.
 * It is also when he wears the harbour's "!" (`BaseScene.markHarbourGivers`),
 * so the survey jobs it opens are never missed for want of a word with him.
 */
export function gymGuideHasStakesNews(progress: {
  readonly firstWordsHeard?: readonly string[];
  readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>>;
}): boolean {
  return raidsGoneOn(progress) > 0 && !hasHeard(progress.firstWordsHeard, 'stakes');
}

/** The words the Gym Guide says on first seeing each gym honour (`look/gymHonours.ts`). */
export const HONOUR_NOTICED: Readonly<Record<HonourId, FirstWordsId>> = { cascade: 'cascadeWorn', soul: 'soulWorn' };

/**
 * A gym honour the player wears that the Gym Guide has not yet seen on them,
 * as the words he says about it: the first, in the order they are won. While
 * there is one he wears the harbour's "!" (`BaseScene.markHarbourGivers`), so a
 * player home in a new honour is drawn over to hear it noticed. One taken off
 * is not seen, and is noticed the day it is put back on.
 */
export function gymGuideHonourNews(progress: {
  readonly defeatedBosses: readonly string[];
  readonly honoursHidden?: readonly string[];
  readonly firstWordsHeard?: readonly string[];
}): FirstWordsId | undefined {
  return honoursWorn(progress)
    .map((id) => HONOUR_NOTICED[id])
    .find((id) => !hasHeard(progress.firstWordsHeard, id));
}

function raidsGoneOn(progress: { readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>> }): number {
  return Object.values(progress.raidRecord ?? {}).reduce((sum, record) => sum + record.deployed, 0);
}

/**
 * The next gym and the types that do well there, in FireRed's Gym Guide's own
 * manner - the facts, never the answer - once a raid has been gone on (a first
 * raid has nothing on its way that the fall does not need, `hub/firstRaid.ts`).
 * Once the leader has been met, he says they will spar in the hall for nothing
 * - THE RAID ARENA's, by name: "the hall" alone sent a
 * first-time friend looking round the harbour for a hall (the overnight
 * retest, 23 Nov 2026).
 */
export function gymAdvice(progress: {
  readonly defeatedBosses: readonly string[];
  readonly gymsMet?: readonly string[];
  readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>>;
}): readonly string[] {
  const raids = raidsGoneOn(progress);
  const gym = nextGym(progress.defeatedBosses);
  if (!gym || raids === 0) {
    return [];
  }
  const met = progress.gymsMet?.includes(gym.bossId) ?? false;
  return [
    ...gym.advice,
    met
      ? // "Practise", the word the far floor's question uses: three words for one free fight read as three things (the critic tour).
        `You've met ${gym.leader.toUpperCase()}. Practise for free in THE RAID ARENA's hall!`
      : `Meet ${gym.leader.toUpperCase()} once, then practise for free in THE RAID ARENA's hall.`,
  ];
}

