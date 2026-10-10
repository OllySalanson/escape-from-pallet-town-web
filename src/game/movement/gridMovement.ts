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
  /**
   * The ways through from one place on the grid to another that are not a
   * step to a neighbour: a building's door, a room's door mat. Every search
   * that walks the grid takes one as one more step (`linkTable`).
   */
  links?: GridLinks;
}

/**
 * A way through: standing on `from` and pressing `toward` - into a door, off
 * the edge of a room's mat - puts you on `to`. Links come in pairs, one each
 * way, so every walk measured over them is the same length both ways.
 */
export interface GridLink {
  readonly from: GridPosition;
  readonly toward: Direction;
  readonly to: GridPosition;
}

/**
 * A grid's links, keyed by `linkKey` of the tile and the way pressed, to the
 * index of the tile they put you on. Built once per map.
 */
export type GridLinks = ReadonlyMap<number, number>;

/** The directions in the order every search numbers them: north, south, west, east. */
export const STEP_DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** The key a link is looked up by: the tile's index and the direction's number. */
export function linkKey(index: number, direction: number): number {
  return index * 4 + direction;
}

/** A list of links as the table every search reads. */
export function linkTable(links: readonly GridLink[], width: number): GridLinks {
  const table = new Map<number, number>();
  for (const link of links) {
    table.set(
      linkKey(link.from.y * width + link.from.x, STEP_DIRECTIONS.indexOf(link.toward)),
      link.to.y * width + link.to.x,
    );
  }
  return table;
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

export const DIRECTION_DELTAS: Record<Direction, GridPosition> = {
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
