import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import type { BasePropName } from './baseTileset';

/**
 * What a built upgrade looks like standing in the yard.
 *
 * This is the whole point of walking the base rather than reading a lobby. A
 * rung of Brock's ladder used to be a row that went grey once it was paid for: you
 * spent four banked Pokemon on Secure locker II and a number in a container got
 * bigger. Here it is a door in the quay wall that was not there last raid. A
 * player who has built six rungs walks out of Oak's Lab past six things they
 * earned, and the base they own is a place rather than a list.
 *
 * It is authored exactly as a worked landmark is (`world/workedLandmarks.ts`)
 * and for the same reason: **nothing is stored**. A fixture stands because
 * `raidProgress.workshopUpgrades` names its rung, so the base and the ladder
 * can never disagree and no save version moves. `baseMap.test.ts` holds that
 * every rung has one *and* that building it changes the ground - a rung with
 * no fixture is a purchase that changes nothing you can see, which is the
 * thing this exists to end.
 *
 * Where each one stands is chosen for the same reason a shop window is: it has
 * to be seen from where the player spends their time. Everything here is
 * visible from the middle of the yard - the mast and the light on the skyline
 * either side, the bay and the ward in the clearings behind the keepers, the lockers along the
 * quay the salvage lands on.
 */

export interface BaseProp {
  readonly name: BasePropName;
  /** Top-left of the prop, as `MapSketch.plant` takes it. */
  readonly x: number;
  readonly y: number;
}

export interface BaseFixture {
  /** The rung of Brock's ladder that builds it. */
  readonly upgradeId: string;
  /** What the caption over it says, in the base's own words. */
  readonly name: string;
  /** The line under it: what it is, not what the rung cost. */
  readonly note: string;
  /** What is planted, in drawing order. */
  readonly props: readonly BaseProp[];
  /**
   * The one tile of it the player can face and read. The caption is seated
   * around the whole of what is planted (`BaseScene.createCaptions`), but a
   * landmark still needs one tile to be spoken to at, the way a sign does.
   */
  readonly at: GridPosition;
}

export const BASE_FIXTURES: readonly BaseFixture[] = [
  {
    upgradeId: 'radio-mast',
    name: 'THE MAST',
    note: 'The aerial that hears the hunter',
    // Seven tiles of stone rising out of the wood beside THE BOLTHOLE: the
    // tallest thing in the base, for the rung most players build first. A first
    // purchase should change the skyline, and the house the player lives in is
    // where they will see it from.
    props: [{ name: 'tower', x: 41, y: 4 }],
    at: { x: 42, y: 10 },
  },
  {
    upgradeId: 'beacon',
    name: 'THE HARBOUR LIGHT',
    note: 'It burns for your landing',
    // On the quay at the harbour mouth, which is where a light goes, and in
    // full view of the jetty the player comes home to.
    props: [{ name: 'roundhouse', x: 3, y: 15 }],
    at: { x: 5, y: 17 },
  },
  {
    upgradeId: 'secure-locker-1',
    name: 'THE STRONGROOM',
    note: 'What a lost raid cannot take',
    props: [{ name: 'cellarDoors', x: 24, y: 17 }],
    at: { x: 24, y: 17 },
  },
  {
    upgradeId: 'secure-locker-2',
    name: 'THE SECOND LOCKER',
    note: 'A second door, and room behind it',
    props: [{ name: 'cellarDoors', x: 27, y: 17 }],
    at: { x: 27, y: 17 },
  },
  {
    upgradeId: 'recovery-bay-1',
    name: 'THE HEALING MACHINE',
    note: 'Beds under a canopy, beside the Center',
    // A white canopy on legs. The sheet's awning is a flat yellow board and
    // read as a sign rather than as somewhere to be treated.
    props: [{ name: 'marketStall', x: 22, y: 4 }],
    at: { x: 23, y: 6 },
  },
  {
    upgradeId: 'recovery-bay-2',
    name: 'THE SECOND MACHINE',
    note: 'Twice the beds, half the wait',
    props: [{ name: 'hut', x: 26, y: 4 }],
    at: { x: 26, y: 6 },
  },
  {
    upgradeId: 'quarantine-ward',
    name: 'THE WARD',
    note: 'Set apart, and free of the clock',
    // At the end of the clearing behind the lab and the workshop, with its colours
    // flying: that is what a quarantine ward is, and it is why it does not
    // stand beside the bay.
    props: [
      { name: 'hut', x: 29, y: 4 },
      { name: 'bannerPair', x: 31, y: 4 },
    ],
    at: { x: 29, y: 6 },
  },
];

/** Every fixture whose rung has been built, in ladder order. */
export function standingFixtures(builtUpgradeIds: readonly string[]): readonly BaseFixture[] {
  return WORKSHOP_UPGRADES.flatMap((upgrade) =>
    builtUpgradeIds.includes(upgrade.id)
      ? BASE_FIXTURES.filter((fixture) => fixture.upgradeId === upgrade.id)
      : [],
  );
}
