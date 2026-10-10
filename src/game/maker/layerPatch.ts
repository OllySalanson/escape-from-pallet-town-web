import type { MapFile } from '../world/mapFile';
import type { MapLayers, TileLayer } from '../world/tiles';
import { buildingSize, type Sides } from './draft';
import { layersFor } from './mapCanvas';

/**
 * Keeping the picture of a map up to date one changed patch at a time.
 *
 * The maker used to build every layer of the whole map after each tile a
 * stroke crossed, which is twenty milliseconds at 128x128 and seventy-odd at
 * 256x256 - a brush that trails the pointer. What a tile is drawn with is read
 * off the tiles round it and never off anything far away (an edge off its
 * eight neighbours, a FireRed tree off the 2x2 lattice cells beside it, a
 * building off its own footprint), so a change can only move the picture
 * within `PATCH_REACH` tiles of itself. That ground is rebuilt from a crop of
 * the map wide enough that every tile it decides is as far from the crop's
 * edge as from anything that could change it, and written over the layers
 * already built. `layerPatch.test.ts` holds the patched layers to the whole
 * build, tile for tile, over random edits.
 */

export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * How far from a changed tile the picture can change. The widest reach is the
 * lattice: a conifer is a 2x2 block whose cell is read off the trees round
 * it, so a tile three or four away can change with it.
 */
export const PATCH_REACH = 6;

/**
 * How much more of the map the crop takes beyond the ground it decides: the
 * reach again, so nothing the crop's edge does is seen, and the widest
 * building (the League gate, nine across), so any building that could stand
 * in the decided ground is inside the crop whole. Even, because the lattice
 * and the grass weave are laid on even rows and columns.
 */
const CROP_MARGIN = 20;

export function unionRect(a: TileRect | undefined, b: TileRect | undefined): TileRect | undefined {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** A rectangle grown by `by` tiles on every side and held to a map of this size. */
export function grownWithin(rect: TileRect, by: number, width: number, height: number): TileRect {
  const x = Math.max(0, rect.x - by);
  const y = Math.max(0, rect.y - by);
  return {
    x,
    y,
    width: Math.max(0, Math.min(width, rect.x + rect.width + by) - x),
    height: Math.max(0, Math.min(height, rect.y + rect.height + by) - y),
  };
}

/** The tiles whose ground letter differs between two maps of one size, as one rectangle. */
export function groundChange(before: MapFile, after: MapFile): TileRect | undefined {
  let changed: TileRect | undefined;
  for (let y = 0; y < after.height; y += 1) {
    const was = before.ground[y];
    const now = after.ground[y];
    if (was === now) {
      continue;
    }
    let left = 0;
    while (left < now.length && was[left] === now[left]) {
      left += 1;
    }
    let right = now.length - 1;
    while (right > left && was[right] === now[right]) {
      right -= 1;
    }
    changed = unionRect(changed, { x: left, y, width: right - left + 1, height: 1 });
  }
  return changed;
}

/** The footprints of every building one map has and the other does not. */
export function buildingChange(before: MapFile, after: MapFile): TileRect | undefined {
  if (before.buildings === after.buildings) {
    return undefined;
  }
  const key = (building: MapFile['buildings'][number]): string =>
    `${building.kind}@${building.x},${building.y}`;
  const kept = (list: MapFile['buildings'], other: MapFile['buildings']): Set<string> => {
    const keys = new Set(other.map(key));
    return new Set(list.map(key).filter((one) => keys.has(one)));
  };
  const stayed = kept(before.buildings, after.buildings);
  let changed: TileRect | undefined;
  for (const building of [...before.buildings, ...after.buildings]) {
    if (!stayed.has(key(building))) {
      changed = unionRect(changed, {
        x: building.x,
        y: building.y,
        ...buildingSize(building.kind),
      });
    }
  }
  // The order buildings are listed in is the order they are drawn: two that
  // overlap and swap places change what is on top even though both stayed.
  if (!changed && before.buildings.map(key).join() !== after.buildings.map(key).join()) {
    for (const building of after.buildings) {
      changed = unionRect(changed, {
        x: building.x,
        y: building.y,
        ...buildingSize(building.kind),
      });
    }
  }
  return changed;
}

/** The part of a map a crop takes, with its corner on even ground. */
function cropOf(decided: TileRect, file: MapFile): TileRect {
  const even = (value: number): number => value - (((value % 2) + 2) % 2);
  const x = even(Math.max(0, decided.x - CROP_MARGIN));
  const y = even(Math.max(0, decided.y - CROP_MARGIN));
  return {
    x,
    y,
    width: Math.min(file.width, decided.x + decided.width + CROP_MARGIN) - x,
    height: Math.min(file.height, decided.y + decided.height + CROP_MARGIN) - y,
  };
}

/** The ground and buildings of one part of a map, as a map of its own. */
function croppedFile(file: MapFile, crop: TileRect): MapFile {
  return {
    ...file,
    width: crop.width,
    height: crop.height,
    ground: file.ground
      .slice(crop.y, crop.y + crop.height)
      .map((row) => row.slice(crop.x, crop.x + crop.width)),
    buildings: file.buildings
      .filter((building) => {
        const size = buildingSize(building.kind);
        return (
          building.x >= crop.x &&
          building.y >= crop.y &&
          building.x + size.width <= crop.x + crop.width &&
          building.y + size.height <= crop.y + crop.height
        );
      })
      .map((building) => ({ ...building, x: building.x - crop.x, y: building.y - crop.y })),
    // A door is a rectangle of shut ground, decided a tile at a time, so a
    // door running out of the crop is cut to the part inside it.
    doors: (file.doors ?? []).flatMap((door) => {
      const x = Math.max(door.x, crop.x);
      const y = Math.max(door.y, crop.y);
      const right = Math.min(door.x + door.width, crop.x + crop.width);
      const bottom = Math.min(door.y + door.height, crop.y + crop.height);
      return right > x && bottom > y
        ? [{ ...door, x: x - crop.x, y: y - crop.y, width: right - x, height: bottom - y }]
        : [];
    }),
  };
}

/** The ground under every door one map has and the other does not: a door shuts what it stands on. */
export function doorChange(before: MapFile, after: MapFile): TileRect | undefined {
  const was = before.doors ?? [];
  const now = after.doors ?? [];
  if (was === now) {
    return undefined;
  }
  const key = (door: NonNullable<MapFile['doors']>[number]): string =>
    `${door.kind}@${door.x},${door.y},${door.width}x${door.height}`;
  const stayed = new Set(was.map(key).filter((one) => now.map(key).includes(one)));
  let changed: TileRect | undefined;
  for (const door of [...was, ...now]) {
    if (!stayed.has(key(door))) {
      changed = unionRect(changed, door);
    }
  }
  return changed;
}

/** Everything a version of a map can be drawn differently by, as one rectangle. */
export function mapChange(before: MapFile, after: MapFile): TileRect | undefined {
  return unionRect(
    unionRect(groundChange(before, after), buildingChange(before, after)),
    doorChange(before, after),
  );
}

function copyGrid<T>(
  into: T[][],
  from: readonly (readonly T[])[],
  rect: TileRect,
  crop: TileRect,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    const target = into[y];
    const source = from[y - crop.y];
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      target[x] = source[x - crop.x];
    }
  }
}

