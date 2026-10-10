import type { MapFile, MapFileArea, MapFileLink } from '../world/mapFile';
import type { MapLayers } from '../world/tiles';
import { TILE_SIZE } from '../worldMap';
import { buildingSize, type Sides, type ThingRef } from './draft';
import {
  extendLayers,
  grownEdges,
  mapChange,
  grownWithin,
  patchLayers,
  PATCH_REACH,
  unionRect,
  type TileRect,
} from './layerPatch';
import { drawMap, layersFor, type DoorwayMark } from './mapCanvas';

/** An inside on screen: the area the view is of, and the links that put its mats and stairs in. */
export interface InsideView {
  readonly area: MapFileArea;
  readonly links: readonly MapFileLink[];
}

const sameInside = (a: InsideView | undefined, b: InsideView | undefined): boolean =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.area.id === b.area.id &&
    a.area.style === b.area.style &&
    a.links === b.links);

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
 * drawn whole, and so is an inside: the biggest is 40x32, which draws in
 * well under a millisecond.
 */
export class MapPainter {
  private drawn:
    | {
        readonly file: MapFile;
        readonly selected: ThingRef | undefined;
        readonly marks: ReadonlyMap<string, TileRect>;
        readonly inside: InsideView | undefined;
      }
    | undefined;
  private built: { file: MapFile; inside: InsideView | undefined; layers: MapLayers } | undefined;

  /**
   * The layers of `file`: patched from the last ones built where the map is
   * the same size, built whole otherwise. The answer is only good until the
   * next call, which may write over it. An inside is built whole.
   */
  public layers(file: MapFile, inside?: InsideView): MapLayers {
    const built = this.built;
    if (built?.file === file && sameInside(built.inside, inside)) {
      return built.layers;
    }
    if (
      !built ||
      inside ||
      built.inside ||
      built.file.width !== file.width ||
      built.file.height !== file.height
    ) {
      this.built = { file, inside, layers: layersFor(file, inside) };
      return this.built.layers;
    }
    const changed = mapChange(built.file, file);
    if (changed) {
      patchLayers(built.layers, file, changed);
    }
    built.file = file;
    return built.layers;
  }

  /**
   * The map grew: `grown` is `before` with wood laid round it by `sides`
   * (`extendMap`). The picture already drawn is moved to where its ground now
   * is, and only the new ground and the old edge it meets are drawn - so a
   * stroke carried past the edge of a 256x256 map does not stop to draw the
   * whole map again at every tile it gains. Only the outdoors grows.
   */
  public grew(
    context: CanvasRenderingContext2D,
    before: MapFile,
    grown: MapFile,
    sides: Sides,
    selected: ThingRef | undefined,
  ): void {
    this.show(context, before, selected);
    const layers = extendLayers(this.layers(before), sides);
    const strips = grownEdges(grown.width, grown.height, sides);
    const decided = strips.map((strip) => patchLayers(layers, grown, strip));
    this.built = { file: grown, inside: undefined, layers };
    const { canvas } = context;
    const old = document.createElement('canvas');
    old.width = canvas.width;
    old.height = canvas.height;
    old.getContext('2d')?.drawImage(canvas, 0, 0);
    canvas.width = grown.width * TILE_SIZE;
    canvas.height = grown.height * TILE_SIZE;
    context.imageSmoothingEnabled = false;
    context.drawImage(old, sides.left * TILE_SIZE, sides.top * TILE_SIZE);
    for (const region of decided) {
      drawMap(context, grown, layers, selected, region);
    }
    this.drawn = { file: grown, selected, marks: markBoxes(grown, selected), inside: undefined };
  }

  /** Forgets what is on the canvas, so the next `show` draws it whole: a new canvas, or one cleared. */
  public forgetCanvas(): void {
    this.drawn = undefined;
  }

  /**
   * Puts `file` on the canvas, drawing only what differs from what is there:
   * the outdoors, or - given `inside` - the inside `file` is a view of, with
   * its ways through marked.
   */
  public show(
    context: CanvasRenderingContext2D,
    file: MapFile,
    selected: ThingRef | undefined,
    doorways: readonly DoorwayMark[] = [],
    inside?: InsideView,
  ): void {
    const drawn = this.drawn;
    const sameSize =
      drawn !== undefined &&
      sameInside(drawn.inside, inside) &&
      drawn.file.width === file.width &&
      drawn.file.height === file.height &&
      context.canvas.width === drawn.file.width * TILE_SIZE &&
      context.canvas.height === drawn.file.height * TILE_SIZE;
    const layers = this.layers(file, inside);
    const marks = markBoxes(file, selected, doorways);
    if (
      drawn &&
      sameSize &&
      drawn.file === file &&
      sameRef(drawn.selected, selected) &&
      sameMarks(drawn.marks, marks)
    ) {
      return;
    }
    if (!drawn || !sameSize || inside) {
      drawMap(context, file, layers, selected, undefined, doorways);
      this.drawn = { file, selected, marks, inside };
      return;
    }
    // Ground and buildings, as far as their edges reach; measured against
    // what was drawn, which is what the canvas shows, rather than against the
    // layers, which may have been asked about a later map in between.
    let dirty = mapChange(drawn.file, file);
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
      drawMap(
        context,
        file,
        layers,
        selected,
        grownWithin(dirty, 0, file.width, file.height),
        doorways,
      );
    }
    this.drawn = { file, selected, marks, inside };
  }
}

const sameRef = (a: ThingRef | undefined, b: ThingRef | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.kind === b.kind && a.index === b.index);

const sameMarks = (a: ReadonlyMap<string, TileRect>, b: ReadonlyMap<string, TileRect>): boolean =>
  a.size === b.size && [...a.keys()].every((key) => b.has(key));

const overlaps = (a: TileRect, b: TileRect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** How far a trainer can watch: the box their shading can fall in. */
const SIGHT_BOX = 4;

/**
 * Everything drawn over the ground, each under a key that changes whenever
 * how it is drawn does, with the tiles it is drawn on: a figure's head is in
 * the row above it, and a trainer's shading runs on along the way they face.
 */
export function markBoxes(
  file: MapFile,
  selected: ThingRef | undefined,
  doorways: readonly DoorwayMark[] = [],
): Map<string, TileRect> {
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
  (file.doors ?? []).forEach((door, index) => add('door', index, door, door));
  for (const doorway of doorways) {
    boxes.set(
      `doorway:${JSON.stringify(doorway.at)}:${doorway.chosen ? 'chosen' : ''}`,
      tile(doorway.at.x, doorway.at.y),
    );
  }
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
