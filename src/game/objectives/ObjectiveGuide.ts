import { contractStopsDone, remainingMarkers, type RaidContract } from './contracts';
import { formatStacks, type RunObjective } from './RunObjectives';
import type { ActiveRunSession } from '../run/RunSession';
import type { GridPosition } from '../movement/gridMovement';
import { WORLD_MAP_NAMES, type WorldMapId } from '../worldMap';
import { poisForMap } from '../world/pois';

export interface ObjectiveGuideContext {
  readonly currentMapId: WorldMapId;
  readonly currentPosition: GridPosition;
  readonly activatedPoiIds: ReadonlySet<string>;
}

export interface ObjectiveGuideObjective {
  readonly description: string;
  readonly progress: string;
  readonly complete: boolean;
  readonly reward: string;
}

export interface ObjectiveGuideModel {
  readonly isFirstContract: boolean;
  readonly contractLabel: string;
  readonly objectives: readonly ObjectiveGuideObjective[];
  readonly hints: readonly string[];
}

/**
 * Builds the field guide from the live raid session so its text cannot drift
 * from objective progress, the chosen insertion, or this run's exits.
 *
 * A contract carries its own briefing, so the guide reads the contract rather
 * than holding a script per contract: a new contract writes its own lines in
 * `contracts.ts` and appears here without touching this file.
 */
export function buildObjectiveGuide(
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
): ObjectiveGuideModel {
  const snapshot = session.manager.snapshot();
  const contract = session.plan?.contract;
  const objectives = session.objectives.map((objective) => objectiveModel(objective, contract, snapshot));
  const isFirstContract = contract?.id === 'recover-lost-field-kit';
  const currentExit = session.plan?.extractionPoints.find((point) => point.mapId === context.currentMapId);
  const safeExit = session.plan?.extractionPoints.find(
    (point) => point.mapId === session.plan?.insertion.mapId,
  );

  return {
    isFirstContract,
    contractLabel: contract ? contractLabel(contract, isFirstContract) : 'Raid field guide',
    objectives,
    hints: contract
      ? contractHints(contract, session, context, snapshot.contractSteps, safeExit?.label, currentExit?.label)
      : laterRunHints(context, currentExit?.label),
  };
}

function contractLabel(contract: RaidContract, isFirstContract: boolean): string {
  return isFirstContract ? 'Recovery contract' : `${contract.name} contract`;
}

function objectiveModel(
  objective: RunObjective,
  contract: RaidContract | undefined,
  snapshot: Parameters<RunObjective['progress']>[0],
): ObjectiveGuideObjective {
  const progress = objective.progress(snapshot);
  return {
    description: objective.description,
    progress: `${progress.current}/${progress.target}`,
    complete: progress.complete,
    // A contract pays once, permanently, so the guide prints the contract's own
    // promise rather than a per-raid item list that would always be empty.
    reward:
      contract && contract.id === objective.id
        ? contract.reward.summary
        : formatStacks(objective.reward.items),
  };
}

/**
 * What to do next, in the contract's own words, followed by how to bank it.
 *
 * The order is deliberate: where you are, what the contract asks, then the exit.
 * A contract that only banks through one exit says so before the guide names
 * any other gate, because that is the fact a player leaves the wrong way for.
 */
function contractHints(
  contract: RaidContract,
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
  contractSteps: readonly string[],
  safeExit: string | undefined,
  currentExit: string | undefined,
): readonly string[] {
  const outstanding = remainingMarkers(contract, contractSteps);
  const extractionHint = bankingHint(contract, safeExit, currentExit);

  if (outstanding.length === 0) {
    return [
      `${contract.name} secured. It only banks when you extract.`,
      extractionHint,
    ];
  }

  // Unnumbered: the field guide renders these in an ordered list, and hints
  // that numbered themselves as well came out as "1. 1. You are in ...".
  return [
    `You are in ${locationHint(contract, session, context, outstanding[0].position)}.`,
    ...(contract.markers.length > 1
      ? [`${contractStopsDone(contract, contractSteps)} of ${contract.markers.length} stops made.`]
      : []),
    ...contract.briefing,
    extractionHint,
  ];
}

function locationHint(
  contract: RaidContract,
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
  nextStop: GridPosition,
): string {
  if (!session.plan) {
    return WORLD_MAP_NAMES[context.currentMapId];
  }
  if (context.currentMapId !== contract.mapId) {
    return `${WORLD_MAP_NAMES[context.currentMapId]}. Travel to ${WORLD_MAP_NAMES[contract.mapId]}`;
  }

  return `${WORLD_MAP_NAMES[contract.mapId]}. The next stop is ${directionTo(context.currentPosition, nextStop)}`;
}

function directionTo(from: GridPosition, to: GridPosition): string {
  const horizontal = to.x === from.x ? '' : to.x > from.x ? 'east' : 'west';
  const vertical = to.y === from.y ? '' : to.y > from.y ? 'south' : 'north';
  const direction = [vertical, horizontal].filter(Boolean).join('-');
  return direction ? `to the ${direction}` : 'right here';
}

function laterRunHints(context: ObjectiveGuideContext, currentExit: string | undefined): readonly string[] {
  if (context.currentMapId === 'floodplain-relay') {
    const radioActive = context.activatedPoiIds.has('floodplain-ranger-radio');
    return [
      'Floodplain Relay: Maya watches three tiles of the fast central road, and taking it means fighting her. The west reeds reconnect above and below her checkpoint.',
      'Flooded Supply Vault: 2 Great Balls + 1 Super Potion. Its causeway is exposed, and the haul banks only on extraction.',
      radioActive
        ? 'Radio Exit is active at Ranger Station. South Gate is always open; Ferry Dock opens on its signal.'
        : 'Ranger Station gives a hunter forecast and activates the Radio Exit. South Gate is always open; Ferry Dock opens on its signal.',
    ];
  }
  // Named and explained by the landmark itself. Every map has its own, and more
  // than one on some, so a sentence that wrote a landmark's name or what it does
  // as a literal would be right on one map and misdirecting on the other three.
  const landmark = poisForMap(context.currentMapId).find((poi) => !context.activatedPoiIds.has(poi.id));
  const landmarkHint = landmark
    ? `${landmark.label} is nearby. ${landmark.description}`
    : 'Search marked caches and loose supplies, then leave before the raid turns against you.';
  return [landmarkHint, currentExit ? `Use ${currentExit} on this map to bank your haul.` : 'Return to a marked extraction gate to bank your haul.'];
}

/** How this contract gets banked, which is not always "any exit will do". */
function bankingHint(
  contract: RaidContract,
  safeExit: string | undefined,
  currentExit: string | undefined,
): string {
  if (contract.requiredExitLabel) {
    return `Only ${contract.requiredExitLabel} banks this contract. Any other gate ends the raid and leaves it unpaid.`;
  }
  if (safeExit) {
    return `Extract through the known safe gate, ${safeExit}, to bank the contract and your haul.`;
  }
  if (currentExit) {
    return `Extract through ${currentExit} on this map to bank the contract and your haul.`;
  }
  return 'Return to a marked extraction gate to bank the contract and your haul.';
}
