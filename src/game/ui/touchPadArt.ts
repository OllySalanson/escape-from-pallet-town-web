/**
 * The touch pad's art, drawn the way the game's own art is: in whole pixels,
 * as SVG paths on a pixel grid (`shape-rendering: crispEdges`), so a d-pad
 * cross and a round button come out as chunky pixel shapes at whatever size
 * the pad is drawn, rather than as smooth vector circles that look like a web
 * page's. Phaser-free and DOM-free, so the shapes are tested as numbers.
 */

/** One row of filled pixels: from `x`, `width` long, on row `y`. */
export interface PixelRun {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/**
 * A filled pixel disc `diameter` pixels across: each row as wide as a circle
 * is at that row's middle, rounded to whole pixels and kept symmetrical.
 */
export function discRuns(diameter: number): PixelRun[] {
  const size = Math.max(1, Math.round(diameter));
  const radius = size / 2;
  const runs: PixelRun[] = [];
  for (let y = 0; y < size; y += 1) {
    const dy = y + 0.5 - radius;
    const half = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    const inset = Math.max(0, Math.round(radius - half));
    const width = size - inset * 2;
    if (width > 0) {
      runs.push({ x: inset, y, width });
    }
  }
  return runs;
}

/**
 * A d-pad's cross on an `size`-pixel square: two bars `arm` pixels thick
 * through the middle, each end's corners cut by one pixel as a moulded
 * button's are.
 */
export function crossRuns(size: number, arm: number): PixelRun[] {
  const n = Math.max(3, Math.round(size));
  const a = Math.max(1, Math.min(n, Math.round(arm)));
  const start = Math.floor((n - a) / 2);
  const end = start + a;
  const runs: PixelRun[] = [];
  for (let y = 0; y < n; y += 1) {
    const inBar = y >= start && y < end;
    const endRow = y === 0 || y === n - 1;
    if (inBar) {
      // The horizontal bar, with its two ends' corners cut.
      const cut = y === start || y === end - 1 ? 1 : 0;
      runs.push({ x: cut, y, width: n - cut * 2 });
    } else {
      runs.push({ x: start + (endRow ? 1 : 0), y, width: a - (endRow ? 2 : 0) });
    }
  }
  return runs;
}

/** A solid arrowhead pointing `heading`, `size` pixels from base to tip, its base `size * 2 - 1` wide. */
export function arrowRuns(heading: 'up' | 'down' | 'left' | 'right', size: number): PixelRun[] {
  const n = Math.max(1, Math.round(size));
  const span = n * 2 - 1;
  const runs: PixelRun[] = [];
  for (let step = 0; step < n; step += 1) {
    // Row `step` from the tip is `step * 2 + 1` wide, centred.
    const width = step * 2 + 1;
    const offset = (span - width) / 2;
    if (heading === 'up') {
      runs.push({ x: offset, y: step, width });
    } else if (heading === 'down') {
      runs.push({ x: offset, y: n - 1 - step, width });
    } else {
      // Sideways arrows are drawn a column at a time, one run per pixel row.
      const column = heading === 'left' ? step : n - 1 - step;
      for (let row = 0; row < width; row += 1) {
        runs.push({ x: column, y: offset + row, width: 1 });
      }
    }
  }
  return runs;
}

/** The runs as one SVG path, moved by `dx`, `dy`. */
export function runsPath(runs: readonly PixelRun[], dx = 0, dy = 0): string {
  return runs.map((run) => `M${run.x + dx} ${run.y + dy}h${run.width}v1h-${run.width}z`).join('');
}

/**
 * The runs grown by one pixel up, down, left and right (never across a corner,
 * which would square a round button off): an outline drawn beneath the shape.
 */
export function outlineRuns(runs: readonly PixelRun[]): PixelRun[] {
  const rows = new Map<number, { from: number; to: number }[]>();
  const add = (y: number, from: number, to: number) => {
    const list = rows.get(y) ?? [];
    list.push({ from, to });
    rows.set(y, list);
  };
  for (const run of runs) {
    add(run.y, run.x - 1, run.x + run.width + 1);
    add(run.y - 1, run.x, run.x + run.width);
    add(run.y + 1, run.x, run.x + run.width);
  }
  const out: PixelRun[] = [];
  for (const [y, spans] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
    spans.sort((a, b) => a.from - b.from);
    let current = { ...spans[0] };
    for (const span of spans.slice(1)) {
      if (span.from <= current.to) {
        current.to = Math.max(current.to, span.to);
      } else {
        out.push({ x: current.from, y, width: current.to - current.from });
        current = { ...span };
      }
    }
    out.push({ x: current.from, y, width: current.to - current.from });
  }
  return out;
}

/** The row a shape's runs stand on, by row: these shapes have one run a row. */
function byRow(runs: readonly PixelRun[]): Map<number, PixelRun> {
  return new Map(runs.map((run) => [run.y, run] as const));
}

/** The part of `run` not under `cover` on the row beside it. */
function uncovered(run: PixelRun, cover: PixelRun | undefined): PixelRun[] {
  if (!cover) {
    return [run];
  }
  const out: PixelRun[] = [];
  if (cover.x > run.x) {
    out.push({ x: run.x, y: run.y, width: Math.min(run.width, cover.x - run.x) });
  }
  const coverEnd = cover.x + cover.width;
  const runEnd = run.x + run.width;
  if (runEnd > coverEnd) {
    const from = Math.max(run.x, coverEnd);
    out.push({ x: from, y: run.y, width: runEnd - from });
  }
  return out;
}

/**
 * The pixels of a shape with nothing above them: where a moulded button
 * catches the light. For shapes of one run a row, as these all are.
 */
export function topEdgeRuns(runs: readonly PixelRun[]): PixelRun[] {
  const rows = byRow(runs);
  return runs.flatMap((run) => uncovered(run, rows.get(run.y - 1)));
}

/** The pixels of a shape with nothing below them: where it turns away into shade. */
export function bottomEdgeRuns(runs: readonly PixelRun[]): PixelRun[] {
  const rows = byRow(runs);
  return runs.flatMap((run) => uncovered(run, rows.get(run.y + 1)));
}

/**
 * Small pixel icons for the page's own keys, as rows of a grid: `#` is ink.
 * Drawn here rather than typed, because Orange Kid has no speaker and no
 * speech bubble, as it has no arrows (`style.css`, the Pixel UI block).
 */
export const PAD_ICONS = {
  soundOn: [
    '....#......',
    '...##...#..',
    '..###.#..#.',
    '####...#.#.',
    '####...#..#',
    '####...#.#.',
    '..###.#..#.',
    '...##...#..',
    '....#......',
  ],
  soundOff: [
    '....#......',
    '...##......',
    '..###.#...#',
    '####...#.#.',
    '####....#..',
    '####...#.#.',
    '..###.#...#',
    '...##......',
    '....#......',
  ],
  feedback: [
    '.#########.',
    '#.........#',
    '#.#######.#',
    '#.........#',
    '#.#####...#',
    '#.........#',
    '.#.#######.',
    '.##........',
    '.#.........',
  ],
} as const;

export type PadIcon = keyof typeof PAD_ICONS;

/** An icon's ink as runs. */
export function iconRuns(icon: PadIcon): PixelRun[] {
  const runs: PixelRun[] = [];
  PAD_ICONS[icon].forEach((row, y) => {
    for (const match of row.matchAll(/#+/g)) {
      runs.push({ x: match.index ?? 0, y, width: match[0].length });
    }
  });
  return runs;
}
