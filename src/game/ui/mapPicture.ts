import {
  fitPicture,
  fittedSize,
  paintMinimap,
  type Minimap,
  type PictureFit,
  type PictureSize,
} from '../world/minimap';
import { escapeAttribute } from './pixelUi';

/**
 * A picture of a map on a menu screen, drawn as big as the room it is given.
 *
 * The drop-in screen used to draw its map in a banner a fixed hundred game
 * pixels tall, which is why the Floodplain was halved into a 64-pixel square
 * and why every map in the game was held to 64x76 tiles - a taller one would
 * have been clipped. Menus take the whole window now (`display/menuStage.ts`),
 * so a picture is fitted to its window instead: the largest whole number of
 * game pixels to the tile that fits (`fitPicture`), and several tiles to the
 * pixel only when the window is smaller than the map.
 *
 * How big that is can only be answered by the browser, after the screen is
 * laid out, so the markup here carries what the picture is to be fitted *to*
 * and `fitMapPictures` answers it in the overlay's measured pass
 * (`MenuOverlay.onMeasure`) - before the columns are counted, because a
 * picture in an `auto` column is what decides how wide that column is.
 *
 * Two ways to fit, and the difference is the design:
 *
 * - `own`: one place at a time. The frame is the size the biggest map (the
 *   `reference`) fits at, so the screen does not move when the cursor changes
 *   the place, and the map inside it is drawn as big as it will go in that
 *   frame. The drop-in screen is this, because what it is for is reading the
 *   place you are about to drop into.
 * - `shared`: several side by side, all at one scale - the largest at which
 *   every one of them fits its own card - standing on one line with whatever
 *   is under them level. The wall map in Oak's Lab hangs the four maps like
 *   this, so the Floodplain reads as four times Route 1 because it is.
 */
export type PictureFitMode = 'shared' | 'own';

interface PictureCommon {
  /** Which picture this is: handed back to the caller's drawing function. */
  readonly key: string;
  /** What a screen reader is told the picture is. */
  readonly label: string;
  /** The map this picture is of, in tiles. */
  readonly size: PictureSize;
  readonly className?: string;
}

export type MapPictureOptions =
  | (PictureCommon & {
      readonly mode: 'own';
      /** The map the frame is sized against, in tiles: the biggest there is. */
      readonly reference: PictureSize;
      /**
       * For a frame in a column that is as wide as its picture: how many game
       * pixels of the screen's body must be left for everything else. Without
       * it the frame is measured for its width like any other box.
       */
      readonly leave?: number;
    })
  | (PictureCommon & { readonly mode: 'shared' });

/** The ring the stylesheet draws round a picture: one game pixel each side. */
export const PICTURE_RING = 1;

export function mapPictureFrame(options: MapPictureOptions): string {
  const fitting =
    options.mode === 'own'
      ? ` data-fit-width="${options.reference.width}" data-fit-height="${options.reference.height}"${
          options.leave === undefined ? '' : ` data-fit-leave="${options.leave}"`
        }`
      : '';
  // A span, so a picture can stand inside a button - a map on the wall is a
  // thing the cursor lands on - without the markup being invalid there.
  return `<span class="px-picture${options.className ? ` ${options.className}` : ''}" data-picture-frame data-fit="${options.mode}"${fitting}><canvas class="px-minimap" data-picture="${escapeAttribute(options.key)}" data-picture-width="${options.size.width}" data-picture-height="${options.size.height}" role="img" aria-label="${escapeAttribute(options.label)}"></canvas></span>`;
}

export interface FramePlan {
  /** The frame, in game pixels, ring included. */
  readonly frame: PictureSize;
  /** How the picture inside it is drawn. */
  readonly fit: PictureFit;
}

/** A room in game pixels, less the ring round the picture. */
function inside(room: PictureSize): PictureSize {
  return {
    width: Math.max(1, Math.floor(room.width) - PICTURE_RING * 2),
    height: Math.max(1, Math.floor(room.height) - PICTURE_RING * 2),
  };
}

const ringed = (size: PictureSize): PictureSize => ({
  width: size.width + PICTURE_RING * 2,
  height: size.height + PICTURE_RING * 2,
});

/**
 * One place in a frame sized for the biggest (`own`). Phaser- and
 * browser-free, so the sizing rules are tested rather than eyeballed.
 */
export function planOwnFrame(size: PictureSize, reference: PictureSize, room: PictureSize): FramePlan {
  const frameFit = fitPicture(reference, inside(room));
  const drawn = fittedSize(reference, frameFit);
  return { frame: ringed(drawn), fit: fitPicture(size, drawn) };
}

