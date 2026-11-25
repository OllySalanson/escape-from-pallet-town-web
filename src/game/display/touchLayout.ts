/**
 * Where everything goes on a touch screen: the game, the menus, and the pad
 * (`ui/touchPad.ts`) that plays it, so a thumb never covers the game and the
 * game never sits under a thumb.
 *
 * A phone held upright is a Game Boy: the game across the top, the pad across
 * the bottom - the d-pad under the left thumb, OK and BACK under the right, the
 * screen's own keys (PACK, TEAM...) in a row above them, and SOUND and FEEDBACK
 * in a bar over the game. On its side it is a Game Boy Advance: the game in the
 * middle, the d-pad in the left-hand column and OK and BACK in the right, with
 * the screen's keys over the buttons and SOUND and FEEDBACK over the d-pad.
 *
 * Every number is CSS pixels. The game itself is still fitted by
 * `display/stage.ts`, only into `game` rather than the whole window, and the
 * menus by `display/menuStage.ts` into `menus`, which is the game's room and
 * the band between it and the screen's keys: a menu is free to cover the game
 * it was opened over, never the pad that works it.
 */
import { computeStage, onDevicePixel, type StageSize } from './stage';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The parts of the screen a notch, a rounded corner or a home bar keeps. */
export interface SafeInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export const NO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface TouchLayout {
  readonly orientation: 'portrait' | 'landscape';
  /** How big the pad is drawn: 1 as designed, less where a small screen needs the room, more where a tall one has it. */
  readonly padScale: number;
  /** The room the canvas is fitted in, and the box it is placed in. */
  readonly game: Rect;
  readonly canvas: Rect;
  /** The game screen fitted into `game`: `stage.zoom` is one game pixel in CSS pixels. */
  readonly stage: StageSize;
  /** The room the menu layer is fitted in. */
  readonly menus: Rect;
  /** The d-pad's square: the whole square answers a thumb, not only the cross. */
  readonly dpad: Rect;
  /** OK and BACK. */
  readonly buttons: Rect;
  /**
   * Where the screen's own keys stand: one tray across the phone upright, and
   * on its side two, one over each thumb, the keys shared between them.
   * A tray is the same size whatever stands in it, so the pad never jumps.
   */
  readonly trays: readonly Rect[];
  /** How many of the screen's keys a tray holds across one row, at most. */
  readonly trayColumns: number;
  /** SOUND and FEEDBACK. */
  readonly system: Rect;
}

/** The pad as designed, before `padScale`. */
export const PAD = {
  /** The d-pad's square. Each arm is a third of it: 52px, past the 44px a fingertip asks. */
  dpad: 156,
  /** OK and BACK together, set on a slant as a Game Boy's are. */
  buttonsWidth: 172,
  buttonsHeight: 156,
  /** One of the screen's keys: past 44px, the least a fingertip asks. */
  chipHeight: 48,
  chipGap: 8,
  /** SOUND and FEEDBACK, each a square a fingertip wide. */
  systemSize: 44,
  /** The one gutter everything stands off the edges by. */
  margin: 16,
  gap: 16,
} as const;

/** The least the pad is shrunk to make room for the smallest game screen beside it. */
export const MIN_PAD_SCALE = 0.75;
/** The most a tall phone grows it: room under the thumbs is spent on bigger controls. */
export const MAX_PAD_SCALE = 1.2;

/** The narrowest the game's column may be on a phone held sideways: the smallest game screen at 1x. */
const MIN_GAME_WIDTH = 320;

const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width: Math.max(0, width),
  height: Math.max(0, height),
});

/** The canvas's box once `stage.ts` has fitted the game into `room`, placed on device pixels, and its zoom. */
function placeCanvas(room: Rect, devicePixelRatio: number, lean: number): { readonly box: Rect; readonly stage: StageSize } {
  const stage = computeStage(room.width, room.height, devicePixelRatio);
  const width = stage.width * stage.zoom;
  const height = stage.height * stage.zoom;
  return {
    box: rect(
      onDevicePixel(room.x + Math.max(0, (room.width - width) / 2), devicePixelRatio),
      onDevicePixel(room.y + Math.max(0, (room.height - height) * lean), devicePixelRatio),
      width,
      height,
    ),
    stage,
  };
}

export function computeTouchLayout(
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio = 1,
  insets: SafeInsets = NO_INSETS,
): TouchLayout {
  const width = Math.max(1, Math.floor(viewportWidth));
  const height = Math.max(1, Math.floor(viewportHeight));
  return width > height
    ? landscape(width, height, devicePixelRatio, insets)
    : portrait(width, height, devicePixelRatio, insets);
}

