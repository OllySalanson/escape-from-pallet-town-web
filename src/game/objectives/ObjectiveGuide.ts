import { formatObjectiveReward, type RunObjective } from './RunObjectives';
import type { ActiveRunSession } from '../run/RunSession';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import { WORLD_POIS } from '../world/pois';

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
 */
export function buildObjectiveGuide(
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
): ObjectiveGuideModel {
  const snapshot = session.manager.snapshot();
  const objectives = session.objectives.map((objective) => objectiveModel(objective, snapshot));
  const isFirstContract = session.objectives.some((objective) => objective.id === 'recover-lost-field-kit');
  const currentExit = session.plan?.extractionPoints.find((point) => point.mapId === context.currentMapId);
  const safeExit = session.plan?.extractionPoints.find(
    (point) => point.mapId === session.plan?.insertion.mapId,
  );

  return {
    isFirstContract,
    contractLabel: isFirstContract ? 'Recovery contract' : 'Raid field guide',
    objectives,
    hints: isFirstContract
      ? firstContractHints(session, context, snapshot.recoveredFieldKit, safeExit?.label, currentExit?.label)
      : laterRunHints(context, currentExit?.label),
  };
}

function objectiveModel(
  objective: RunObjective,
  snapshot: Parameters<RunObjective['progress']>[0],
): ObjectiveGuideObjective {
  const progress = objective.progress(snapshot);
  return {
    description: objective.description,
    progress: `${progress.current}/${progress.target}`,
    complete: progress.complete,
    reward: formatObjectiveReward(objective.reward),
  };
}

function firstContractHints(
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
  recoveredFieldKit: boolean,
  safeExit: string | undefined,
  currentExit: string | undefined,
): readonly string[] {
  const fieldStation = WORLD_POIS.find((poi) => poi.mapId === 'route-1');
  const stationVisited = fieldStation !== undefined && context.activatedPoiIds.has(fieldStation.id);
  const extractionHint = knownExitHint(safeExit, currentExit);

  if (recoveredFieldKit) {
    return [
      'Field kit secured. The contract only banks when you extract.',
      extractionHint,
    ];
  }

  const locationHint = firstContractLocationHint(session, context);
  return [
    `1. You are in ${locationHint}.`,
    stationVisited
      ? '2. The Field Station cache is secured. Continue searching Route 1 for the lost field kit.'
      : '2. On Route 1, look for Oak’s Field Station. Its cache is optional, but it confirms you are on the right route.',
    '3. Step onto the lost field kit marker to retrieve it.',
    `4. ${extractionHint}`,
  ];
}

function firstContractLocationHint(
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
): string {
  const contract = session.plan?.contract;
  if (!contract || context.currentMapId !== contract.mapId) {
    return 'Pallet Town. Follow the road south through the Route 1 gate';
  }

  return `Route 1. The lost field kit is ${directionTo(context.currentPosition, contract.position)}`;
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
      'Floodplain Relay: Maya watches the fast central road. The west reeds reconnect above and below her checkpoint.',
      'Flooded Supply Vault: 2 Great Balls + 1 Super Potion. Its causeway is exposed, and the haul banks only on extraction.',
      radioActive
        ? 'Radio Exit is active at Ranger Station. South Gate is always open; Ferry Dock opens on its signal.'
        : 'Ranger Station gives a hunter forecast and activates the Radio Exit. South Gate is always open; Ferry Dock opens on its signal.',
    ];
  }
  const fieldStation = WORLD_POIS.find((poi) => poi.mapId === context.currentMapId);
  const stationHint =
    fieldStation && !context.activatedPoiIds.has(fieldStation.id)
      ? `Oak’s Field Station is nearby. Its marked cache is worth checking.`
      : 'Search marked caches and loose supplies, then leave before the raid turns against you.';
  return [stationHint, currentExit ? `Use ${currentExit} on this map to bank your haul.` : 'Return to a marked extraction gate to bank your haul.'];
}

function knownExitHint(safeExit: string | undefined, currentExit: string | undefined): string {
  if (safeExit) {
    return `Extract through the known safe gate, ${safeExit}, to bank the field kit and your haul.`;
  }
  if (currentExit) {
    return `Extract through ${currentExit} on this map to bank the field kit and your haul.`;
  }
  return 'Return to a marked extraction gate to bank the field kit and your haul.';
}
