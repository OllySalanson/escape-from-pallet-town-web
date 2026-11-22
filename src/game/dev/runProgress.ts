import { isFirstJobsBanked, NEAR_JOBS } from '../objectives/standingBoard';
import { CHART_PIECES, type TreasureHunt } from '../treasure/treasureMap';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from '../world/valeQuarters';

/**
 * How far through a full run a save is: the finish line an AI playtester
 * plays to, and what its dashboard draws as a bar.
 *
 * A finished run is the captain's (19 Nov 2026): **the authored contract chain
 * banked, both gym leaders beaten, and the treasure map done.** Each of those
 * is a `finish` milestone; the others are the steps on the way, so a bar moves
 * before the first of the big three falls.
 *
 * The contract chain, read honestly: `isChainFinished` is the game's own
 * question, and while only Greystone Vale is in play every authored contract
 * is on a retired map and put away, so it says yes on a new save. What a new
 * save is actually dealt on the vale is the standing board, whose first
 * `NEAR_JOBS` jobs are its authored-feeling opening (`standingBoard.ts`), so
 * the chain counts as banked once the game's chain is finished *and* those
 * are banked. Bring a map back and its contracts join the chain unasked.
 *
 * Read off the raw stored save rather than through `SaveManager`, because it
 * is asked on every `describe()` and needs four fields, not a rebuilt team.
 */

export type MilestoneId =
  | 'first-contract'
  | 'contract-chain'
  | 'misty'
  | 'koga'
  | 'chart-room'
  | 'chart-whole'
  | 'treasure';

export interface Milestone {
  readonly id: MilestoneId;
  /** In plain words, for the dashboard. */
  readonly label: string;
  readonly done: boolean;
  /** One of the captain's finish-line milestones. */
  readonly finish: boolean;
  /** Where a counted milestone stands, when it is counted: `2 of 4`. */
  readonly count?: { readonly have: number; readonly need: number };
}

export interface RunProgress {
  readonly milestones: readonly Milestone[];
  readonly done: number;
  readonly total: number;
  /** Every finish milestone done: the run is over. */
  readonly finished: boolean;
  readonly raids: { readonly contractsBanked: number; readonly bossesBeaten: readonly string[] };
}

/** The part of a save's `raidProgress` the finish line reads. */
export interface ProgressFields {
  readonly firstContractExtracted?: boolean;
  readonly completedContracts?: readonly string[];
  readonly standingContractsBanked?: number;
  readonly defeatedBosses?: readonly string[];
  readonly treasureHunt?: Partial<TreasureHunt>;
}

export function runProgress(fields: ProgressFields): RunProgress {
  const completed = fields.completedContracts ?? [];
  const standing = fields.standingContractsBanked ?? 0;
  const bosses = fields.defeatedBosses ?? [];
  const hunt = fields.treasureHunt ?? {};
  const pinned = CHART_PIECES.filter((piece) => (hunt.pinned ?? []).includes(piece.id)).length;
  const milestones: Milestone[] = [
    {
      id: 'first-contract',
      label: 'First contract out',
      done: fields.firstContractExtracted === true || completed.length + standing > 0,
      finish: false,
    },
    {
      id: 'contract-chain',
      label: 'Contract chain banked',
      done: isFirstJobsBanked({ completedContracts: completed, standingContractsBanked: standing }),
      finish: true,
      count: { have: Math.min(standing, NEAR_JOBS), need: NEAR_JOBS },
    },
    { id: 'misty', label: 'Misty beaten', done: bosses.includes(MISTY_BOSS_ID), finish: true },
    { id: 'koga', label: 'Koga beaten', done: bosses.includes(KOGA_BOSS_ID), finish: true },
    { id: 'chart-room', label: 'Chart room open', done: hunt.roomOpen === true, finish: false },
    {
      id: 'chart-whole',
      label: 'Treasure map whole',
      done: pinned === CHART_PIECES.length,
      finish: false,
      count: { have: pinned, need: CHART_PIECES.length },
    },
    { id: 'treasure', label: 'Treasure chest opened', done: hunt.chestOpened === true, finish: true },
  ];
  const done = milestones.filter((milestone) => milestone.done).length;
  return {
    milestones,
    done,
    total: milestones.length,
    finished: milestones.every((milestone) => !milestone.finish || milestone.done),
    raids: { contractsBanked: completed.length + standing, bossesBeaten: [...bosses] },
  };
}

/** The finish line for the stored save text, or null when there is no readable save. */
export function readRunProgress(saveText: string | null): RunProgress | null {
  if (!saveText) {
    return null;
  }
  try {
    const save = JSON.parse(saveText) as { readonly raidProgress?: ProgressFields } | null;
    return save?.raidProgress ? runProgress(save.raidProgress) : null;
  } catch {
    return null;
  }
}
