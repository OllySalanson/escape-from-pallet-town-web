import type { BuiltRoom } from '../base/rooms';
import { BASE_PIECES } from '../base/generated/basePieces';
import { BASE_SHEET_SOURCE } from '../base/baseSheet';
import type { PaintedPicture } from '../world/minimap';
import type { TileLayer } from '../world/tiles';
import { pixelFigure } from './pixelUi';
import { sourceOfTile } from './fixturePicture';

/**
 * A keeper's room as a picture on their screen: Bill among his shelves, Brock in
 * his workshop with chalk on the floor where each machine not built yet will
 * stand. Drawn from the room the yard walks into (`base/rooms.ts`'s
 * `buildRoom`), off the sheets the game has already loaded, so it is always the
 * room as this save has it - never a picture that goes stale.
 *
 * The keeper stands in it as a DOM figure (`pixelFigure`), placed on their own
 * tile, so the picture is the room and the person is the person.
 */

const TILE = 16;

/** The picture's size and where its keeper stands, in game pixels. */
export interface RoomPictureFrame {
  readonly width: number;
  readonly height: number;
  /** The keeper's feet, the point a screen centres the picture on. */
  readonly focusX: number;
  readonly focusY: number;
}

export function roomPictureFrame(built: BuiltRoom): RoomPictureFrame {
  const keeper = built.room.keeper;
  const width = built.room.width * TILE;
  const height = built.room.height * TILE;
  return {
    width,
    height,
    focusX: keeper ? keeper.position.x * TILE + TILE / 2 : width / 2,
    focusY: keeper ? keeper.position.y * TILE + TILE : height / 2,
  };
}

/**
 * The picture's markup: a canvas the room is painted into once the screen is
 * on the page (`drawRoomPicture`), its keeper standing on their tile, all of it
 * framed round the keeper and cropped by its box.
 */
export function roomPictureMarkup(built: BuiltRoom, label: string, marks = ''): string {
  const frame = roomPictureFrame(built);
  const keeper = built.room.keeper;
  const figure = keeper
    ? `<span class="room-pic-keeper" style="--kx:${keeper.position.x * TILE};--ky:${keeper.position.y * TILE}">${pixelFigure(keeper.design, keeper.name)}</span>`
    : '';
  return `<div class="room-pic" role="img" aria-label="${label}" style="--rw:${frame.width};--rh:${frame.height};--fx:${frame.focusX};--fy:${frame.focusY}"><div class="room-pic-room"><canvas data-room-picture="${built.room.id}" width="${frame.width}" height="${frame.height}"></canvas>${marks}${figure}</div></div>`;
}

/**
 * A gold box round some tiles of the picture - the bay the chosen build will
 * stand in - shown only while its card is the one the cursor is on: it carries
 * `data-shown-by`, so the screen's own detail swap shows and hides it.
 */
export function roomPictureMark(shownBy: string, area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, shown: boolean): string {
  return `<span class="room-pic-mark" data-shown-by="${shownBy}"${shown ? '' : ' hidden'} style="--mx:${area.x * TILE};--my:${area.y * TILE};--mw:${area.width * TILE};--mh:${area.height * TILE}"></span>`;
}

function drawLayer(
  context: CanvasRenderingContext2D,
  layer: TileLayer,
  built: BuiltRoom,
  image: (textureKey: string) => CanvasImageSource | undefined,
): void {
  layer.tiles.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile < 0) {
        return;
      }
      const source = sourceOfTile(tile, built.sources);
      const sheet = source ? image(source.textureKey) : undefined;
      if (!source || !sheet) {
        return;
      }
      const local = tile - source.firstIndex;
      const sx = (local % source.columns) * TILE;
      const sy = Math.floor(local / source.columns) * TILE;
      if (layer.flips[y]?.[x]) {
        context.save();
        context.translate(x * TILE + TILE, y * TILE);
        context.scale(-1, 1);
        context.drawImage(sheet, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
        context.restore();
      } else {
        context.drawImage(sheet, sx, sy, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
      }
    });
  });
}

