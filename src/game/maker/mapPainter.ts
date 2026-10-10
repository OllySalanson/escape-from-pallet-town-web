import type { MapFile } from '../world/mapFile';
import type { MapLayers } from '../world/tiles';
import { TILE_SIZE } from '../worldMap';
import { buildingSize, type ThingRef } from './draft';
import {
  buildingChange,
  groundChange,
  grownWithin,
  patchLayers,
  PATCH_REACH,
  unionRect,
  type TileRect,
} from './layerPatch';
import { drawMap, layersFor } from './mapCanvas';

/**
 * The map maker's picture of a map, kept rather than repainted.
 *
 * A 256x256 map is sixty-five thousand tiles in five layers, and drawing all
 * of it is a good part of a second - after every tile a stroke crossed, and
 * again after every click that chose something. So the painter remembers what
 * it last drew, works out which tiles a new version of the map can look
 * different on - ground or buildings that changed and the reach of their
 * edges, and the marks, figures and frames that were added, taken away or
 * chosen - and draws those again and nothing else. A map of a new size is
 * drawn whole.
 */
export class MapPainter {
  private drawn:
    | {
        readonly file: MapFile;
        readonly selected: ThingRef | undefined;
        readonly marks: ReadonlyMap<string, TileRect>;
      }
    | undefined;
  private built: { file: MapFile; layers: MapLayers } | undefined;

  /**
   * The layers of `file`: patched from the last ones built where the map is
   * the same size, built whole otherwise. The answer is only good until the
   * next call, which may write over it.
   */
  public layers(file: MapFile): MapLayers {
    const built = this.built;
    if (built?.file === file) {
      return built.layers;
    }
    if (!built || built.file.width !== file.width || built.file.height !== file.height) {
      this.built = { file, layers: layersFor(file) };
      return this.built.layers;
    }
    const changed = unionRect(groundChange(built.file, file), buildingChange(built.file, file));
    if (changed) {
      patchLayers(built.layers, file, changed);
    }
    built.file = file;
    return built.layers;
  }

  /** Forgets what is on the canvas, so the next `show` draws it whole: a new canvas, or one cleared. */
  public forgetCanvas(): void {
    this.drawn = undefined;
  }

  /** Puts `file` on the canvas, drawing only what differs from what is there. */
  public show(
    context: CanvasRenderingContext2D,
    file: MapFile,
    selected: ThingRef | undefined,
  ): void {
    const drawn = this.drawn;
    const sameSize =
      drawn !== undefined &&
      drawn.file.width === file.width &&
      drawn.file.height === file.height &&
      context.canvas.width === drawn.file.width * TILE_SIZE &&
      context.canvas.height === drawn.file.height * TILE_SIZE;
    const layers = this.layers(file);
    const marks = markBoxes(file, selected);
    if (!drawn || !sameSize) {
      drawMap(context, file, layers, selected);
      this.drawn = { file, selected, marks };
      return;
    }
    if (drawn.file === file && sameRef(drawn.selected, selected)) {
      return;
    }
    // Ground and buildings, as far as their edges reach; measured against
    // what was drawn, which is what the canvas shows, rather than against the
    // layers, which may have been asked about a later map in between.
    let dirty = unionRect(groundChange(drawn.file, file), buildingChange(drawn.file, file));
    if (dirty) {
      dirty = grownWithin(dirty, PATCH_REACH, file.width, file.height);
    }
    for (const [key, box] of drawn.marks) {
      if (!marks.has(key)) {
        dirty = unionRect(dirty, box);
      }
    }
    for (const [key, box] of marks) {
      if (!drawn.marks.has(key)) {
        dirty = unionRect(dirty, box);
      } else if (dirty && key.startsWith('trainer') && overlaps(box, dirty)) {
        // What a trainer watches stops at the first wall, so ground changed
        // anywhere along their line can move the end of the shading.
        dirty = unionRect(dirty, box);
      }
    }
    if (dirty) {
      drawMap(context, file, layers, selected, grownWithin(dirty, 0, file.width, file.height));
    }
    this.drawn = { file, selected, marks };
  }
}

const sameRef = (a: ThingRef | undefined, b: ThingRef | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.kind === b.kind && a.index === b.index);

const overlaps = (a: TileRect, b: TileRect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** How far a trainer can watch: the box their shading can fall in. */
const SIGHT_BOX = 4;

/**
 * Everything drawn over the ground, each under a key that changes whenever
 * how it is drawn does, with the tiles it is drawn on: a figure's head is in
 * the row above it, and a trainer's shading runs on along the way they face.
 */
export function markBoxes(file: MapFile, selected: ThingRef | undefined): Map<string, TileRect> {
  const boxes = new Map<string, TileRect>();
  const chosen = (kind: string, index: number): boolean =>
    selected?.kind === kind && selected.index === index;
  const tile = (x: number, y: number): TileRect => ({ x, y, width: 1, height: 1 });
  const add = (kind: string, index: number, thing: unknown, box: TileRect): void => {
    boxes.set(`${kind}:${JSON.stringify(thing)}:${chosen(kind, index) ? 'chosen' : ''}`, box);
  };
  (file.districts ?? []).forEach((district, index) => add('district', index, district, district));
  file.dropIns.forEach((spot, index) => add('drop-in', index, spot, tile(spot.x, spot.y)));
  file.exits.forEach((spot, index) => add('exit', index, spot, tile(spot.x, spot.y)));
  file.itemSpots.forEach((spot, index) => add('item', index, spot, tile(spot.x, spot.y)));
  (file.landmarks ?? []).forEach((spot, index) =>
    add('landmark', index, spot, tile(spot.x, spot.y)),
  );
  (file.signs ?? []).forEach((spot, index) => add('sign', index, spot, tile(spot.x, spot.y)));
  (file.people ?? []).forEach((spot, index) =>
    add('person', index, spot, { x: spot.x, y: spot.y - 1, width: 1, height: 2 }),
  );
  (file.trainers ?? []).forEach((spot, index) =>
    add('trainer', index, spot, {
      x: spot.x - SIGHT_BOX,
      y: spot.y - SIGHT_BOX,
      width: SIGHT_BOX * 2 + 1,
      height: SIGHT_BOX * 2 + 1,
    }),
  );
  if (selected?.kind === 'building') {
    const building = file.buildings[selected.index];
    if (building) {
      boxes.set(`building:${JSON.stringify(building)}:chosen`, {
        x: building.x,
        y: building.y,
        ...buildingSize(building.kind),
      });
    }
  }
  return boxes;
}
