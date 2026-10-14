import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import type { MapFileSwitchKind } from './mapFile';
import { fileMap } from './playerMaps';

/**
 * A switch, and the barrier it opens: FireRed's Victory Road rule
 * (`VictoryRoad_2F/scripts.inc`), where a Strength boulder pushed onto a floor
 * switch lifts a rock barrier with a crack, and the boulder stays where it fell.
 *
 * A switch is thrown once and stays thrown for the rest of the raid, and the
 * barrier it opens is open for the rest of the raid - never for good, so the
 * puzzle is the price of the way every raid that takes it. Like a boulder's
 * place, that is raid state, never map state: what has been thrown rides on
 * `ActiveRunSession.switchesThrown`, because the world is rebuilt on the return
 * from every fight, and a barrier is an entity rather than a gate for the
 * boulder's reason - a gate is a tile shut or open for good, and a barrier is a
 * wall for one raid. The step planner, the boulders and the hunter's search
 * meet a shut barrier as they meet a person (`WorldScene.entityHolds`).
 *
 * Two kinds, so one rule serves a cave and a machine room: a `plate` is thrown
 * by a boulder coming to rest on it, and a `lever` - a generator, a panel - by
 * facing its tile and pressing the interact key. A barrier with more than one
 * switch opens only when every one of them is thrown, which is what makes a
 * floor of plates a puzzle about the order the boulders go in. A switch may
 * open a barrier in another place of the same map.
 */
export interface WorldSwitch {
  /** Unique on its map; what `switchesThrown` records. */
  readonly id: string;
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly kind: MapFileSwitchKind;
  /** The barrier it opens. */
  readonly opens: string;
}

/** The switches on a map: a file's, in the grid it is played on. */
export function switchesOn(mapId: WorldMapId): readonly WorldSwitch[] {
  return fileMap(mapId)?.switches ?? [];
}

/** The switch on this tile, if there is one. */
export function switchAt(
  switches: readonly WorldSwitch[],
  tile: GridPosition,
): WorldSwitch | undefined {
  return switches.find((candidate) => candidate.position.x === tile.x && candidate.position.y === tile.y);
}

/** Whether a barrier stands open: every switch that opens it has been thrown. */
export function isBarrierOpen(
  barrier: string,
  switches: readonly WorldSwitch[],
  thrown: readonly string[],
): boolean {
  const own = switches.filter((candidate) => candidate.opens === barrier);
  return own.length > 0 && own.every((candidate) => thrown.includes(candidate.id));
}

/**
 * The barriers this switch being thrown opens now: its own, if it was the last
 * of that barrier's switches still up. Empty when it was thrown already.
 */
export function barriersOpenedBy(
  thrown: WorldSwitch,
  switches: readonly WorldSwitch[],
  before: readonly string[],
): readonly string[] {
  if (before.includes(thrown.id) || isBarrierOpen(thrown.opens, switches, before)) {
    return [];
  }
  return isBarrierOpen(thrown.opens, switches, [...before, thrown.id]) ? [thrown.opens] : [];
}

/**
 * What a lever says when it is first faced: FireRed's own words for the
 * Pokemon Mansion's (`PokemonMansion_Text_PressSecretSwitch`), less the
 * question, because a raid's switch only ever goes one way. A thrown one says
 * nothing, as FireRed's floor switch does once its boulder has fallen
 * (`VictoryRoad_2F_EventScript_FloorSwitch1AlreadyPressed`).
 */
export const LEVER_LINES: readonly string[] = ['A secret switch!'];

/**
 * What a boulder that has fallen onto its floor switch says when faced. It
 * stays there for the rest of the raid (`WorldScene.boulderIsSeated`), so the
 * Strength user's "walk into it" would be a promise the next step breaks.
 */
export const SEATED_BOULDER_LINES: readonly string[] = [
  "The boulder is wedged on the switch. It won't move again.",
];