function paint(context: CanvasRenderingContext2D, picture: PaintedPicture, x: number, y: number): void {
  if (picture.width <= 0 || picture.height <= 0 || typeof document === 'undefined') {
    return;
  }
  const scratch = document.createElement('canvas');
  scratch.width = picture.width;
  scratch.height = picture.height;
  const scratchContext = scratch.getContext('2d');
  if (!scratchContext) {
    return;
  }
  scratchContext.putImageData(new ImageData(new Uint8ClampedArray(picture.data), picture.width, picture.height), 0, 0);
  context.drawImage(scratch, x, y);
}

/**
 * Paints the room onto its canvas: its tile layers, the little sprites set on
 * it (`RoomSprite`), and the pictures of the save painted on its walls and
 * floor (`posters`, read by `poster`). A tile whose sheet is not loaded is left
 * out rather than drawn wrong.
 */
export function drawRoomPicture(
  canvas: HTMLCanvasElement,
  built: BuiltRoom,
  image: (textureKey: string) => CanvasImageSource | undefined,
  poster: (index: number) => PaintedPicture | undefined,
): void {
  const frame = roomPictureFrame(built);
  // Painted afresh at full size: any half-size copy of an older painting is stale.
  fullRooms.delete(canvas);
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, frame.width, frame.height);
  const { layers } = built;
  for (const layer of [layers.ground, layers.overlay, layers.detail]) {
    drawLayer(context, layer, built, image);
  }
  built.posters.forEach((placed, index) => {
    const picture = poster(index);
    if (picture) {
      paint(context, picture, placed.area.x * TILE, placed.area.y * TILE);
    }
  });
  const sheet = image(BASE_SHEET_SOURCE.source.textureKey);
  if (sheet) {
    for (const sprite of built.sprites) {
      const piece = BASE_PIECES[sprite.piece];
      context.drawImage(
        sheet,
        piece.column * TILE,
        piece.row * TILE,
        piece.width * TILE,
        piece.height * TILE,
        sprite.x * TILE,
        sprite.y * TILE,
        piece.width * TILE,
        piece.height * TILE,
      );
    }
  }
  for (const layer of [layers.canopy, layers.brim]) {
    drawLayer(context, layer, built, image);
  }
  clearOuterVoid(context, frame.width, frame.height);
}

/**
 * A room's outermost tiles carry the void beyond its walls, drawn black, which
 * the yard shows against its own black; on a screen it would be a black band
 * down the room's sides. Pure black in those tiles is cleared, so the room's
 * own colours behind the picture show through (`.room-pic`).
 */
function clearOuterVoid(context: CanvasRenderingContext2D, width: number, height: number): void {
  if (width <= TILE * 2 || height <= TILE * 2) {
    return;
  }
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= TILE && x < width - TILE && y >= TILE && y < height - TILE) {
        continue;
      }
      const at = (y * width + x) * 4;
      if (data[at] < 8 && data[at + 1] < 8 && data[at + 2] < 8) {
        data[at + 3] = 0;
      }
    }
  }
  context.putImageData(image, 0, 0);
}

/**
 * The scale a room is drawn at in a box: the largest whole number at which the
 * whole room fits, so its keeper and every bay in it are always in view - and,
 * in a box too small for even one, the largest whole fraction that fits (a
 * half, a third...), drawn by keeping one source pixel in so many on its own
 * canvas, so it is whole screen pixels at any zoom - never a smear, never cut.
 */
export function roomScaleFor(box: { readonly width: number; readonly height: number }, room: { readonly width: number; readonly height: number }): number {
  if (room.width <= 0 || room.height <= 0) {
    return 1;
  }
  const fits = Math.min(box.width / room.width, box.height / room.height);
  return fits >= 1 ? Math.floor(fits) : 1 / Math.ceil(1 / Math.max(fits, 1 / 8));
}

/** Where a room sits in its box along one side, in game pixels: centred. */
export function roomOffset(box: number, room: number): number {
  return Math.floor((box - room) / 2);
}

/**
 * Fits every room picture on a screen to its box, once the box is laid out:
 * the whole room at the largest whole-number scale that fits (`roomScaleFor`),
 * centred (`roomOffset`), on the game-pixel grid. Round it, the room's own
 * colours carry on - its wall's above its middle and its floor's below - so the
 * stage is the room, never a black or white band.
 */
