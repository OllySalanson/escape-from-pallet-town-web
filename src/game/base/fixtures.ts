import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_TILESET, type BasePropName } from './baseTileset';

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
 * and for the same reason: a fixture stands because
 * `raidProgress.workshopUpgrades` names its rung, so the base and the ladder
 * can never disagree. Only where it stands is stored, as which of its
 * `places` the player chose (`raidProgress.fixturePlaces`). `baseMap.test.ts` holds that
 * every rung has one *and* that building it changes the ground - a rung with
 * no fixture is a purchase that changes nothing you can see, which is the
 * thing this exists to end.
 *
 * Where each one stands is chosen for the same reason a shop window is: it has
 * to be seen from where the player spends their time. Everything here is
 * visible from the middle of the yard - the mast and the light on the skyline
 * either side, the bay and the ward in the clearing behind the keepers (a row
 * deep enough that a lane two wide runs in front of them), and the lockers in
 * HARBOUR SQUARE's paving either side of the fountain, off the way down to the
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
  /**
   * Where it may stand, chosen when it is built and changed for free after
   * (`BaseScene`'s placing, `SaveManager.placeFixture`): the top-left of the
   * whole of it, the first being where it is authored above. Every place is
   * held by the yard's tests with every one of them filled at once
   * (`everyPlaceFilled`), and the regulars walk round all of them, so no
   * choice a player makes can wall anything off or stand on anybody's way.
   */
  readonly places: readonly FixturePlace[];
}

