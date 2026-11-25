import { itemAmountsFor } from '../items';

/**
 * A new save's way into its first raid, which is the one thing it has come for.
 *
 * Everything a raid can be got ready with is still in THE RAID ARENA, and all of
 * it has a default good enough to go on: so until a save has been on a raid,
 * nothing stands between the title and the fall that the fall does not need. No
 * name asked for, no trailer, no favours, no job on the board, no words at the
 * rail and no card to read. All of that is one raid later, when somebody knows
 * what it is about. What it does add is a fright: its stake is money, and a hunter
 * comes for it at forty seconds (`RunPlan.stagedChase`).
 *
 * It is read off what the save has done rather than kept, so a save written before
 * any of this, which has raids behind it or a contract banked, is simply past it.
 */
export function isFirstRaid(progress: {
  readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>>;
  readonly completedContracts?: readonly string[];
  readonly standingContractsBanked?: number;
}): boolean {
  const raids = Object.values(progress.raidRecord ?? {}).reduce((total, record) => total + record.deployed, 0);
  return raids === 0 && (progress.completedContracts?.length ?? 0) === 0 && (progress.standingContractsBanked ?? 0) === 0;
}

/**
 * Whether SPACE at the rail goes straight over, with no card: the first raid, with
 * one way in to choose from and nothing wrong with the raid being got ready. A
 * card that offered no choice and said nothing that could change the answer was a
 * press spent on reading what had just been decided.
 */
export function goesStraightOver(firstRaid: boolean, waysIn: number, notReady: string | undefined, inARoom: boolean): boolean {
  return firstRaid && waysIn <= 1 && notReady === undefined && !inARoom;
}

/**
 * What a new save is told as its first raid lands, in the dialogue box the
 * raids after it open with their job (`WorldScene.showFirstDeploymentBriefing`).
 * Nothing stands between the title and the fall, so this is the first time the
 * game says what a raid is: the 22 Nov 2026 AI playtest's newcomers jumped
 * without being told the job, the clock or the risk, which a first-time player
 * needs most (tester 3's confusing 9). Two short boxes, no more.
 */
export const FIRST_RAID_BRIEFING: readonly string[] = [
  'Your first raid! Follow the gold arrow, grab what you can, and get out before the clock hits 0:00.',
  'Get out and you keep it all. Faint, or run out of time, and the pack is lost. And keep moving: a hunter is coming.',
];

/**
 * Asked at the rail before a new save's first jump, which goes straight over
 * with no card (`goesStraightOver`). The overnight critic walked past three
 * objects called BENCH, RACK and LOCKER that nothing explained, and one SPACE
 * threw him into the valley with no confirmation and, as far as he knew,
 * nothing packed (problem 5, 25 Nov 2026). One FireRed question at the moment
 * it matters says what the three did, by what they hold, and asks; the cursor
 * starts on JUMP IN, as FireRed's starts on YES, because raid one has nothing
 * to lose and a NOT YET default would teach a newcomer to hesitate.
 */
export function firstJumpQuestion(packed: {
  readonly team: readonly string[];
  readonly carried: readonly { readonly itemId: string; readonly quantity: number }[];
  readonly locked: readonly { readonly itemId: string; readonly quantity: number }[];
}): string {
  const team = packed.team.map((name) => name.toUpperCase()).join(' and ');
  const carried = packed.carried.length > 0 ? `, ${itemAmountsFor(packed.carried).toUpperCase()} off the RACK` : '';
  const locked = packed.locked.length > 0 ? `, ${itemAmountsFor(packed.locked).toUpperCase()} safe in the LOCKER` : '';
  return `${team} off the BENCH${carried}${locked}. Jump in?`;
}

/**
 * The longest the question may be and still sit in the box's two rows: the
 * starter's kit is held to it (`firstRaid.test.ts`), because a third row was
 * drawn below the box's frame.
 */
export const FIRST_JUMP_QUESTION_LONGEST = 92;

/** The two answers at the rail, JUMP IN first. */
export const FIRST_JUMP_ANSWERS = ['JUMP IN', 'NOT YET'] as const;
