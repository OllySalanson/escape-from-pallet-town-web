import { contractStopsDone, remainingMarkers, type RaidContract } from './contracts';
import { formatStacks, type RunObjective } from './RunObjectives';
import type { ActiveRunSession } from '../run/RunSession';
import type { GridPosition } from '../movement/gridMovement';
import { compassBearing, compassWord } from '../world/bearing';
import { type WorldMapId, worldMapName } from '../worldMap';
import { poisForMap, type WorldPoi } from '../world/pois';
import { isLandmarkWorked } from '../world/workedLandmarks';
import { errandForItem, errandPlace, errandSquares, errandThing } from '../hub/errands';
import { isDugExit, itemThatOpens } from '../world/extractionPoints';
import { ITEMS } from '../items/items';
import { createRunTrainerEncounters } from '../world/trainers';

export interface ObjectiveGuideContext {
  readonly currentMapId: WorldMapId;
  readonly currentPosition: GridPosition;
  /**
   * Where to head for a tile from here, when the map's places are joined by
   * doors and a straight line would point at the wall of a room
   * (`areaRoutes.ts`). Absent is straight at it.
   */
  readonly towards?: (target: GridPosition) => GridPosition;
  readonly activatedPoiIds: ReadonlySet<string>;
  /**
   * How many of an item the raid's pack holds now. A thing picked up can be
   * put down again for good, so what was found is not what is carried.
   */
  readonly carried?: (itemId: string) => number;
  /**
   * The open exit the fewest walking steps from here (`../world/nearestExit`),
   * named by the guide in place of the first in the map's list. Absent when
   * the scene did not measure one, or none is open and in reach.
   */
  readonly nearestOpenExit?: { readonly label: string; readonly position: GridPosition };
  /**
   * Walking steps from here to a tile, or undefined when it cannot be reached
   * now (`../world/nearestExit`'s `walkingStepsFrom`). Absent is a straight
   * line: the scene did not measure.
   */
  readonly stepsTo?: (target: GridPosition) => number | undefined;
  /** The trainers beaten this raid. A toll stands up again next raid, but not in this one. */
  readonly defeatedTrainerIds?: ReadonlySet<string>;
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
    // Never the screen's own name: the guide's eyebrow already says that, and
    // a heading that repeats the line above it is a rank of nothing.
    contractLabel: contract ? contractLabel(contract, isFirstContract) : 'No contract on this raid',
    objectives,
    hints: [
      ...(contract
        ? contractHints(contract, session, context, snapshot.contractSteps, safeExit?.label, currentExit?.label)
        : laterRunHints(session, context, currentExit?.label)),
      ...barredExitHints(session, context),
      ...lockedCacheHints(session, context),
      ...errandHints(session, context, snapshot.foundItems),
      ...shinyHints(snapshot.caughtPokemon),
    ],
  };
}

/**
 * Somebody's errand lying on this map this raid (`../hub/errands`): where, and
 * which way - it is drawn with a light on it, so this says nothing the map will
 * not - and once it is in the pack, that it is only theirs if you walk out.
 */
function errandHints(
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
  found: readonly { readonly itemId: string }[],
): string[] {
  return (session.plan?.loot[context.currentMapId] ?? []).flatMap((piece) => {
    const errand = errandForItem(piece.itemId);
    if (!errand) {
      return [];
    }
    const thing = errandThing(errand);
    if (found.some((stack) => stack.itemId === piece.itemId)) {
      // Found is not carried: the pack can put it down for good to make room,
      // and then it is not out here this raid any more.
      return (context.carried?.(piece.itemId) ?? 1) > 0
        ? [`You are carrying ${thing} for ${errand.name}. Walk out with it and it is theirs; wipe and it is lost with the pack.`]
        : [`You put ${thing} down. ${errand.name} is still waiting for it, and it will be out here again next raid.`];
    }
    const squares = errandSquares(errand);
    const heading = context.towards?.(piece.position) ?? piece.position;
    return [
      `${errand.name}'s errand: ${thing} lies in ${errandPlace(errand)}, ${directionTo(context.currentPosition, heading)}. It takes ${squares} ${squares === 1 ? 'square' : 'squares'} of your pack.`,
    ];
  });
}

/**
 * A barred exit on this map that what is in the pack can open - a locked gate
 * and its own key, or rubble and a Pickaxe - and which way it is. The nearest
 * open exit never counts one (`isBarredExit`), so without this a player who
 * carried a key in at the risk of losing it was never told where its gate is.
 * Said only while it is still barred: opened, it is an ordinary way out.
 */
function barredExitHints(session: ActiveRunSession, context: ObjectiveGuideContext): string[] {
  const opened = session.exitsOpened ?? [];
  return (session.plan?.extractionPoints ?? []).flatMap((point) => {
    const opener = itemThatOpens(point);
    if (
      point.mapId !== context.currentMapId ||
      !opener ||
      opened.includes(point.label) ||
      (context.carried?.(opener) ?? 0) === 0
    ) {
      return [];
    }
    const where = directionTo(context.currentPosition, context.towards?.(point.position) ?? point.position);
    return isDugExit(point)
      ? [`Your ${ITEMS[opener].displayName} can dig out ${point.label}, ${where}, as a way out for this raid.`]
      : [`You carry the ${ITEMS[opener].displayName}: it opens ${point.label}, ${where}, as a way out for this raid.`];
  });
}

