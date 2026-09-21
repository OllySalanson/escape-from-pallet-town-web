import type { ExtractionPoint } from './extractionPoints';
import { WORLD_POIS, type WorldPoi } from './pois';
import type { WorldMapId } from '../worldMap';

/**
 * A landmark the world keeps worked, because a contract banked it for good.
 *
 * A contract already unlocks insertions and pays a reward, and until now the
 * map it was banked on said nothing about it: you wound the Sluice Wheel,
 * carried the ledger out through the culvert it drains, and next raid the wheel
 * was standing there again with the culvert sealed behind it. This is the map
 * remembering - the sluice stays pegged, the relay stays on, the tower stays
 * lit, and the cache you emptied stays empty.
 *
 * # Derived, never stored
 *
 * The tutorial this game grew out of answers this with a blob per object: every
 * savable thing in a scene carries a stable id and writes its own state into
 * the save file. That is the opposite of the discipline the rest of this game
 * is built on - `secureItemStackLimit()`, `contractUnlockedInsertionIds()`,
 * `getWorldMap()` and Bill's standing are all *derived* from the lists
 * `raidProgress` already keeps, which is why a save can never disagree with any
 * of them. Nothing here is stored either: a row below is a landmark and the
 * contract that finishes it, and `raidProgress.completedContracts` is the whole
 * of the state. A player who banks the cordon ledger on a browser that cannot
 * write a save still walks out through an open culvert, for exactly as long as
 * the contract is banked - which is the same rule a boss-held gate follows.
 *
 * What genuinely could not be derived this way would be a landmark whose state
 * is not the consequence of anything the save records - a cache emptied on a
 * whim, a lamp lit for its own sake. There is none, and there should not be:
 * a change to the map that nothing in the player's record explains is a change
 * they cannot reason about. If one is ever wanted, it needs its own list in
 * `raidProgress` - a list of ids, like every other, never a blob per object.
 *
 * # Never decoration
 *
 * Every row here changes a route and a risk, because a landmark that seals an
 * exit is the only kind of landmark this game has: worked for good, the exit it
 * seals is open from the first second of every later raid, which is a way home
 * the hunter cannot take away. Oak's field station is the one that also costs
 * something - its cache is a standing supply of two Poke Balls and a Potion,
 * and a station you have finished with does not restock itself - so the mark it
 * leaves is a trade rather than a gift.
 */
export interface WorkedLandmark {
  /** The landmark (`./pois.ts`). One landmark, one contract: this is the key. */
  readonly poiId: string;
  /** The contract whose banking finishes it, by `RaidContract.id`. */
  readonly contractId: string;
  /**
   * What the landmark says under its own name once it is finished, in the
   * capitals every caption uses. It replaces the line that used to say what
   * working it would open.
   */
  readonly standing: string;
  /** The sentence the result screen adds to the reward that bought it. */
  readonly note: string;
}

export const WORKED_LANDMARKS: readonly WorkedLandmark[] = [
  {
    // The teaching contract, on the starting map: the first thing a player ever
    // banks is also the first time the world keeps something. The ranger whose
    // kit you carried out of the reeds is back at his station, so the forecast
    // is on and the Radio Exit out west in the marsh stands open - a second
    // always-open door on the home bank, in the corner the reeds detour ends in.
    poiId: 'floodplain-ranger-radio',
    contractId: 'recover-lost-field-kit',
    standing: 'RELAY LIVE\nRADIO EXIT: OPEN',
    note: 'The ranger is back at his station: the RADIO EXIT is open from the first second of every Floodplain raid from now on.',
  },
  {
    // The one that costs something. The station is a sealed exit *and* a cache,
    // and a station you have finished with is both things finished: the relay
    // stays on, and the two Poke Balls and the Potion that used to be at its
    // door every single raid are not there any more. Route 1 trades a standing
    // supply for a standing way home.
    poiId: 'oak-field-station-relay',
    contractId: 'survey-the-braid',
    standing: 'RELAY ON, CACHE EMPTY\nSTATION RELAY: OPEN',
    note: "Oak's field station is signed off: the STATION RELAY is open from the first second of every Route 1 raid from now on, and the cache at its door stays empty.",
  },
  {
    // The contract *was* winding this hatch and carrying the ledger out through
    // what it drains, so leaving it wound is only the map agreeing with what
    // the player already did. The West Culvert is at the far south-west and the
    // wheel at the far south-east, so this is the errand, not the reward.
    poiId: 'pallet-sluice-wheel',
    contractId: 'cordon-ledger',
    standing: 'PEGGED SHUT\nWEST CULVERT: OPEN',
    note: 'The sluice hatch stays pegged: the WEST CULVERT is open from the first second of every Pallet Town raid from now on.',
  },
  {
    // The forest's own briefing already tells you to light the tower on the way
    // in because the Tower Steps are the near way out. Resupply the warden and
    // he keeps it lit, which is what turns the forest from a map you leave the
    // long way round into one you leave over the ridge.
    poiId: 'forest-fire-tower',
    contractId: 'wardens-resupply',
    standing: 'LIT\nTOWER STEPS: OPEN',
    note: 'The warden keeps the fire tower lit: the TOWER STEPS are open from the first second of every Viridian Forest raid from now on.',
  },
];