/** One place a build may stand, and what the yard calls it. */
export interface FixturePlace {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

export const BASE_FIXTURES: readonly BaseFixture[] = [
  {
    upgradeId: 'radio-mast',
    name: 'THE MAST',
    note: 'The aerial that hears the hunter',
    // A red and white lattice aerial with a dish and a light on its tip, on
    // the lawn beside THE BOLTHOLE: the house the player lives in is where they
    // will see it from. It was the CC0 sheet's stone tower, seven tiles of grey
    // that read as a silo (the owner, 26 Nov 2026: "why is it just a big
    // tower?"); it is drawn for what it is now (`scripts/draw-promenade.mjs`),
    // three tiles tall, on the same foot.
    // It stands a tile clear of the house and a tile clear of the Day-Care's
    // fence: against the house's wall the two read as one building.
    props: [{ name: 'radioMast', x: 43, y: 8 }],
    at: { x: 43, y: 10 },
    places: [
      { name: 'BY THE BOLTHOLE', x: 43, y: 8 },
      { name: 'BESIDE THE BATTLE ARENA', x: 65, y: 4 },
      { name: 'BESIDE THE POKéMON CENTER', x: 22, y: 8 },
    ],
  },
  {
    upgradeId: 'beacon',
    name: 'THE HARBOUR LIGHT',
    note: 'It burns for your landing',
    // At the head of the breakwater, which is the harbour mouth and where a
    // light goes: the Seagallop comes in past it, and at night its beam
    // sweeps the bay (`harbourNight.ts`). A red and white lighthouse
    // (`scripts/draw-promenade.mjs`), where the CC0 sheet's grey roundhouse
    // stood.
    props: [{ name: 'harbourLight', x: 39, y: 28 }],
    at: { x: 40, y: 31 },
    places: [
      { name: 'AT THE BREAKWATER HEAD', x: 39, y: 28 },
      { name: 'AT THE BREAKWATER ELBOW', x: 57, y: 26 },
      { name: 'BY THE LONG PIER', x: 25, y: 24 },
    ],
  },
  {
    upgradeId: 'secure-locker-1',
    name: 'THE STRONGROOM',
    note: 'What a lost raid cannot take',
    props: [{ name: 'cellarDoors', x: 23, y: 15 }],
    at: { x: 23, y: 15 },
    places: [
      { name: 'IN HARBOUR SQUARE', x: 23, y: 15 },
      { name: 'ABOVE THE COVE', x: 53, y: 14 },
    ],
  },
  {
    upgradeId: 'secure-locker-2',
    name: 'THE SECOND LOCKER',
    note: 'A second door, and room behind it',
    props: [{ name: 'cellarDoors', x: 32, y: 15 }],
    at: { x: 32, y: 15 },
    places: [
      { name: 'IN HARBOUR SQUARE', x: 32, y: 15 },
      { name: 'ON THE QUAY', x: 46, y: 17 },
    ],
  },
  {
    upgradeId: 'recovery-bay-1',
    name: 'THE HEALING MACHINE',
    note: 'Beds under a canopy, beside the Center',
    // A white canopy on legs. The sheet's awning is a flat yellow board and
    // read as a sign rather than as somewhere to be treated.
    props: [{ name: 'marketStall', x: 22, y: 3 }],
    at: { x: 23, y: 5 },
    places: [
      { name: 'IN THE CLEARING', x: 22, y: 3 },
      { name: 'BESIDE THE DAY-CARE', x: 54, y: 6 },
    ],
  },
  {
    upgradeId: 'recovery-bay-2',
    name: 'THE SECOND MACHINE',
    note: 'Twice the beds, half the wait',
    // A treatment tent, pitched beside the first machine's canopy. It was the
    // CC0 sheet's hut, the same hut as the ward's, and the two read as kennels.
    props: [{ name: 'treatmentTent', x: 26, y: 3 }],
    at: { x: 26, y: 5 },
    places: [
      { name: 'IN THE CLEARING', x: 26, y: 3 },
      { name: "BESIDE BROCK'S WORKSHOP", x: 34, y: 8 },
    ],
  },
  {
    upgradeId: 'quarantine-ward',
    name: 'THE WARD',
    note: 'Set apart, and free of the clock',
    // At the end of the clearing behind the lab and the workshop, with its colours
    // flying: that is what a quarantine ward is, and it is why it does not
    // stand beside the bay.
    // A white cabin of its own with a red cross over the door
    // (`scripts/draw-promenade.mjs`).
    props: [
      { name: 'wardCabin', x: 29, y: 3 },
      { name: 'bannerPair', x: 31, y: 3 },
    ],
    at: { x: 29, y: 5 },
    places: [
      // Nowhere else in the yard takes a cabin and its colours and leaves every
      // way two abreast: it stays set apart where it is.
      { name: 'IN THE CLEARING', x: 29, y: 3 },
    ],
  },
];

/** Which place each build stands in, by rung id; a build not named stands in its first. */
export type FixturePlaces = Readonly<Record<string, number>>;

/** The tiles the whole of a fixture covers, from the top-left of its props. */
function originOf(fixture: BaseFixture): GridPosition {
  return { x: Math.min(...fixture.props.map((prop) => prop.x)), y: Math.min(...fixture.props.map((prop) => prop.y)) };
}

/** The place a save has chosen for this build: its first unless a known one is named. */
export function placeIndex(fixture: BaseFixture, places: FixturePlaces = {}): number {
  const index = places[fixture.upgradeId];
  return index !== undefined && Number.isInteger(index) && index >= 0 && index < fixture.places.length ? index : 0;
}

/** A fixture moved, whole, to one of its places. */
export function fixtureAt(fixture: BaseFixture, index: number): BaseFixture {
  const place = fixture.places[index] ?? fixture.places[0];
  const origin = originOf(fixture);
  const dx = place.x - origin.x;
  const dy = place.y - origin.y;
  if (dx === 0 && dy === 0) {
    return fixture;
  }
  return {
    ...fixture,
    props: fixture.props.map((prop) => ({ ...prop, x: prop.x + dx, y: prop.y + dy })),
    at: { x: fixture.at.x + dx, y: fixture.at.y + dy },
  };
}

/** Whether a build has more than one place, so can be put somewhere else. */
export function canBeMoved(upgradeId: string): boolean {
  return (BASE_FIXTURES.find((fixture) => fixture.upgradeId === upgradeId)?.places.length ?? 0) > 1;
}

/** Every tile a fixture's props stand on. */
export function fixtureTiles(fixture: BaseFixture): readonly GridPosition[] {
  return fixture.props.flatMap((prop) => {
    const { width, height } = BASE_TILESET.props[prop.name];
    return Array.from({ length: width * height }, (_tile, index) => ({ x: prop.x + (index % width), y: prop.y + Math.floor(index / width) }));
  });
}

/** Every fixture whose rung has been built, in ladder order, each in the place the save chose. */
export function standingFixtures(builtUpgradeIds: readonly string[], places: FixturePlaces = {}): readonly BaseFixture[] {
  return WORKSHOP_UPGRADES.flatMap((upgrade) =>
    builtUpgradeIds.includes(upgrade.id)
      ? BASE_FIXTURES.filter((fixture) => fixture.upgradeId === upgrade.id).map((fixture) => fixtureAt(fixture, placeIndex(fixture, places)))
      : [],
  );
}

/**
 * Every build in every one of its places at once: the most the yard could ever
 * have standing in it. Its walks are what the yard's tests hold and what the
 * regulars plan on, so whichever place a player picks is already allowed for.
 */
export function everyPlaceFilled(): readonly BaseFixture[] {
  return BASE_FIXTURES.flatMap((fixture) => fixture.places.map((_place, index) => fixtureAt(fixture, index)));
}
