export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  x: number;
  y: number;
}

export interface GridInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface GridBounds {
  width: number;
  height: number;
}

export interface GridStepDecision {
  facing: Direction;
  target: GridPosition | null;
}

export interface PlanNextGridStepOptions {
  position: GridPosition;
  facing: Direction;
  input: GridInputState;
  bounds: GridBounds;
  isBlocked?: (tile: GridPosition) => boolean;
}

const DIRECTION_PRIORITY: readonly Direction[] = ['up', 'down', 'left', 'right'];

const DIRECTION_DELTAS: Record<Direction, GridPosition> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const INPUT_LOOKUP: Record<Direction, keyof GridInputState> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
};

function isDirectionPressed(input: GridInputState, direction: Direction): boolean {
  return input[INPUT_LOOKUP[direction]];
}

function resolveStepDirection(input: GridInputState, facing: Direction): Direction | null {
  if (isDirectionPressed(input, facing)) {
    return facing;
  }

  return DIRECTION_PRIORITY.find((direction) => isDirectionPressed(input, direction)) ?? null;
}

export function nextTileFromDirection(position: GridPosition, direction: Direction): GridPosition {
  const delta = DIRECTION_DELTAS[direction];

  return {
    x: position.x + delta.x,
    y: position.y + delta.y,
  };
}

export function isWithinBounds(position: GridPosition, bounds: GridBounds): boolean {
  return (
    position.x >= 0 && position.y >= 0 && position.x < bounds.width && position.y < bounds.height
  );
}

export function planNextGridStep(options: PlanNextGridStepOptions): GridStepDecision {
  const direction = resolveStepDirection(options.input, options.facing);
  if (!direction) {
    return { facing: options.facing, target: null };
  }

  const target = nextTileFromDirection(options.position, direction);
  if (!isWithinBounds(target, options.bounds)) {
    return { facing: direction, target: null };
  }

  if (options.isBlocked?.(target)) {
    return { facing: direction, target: null };
  }

  return { facing: direction, target };
}
