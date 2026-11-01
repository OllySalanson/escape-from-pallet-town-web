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
