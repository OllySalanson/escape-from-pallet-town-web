import {
  MAP_FILE_LIMITS,
  plantedProp,
  type MapFile,
  type MapFileLink,
  type MapFileLinkEnd,
} from '../world/mapFile';
import { MATERIAL_CHARS } from '../world/tileset/materials';
import { areaById, doorEnd, linkThroughDoor, occupiedIn, type AreaId } from './areas';
import type { GridPoint } from './draft';

/**
 * A passage between two places that both exist already, made in two clicks:
 * where it goes in, then where it comes out.
 *
 * MAKE ITS CAVE and ADD A FLOOR BELOW each make a new place and the way into it
 * at once. A passage is the other half - a second mouth into a cave there is
 * already, a ladder from one cave down into another - and it is made the way a
 * maker thinks of it: put the entrance down, then point at where it comes out.
 * Each end is placed by the same rule FireRed stands that kind of way through
 * by, and the pair is always a pair FireRed has: a ladder down comes out at the
 * foot of a ladder up, a cave's daylight comes out of a cave mouth.
 */

/**
 * The ways through a maker puts down one end at a time - and the Underground
 * Path, put down by choosing one of its huts and then the hut it comes up in
 * (`makeUndergroundPath` makes all of it at once).
 */
export type PassageLook = 'ladder-down' | 'ladder-up' | 'cave-exit' | 'mouth' | 'path-hut';

/** The far end each kind of entrance comes out at. */
export const PASSAGE_PAIRS: Readonly<Record<PassageLook, PassageLook>> = {
  'ladder-down': 'ladder-up',
  'ladder-up': 'ladder-down',
  'cave-exit': 'mouth',
  mouth: 'cave-exit',
  'path-hut': 'path-hut',
};

/** An entrance put down, waiting to be told where it comes out. */
export interface PendingPassage {
  readonly from: MapFileLinkEnd;
  /** What its far end has to be. */
  readonly to: PassageLook;
}

export type PassageEnd =
  | { readonly placed: true; readonly end: MapFileLinkEnd }
  | { readonly placed: false; readonly reason: string };

/** What each end is called when a maker is told what to click for it. */
export const PASSAGE_TARGETS: Readonly<Record<PassageLook, string>> = {
  'ladder-down': 'the floor of a cave, where its hole goes',
  'ladder-up': 'the floor of a cave, where its ladder stands',
  'cave-exit': "a cave's south wall, where the daylight goes",
  mouth: 'a cave mouth outside that leads nowhere yet',
  'path-hut': 'another Underground Path hut outside, where the path comes up',
};

/** The Underground Path hut outside whose footprint a tile is in, by its place in the list. */
export function pathHutAt(file: MapFile, area: AreaId, tile: GridPoint): number | undefined {
  if (area !== undefined) {
    return undefined;
  }
  const index = file.buildings.findIndex((building) => {
    if (building.kind !== 'underground-path') {
      return false;
    }
    const prop = plantedProp(building.kind);
    return (
      tile.x >= building.x &&
      tile.y >= building.y &&
      tile.x < building.x + prop.width &&
      tile.y < building.y + prop.height
    );
  });
  return index >= 0 ? index : undefined;
}

/**
 * The end of a way through of this kind at the tile clicked, or why it cannot
 * stand there. A hole is the tile clicked, walked into from the tile below
 * it; a ladder up stands its foot on the tile clicked, its top above; a
 * cave's daylight is cut into the rock clicked, walked into from the floor
 * above it; a cave mouth is the mouth clicked, walked into from in front.
 */
export function passageEndAt(
  file: MapFile,
  area: AreaId,
  look: PassageLook,
  tile: GridPoint,
): PassageEnd {
  if (look === 'path-hut') {
    return { placed: false, reason: 'Click an Underground Path hut outside.' };
  }
  if (look === 'mouth') {
    if (area !== undefined) {
      return { placed: false, reason: 'A cave mouth is outside: go OUTSIDE and click one.' };
    }
    const index = file.buildings.findIndex(
      (building) =>
        building.kind === 'cave-mouth' && building.x === tile.x && building.y === tile.y,
    );
    const mouth = file.buildings[index];
    const end = mouth ? doorEnd(mouth) : undefined;
    if (!mouth || !end) {
      return { placed: false, reason: 'Click a cave mouth.' };
    }
    if (linkThroughDoor(file, mouth)) {
      return { placed: false, reason: 'That cave mouth leads somewhere already.' };
    }
    return { placed: true, end };
  }
  const cave = areaById(file, area);
  if (!cave || cave.kind !== 'cave') {
    return { placed: false, reason: 'That goes in a cave: choose one above, then click in it.' };
  }
  const taken = occupiedIn(file, cave.id);
  const letter = (x: number, y: number): string | undefined => cave.ground[y]?.[x];
  const floor = (x: number, y: number): boolean =>
    (letter(x, y) === MATERIAL_CHARS.paving || letter(x, y) === MATERIAL_CHARS.sand) &&
    !taken(x, y);
  const { x, y } = tile;
  switch (look) {
    case 'ladder-down':
      return floor(x, y) && floor(x, y + 1)
        ? { placed: true, end: { area: cave.id, x, y: y + 1, toward: 'up', look } }
        : {
            placed: false,
            reason:
              'A hole needs clear floor, and clear floor in front of it to walk into it from.',
          };
    case 'ladder-up':
      return floor(x, y) && letter(x, y - 1) !== undefined && !taken(x, y - 1)
        ? { placed: true, end: { area: cave.id, x, y, toward: 'up', look } }
        : { placed: false, reason: 'A ladder needs clear floor at its foot and room above it.' };
    case 'cave-exit': {
      const rock = (at: number): boolean => letter(at, y) === MATERIAL_CHARS.wall;
      return rock(x) && rock(x - 1) && rock(x + 1) && floor(x, y - 1)
        ? { placed: true, end: { area: cave.id, x, y: y - 1, toward: 'down', look } }
        : {
            placed: false,
            reason:
              "The daylight is cut into the cave's south wall, with rock either side of it and floor in front.",
          };
    }
  }
}

/** The two ends as a way through, or why the map cannot take another. */
export function linkPassage(
  file: MapFile,
  from: MapFileLinkEnd,
  to: MapFileLinkEnd,
):
  | { readonly linked: true; readonly file: MapFile; readonly link: number }
  | { readonly linked: false; readonly reason: string } {
  if ((file.links ?? []).length >= MAP_FILE_LIMITS.maxLinks) {
    return { linked: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxLinks} ways through.` };
  }
  if (from.area === to.area && from.x === to.x && from.y === to.y) {
    return { linked: false, reason: 'A way through has to come out somewhere else.' };
  }
  const link: MapFileLink = { ends: [from, to] };
  const links = [...(file.links ?? []), link];
  return { linked: true, file: { ...file, links }, link: links.length - 1 };
}
