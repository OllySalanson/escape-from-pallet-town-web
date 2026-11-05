/**
 * Greystone Vale in quarters: the open middle of the vale, and the parts of it a
 * gym holds shut until its leader is beaten (the captain, 5 Nov 2026: gyms as
 * access levels into different quarters, each with a team that beats it).
 *
 * The gate itself is nothing new. A gym leader is a boss in `trainers.ts`, the
 * two crossings into the quarter are that boss's `boss` doors in the stitched
 * file (`tools/mapcraft/worlds/greystoneVale/plan.ts` marks them `held`), and
 * beating the leader opens both for good, in the raid that won it, exactly as
 * every keeper's doors open. The badge is the same fact read the other way
 * (`base/badgeCase.ts`). What this file adds is the quarter as a *place*: which
 * landings lie inside it, so a save is not offered a way in past the gym
 * (`availableInsertionIds`), which keepers stand inside it, so their doors are
 * only ever asked about once the gym's are open (`gateStatesToVerify`), and the
 * words the game says about it.
 *
 * The plan for all four quarters is firstmate's `eptw-gyms-loadouts-plan`; this
 * is its first step, Misty holding the Coast. Koga's Marsh and Lt. Surge's
 * Station are rows still to come, in that order.
 *
 * Deliberately free of imports: the landing filter, the gates and the badge
 * case all read it, and it must sit at the bottom of the graph they share.
 */

export interface ValeGym {
  /** The leader's boss id (`trainers.ts`), which is what the save keeps. */
  readonly bossId: string;
  /** The leader, as dialogue names them. */
  readonly leader: string;
  /** The badge they give, which is the same fact as their doors being open. */
  readonly badge: string;
  /** The gym building, as the stitched file names it. */
  readonly building: string;
}

export interface ValeQuarter {
  readonly id: string;
  /** What the quarter is called, in capitals as the map says it. */
  readonly name: string;
  /** Who holds it shut, if anybody: the open vale has no gym. */
  readonly gym?: ValeGym;
  /** Its districts, by the names the stitched file gives them. */
  readonly districts: readonly string[];
  /** The landings inside it, which a save is offered only once its gym is beaten. */
  readonly landings: readonly string[];
  /**
   * Keepers whose doors stand inside the quarter. A door behind the gym's is only
   * ever walked to once the gym's are open, so the maps are asked about it in
   * that state rather than alone (`gates.ts`, `gateStatesToVerify`).
   */
  readonly keepersInside?: readonly string[];
  /** What the quarter throws at a team, said plainly, a line each. */
  readonly threat: readonly string[];
}

/** Misty's boss id: her gym, her two doors and her badge are all this one word. */
export const MISTY_BOSS_ID = 'vale-gym-misty';

export const VALE_QUARTERS: readonly ValeQuarter[] = [
  {
    id: 'the-vale',
    name: 'THE VALE',
    districts: [
      'MILLBROOK',
      'HIGH MOOR',
      'REEDMERE',
      'THE CROSSING',
      'GULL STRAND',
      'GREYSTONE PEAKS',
      'PINE HOLLOW',
      'TANGLEWOOD',
      'ORCHARD TERRACES',
    ],
    landings: [
      'greystone-vale',
      'greystone-vale-moor-top',
      'greystone-vale-the-quarry',
      'greystone-vale-stepping-stones',
      'greystone-vale-the-strand',
      'greystone-vale-farmhouse',
    ],
    threat: [],
  },
  {
    id: 'the-coast',
    name: 'THE COAST',
    gym: {
      bossId: MISTY_BOSS_ID,
      leader: 'Misty',
      badge: 'CASCADE BADGE',
      building: 'Cerulean Gym',
    },
    districts: ['THE SUNKEN QUARTER', "SMUGGLERS' COVE"],
    landings: ['greystone-vale-old-quay', 'greystone-vale-cove-steps'],
    keepersInside: ['vale-quay-keeper'],
    threat: [
      'Misty makes it rain, and in the rain her swimmers move first.',
      'Water hits half as hard again in the rain, and Fire half as hard.',
      'Electric and Grass hit Water twice as hard. A Psyduck stills the weather.',
    ],
  },
];

/** The quarter a landing lies in, if it lies in one. */
export function quarterOfLanding(insertionId: string): ValeQuarter | undefined {
  return VALE_QUARTERS.find((quarter) => quarter.landings.includes(insertionId));
}

/**
 * Whether a save that has opened these doors (`openedDoors` in `gates.ts`: the
 * bosses it beat, and the explorer run's every door) may land here: anywhere
 * outside a gym's quarter, and inside one once its leader's doors are open. A
 * landing held back stays in the save's `reachedInsertions`, so it comes back by
 * itself with the badge.
 */
export function isLandingOpen(insertionId: string, opened: readonly string[]): boolean {
  const gym = quarterOfLanding(insertionId)?.gym;
  return gym === undefined || opened.includes(gym.bossId);
}

/** The gym whose doors this keeper stands behind, if any (`keepersInside`). */
export function gymInFrontOf(bossId: string): string | undefined {
  return VALE_QUARTERS.find((quarter) => quarter.keepersInside?.includes(bossId))?.gym?.bossId;
}

/** The quarter a gym leader holds. */
export function quarterHeldBy(bossId: string): ValeQuarter | undefined {
  return VALE_QUARTERS.find((quarter) => quarter.gym?.bossId === bossId);
}

/**
 * Landings a save has reached that its badges do not open yet, for the one line
 * of news at the harbour (`hub/firstWords.ts`): an old save that walked to the
 * Old Quay before Misty held it.
 */
export function landingsHeldBack(progress: {
  readonly reachedInsertions: readonly string[];
  readonly unlockedInsertions?: readonly string[];
  readonly defeatedBosses: readonly string[];
  readonly openedGates?: readonly string[];
}): readonly string[] {
  const opened = [...progress.defeatedBosses, ...(progress.openedGates ?? [])];
  return [...new Set([...progress.reachedInsertions, ...(progress.unlockedInsertions ?? [])])].filter(
    (id) => !isLandingOpen(id, opened),
  );
}