/**
 * The nearest locked cache still to open, for a pack with a Lockpick in it -
 * the one thing that opens it. Never named as the landmark to work otherwise
 * (`nearestLandmarkToWork`), because a pack with no pick is only refused at it.
 */
function lockedCacheHints(session: ActiveRunSession, context: ObjectiveGuideContext): string[] {
  if ((context.carried?.('lockpick') ?? 0) === 0) {
    return [];
  }
  const cache = nearestLandmarkToWork(session, context, (poi) => poi.locked === true, true);
  if (!cache) {
    return [];
  }
  const where = directionTo(context.currentPosition, context.towards?.(cache.position) ?? cache.position);
  return [`You carry a Lockpick: ${cache.label}, ${where}, is locked and pays more than the open caches round it.`];
}

/**
 * A shiny caught this raid, named in the field notes for as long as it is
 * being carried: it is the rarest thing a raid can hold, and like every catch
 * it is only the player's once they walk out with it.
 */
function shinyHints(caught: readonly { readonly shiny: boolean; readonly base: { readonly name: string } }[]): string[] {
  return caught
    .filter((pokemon) => pokemon.shiny)
    .map((pokemon) => `You are carrying a shiny ${pokemon.base.name}. It is only yours once you extract.`);
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
  const extractionHint = bankingHint(contract, session, context, safeExit, currentExit);

  if (outstanding.length === 0) {
    return [
      `${contract.name} is ready. It only banks when you extract.`,
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
    return worldMapName(context.currentMapId);
  }
  if (context.currentMapId !== contract.mapId) {
    return `${worldMapName(context.currentMapId)}. Travel to ${worldMapName(contract.mapId)}`;
  }

  const heading = context.towards?.(nextStop) ?? nextStop;
  return `${worldMapName(contract.mapId)}. The next stop is ${directionTo(context.currentPosition, heading)}`;
}

function directionTo(from: GridPosition, to: GridPosition): string {
  const bearing = compassBearing(from, to);
  return bearing ? `to the ${compassWord(bearing)}` : 'right here';
}

/** The Floodplain's toll on the shore road (`../world/trainers`). */
const MAYA_ID = 'floodplain-checkpoint-maya';

function laterRunHints(
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
  currentExit: string | undefined,
): readonly string[] {
  const nearest = nearestExitHint(context);
  if (context.currentMapId === 'floodplain-relay') {
    const radioActive = context.activatedPoiIds.has('floodplain-ranger-radio');
    // Banking the first contract finishes the station for good: it refuses to
    // be worked again and the Radio Exit is open from the first second.
    const radioKept = isLandmarkWorked('floodplain-ranger-radio', session.plan?.completedContracts ?? []);
    // The landmark and the exit are the nearest ones, as on every other map:
    // the Floodplain is 128 tiles across and has ten landings, and the first
    // cache in its list and a gate named by hand were a hundred tiles off from
    // most of them. The station keeps a line of its own, because its radio is
    // the one landmark that changes the map's ways out.
    const landmark = nearestLandmarkToWork(session, context, (poi) => poi.effect === undefined);
    // Named as the map names them, in the capitals every other line of the
    // guide prints a place in: typed by hand, the station's line said "Radio
    // Exit" straight above a line saying "RADIO EXIT".
    const station = poisForMap('floodplain-relay').find((poi) => poi.id === 'floodplain-ranger-radio');
    const stationName = station?.label ?? 'RANGER STATION';
    const radioExit = station?.unlockedExtractionLabel ?? 'RADIO EXIT';
    // Maya stands up again every raid, but not in the one that beat her.
    const mayaBeaten = context.defeatedTrainerIds?.has(MAYA_ID) ?? false;
    // Her road is the front door's: from six of the map's ten landings it is
    // behind a shut door, and a first line about a toll nobody can walk to
    // sent a raid dropped at the Quarry or the Light looking for her.
    const maya = createRunTrainerEncounters().find((encounter) => encounter.trainer.id === MAYA_ID);
    const mayaInReach = maya !== undefined && (!context.stepsTo || context.stepsTo(maya.position) !== undefined);
    return [
      ...(mayaBeaten
        ? ['You beat Maya this raid: the shore road is clear past her checkpoint. She will be back on it next raid.']
        : mayaInReach
          ? ['Floodplain Relay: the shore road narrows to one tile where Maya is watching it, and walking that means fighting her. The reeds go round - straight on where the road turns at the hut - and come back to the road below her, but the flooded cut makes them the long way.']
          : []),
      landmark
        ? landmarkHint(landmark, context)
        : 'No marked cache in reach is left to work this raid.',
      radioKept
        ? `The ${stationName} stays switched on: the ${radioExit} is open from the first second of every raid.`
        : radioActive
          ? `The ${radioExit} is active at the ${stationName}.`
          : `The ${stationName} gives a hunter forecast and activates the ${radioExit}.`,
      nearest
        ? `The nearest open exit is ${nearest}. Use it to bank your haul.`
        : 'The SOUTH GATE is always open; the FERRY DOCK opens on its signal.',
    ];
  }
  // Named and explained by the landmark itself. Every map has its own, and more
  // than one on some, so a sentence that wrote a landmark's name or what it does
  // as a literal would be right on one map and misdirecting on the other three.
  // The nearest one still to work, and which way: the vast maps hold a dozen,
  // and the first in authored order was the Green's pump whichever end of the
  // valley the player stood in.
  const landmark = nearestLandmarkToWork(session, context);
  return [
    landmark
      ? landmarkHint(landmark, context)
      : 'Search marked caches and loose supplies, then leave before the raid turns against you.',
    nearest
      ? `The nearest open exit is ${nearest}. Use it to bank your haul.`
      : currentExit
        ? `Use ${currentExit} on this map to bank your haul.`
        : 'Return to a marked extraction gate to bank your haul.',
  ];
}

/**
 * The one exit that banks this contract, which way it is from here, and - while
 * a landmark still seals it - which landmark and which way that is: the ledger
 * in hand and a shut culvert is exactly when a player walks the wrong way.
 */
function requiredExitHint(
  label: string,
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
): string {
  const unpaid = 'Any other gate ends the raid and leaves it unpaid.';
  const exit = session.plan?.extractionPoints.find(
    (point) => point.mapId === context.currentMapId && point.label === label,
  );
  if (!exit) {
    return `Only ${label} banks this contract. ${unpaid}`;
  }
  const way = (target: GridPosition): string =>
    directionTo(context.currentPosition, context.towards?.(target) ?? target);
  const seal = exit.requirement;
  const sealedBy =
    seal?.kind === 'poi-activated' && !context.activatedPoiIds.has(seal.poiId)
      ? poisForMap(context.currentMapId).find((poi) => poi.id === seal.poiId)
      : undefined;
  const sealed = sealedBy
    ? ` It stays sealed until ${sealedBy.label} is worked, ${way(sealedBy.position)}.`
    : '';
  return `Only ${label}, ${way(exit.position)}, banks this contract.${sealed} ${unpaid}`;
}

/** The nearest open exit and which way it is, as a sentence names it. */
function nearestExitHint(context: ObjectiveGuideContext): string | undefined {
  const exit = context.nearestOpenExit;
  if (!exit) {
    return undefined;
  }
  return `${exit.label}, ${directionTo(context.currentPosition, context.towards?.(exit.position) ?? exit.position)}`;
}

function landmarkHint(landmark: WorldPoi, context: ObjectiveGuideContext): string {
  return `The nearest landmark still to work is ${landmark.label}, ${directionTo(context.currentPosition, context.towards?.(landmark.position) ?? landmark.position)}. ${landmark.description}`;
}

/**
 * The landmark on this map closest to the player that this raid can still work:
 * not worked this raid, and not finished with for good by a banked contract
 * (`../world/workedLandmarks`), which still stands but hands out nothing.
 * A locked cache is asked for only by name (`locked`): to a pack with no
 * Lockpick it is a crate that refuses, never the next place to go.
 * Closest on foot when the scene measured the walk, so one behind a shut gate
 * or across the river is never named over one down the lane; in a straight
 * line otherwise.
 */
function nearestLandmarkToWork(
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
  kind: (poi: WorldPoi) => boolean = () => true,
  locked = false,
): WorldPoi | undefined {
  const completed = session.plan?.completedContracts ?? [];
  const here = context.currentPosition;
  const distanceTo = (poi: WorldPoi): number | undefined =>
    context.stepsTo
      ? context.stepsTo(poi.position)
      : Math.abs(poi.position.x - here.x) + Math.abs(poi.position.y - here.y);
  let best: { readonly poi: WorldPoi; readonly distance: number } | undefined;
  for (const poi of poisForMap(context.currentMapId)) {
    if (!kind(poi) || (poi.locked === true) !== locked || context.activatedPoiIds.has(poi.id) || isLandmarkWorked(poi.id, completed)) {
      continue;
    }
    const distance = distanceTo(poi);
    if (distance !== undefined && (!best || distance < best.distance)) {
      best = { poi, distance };
    }
  }
  return best?.poi;
}

/** How this contract gets banked, which is not always "any exit will do". */
function bankingHint(
  contract: RaidContract,
  session: ActiveRunSession,
  context: ObjectiveGuideContext,
  safeExit: string | undefined,
  currentExit: string | undefined,
): string {
  if (contract.requiredExitLabel) {
    return requiredExitHint(contract.requiredExitLabel, session, context);
  }
  const nearest = nearestExitHint(context);
  if (nearest) {
    return `The nearest open exit is ${nearest}. Extract there to bank the contract and your haul.`;
  }
  if (safeExit) {
    return `Extract through the known safe gate, ${safeExit}, to bank the contract and your haul.`;
  }
  if (currentExit) {
    return `Extract through ${currentExit} on this map to bank the contract and your haul.`;
  }
  return 'Return to a marked extraction gate to bank the contract and your haul.';
}
