import type { Direction } from './movement/gridMovement';

export const CHARACTER_FRAME_WIDTH = 16;
export const CHARACTER_FRAME_HEIGHT = 16;

const CHARACTER_SHEET_COLUMNS = 17;
const PLAYER_FRAME_COLUMN_OFFSET = 0;
const WALK_FRAME_COUNT = 4;
const IDLE_FRAME_OFFSET = 1;

const PLAYER_DIRECTION_ROWS: Record<Direction, number> = {
  down: 0,
  left: 1,
  up: 2,
  right: 3,
};

function toFrameIndex(column: number, row: number): number {
  return row * CHARACTER_SHEET_COLUMNS + column;
}

export function getWalkFrames(direction: Direction): number[] {
  const row = PLAYER_DIRECTION_ROWS[direction];

  return Array.from({ length: WALK_FRAME_COUNT }, (_, frameOffset) =>
    toFrameIndex(PLAYER_FRAME_COLUMN_OFFSET + frameOffset, row),
  );
}

export function getIdleFrame(direction: Direction): number {
  return toFrameIndex(
    PLAYER_FRAME_COLUMN_OFFSET + IDLE_FRAME_OFFSET,
    PLAYER_DIRECTION_ROWS[direction],
  );
}

export function getWalkAnimationKey(direction: Direction): string {
  return `player-walk-${direction}`;
}
