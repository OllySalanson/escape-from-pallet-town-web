import type { Direction } from './movement/gridMovement';

export const CHARACTER_FRAME_WIDTH = 16;
export const CHARACTER_FRAME_HEIGHT = 32;

// Where the drawn figure sits inside its 16x32 frame, measured from the opaque
// pixels of the idle frames: the soles rest on row 27 and the hair starts at
// row 5. Anything anchored to the character - the tile it occupies, the player
// marker - is placed from these rather than from the frame edges.
export const CHARACTER_FEET_PIXEL_Y = 27;
export const CHARACTER_HEAD_PIXEL_Y = 5;

/**
 * `character.png` is 17 frames wide; the designs in `world/characterDesigns.ts`
 * are cut to the same rows and the same first four columns on a sheet only four
 * frames wide. The sheet width is therefore the one thing a frame index needs
 * to be told, and everything below takes it rather than forking per sheet.
 */
export const CHARACTER_SHEET_COLUMNS = 17;
const PLAYER_SHEET_COLUMN_START = 0;
const PLAYER_SHEET_ROW_START = 0;

const PLAYER_IDLE_FRAME_COLUMN_OFFSET = 0;
const PLAYER_WALK_FRAME_COLUMN_OFFSETS = [1, 0, 3, 0] as const;

const PLAYER_DIRECTION_ROW_OFFSETS: Record<Direction, number> = {
  down: 0,
  left: 3,
  up: 2,
  right: 1,
};

function toFrameIndex(column: number, row: number, sheetColumns: number): number {
  return row * sheetColumns + column;
}

export function getWalkFrames(
  direction: Direction,
  sheetColumns: number = CHARACTER_SHEET_COLUMNS,
): number[] {
  const row = PLAYER_SHEET_ROW_START + PLAYER_DIRECTION_ROW_OFFSETS[direction];

  return PLAYER_WALK_FRAME_COLUMN_OFFSETS.map((columnOffset) =>
    toFrameIndex(PLAYER_SHEET_COLUMN_START + columnOffset, row, sheetColumns),
  );
}

export function getIdleFrame(
  direction: Direction,
  sheetColumns: number = CHARACTER_SHEET_COLUMNS,
): number {
  const row = PLAYER_SHEET_ROW_START + PLAYER_DIRECTION_ROW_OFFSETS[direction];

  return toFrameIndex(
    PLAYER_SHEET_COLUMN_START + PLAYER_IDLE_FRAME_COLUMN_OFFSET,
    row,
    sheetColumns,
  );
}

/** `sheet` is the texture key the cycle is cut from; the player's own by default. */
export function getWalkAnimationKey(direction: Direction, sheet: string = 'player'): string {
  return `${sheet}-walk-${direction}`;
}
