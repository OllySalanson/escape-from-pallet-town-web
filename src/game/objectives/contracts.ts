import type { ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import type { RunSnapshot } from '../run/RunManager';
import type { WorldMapId } from '../worldMap';

/**
 * The raid contracts, and everything that makes one different from a waypoint.
 *
 * A contract is not "an extra place to walk to". Every one of these changes the
 * shape of the raid it is carried on - where you go, what you pack, or which
 * exit will actually bank it - and the fields below exist only because a
 * specific contract could not be expressed without them:
 *
 * - `markers` is a list because the braid survey is three stops, not one.
 * - `requiredExitLabel` exists because the cordon ledger only banks through a
 *   sealed exit at the far end of the map, which turns the always-open gate you
 *   walk past into a temptation rather than an escape.
 * - `carriedIn` on a marker exists because the warden's resupply is a delivery:
 *   the supplies come out of your own pack and are gone when you hand them over.
 *
 * Contracts unlock in a chain (`unlockedBy`) so the board is never empty after
 * the first one is banked, and each pays once, permanently, in access,
 * capability or supplies - never in currency, because the game has none.
 */

export interface ContractStack {
  readonly itemId: ItemId;
  readonly quantity: number;
}

/** One thing a contract asks the player to stand on. */
export interface ContractMarker {
  /** Recorded on the run when the player steps here. Unique across contracts. */
  readonly id: string;
  readonly position: GridPosition;
  /** Drawn over the marker in the world, so a stop never has to be guessed. */
  readonly label: string;
  /** The same stop in one short line, for the raid HUD's objective chip. */
  readonly cue: string;
  /** Which of the two authored objective icons this stop draws as. */
  readonly icon: 'field-kit' | 'supply-cache';
  /** Supplies taken out of the bag here. The stop cannot be made without them. */
  readonly carriedIn?: readonly ContractStack[];
  readonly collectedMessage: string;
  /** Shown when the player arrives without what the drop needs. */
  readonly shortMessage?: string;
}

/**
 * What banking a contract pays, once and for good.
 *
 * `summary` is the sentence the lobby, the field guide and the extraction report
 * all print, so the promise cannot drift between the three places it is made.
 */
export interface ContractReward {
  readonly summary: string;
  /** Added to the stash the first time the contract is banked. */
  readonly items: readonly ContractStack[];
  /** Insertions this contract opens for good. */
  readonly unlockedInsertionIds?: readonly string[];
  /** Adds one protected item stack to the secure slot, for every later raid. */
  readonly secureItemStack?: boolean;
  /** Raises the kit every recovery path tops the stash back up to. */
  readonly restockFloor?: Readonly<Record<string, number>>;
}

export interface RaidContract {
  readonly id: string;
  /** The contract's name, as the lobby lists it. */
  readonly name: string;
  /** The objective sentence, as the field guide and the report print it. */
  readonly description: string;
  readonly mapId: WorldMapId;
  readonly markers: readonly ContractMarker[];
  /** When set, only this exit banks the contract. Every exit still ends the raid. */
  readonly requiredExitLabel?: string;
  /** Contract that must already be banked before this one is offered. */
  readonly unlockedBy?: string;
  readonly reward: ContractReward;
  /** What the raid actually asks of the player, in the field guide's own voice. */
  readonly briefing: readonly string[];
  /** The one line shown on the map as the raid opens. */
  readonly deploymentBriefing: string;
}

export const FIRST_CONTRACT_ID = 'recover-lost-field-kit';

/**
 * Floodplain Relay. The teaching contract: one marker, three reed shelves deep,
 * and any exit banks it. Every other contract is a departure from this one.
 */
const RECOVER_LOST_FIELD_KIT: RaidContract = {
  id: FIRST_CONTRACT_ID,
  name: 'Lost field kit',
  description: 'Recover the lost field kit at the Floodplain Relay',
  mapId: 'floodplain-relay',
  markers: [
    {
      id: 'lost-field-kit',
      position: { x: 11, y: 23 },
      label: 'LOST FIELD KIT',
      cue: 'LOST KIT',
      icon: 'field-kit',
      collectedMessage: 'Recovered the lost field kit! Extract to secure it.',
    },
  ],
  reward: {
    summary:
      'Three more insertions are permanently unlocked, and a Super Potion is waiting at base.',
    items: [{ itemId: 'super-potion', quantity: 1 }],
    unlockedInsertionIds: ['town-square', 'route-1', 'viridian-forest'],
  },
  briefing: [
    'Two ways down: the central road is fast and open, but Maya watches its checkpoint and fights whoever walks it; the west reeds are slower, cost encounters, and rejoin the road above and below her.',
    'Step onto the lost field kit marker to retrieve it.',
  ],
  deploymentBriefing:
    'ARROW KEYS / WASD: move. The field kit is SOUTH - fast road or west reeds. Press O for the FIELD GUIDE.',
};

/**
 * Route 1. Three stakes, one on each road and one inside the middle field, so
 * the braid cannot be run down one side: the survey is a zigzag and every
 * crossing of it is tall grass, which is where Route 1 keeps its fights.
 *
 * It is also the contract that keeps you in past the hunter. Collecting all
 * three and reaching a gate is about ninety steps against the fifty-four a
 * straight run down one road costs.
 */
const SURVEY_THE_BRAID: RaidContract = {
  id: 'survey-the-braid',
  name: 'Braid survey',
  description: 'Read all three survey stakes on Route 1',
  mapId: 'route-1',
  unlockedBy: FIRST_CONTRACT_ID,
  markers: [
    {
      id: 'braid-stake-west',
      position: { x: 7, y: 18 },
      label: 'SURVEY STAKE\nWEST ROAD',
      cue: 'WEST STAKE',
      icon: 'field-kit',
      collectedMessage: 'West road logged. Two stakes left.',
    },
    {
      id: 'braid-stake-field',
      position: { x: 16, y: 17 },
      label: 'SURVEY STAKE\nMIDDLE FIELD',
      cue: 'FIELD STAKE',
      icon: 'field-kit',
      collectedMessage: 'Middle field logged. The braid reads clean from here.',
    },
    {
      id: 'braid-stake-east',
      position: { x: 25, y: 23 },
      label: 'SURVEY STAKE\nEAST ROAD',
      cue: 'EAST STAKE',
      icon: 'field-kit',
      collectedMessage: 'East road logged.',
    },
  ],
  reward: {
    summary:
      'The Cordon Ledger and the Warden’s Resupply are added to the contract board, and two Great Balls are waiting at base.',
    items: [{ itemId: 'great-ball', quantity: 2 }],
  },
  briefing: [
    'Three stakes: west road, middle field, east road. No single road passes two of them.',
    'The middle field is fenced. Its north doors open off the second cross-link; its south door and the third cross-link are behind Maya, and she only steps aside once you have beaten her.',
    'Every cross-link is tall grass, so each crossing of the braid is a fight you are choosing to take.',
  ],
  deploymentBriefing:
    'Three survey stakes: west road, middle field, east road. No one road passes two. Press O for the FIELD GUIDE.',
};

/**
 * Pallet Town. The ledger sits deep in the Allotments, and the only exit that
 * banks it is the West Culvert - sealed until the Sluice Wheel is wound, and
 * the wheel is at the opposite end of the south bank.
 *
 * So the map's always-open South Gate stops being an escape and becomes the
 * decision: thirty-five steps to bank the raid, eighty-three to bank the
 * contract, with the hunter already up. Both orders of the two errands cost
 * within two steps of each other, so there is no route to be told.
 */
const CORDON_LEDGER: RaidContract = {
  id: 'cordon-ledger',
  name: 'Cordon ledger',
  description: 'Carry the cordon ledger out of Pallet Town through the West Culvert',
  mapId: 'pallet-town',
  unlockedBy: 'survey-the-braid',
  requiredExitLabel: 'WEST CULVERT',
  markers: [
    {
      id: 'cordon-ledger',
      position: { x: 13, y: 24 },
      label: 'CORDON LEDGER',
      cue: 'LEDGER',
      icon: 'field-kit',
      collectedMessage: 'Ledger recovered. Only the West Culvert will take it.',
    },
  ],
  reward: {
    summary: 'The secure slot is rebuilt: one more item stack comes home from every raid.',
    items: [],
    secureItemStack: true,
  },
  briefing: [
    'The ledger is in the Allotments, in the tall grass strips.',
    'Only the West Culvert banks it, and the culvert stays sealed until the Sluice Wheel on the far east of the south bank is wound.',
    'The South Gate will still take you home. It will not take the ledger.',
  ],
  deploymentBriefing:
    'Ledger in the Allotments, Sluice Wheel in the east, out through the West Culvert. Press O for the FIELD GUIDE.',
};

/**
 * Viridian Forest. A delivery, so this one is decided at the loadout screen:
 * two Potions have to leave base in your pack and be handed over at East Rise,
 * which is forty-five steps of tall grass from the landing.
 *
 * The pressure is not the clock, it is your health bar. Every step in is an
 * encounter roll, and the cure for that is in the pack you promised away.
 */
const WARDENS_RESUPPLY: RaidContract = {
  id: 'wardens-resupply',
  name: 'Warden’s resupply',
  description: 'Deliver 2 Potions to the warden’s cache at East Rise',
  mapId: 'viridian-forest',
  unlockedBy: 'survey-the-braid',
  markers: [
    {
      id: 'warden-cache-drop',
      position: { x: 28, y: 20 },
      label: 'WARDEN’S CACHE\nNEEDS 2 POTIONS',
      cue: 'CACHE DROP',
      icon: 'supply-cache',
      carriedIn: [{ itemId: 'potion', quantity: 2 }],
      collectedMessage: 'Two Potions into the warden’s cache. Now get out of the forest.',
      shortMessage: 'The warden’s cache is empty. It needs 2 Potions out of your own pack.',
    },
  ],
  reward: {
    summary:
      'The warden keeps your kit stocked: base now restocks two Great Balls and a Super Potion on top of the standing minimum, and a set is waiting there now.',
    items: [
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ],
    restockFloor: { 'great-ball': 2, 'super-potion': 1 },
  },
  briefing: [
    'Pack the two Potions at base. Nothing in this forest replaces them.',
    'The cache is at East Rise, in the south-east. Every trail there is tall grass.',
    'Light the Fire Tower on the way in and the Tower Steps open twenty steps from the cache; skip it and the only near exit is The Clearing.',
  ],
  deploymentBriefing:
    'Two Potions to the warden’s cache at East Rise, south-east. Every trail is grass. Press O for the FIELD GUIDE.',
};

export const RAID_CONTRACTS: readonly RaidContract[] = [
  RECOVER_LOST_FIELD_KIT,
  SURVEY_THE_BRAID,
  CORDON_LEDGER,
  WARDENS_RESUPPLY,
];

/** The teaching contract, named because several systems treat it specially. */
export const FIRST_CONTRACT = RECOVER_LOST_FIELD_KIT;

export function getContract(id: string | undefined): RaidContract | undefined {
  return id === undefined ? undefined : RAID_CONTRACTS.find((contract) => contract.id === id);
}

/**
 * The contracts on the board: every one whose prerequisite is banked and which
 * is not banked itself. A banked contract never comes back, so the board is a
 * queue of things still worth a raid rather than a repeatable chore list.
 */
export function availableContracts(completedContractIds: readonly string[]): readonly RaidContract[] {
  const completed = new Set(completedContractIds);
  return RAID_CONTRACTS.filter(
    (contract) =>
      !completed.has(contract.id) &&
      (contract.unlockedBy === undefined || completed.has(contract.unlockedBy)),
  );
}

/**
 * The contract a raid inserting here would carry. A contract belongs to its map,
 * so choosing where to drop in is choosing which contract to take: there is no
 * separate acceptance step to get out of step with the insertion.
 */
export function contractForMap(
  mapId: WorldMapId,
  completedContractIds: readonly string[],
): RaidContract | undefined {
  return availableContracts(completedContractIds).find((contract) => contract.mapId === mapId);
}

/** Every stop still outstanding on this contract. */
export function remainingMarkers(
  contract: RaidContract,
  contractSteps: readonly string[],
): readonly ContractMarker[] {
  return contract.markers.filter((marker) => !contractSteps.includes(marker.id));
}

export function contractStopsDone(contract: RaidContract, contractSteps: readonly string[]): number {
  return contract.markers.filter((marker) => contractSteps.includes(marker.id)).length;
}

/** Whether every stop has been made. Says nothing about which exit banks it. */
export function areContractStopsComplete(
  contract: RaidContract,
  contractSteps: readonly string[],
): boolean {
  return contractStopsDone(contract, contractSteps) === contract.markers.length;
}

/**
 * Whether extracting through this exit banks the contract. The stops and the
 * exit are one question because a contract with `requiredExitLabel` is not
 * finished by touching its marker - leaving the right way is the objective.
 */
export function isContractBankable(
  contract: RaidContract,
  snapshot: Pick<RunSnapshot, 'contractSteps'>,
  exitLabel: string,
): boolean {
  return (
    areContractStopsComplete(contract, snapshot.contractSteps) &&
    (contract.requiredExitLabel === undefined || contract.requiredExitLabel === exitLabel)
  );
}

/** What the loadout screen has to make sure leaves base with the player. */
export function contractCarryIn(contract: RaidContract): readonly ContractStack[] {
  return contract.markers.flatMap((marker) => marker.carriedIn ?? []);
}

/**
 * What a delivery still needs, given what is actually in the bag.
 *
 * The rule lives here rather than inline in the raid because it is asked twice
 * from two places - on deployment, to warn before the walk, and at the drop, to
 * refuse it - and the two must never disagree about what "short" means.
 */
export function missingCarryIn(
  required: readonly ContractStack[],
  held: (itemId: ItemId) => number,
): readonly ContractStack[] {
  return required
    .map(({ itemId, quantity }) => ({ itemId, quantity: quantity - held(itemId) }))
    .filter(({ quantity }) => quantity > 0);
}

/** The secure slot before any contract has enlarged it. */
export const BASE_SECURE_ITEM_STACKS = 2;

/**
 * How many item stacks the secure slot protects for this save. The cordon
 * ledger's whole reward is this number, so it is derived from banked contracts
 * rather than stored, and a save can never disagree with the contract list.
 */
export function secureItemStackLimit(completedContractIds: readonly string[]): number {
  return RAID_CONTRACTS.filter(
    (contract) => contract.reward.secureItemStack && completedContractIds.includes(contract.id),
  ).length + BASE_SECURE_ITEM_STACKS;
}

/**
 * Supplies banked contracts have added to the kit every recovery path tops the
 * stash back up to, on top of `MINIMUM_SUPPLIES`.
 */
export function contractRestockBonus(
  completedContractIds: readonly string[],
): Readonly<Record<string, number>> {
  const bonus: Record<string, number> = {};
  for (const contract of RAID_CONTRACTS) {
    if (!completedContractIds.includes(contract.id)) {
      continue;
    }
    for (const [itemId, quantity] of Object.entries(contract.reward.restockFloor ?? {})) {
      bonus[itemId] = (bonus[itemId] ?? 0) + quantity;
    }
  }
  return bonus;
}

/** Insertions every banked contract has opened, in the order they were listed. */
export function contractUnlockedInsertionIds(
  completedContractIds: readonly string[],
): readonly string[] {
  return RAID_CONTRACTS.filter((contract) => completedContractIds.includes(contract.id)).flatMap(
    (contract) => contract.reward.unlockedInsertionIds ?? [],
  );
}
