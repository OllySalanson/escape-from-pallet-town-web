/**
 * Where a map file's places lie in the one grid the game plays: the outdoors at
 * the origin, each area east of it. Apart from `mapAreas.ts`, which builds the
 * layers, because the trainers the game authors inside a room of a shipped map
 * (`trainers.ts`) stand where this says, and that module sits under everything
 * `mapAreas.ts` imports. It imports nothing but types.
 */
import type { Rect } from './interiors';
import type { MapFileArea, MapFileAreaKind, MapFileAreaStyle } from './mapFile';

/** One place of a composed map: the outdoors, or one of the file's areas. */
export interface PlacedArea {
  /** The area's id in the file; undefined is the outdoors. */
  readonly id: string | undefined;
  /** What it is called on the plate that rises when you walk in. */
  readonly name: string;
  readonly kind: 'outdoors' | MapFileAreaKind;
  /** How it is dressed (`MapFileArea.style`); the outdoors has none. */
  readonly style?: MapFileAreaStyle;
  /** Where it lies in the composed grid. */
  readonly rect: Rect;
  /**
   * Whether whoever is in it is out of sight of a hunter outside it. A place
   * hides you only when it has two doors out of it onto the outdoors, so no
   * hunter waiting on the doorstep it last saw you on can shut you in
   * (`buildingInsides.ts`); anywhere else the hunter follows you in.
   */
  readonly hides?: boolean;
}

/** Tiles of dark between one area and the next. */
const GAP = 1;

/**
 * Where each area lies beside an outdoors of a given size: columns of areas
 * east of it, each column as tall as the outdoors (and never shorter than a
 * big room), so the grid stays close to square. `margin` is dark left round
 * the far side of the areas, so a room's floor never lies on the grid's own
 * edge - which a shipped map is held to (`mapStructure.testkit.ts`). A column
 * always leaves a row of dark under its last room, margin or not: a shipped map
 * drawn as a file has none, and the vale's rooms came to end exactly on the row
 * below which there was no more grid.
 */
export function layOutAreas(
  outdoors: { readonly name: string; readonly width: number; readonly height: number },
  areas: readonly (Pick<MapFileArea, 'id' | 'name' | 'kind' | 'width' | 'height'> &
    Partial<Pick<MapFileArea, 'style'>>)[],
  margin = 0,
): {
  readonly width: number;
  readonly height: number;
  readonly areas: readonly PlacedArea[];
} {
  const placed: PlacedArea[] = [
    {
      id: undefined,
      name: outdoors.name,
      kind: 'outdoors',
      rect: { x: 0, y: 0, width: outdoors.width, height: outdoors.height },
    },
  ];
  const columnLimit = Math.max(outdoors.height, 32);
  let columnX = outdoors.width + GAP;
  let columnWidth = 0;
  let y = margin;
  let width = outdoors.width;
  let height = outdoors.height;
  for (const area of areas) {
    if (y > margin && y + area.height + Math.max(margin, 1) > columnLimit) {
      columnX += columnWidth + GAP;
      columnWidth = 0;
      y = margin;
    }
    placed.push({
      id: area.id,
      name: area.name,
      kind: area.kind,
      ...(area.style ? { style: area.style } : {}),
      rect: { x: columnX, y, width: area.width, height: area.height },
    });
    columnWidth = Math.max(columnWidth, area.width);
    width = Math.max(width, columnX + area.width + margin);
    height = Math.max(height, y + area.height + margin);
    y += area.height + GAP;
  }
  return { width, height, areas: placed };
}
