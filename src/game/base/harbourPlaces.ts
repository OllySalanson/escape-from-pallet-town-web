import type { GridPosition } from '../movement/gridMovement';

/**
 * The parts of THE HARBOUR, by name, as a raid map names its districts
 * (`world/districts.ts`) - and for the same reason. A stranger who walks a
 * place once remembers the parts that said what they were; a harbour that is
 * one name from the jetty to the green is one place with a lot of ground.
 *
 * Each is rectangles of tiles, the first listed winning where two overlap, and
 * every walkable tile of the yard is in one (`harbourPlaces.test.ts`). Walking
 * from one into another puts its name up in FireRed's own way - the map-name
 * sign at the top of the screen, for a moment (`base/placeNameSign.ts`).
 */
export interface HarbourPlace {
  readonly id: string;
  /** What the sign says. */
  readonly name: string;
  readonly areas: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
}

export const HARBOUR_PLACES: readonly HarbourPlace[] = [
  {
    id: 'long-pier',
    name: 'THE LONG PIER',
    areas: [{ x: 28, y: 22, width: 3, height: 6 }],
  },
  {
    id: 'breakwater',
    name: 'THE BREAKWATER',
    areas: [
      { x: 59, y: 21, width: 2, height: 9 },
      { x: 38, y: 30, width: 23, height: 2 },
    ],
  },
  {
    id: 'cove',
    name: 'THE COVE',
    areas: [{ x: 48, y: 17, width: 13, height: 7 }],
  },
  {
    id: 'docks',
    name: 'THE DOCKS',
    areas: [
      { x: 36, y: 17, width: 12, height: 6 },
      { x: 22, y: 20, width: 26, height: 3 },
    ],
  },
  {
    id: 'quay',
    name: 'THE QUAY',
    areas: [{ x: 3, y: 17, width: 33, height: 6 }],
  },
  {
    id: 'square',
    name: 'HARBOUR SQUARE',
    areas: [{ x: 22, y: 14, width: 13, height: 3 }],
  },
  {
    id: 'arena-square',
    name: 'ARENA SQUARE',
    areas: [{ x: 3, y: 7, width: 11, height: 10 }],
  },
  {
    id: 'green',
    name: 'THE GREEN',
    areas: [{ x: 44, y: 4, width: 19, height: 13 }],
  },
  {
    id: 'yard',
    name: 'KEEPERS’ ROW',
    areas: [{ x: 14, y: 4, width: 30, height: 13 }],
  },
];

/** The part of the harbour a tile is in, or null where nobody can stand. */
export function harbourPlaceAt(tile: GridPosition): HarbourPlace | null {
  return (
    HARBOUR_PLACES.find((place) =>
      place.areas.some(
        (area) => tile.x >= area.x && tile.x < area.x + area.width && tile.y >= area.y && tile.y < area.y + area.height,
      ),
    ) ?? null
  );
}
