import {
  buildMinimap,
  fitPicture,
  paintMinimap,
  type PaintedPicture,
  type PictureFit,
  type PictureSize,
} from '../world/minimap';
import { MAP_FILE_STAMPS, type MapFile } from '../world/mapFile';
import { materialForChar, type Material } from '../world/tileset/materials';
import { buildingSize } from './draft';

/**
 * The whole map at a glance, for the corner of the maker's map window: the
 * same picture the drop-in screen draws of a map (`world/minimap.ts`), one
 * colour a tile and the ways in and out pinned on it, fitted to a small frame
 * at a whole number of game pixels to the tile - or several tiles to the pixel
 * for a map bigger than the frame. It is how a maker finds their way round a
 * 256x256 map without scrolling across four screens of it.
 */

/** The most room the overview takes in the corner of the map window, in game pixels. */
export const OVERVIEW_ROOM: PictureSize = { width: 96, height: 72 };

/**
 * Whether the overview, `frame` across and down as drawn, leaves the map window
 * it stands in most of itself: it is shown only while it covers no more than
 * half of that window across and half of it down. In a small window it was
 * bigger than the window and spilled out over the paint tools beside it, and a
 * map you cannot see for its overview is no help finding your way round it.
 */
export function overviewLeavesRoom(frame: PictureSize, window: PictureSize): boolean {
  return frame.width * 2 <= window.width && frame.height * 2 <= window.height;
}

export interface Overview {
  readonly picture: PaintedPicture;
  readonly fit: PictureFit;
}

/** What each tile is made of, as the game reads it: a stamp is its ground, a building its wall. */
function terrainOf(file: MapFile): Material[][] {
  const terrain = file.ground.map((row) =>
    [...row].map(
      (letter) =>
        materialForChar(letter) ??
        materialForChar(MAP_FILE_STAMPS[letter]?.ground ?? '') ??
        'grass',
    ),
  );
  for (const building of file.buildings) {
    const size = buildingSize(building.kind);
    for (let y = building.y; y < building.y + size.height; y += 1) {
      for (let x = building.x; x < building.x + size.width; x += 1) {
        if (terrain[y]?.[x] !== undefined) {
          terrain[y][x] = 'wall';
        }
      }
    }
  }
  return terrain;
}

/** The overview of `file`, whose collision the maker's layers already know. */
export function overviewOf(
  file: MapFile,
  collision: readonly (readonly boolean[])[],
  room: PictureSize = OVERVIEW_ROOM,
): Overview {
  const fit = fitPicture(file, room);
  const every = new Set<number>();
  for (let index = 0; index < file.width * file.height; index += 1) {
    every.add(index);
  }
  const picture = buildMinimap({
    map: {
      width: file.width,
      height: file.height,
      terrain: terrainOf(file),
      collision: collision as boolean[][],
    },
    surveyed: every,
    marks: [
      ...file.exits.map((exit) => ({ position: { x: exit.x, y: exit.y }, char: 'X' })),
      ...file.dropIns.map((dropIn) => ({ position: { x: dropIn.x, y: dropIn.y }, char: 'I' })),
    ],
    step: fit.step,
  });
  return { picture: paintMinimap(picture, fit.zoom), fit };
}
