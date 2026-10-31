/**
 * A door that opens: FireRed's own room for the building it is (`maker/areas.ts`),
 * named for who keeps it, with somebody or something in it. What a place has that
 * a route does not, and the same few lines for every district that has one.
 */
import { makeInside } from '../../../../src/game/maker/areas';
import type { MapFile, MapFileArea, MapFileBuilding, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';

export interface InsideExtras extends Partial<Pick<MapFile, 'itemSpots' | 'pokemon' | 'landmarks'>> {
  /** A different room from the one its building would open on. */
  readonly room?: Pick<MapFileArea, 'style' | 'width' | 'height' | 'ground' | 'buildings'>;
  /** Furniture to take out of the room its building opens on. */
  readonly without?: readonly string[];
}

const HOUSE_GROUND = ['BBBBBBBBBBBB', 'BBBBBBBBBBBB', ...Array<string>(7).fill('PPPPPPPPPPPP')];

/** The public room of an inn: FireRed's house with the tables out, for a house that is an inn. */
export const INN_ROOM: NonNullable<InsideExtras['room']> = {
  style: 'house',
  width: 12,
  height: 9,
  ground: HOUSE_GROUND,
  buildings: [
    { kind: 'kitchen-sink', x: 0, y: 1 },
    { kind: 'cupboard', x: 2, y: 0 },
    { kind: 'notice', x: 5, y: 0 },
    { kind: 'window', x: 7, y: 0 },
    { kind: 'tall-drawers', x: 10, y: 0 },
    { kind: 'dining-table', x: 1, y: 3 },
    { kind: 'dining-table', x: 7, y: 3 },
    { kind: 'dining-table', x: 1, y: 6 },
    { kind: 'dining-table', x: 8, y: 6 },
    { kind: 'potted-plant', x: 11, y: 2 },
  ],
};

/** `file` with the building of this kind at this tile opening on a room of this name. */
export function withInside(
  file: MapFile,
  prefix: string,
  kind: MapFileOutdoorBuildingKind,
  x: number,
  y: number,
  name: string,
  people: NonNullable<MapFile['people']>,
  more: InsideExtras = {},
): MapFile {
  const index = file.buildings.findIndex(
    (building: MapFileBuilding) => building.kind === kind && building.x === x && building.y === y,
  );
  const made = makeInside(file, index);
  if (!made.made) throw new Error(`${name}: ${made.reason}`);
  const area = made.area;
  const id = `${prefix}-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`.slice(0, 40);
  return {
    ...made.file,
    areas: (made.file.areas ?? []).map((one) =>
      one.id === area
        ? { ...one, ...more.room, buildings: (more.room?.buildings ?? one.buildings).filter((piece) => !more.without?.includes(piece.kind)), id, name }
        : one,
    ),
    links: (made.file.links ?? []).map((link) => ({
      ...link,
      ends: link.ends.map((end) =>
        end.area === area
          ? { ...end, area: id, ...(more.room ? { x: Math.floor(more.room.width / 2), y: more.room.height - 1 } : {}) }
          : end,
      ) as unknown as typeof link.ends,
    })),
    people: [...(made.file.people ?? []), ...people.map((one) => ({ ...one, area: id }))],
    itemSpots: [...made.file.itemSpots, ...(more.itemSpots ?? []).map((one) => ({ ...one, area: id }))],
    pokemon: [...(made.file.pokemon ?? []), ...(more.pokemon ?? []).map((one) => ({ ...one, area: id }))],
    landmarks: [...(made.file.landmarks ?? []), ...(more.landmarks ?? []).map((one) => ({ ...one, area: id }))],
  };
}