function portrait(width: number, height: number, ratio: number, insets: SafeInsets): TouchLayout {
  const left = insets.left + PAD.margin;
  const right = width - insets.right - PAD.margin;
  // The top bar: SOUND and FEEDBACK, and the game straight under it, as a
  // Game Boy's screen sits at the top of its face.
  const systemTop = insets.top + PAD.margin / 2;
  const system = rect(right - PAD.systemSize * 2 - PAD.chipGap, systemTop, PAD.systemSize * 2 + PAD.chipGap, PAD.systemSize);
  const roomTop = systemTop + PAD.systemSize + PAD.margin / 2;
  const trayHeight = (scale: number) => Math.round(PAD.chipHeight * Math.min(1, scale)) * 2 + PAD.chipGap;
  const padHeight = (scale: number) =>
    Math.round(Math.max(PAD.dpad, PAD.buttonsHeight) * scale) + PAD.gap + trayHeight(scale) + PAD.gap;
  const bottom = height - Math.max(PAD.margin, insets.bottom + PAD.margin / 2);
  // Fitted first in all the height the smallest pad leaves, the game is as big
  // as the phone's width allows; then the pad takes everything under it.
  const fitRoom = rect(0, roomTop, width, bottom - padHeight(MIN_PAD_SCALE) - roomTop);
  const canvas = placeCanvas(fitRoom, ratio, 0);
  const under = canvas.box.y + canvas.box.height + PAD.gap;
  const designed = PAD.dpad + PAD.buttonsWidth + PAD.gap;
  const byWidth = (right - left) / designed;
  const byHeight = (bottom - under - PAD.gap - trayHeight(1) - PAD.gap) / Math.max(PAD.dpad, PAD.buttonsHeight);
  const padScale = Math.max(MIN_PAD_SCALE, Math.min(MAX_PAD_SCALE, byWidth, byHeight));
  const dpadSize = Math.round(PAD.dpad * padScale);
  const buttonsWidth = Math.round(PAD.buttonsWidth * padScale);
  const buttonsHeight = Math.round(PAD.buttonsHeight * padScale);
  const controlsTop = bottom - Math.max(dpadSize, buttonsHeight);
  const dpad = rect(left, bottom - dpadSize, dpadSize, dpadSize);
  const buttons = rect(right - buttonsWidth, bottom - buttonsHeight, buttonsWidth, buttonsHeight);
  const tray = rect(left, controlsTop - PAD.gap - trayHeight(padScale), right - left, trayHeight(padScale));
  return {
    orientation: 'portrait',
    padScale,
    game: fitRoom,
    canvas: canvas.box,
    stage: canvas.stage,
    // A menu covers the game it was opened over, on the gutter everything else stands on.
    menus: rect(insets.left + PAD.margin - 8, roomTop, width - insets.left - insets.right - (PAD.margin - 8) * 2, tray.y - PAD.gap / 2 - roomTop),
    dpad,
    buttons,
    trays: [tray],
    trayColumns: 4,
    system,
  };
}

function landscape(width: number, height: number, ratio: number, insets: SafeInsets): TouchLayout {
  const designedColumn = Math.max(PAD.dpad, PAD.buttonsWidth) + PAD.margin * 2;
  const sideInsets = Math.max(insets.left, insets.right);
  // The game's column must hold the smallest game screen; the pad shrinks before it does.
  const roomForColumns = (width - MIN_GAME_WIDTH) / 2 - sideInsets;
  const padScale = Math.max(MIN_PAD_SCALE, Math.min(1, roomForColumns / designedColumn));
  const column = Math.round(designedColumn * padScale) + sideInsets;
  const game = rect(column, insets.top, width - column * 2, height - insets.top - insets.bottom);
  const placed = placeCanvas(game, ratio, 0.5);
  const canvas = placed.box;
  // The columns take whatever the game left them.
  const leftColumn = rect(insets.left, 0, canvas.x - insets.left, height);
  const rightStart = canvas.x + canvas.width;
  const rightColumn = rect(rightStart, 0, width - insets.right - rightStart, height);
  const dpadSize = Math.round(PAD.dpad * padScale);
  const buttonsWidth = Math.round(PAD.buttonsWidth * padScale);
  const buttonsHeight = Math.round(PAD.buttonsHeight * padScale);
  // Further off the foot than upright: a phone on its side is held by its ends.
  const bottom = height - Math.max(PAD.margin * 1.5, insets.bottom + PAD.margin);
  const top = insets.top + PAD.margin;
  const centredIn = (column: Rect, size: number) => column.x + (column.width - size) / 2;
  const dpad = rect(centredIn(leftColumn, dpadSize), bottom - dpadSize, dpadSize, dpadSize);
  const buttons = rect(centredIn(rightColumn, buttonsWidth), bottom - buttonsHeight, buttonsWidth, buttonsHeight);
  const inset = (column: Rect): { readonly x: number; readonly width: number } => ({
    x: column.x + PAD.margin,
    width: column.width - PAD.margin * 2,
  });
  const leftInner = inset(leftColumn);
  const rightInner = inset(rightColumn);
  const system = rect(leftInner.x, top, PAD.systemSize * 2 + PAD.chipGap, PAD.systemSize);
  const leftTrayTop = system.y + system.height + PAD.chipGap;
  return {
    orientation: 'landscape',
    padScale,
    game,
    canvas,
    stage: placed.stage,
    // The column the game stands in, the whole height: a menu may cover the
    // game, and the pad's columns either side stay clear to work it.
    menus: rect(canvas.x, 0, canvas.width, height),
    dpad,
    buttons,
    trays: [
      rect(leftInner.x, leftTrayTop, leftInner.width, dpad.y - PAD.gap - leftTrayTop),
      rect(rightInner.x, top, rightInner.width, buttons.y - PAD.gap - top),
    ],
    trayColumns: 2,
    system,
  };
}