/** How big a fit draws a tile: game pixels to a tile, which may be a fraction. */
const scaleOf = (fit: PictureFit): number => fit.zoom / fit.step;

/**
 * Several maps side by side at one scale (`shared`): the largest at which
 * every one of them fits the room its own card gives it. The frames are all
 * as tall as the tallest picture, so the pictures stand on one line and
 * whatever hangs under them is level.
 */
export function planSharedRow(
  entries: readonly { readonly size: PictureSize; readonly room: PictureSize }[],
): { readonly fit: PictureFit; readonly frames: readonly PictureSize[] } {
  const fits = entries.map((entry) => fitPicture(entry.size, inside(entry.room)));
  const fit = fits.reduce<PictureFit>(
    (smallest, candidate) => (scaleOf(candidate) < scaleOf(smallest) ? candidate : smallest),
    fits[0] ?? { step: 1, zoom: 1 },
  );
  const drawn = entries.map((entry) => ringed(fittedSize(entry.size, fit)));
  const height = Math.max(0, ...drawn.map((size) => size.height));
  return { fit, frames: drawn.map((size) => ({ width: size.width, height })) };
}

/**
 * Columns for a row of pictures drawn at one scale: each as wide as its own
 * map is in proportion to the others, plus the same `overhead` each for the
 * card round it, in whole game pixels - the leftover pixels handed out one at
 * a time from the first, because a track a third of a pixel wide draws every
 * frame in the row soft (`columnLayout.ts` says the same of a list).
 *
 * Equal columns were tried first: the Floodplain is twice as wide as the
 * other three, so four equal columns left it one pixel short of drawing tile
 * for tile at the size the lobby's windows mostly are, while the others had
 * room to spare. Sharing the row the way the maps share the wall is what lets
 * the biggest map be as big as the row can make it.
 */
export function shareTracks(
  total: number,
  weights: readonly number[],
  gap: number,
  overhead: number,
): readonly number[] {
  const room = Math.max(
    0,
    Math.floor(total) - gap * Math.max(0, weights.length - 1) - overhead * weights.length,
  );
  const sum = weights.reduce((all, weight) => all + Math.max(0, weight), 0) || 1;
  const tracks = weights.map((weight) => Math.floor((room * Math.max(0, weight)) / sum));
  let spare = room - tracks.reduce((all, track) => all + track, 0);
  for (let index = 0; spare > 0 && tracks.length > 0; index = (index + 1) % tracks.length) {
    tracks[index] += 1;
    spare -= 1;
  }
  return tracks.map((track) => track + overhead);
}

/** Markup for a row of cards whose columns `fitMapPictures` shares out by `weights`. */
export function pictureRowAttributes(weights: readonly number[], gap: number, overhead: number): string {
  return `data-picture-row="${weights.join(',')}" data-picture-gap="${gap}" data-picture-overhead="${overhead}"`;
}

/**
 * The room each `shared` frame has: as wide as its card, and as tall as the
 * card less everything else in it. A shared frame is sized to its picture once
 * it is fitted, so its own height is never the room it had - it is asked of
 * the card instead. The cards share their rows (a subgrid), so what else is in
 * a card is as tall as the tallest of its kind in any card: a name that wraps
 * in one card takes the same line from every picture.
 */
function sharedRooms(frames: readonly HTMLElement[], unit: number): readonly PictureSize[] {
  const siblings = frames.map((frame) =>
    [...(frame.parentElement?.children ?? [])].filter((child) => child !== frame) as HTMLElement[],
  );
  const tallest: number[] = [];
  siblings.forEach((others) =>
    others.forEach((child, index) => {
      tallest[index] = Math.max(tallest[index] ?? 0, child.offsetHeight);
    }),
  );
  return frames.map((frame, index) => {
    const card = frame.parentElement;
    if (!card) {
      return { width: frame.clientWidth / unit, height: frame.clientHeight / unit };
    }
    const style = getComputedStyle(card);
    const others = siblings[index];
    const gap = Number.parseFloat(style.rowGap) || 0;
    const content =
      card.clientHeight -
      Number.parseFloat(style.paddingTop) -
      Number.parseFloat(style.paddingBottom) -
      others.reduce((sum, _child, at) => sum + (tallest[at] ?? 0), 0) -
      gap * (others.length + 1);
    return { width: frame.clientWidth / unit, height: content / unit };
  });
}

