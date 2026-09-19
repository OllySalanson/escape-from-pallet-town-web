import type { GridPosition } from '../movement/gridMovement';
import { getWorldMap, type WorldMapId } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import { stepDistances } from './mapStructure';
import { createRunTrainerEncounters } from './trainers';

/**
 * Route facts for the hand-drawn maps, measured the way a player walks them.
 *
 * `mapStructure.test.ts` holds every map to the same rules; what it cannot say
 * is what a particular map is *for* - that the bridge is the quick way and the
 * far ford the quiet one, that June is a door and Ivy is not. Those are facts
 * about one drawing, and a redraw that loses one still passes every rule. Each
 * map's own test pins them, in walking steps, through this.
 */
export interface Walk {
  /** Bosses already beaten: which gates stand open. */
  readonly beaten?: readonly string[];
  /** Trainers still standing, by trainer id. They block their own tile. */
  readonly standing?: readonly string[];
  /** Tiles to treat as shut, to ask what a route costs without them. */
  readonly without?: readonly GridPosition[];
  /** Never step in tall grass: the walk that costs no fights. */
  readonly dry?: boolean;
}

export function trainerTile(trainerId: string): GridPosition {
  const found = createRunTrainerEncounters().find((trainer) => trainer.trainer.id === trainerId);
  if (!found) {
    throw new Error(`no trainer '${trainerId}'`);
  }
  return found.position;
}

export function exitTile(mapId: WorldMapId, label: string): GridPosition {
  const found = EXTRACTION_POINTS.find((point) => point.mapId === mapId && point.label === label);
  if (!found) {
    throw new Error(`no exit '${label}' on ${mapId}`);
  }
  return found.position;
}

/** Walking steps between two tiles, or -1 where there is no way. */
export function steps(mapId: WorldMapId, from: GridPosition, to: GridPosition, walk: Walk = {}): number {
  const map = getWorldMap(mapId, walk.beaten ?? []);
  const shut = new Set<string>();
  for (const id of walk.standing ?? []) {
    const tile = trainerTile(id);
    shut.add(`${tile.x},${tile.y}`);
  }
  for (const tile of walk.without ?? []) {
    shut.add(`${tile.x},${tile.y}`);
  }
  if (walk.dry) {
    map.tallGrass.forEach((row, y) =>
      row.forEach((grass, x) => {
        if (grass) shut.add(`${x},${y}`);
      }),
    );
  }
  return stepDistances(map.collision, from, shut)[to.y][to.x];
}
