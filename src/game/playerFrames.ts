import type { Direction } from './movement/gridMovement';

export const CHARACTER_FRAME_WIDTH = 16;
export const CHARACTER_FRAME_HEIGHT = 32;

const CHARACTER_SHEET_COLUMNS = 17;
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

function toFrameIndex(column: number, row: number): number {
  return row * CHARACTER_SHEET_COLUMNS + column;
}

export function getWalkFrames(direction: Direction): number[] {
  const row = PLAYER_SHEET_ROW_START + PLAYER_DIRECTION_ROW_OFFSETS[direction];

  return PLAYER_WALK_FRAME_COLUMN_OFFSETS.map((columnOffset) =>
    toFrameIndex(PLAYER_SHEET_COLUMN_START + columnOffset, row),
  );
}

export function getIdleFrame(direction: Direction): number {
  const row = PLAYER_SHEET_ROW_START + PLAYER_DIRECTION_ROW_OFFSETS[direction];

  return toFrameIndex(PLAYER_SHEET_COLUMN_START + PLAYER_IDLE_FRAME_COLUMN_OFFSET, row);
}

export function getWalkAnimationKey(direction: Direction): string {
  return `player-walk-${direction}`;
}