function poiOf(work: WorkedLandmark): WorldPoi | undefined {
  return WORLD_POIS.find((poi) => poi.id === work.poiId);
}

/** Whether this contract has been banked, which is the whole of the state. */
export function isWorkDone(
  work: WorkedLandmark,
  completedContractIds: readonly string[],
): boolean {
  return completedContractIds.includes(work.contractId);
}

/** The finished landmarks on one map, in authored order. */
export function workedLandmarksOn(
  mapId: WorldMapId,
  completedContractIds: readonly string[],
): readonly WorkedLandmark[] {
  return WORKED_LANDMARKS.filter(
    (work) => poiOf(work)?.mapId === mapId && isWorkDone(work, completedContractIds),
  );
}

/** The work one contract leaves behind, for the line its reward is printed on. */
export function workLeftByContract(contractId: string): WorkedLandmark | undefined {
  return WORKED_LANDMARKS.find((work) => work.contractId === contractId);
}

/**
 * Whether this landmark is finished with. A finished landmark still stands -
 * the map is how a player learns they did that - but it hands out nothing and
 * cannot be worked again.
 */
export function isLandmarkWorked(
  poiId: string,
  completedContractIds: readonly string[],
): WorkedLandmark | undefined {
  return WORKED_LANDMARKS.find(
    (work) => work.poiId === poiId && isWorkDone(work, completedContractIds),
  );
}

/**
 * The exits a finished landmark holds open for good, by label.
 *
 * Derived from the landmark rather than authored twice: an exit is opened by
 * the landmark that names it (`WorldPoi.unlockedExtractionLabel`), so the exit
 * a finished landmark leaves open cannot drift from the exit working it opens.
 */
export function exitsOpenForGood(
  mapId: WorldMapId,
  completedContractIds: readonly string[],
): readonly string[] {
  return workedLandmarksOn(mapId, completedContractIds)
    .map((work) => poiOf(work))
    .filter((poi): poi is WorldPoi => poi?.effect === 'unlock-extraction')
    .map((poi) => poi.unlockedExtractionLabel)
    .filter((label): label is string => label !== undefined);
}

/**
 * Every authored exit, with the ones a finished landmark holds open rewritten
 * as open from the first second.
 *
 * A `poi-activated` requirement is the only kind this touches, and it is
 * replaced with `always` rather than pre-activating the landmark: the raid's
 * own `activatedPoiIds` is what the player did *this* raid, and a door that is
 * open because of a raid three weeks ago is not the same fact.
 */
export function withWorkedExitsOpen(
  points: readonly ExtractionPoint[],
  completedContractIds: readonly string[],
): readonly ExtractionPoint[] {
  return points.map((point) => {
    if (
      point.requirement?.kind !== 'poi-activated' ||
      !isLandmarkWorked(point.requirement.poiId, completedContractIds)
    ) {
      return point;
    }
    return { ...point, unlockAtMs: 0, requirement: { kind: 'always' as const } };
  });
}

/** What a finished landmark says on the map, under its own name. */
export function workedLandmarkCaption(poi: WorldPoi, work: WorkedLandmark): string {
  return `${poi.label}\n${work.standing}`;
}