export function fitRoomPictures(root: ParentNode, unit: number): void {
  if (unit <= 0) {
    return;
  }
  root.querySelectorAll<HTMLElement>('.room-pic').forEach((picture) => {
    const room = picture.querySelector<HTMLElement>('.room-pic-room');
    const canvas = picture.querySelector<HTMLCanvasElement>('canvas[data-room-picture]');
    if (!room || !canvas) {
      return;
    }
    const style = picture.style;
    const width = Number(style.getPropertyValue('--rw'));
    const height = Number(style.getPropertyValue('--rh'));
    const bounds = picture.getBoundingClientRect();
    const box = { width: Math.floor(bounds.width / unit), height: Math.floor(bounds.height / unit) };
    if (box.width <= 0 || box.height <= 0) {
      return;
    }
    const scale = roomScaleFor(box, { width, height });
    picture.style.setProperty('--rs', String(scale));
    // Read off the room at full size, before it may be shown at half.
    const full = fullRooms.get(canvas) ?? canvas;
    const floor = commonColour(full, 0, full.height);
    const wall = commonColour(full, 0, Math.min(full.height, TILE * 2));
    showAtScale(canvas, scale);
    // Sized off the canvas as drawn: at a fraction it is whole source pixels
    // kept, so its size is the painting's, rounded up, never a stretch of it.
    const shownWidth = scale >= 1 ? width * scale : canvas.width;
    const shownHeight = scale >= 1 ? height * scale : canvas.height;
    room.style.width = `${shownWidth * unit}px`;
    room.style.height = `${shownHeight * unit}px`;
    room.style.left = `${roomOffset(box.width, shownWidth) * unit}px`;
    room.style.top = `${roomOffset(box.height, shownHeight) * unit}px`;
    if (floor) {
      picture.style.setProperty('--room-floor', floor);
    }
    if (wall) {
      picture.style.setProperty('--room-wall', wall);
    }
  });
}

/** The room as painted at full size, kept while a canvas shows it at half. */
const fullRooms = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/**
 * Shows the painted room at half (every second pixel kept, never smoothed) or
 * puts it back at full, so a half-size room is whole screen pixels at any zoom.
 */
function showAtScale(canvas: HTMLCanvasElement, scale: number): void {
  // Always from the full painting, so a box that grows or shrinks redraws
  // from every pixel rather than from a copy already cut down.
  const full = fullRooms.get(canvas) ?? copyOf(canvas);
  const divisor = scale >= 1 ? 1 : Math.round(1 / scale);
  const width = Math.ceil(full.width / divisor);
  const height = Math.ceil(full.height / divisor);
  if (divisor === 1) {
    fullRooms.delete(canvas);
  } else {
    fullRooms.set(canvas, full);
  }
  if (canvas.width === width && canvas.height === height) {
    return;
  }
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) {
    context.imageSmoothingEnabled = false;
    context.drawImage(full, 0, 0, full.width, full.height, 0, 0, width, height);
  }
}

/** A copy of what a canvas holds now. */
function copyOf(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')?.drawImage(canvas, 0, 0);
  return copy;
}

/**
 * The colour most of a band of the painted room is, read every few pixels: over
 * the whole room that is its floor, over its top two rows its wall - so a bench
 * or a machine is never mistaken for either.
 */
function commonColour(canvas: HTMLCanvasElement, top: number, bottom: number): string | undefined {
  try {
    const { width } = canvas;
    const rows = bottom - top;
    if (width <= 0 || rows <= 0) {
      return undefined;
    }
    const data = canvas.getContext('2d')?.getImageData(0, top, width, rows).data;
    if (!data) {
      return undefined;
    }
    const counts = new Map<number, number>();
    for (let y = 0; y < rows; y += 3) {
      for (let x = 0; x < width; x += 3) {
        const at = (y * width + x) * 4;
        if (data[at + 3] === 0) {
          continue;
        }
        const colour = (data[at] << 16) | (data[at + 1] << 8) | data[at + 2];
        counts.set(colour, (counts.get(colour) ?? 0) + 1);
      }
    }
    const [most] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return most === undefined ? undefined : `#${most.toString(16).padStart(6, '0')}`;
  } catch {
    return undefined;
  }
}