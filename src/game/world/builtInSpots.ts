import type { GridPosition } from '../movement/gridMovement';
import { layOutAreas } from './areaLayout';
import type { MapFileArea } from './mapFile';

/**
 * Where a spot in one of the game's own map files stands in the grid the game
 * plays, for the few things authored outside the file that stand inside it: a
 * gym leader and her trainers are bosses and measured parties (`trainers.ts`),
 * which no map file may name, and they stand in the gym's own room.
 *
 * A room's place in the grid depends on every room laid before it, so a
 * position typed as two numbers would move the day somebody drew another
 * house; read off the file, it cannot. Only the file's sizes are read - the
 * same layout `buildFileMap` places everything by, with no margin - so this
 * stays out of the import graph the map builder sits in.
 */
const FILES: Readonly<Record<string, unknown>> = import.meta.glob('./maps/*.json', {
  eager: true,
  import: 'default',
});

interface FileShape {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly areas?: readonly MapFileArea[];
}

const layouts = new Map<string, ReturnType<typeof layOutAreas>>();

function layoutOf(fileId: string): ReturnType<typeof layOutAreas> {
  let layout = layouts.get(fileId);
  if (!layout) {
    const file = Object.values(FILES).find(
      (value): value is FileShape => typeof value === 'object' && value !== null && (value as FileShape).id === fileId,
    );
    if (!file) {
      throw new Error(`no built-in map file '${fileId}'`);
    }
    layout = layOutAreas({ name: file.name, width: file.width, height: file.height }, file.areas ?? []);
    layouts.set(fileId, layout);
  }
  return layout;
}

/** A spot in a built-in map file - outdoors, or in one of its rooms by id - as a tile of the played grid. */
export function builtInSpot(
  fileId: string,
  spot: { readonly area?: string; readonly x: number; readonly y: number },
): GridPosition {
  const placed = layoutOf(fileId).areas.find((area) => area.id === spot.area);
  if (!placed) {
    throw new Error(`'${fileId}' has no room '${String(spot.area)}'`);
  }
  return { x: placed.rect.x + spot.x, y: placed.rect.y + spot.y };
}