/**
 * Fits and paints every map picture on a screen. `draw` builds the picture for
 * a key at a step - a caller holds the save and the maps, this holds neither.
 * A canvas already painted at the fit it would get now is left alone, because
 * this runs every time the cursor moves.
 */
export function fitMapPictures(
  root: HTMLElement,
  unit: number,
  draw: (key: string, step: number) => Minimap | undefined,
): void {
  if (unit <= 0) {
    return;
  }
  const whole = (value: number): string => `${Math.round(value) * unit}px`;
  const number = (value: string | undefined): number => Number(value) || 0;
  // The rows first, because a card's width is the room its picture has.
  root.querySelectorAll<HTMLElement>('[data-picture-row]').forEach((row) => {
    const style = getComputedStyle(row);
    const inner =
      (row.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)) /
      unit;
    const tracks = shareTracks(
      inner,
      (row.dataset.pictureRow ?? '').split(',').map(Number),
      number(row.dataset.pictureGap),
      number(row.dataset.pictureOverhead),
    );
    row.style.gridTemplateColumns = tracks.map(whole).join(' ');
  });

  const paint = (
    frame: HTMLElement,
    canvas: HTMLCanvasElement,
    fit: PictureFit,
    place: 'centre' | 'foot',
  ): void => {
    const signature = `${fit.step}:${fit.zoom}`;
    if (canvas.dataset.painted !== signature) {
      const picture = draw(canvas.dataset.picture ?? '', fit.step);
      const context = canvas.getContext('2d');
      if (!picture || !context) {
        return;
      }
      const painted = paintMinimap(picture, fit.zoom);
      canvas.width = painted.width;
      canvas.height = painted.height;
      context.putImageData(new ImageData(painted.data, painted.width, painted.height), 0, 0);
      canvas.style.width = whole(painted.width);
      canvas.style.height = whole(painted.height);
      canvas.dataset.painted = signature;
    }
    // On whole game pixels, so its one-pixel ring is never drawn soft.
    const spareX = frame.clientWidth / unit - canvas.width;
    const spareY = frame.clientHeight / unit - canvas.height;
    canvas.style.left = whole(Math.floor(spareX / 2));
    canvas.style.top = whole(place === 'foot' ? spareY - PICTURE_RING : Math.floor(spareY / 2));
  };

  const pictures = [...root.querySelectorAll<HTMLElement>('[data-picture-frame]')]
    .map((frame) => ({ frame, canvas: frame.querySelector<HTMLCanvasElement>('canvas[data-picture]') }))
    .filter((entry): entry is { frame: HTMLElement; canvas: HTMLCanvasElement } => entry.canvas !== null);
  const size = (canvas: HTMLCanvasElement): PictureSize => ({
    width: number(canvas.dataset.pictureWidth),
    height: number(canvas.dataset.pictureHeight),
  });

  for (const { frame, canvas } of pictures.filter((entry) => entry.frame.dataset.fit === 'own')) {
    const leave = frame.dataset.fitLeave;
    const body = frame.closest<HTMLElement>('.px-body') ?? root;
    // A column as wide as its picture is still as wide as its heading: at the
    // smallest stage the place's name holds the column open wider than the
    // share `leave` allows, and that width is room the picture may use too.
    if (leave !== undefined) {
      frame.style.removeProperty('width');
    }
    const plan = planOwnFrame(
      size(canvas),
      { width: number(frame.dataset.fitWidth), height: number(frame.dataset.fitHeight) },
      {
        width:
          leave === undefined
            ? frame.clientWidth / unit
            : Math.max(frame.clientWidth / unit, body.clientWidth / unit - Number(leave)),
        height: frame.clientHeight / unit,
      },
    );
    if (leave !== undefined) {
      frame.style.width = whole(plan.frame.width);
    }
    paint(frame, canvas, plan.fit, 'centre');
  }

  const shared = pictures.filter((entry) => entry.frame.dataset.fit === 'shared');
  if (shared.length === 0) {
    return;
  }
  // Measured with every frame back at no height of its own, so the room each
  // card has is the room it has now rather than what the last fit left it.
  shared.forEach(({ frame }) => frame.style.removeProperty('height'));
  const rooms = sharedRooms(
    shared.map(({ frame }) => frame),
    unit,
  );
  const row = planSharedRow(shared.map(({ canvas }, index) => ({ size: size(canvas), room: rooms[index] })));
  shared.forEach(({ frame, canvas }, index) => {
    frame.style.height = whole(row.frames[index].height);
    paint(frame, canvas, row.fit, 'foot');
  });
}