const isTileLayer = (value: unknown): value is TileLayer =>
  typeof value === 'object' && value !== null && 'tiles' in value && 'flips' in value;

/**
 * Brings `layers` - built for an earlier version of `file` of the same size -
 * up to date with `file` wherever `changed` could have moved the picture, in
 * place. Returns the ground that was rebuilt, which is what has to be drawn
 * again.
 */
export function patchLayers(layers: MapLayers, file: MapFile, changed: TileRect): TileRect {
  const decided = grownWithin(changed, PATCH_REACH, file.width, file.height);
  const crop = cropOf(decided, file);
  const part = layersFor(croppedFile(file, crop));
  for (const key of Object.keys(layers) as (keyof MapLayers)[]) {
    const into = layers[key];
    const from = part[key];
    if (isTileLayer(into) && isTileLayer(from)) {
      copyGrid(into.tiles, from.tiles, decided, crop);
      copyGrid(into.tints, from.tints, decided, crop);
      copyGrid(into.flips, from.flips, decided, crop);
    } else {
      copyGrid(into as unknown[][], from as unknown[][], decided, crop);
    }
  }
  return decided;
}

/**
 * Layers built for a map, laid into the layers of the same map grown by
 * `sides` - the old picture moved to where its ground now is, and nothing yet
 * where the new ground is. `patchLayers` over `grownEdges` finishes them.
 */
export function extendLayers(
  layers: MapLayers,
  sides: Sides,
): MapLayers {
  const oldHeight = layers.collision.length;
  const oldWidth = layers.collision[0]?.length ?? 0;
  const width = oldWidth + sides.left + sides.right;
  const height = oldHeight + sides.top + sides.bottom;
  const grid = <T>(from: readonly (readonly T[])[], blank: T): T[][] =>
    Array.from({ length: height }, (_, y) => {
      const source = from[y - sides.top];
      if (!source) {
        return Array<T>(width).fill(blank);
      }
      return [
        ...Array<T>(sides.left).fill(blank),
        ...source,
        ...Array<T>(sides.right).fill(blank),
      ];
    });
  const layer = (from: TileLayer): TileLayer => ({
    tiles: grid(from.tiles, -1),
    tints: grid(from.tints, -1),
    flips: grid(from.flips, false),
  });
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(layers) as (keyof MapLayers)[]) {
    const value = layers[key];
    next[key] = isTileLayer(value)
      ? layer(value)
      : grid<unknown>(value, typeof value[0]?.[0] === 'boolean' ? false : 0);
  }
  return next as unknown as MapLayers;
}

/**
 * The ground of a grown map a patch has to decide: each strip of new ground,
 * with the old edge it now meets, because what stood on the old edge was drawn
 * against the map's end and now stands against more wood.
 */
export function grownEdges(
  width: number,
  height: number,
  sides: Sides,
): TileRect[] {
  const strips: TileRect[] = [];
  if (sides.left > 0) {
    strips.push({ x: 0, y: 0, width: sides.left + 1, height });
  }
  if (sides.right > 0) {
    strips.push({ x: width - sides.right - 1, y: 0, width: sides.right + 1, height });
  }
  if (sides.top > 0) {
    strips.push({ x: 0, y: 0, width, height: sides.top + 1 });
  }
  if (sides.bottom > 0) {
    strips.push({ x: 0, y: height - sides.bottom - 1, width, height: sides.bottom + 1 });
  }
  return strips;
}
