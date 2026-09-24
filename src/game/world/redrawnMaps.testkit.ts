import type { GridPosition } from '../movement/gridMovement';
import { getWorldMap, type WorldMapId } from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
import { stepDistances } from './mapStructure';
import { createRunTrainerEncounters } from './trainers';

/**
 * Route facts for the hand-drawn maps, measured the way a player walks them.
 *
 * `mapStructure.testkit.ts` holds every map to the same rules; what it cannot say
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

/**
 * The cheapest walk between two tiles, counted in tall-grass steps first and
 * walking steps second - which is the currency Viridian Forest is priced in,
 * where a longer road with no grass on it is the better road. A 0-1 BFS, so
 * "cheapest in fights, then shortest" is one pass.
 */
export function cheapestWalk(
  mapId: WorldMapId,
  beaten: readonly string[],
  from: GridPosition,
  to: GridPosition,
): { readonly grass: number; readonly steps: number } {
  const map = getWorldMap(mapId, beaten);
  const width = map.width;
  const height = map.height;
  const grass = Array.from({ length: height }, () => Array<number>(width).fill(Infinity));
  const walked = Array.from({ length: height }, () => Array<number>(width).fill(Infinity));
  grass[from.y][from.x] = 0;
  walked[from.y][from.x] = 0;
  const queue: GridPosition[] = [from];
  while (queue.length > 0) {
    const tile = queue.shift() as GridPosition;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const next = { x: tile.x + dx, y: tile.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) continue;
      if (map.collision[next.y][next.x]) continue;
      const price = map.tallGrass[next.y][next.x] ? 1 : 0;
      const cost = grass[tile.y][tile.x] + price;
      const length = walked[tile.y][tile.x] + 1;
      if (cost < grass[next.y][next.x] || (cost === grass[next.y][next.x] && length < walked[next.y][next.x])) {
        grass[next.y][next.x] = cost;
        walked[next.y][next.x] = length;
        if (price === 0) queue.unshift(next);
        else queue.push(next);
      }
    }
  }
  return { grass: grass[to.y][to.x], steps: walked[to.y][to.x] };
}
