/**
 * A map written as a short program of strokes that compiles to the game's own
 * map file (`src/game/world/mapFile.ts`): ground letters and planted buildings.
 *
 * This is how the AI-drawn districts that scored level with real FireRed routes
 * in round 3 of the map research were made (`tools/mapcraft/README.md`). A
 * program says *where* things go and *why*, one decision a line; the craft that
 * no program should have to remember lives here instead:
 *
 * - trees come out whole on the 2x2 lattice the Kanto sheet draws them on, so a
 *   wood never leaves a half tree that renders as a stray bush (`compile`);
 * - a ledge always carries both of its ends, however it was drawn (`compile`);
 * - roads are straight legs at least two tiles wide (the FireRed sheet draws a
 *   lane's fringe on one side of a tile, so a one-tile lane looks cut);
 * - a building is planted by the file's own word, on a lot of the ground it
 *   asks for, with its footprint read from the game rather than typed here.
 *
 * Strokes overwrite earlier strokes, except on tiles a program has `lock`ed -
 * the seam a district shares with a neighbour drawn before it.
 */
import {
  MAP_FILE_FORMAT,
  MAP_FILE_STAMPS,
  plantedProp,
  type MapFile,
  type MapFileBuilding,
  type MapFileDropIn,
  type MapFileExit,
  type MapFileHabitat,
  type MapFileItemSpot,
  type MapFileOutdoorBuildingKind,
} from '../../src/game/world/mapFile';
import { MATERIAL_CHARS } from '../../src/game/world/tileset/materials';

/** Every letter a map file's ground may use. */
export const GROUND_LETTERS: ReadonlySet<string> = new Set([
  ...Object.values(MATERIAL_CHARS),
  ...Object.keys(MAP_FILE_STAMPS),
]);

/** The three letters a ledge is drawn with: its west end, its run and its east end. */
export const LEDGE_LETTERS: ReadonlySet<string> = new Set(['<', '=', '>']);

export type Point = readonly [number, number];

/** A small seeded random (mulberry32), so a program and a seed are one map. */
export interface Random {
  /** A number in [0, 1). */
  next(): number;
  /** A whole number from `low` to `high`, both included. */
  int(low: number, high: number): number;
  pick<T>(values: readonly T[]): T;
  chance(probability: number): boolean;
}

export function seeded(seed: number): Random {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
    pick: (values) => values[Math.floor(next() * values.length)],
    chance: (probability) => next() < probability,
  };
}

/** How many tiles a planted building covers, read from the game's own prop. */
export function buildingSize(kind: MapFileOutdoorBuildingKind): { width: number; height: number } {
  const prop = plantedProp(kind);
  return { width: prop.width, height: prop.height };
}

/** What a program needs to say about a map beyond its ground. */
export interface MapFileDetails {
  readonly id: string;
  readonly name: string;
  readonly maker?: string;
  readonly dropIns: readonly MapFileDropIn[];
  readonly exits: readonly MapFileExit[];
  readonly itemSpots?: readonly MapFileItemSpot[];
  readonly wildlife?: MapFileHabitat;
  /** Anything else the file should carry (districts, signs, trainers...). */
  readonly extra?: Partial<
    Omit<MapFile, 'format' | 'id' | 'name' | 'maker' | 'width' | 'height' | 'ground'>
  >;
}

export class MapProgram {
  public readonly width: number;
  public readonly height: number;
  /** One letter a tile, row by row. Brushes write it; `compile` tidies it. */
  public readonly ground: string[][];
  public readonly buildings: MapFileBuilding[] = [];
  /** What a brush noticed and let through: read these before trusting a map. */
  public readonly notes: string[] = [];
  private readonly locked: boolean[][];

  public constructor(width: number, height: number, fill = 'T') {
    this.width = width;
    this.height = height;
    this.assertLetter(fill);
    this.ground = Array.from({ length: height }, () => Array<string>(width).fill(fill));
    this.locked = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
  }

  public inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  public at(x: number, y: number): string | undefined {
    return this.inside(x, y) ? this.ground[y][x] : undefined;
  }

  /** One tile; off the map and locked tiles are left alone. */
  public put(x: number, y: number, letter: string): this {
    this.assertLetter(letter);
    if (this.inside(x, y) && !this.locked[y][x]) this.ground[y][x] = letter;
    return this;
  }

  public block(x: number, y: number, width: number, height: number, letter: string): this {
    for (let j = y; j < y + height; j += 1) {
      for (let i = x; i < x + width; i += 1) this.put(i, j, letter);
    }
    return this;
  }

  /** Copies rows of letters onto the map, top-left at (x, y); a space keeps what is there. */
  public draw(x: number, y: number, rows: readonly string[]): this {
    rows.forEach((row, j) => {
      [...row].forEach((letter, i) => {
        if (letter !== ' ') this.put(x + i, y + j, letter);
      });
    });
    return this;
  }

  /**
   * Copies a sketch drawn one letter a 2x2 lattice cell, every letter doubled
   * both ways, top-left at cell (cx, cy). A wood is drawn this way because the
   * conifer stands on that lattice: a lane drawn on an odd tile is eaten by
   * the trees beside it. A space keeps what is there.
   */
  public cells(rows: readonly string[], cx = 0, cy = 0): this {
    rows.forEach((row, j) => {
      const doubled = [...row].map((letter) => letter + letter).join('');
      this.draw(cx * 2, (cy + j) * 2, [doubled, doubled]);
    });
    return this;
  }

  /** Keeps a rectangle exactly as it is from now on: a seam shared with a neighbour. */
  public lock(x: number, y: number, width: number, height: number): this {
    for (let j = y; j < y + height; j += 1) {
      for (let i = x; i < x + width; i += 1) if (this.inside(i, j)) this.locked[j][i] = true;
    }
    return this;
  }

  /** Frees tiles a `lock` held, so they can be drawn on again. */
  public unlock(tiles: readonly Point[]): this {
    for (const [x, y] of tiles) if (this.inside(x, y)) this.locked[y][x] = false;
    return this;
  }

  public isLocked(x: number, y: number): boolean {
    return this.inside(x, y) && this.locked[y][x];
  }

  // -- Ground ---------------------------------------------------------------

  /** Open ground. */
  public meadow(x: number, y: number, width: number, height: number, letter = '.'): this {
    return this.block(x, y, width, height, letter);
  }

  public wood(x: number, y: number, width: number, height: number): this {
    return this.block(x, y, width, height, 'T');
  }

  public rock(x: number, y: number, width: number, height: number): this {
    return this.block(x, y, width, height, 'C');
  }

  /** An ellipse with a soft, seeded rim: a pond, a copse, a bed that is not a box. */
  public blob(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    letter: string,
    random?: Random,
  ): this {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y += 1) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1 - (random ? random.next() * 0.25 : 0)) this.put(x, y, letter);
      }
    }
    return this;
  }

  /**
   * A road through points, each leg straight (east-west or north-south),
   * `width` tiles wide from each point's top-left. Corners fill themselves.
   */
  public road(
    points: readonly Point[],
    { width = 2, letter = 'd' }: { width?: number; letter?: string } = {},
  ): this {
    if (width < 2)
      this.notes.push(`a road at ${points[0]} is ${width} wide: FireRed draws lanes two wide`);
    for (let k = 0; k + 1 < points.length; k += 1) {
      const [ax, ay] = points[k];
      const [bx, by] = points[k + 1];
      if (ax !== bx && ay !== by)
        throw new Error(`road leg ${points[k]} to ${points[k + 1]} is not straight`);
      this.block(
        Math.min(ax, bx),
        Math.min(ay, by),
        Math.abs(bx - ax) + width,
        Math.abs(by - ay) + width,
        letter,
      );
    }
    return this;
  }

  /** A path of grass through a wood: FireRed's forest paths are grass, not sand. */
  public trail(points: readonly Point[], { width = 2 }: { width?: number } = {}): this {
    return this.road(points, { width, letter: '.' });
  }

  /** A river: straight legs of deep water. */
  public river(points: readonly Point[], { width = 3 }: { width?: number } = {}): this {
    return this.road(points, { width, letter: 'W' });
  }

  /** Tall grass. Under ten tiles it is a speck rather than a bed, and says so. */
  public bed(
    x: number,
    y: number,
    width: number,
    height: number,
    { round = true }: { round?: boolean } = {},
  ): this {
    const rounded = round && width > 2 && height > 2;
    const tiles = width * height - (rounded ? 4 : 0);
    if (tiles < 10) this.notes.push(`the grass at ${x},${y} is ${tiles} tiles, under ten`);
    this.block(x, y, width, height, 'g');
    if (rounded) for (const [i, j] of corners(x, y, width, height)) this.put(i, j, '.');
    return this;
  }

  /** Tall grass drawn a row at a time: [row, first x, last x] - wild grass has a ragged edge. */
  public bedRows(...rows: readonly (readonly [number, number, number])[]): this {
    for (const [y, from, to] of rows) for (let x = from; x <= to; x += 1) this.put(x, y, 'g');
    return this;
  }

  public pond(x: number, y: number, width: number, height: number): this {
    this.block(x, y, width, height, 'W');
    if (width > 3 && height > 3)
      for (const [i, j] of corners(x, y, width, height)) this.put(i, j, '.');
    return this;
  }

  /**
   * A ledge from x0 to x1 on row y: the player hops it southward and cannot
   * climb it. Keep it short and give it a job (see `patterns.ts`).
   */
  public ledge(x0: number, x1: number, y: number): this {
    for (let x = x0; x <= x1; x += 1) this.put(x, y, x === x0 ? '<' : x === x1 ? '>' : '=');
    return this;
  }

  /** A fence along straight legs, with gaps left open. */
  public fenceLine(
    points: readonly Point[],
    { gaps = [] }: { gaps?: readonly Point[] } = {},
  ): this {
    for (let k = 0; k + 1 < points.length; k += 1) {
      const [ax, ay] = points[k];
      const [bx, by] = points[k + 1];
      if (ax !== bx && ay !== by)
        throw new Error(`fence leg ${points[k]} to ${points[k + 1]} is not straight`);
      const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let t = 0; t <= steps; t += 1)
        this.put(ax + Math.sign(bx - ax) * t, ay + Math.sign(by - ay) * t, 'F');
    }
    for (const [x, y] of gaps) this.put(x, y, '.');
    return this;
  }

  /** A fenced rectangle of `inner` ground (mown turf by default), with gates. */
  public yard(
    x: number,
    y: number,
    width: number,
    height: number,
    { gates = [], inner = '"' }: { gates?: readonly Point[]; inner?: string } = {},
  ): this {
    this.block(x, y, width, height, inner);
    this.fenceLine([
      [x, y],
      [x + width - 1, y],
      [x + width - 1, y + height - 1],
      [x, y + height - 1],
      [x, y],
    ]);
    for (const [gx, gy] of gates) this.put(gx, gy, inner);
    return this;
  }

  /** A bush on each point that is open grass (or turf, or paving, each with its own letter). */
  public bushes(...points: readonly Point[]): this {
    const onGround: Readonly<Record<string, string>> = { '.': 'o', '"': 'u', P: 'k' };
    for (const [x, y] of points) {
      const letter = onGround[this.at(x, y) ?? ''];
      if (letter) this.put(x, y, letter);
    }
    return this;
  }

  /** Flowers on each point that is grass or turf. */
  public flowers(...points: readonly Point[]): this {
    const onGround: Readonly<Record<string, string>> = { '.': 'f', '"': 'r' };
    for (const [x, y] of points) {
      const letter = onGround[this.at(x, y) ?? ''];
      if (letter) this.put(x, y, letter);
    }
    return this;
  }

  /**
   * Plants a building by the file's own word, clearing its footprint to `lot`.
   * Its size comes from the game, so a renamed or redrawn prop cannot leave a
   * program planting the wrong-sized hole.
   */
  public building(
    kind: MapFileOutdoorBuildingKind,
    x: number,
    y: number,
    { lot = '.' }: { lot?: string } = {},
  ): this {
    const { width, height } = buildingSize(kind);
    this.block(x, y, width, height, lot);
    this.buildings.push({ x, y, kind });
    return this;
  }

  // -- The moves human mappers make (see README.md, "The pattern language") --

  /**
   * A deep, ragged border of wood (or rock) inside a rectangle. FireRed's
   * borders run four to six deep and never in a ruler line.
   */
  public frame(
    x: number,
    y: number,
    width: number,
    height: number,
    {
      depth = 4,
      ragged = 2,
      letter = 'T',
      random,
    }: { depth?: number; ragged?: number; letter?: string; random?: Random } = {},
  ): this {
    for (let j = y; j < y + height; j += 1) {
      for (let i = x; i < x + width; i += 1) {
        const inward = Math.min(i - x, j - y, x + width - 1 - i, y + height - 1 - j);
        const jitter =
          random && ((i >> 1) + (j >> 1)) % 3 === 0 ? Math.floor(random.next() * (ragged + 1)) : 0;
        if (inward < depth + jitter) this.put(i, j, letter);
      }
    }
    return this;
  }

  /**
   * Terraces: short ledge pieces in rows `spacing` apart, each piece ending
   * against `stop` (a bush by default), the gaps staggered row to row so the
   * way up zigzags. FireRed's ledges are three to six long and stacked.
   */
  public terraces(
    x0: number,
    x1: number,
    y0: number,
    rows: number,
    random: Random,
    {
      spacing = 4,
      piece = [4, 6],
      stop = 'o',
    }: { spacing?: number; piece?: readonly [number, number]; stop?: string } = {},
  ): this {
    for (let k = 0; k < rows; k += 1) {
      const y = y0 + k * spacing;
      let x = x0 + (k % 2 ? random.int(1, 3) : 0);
      while (x < x1) {
        const end = Math.min(x1, x + random.int(piece[0], piece[1]) - 1);
        if (end - x >= 2) {
          this.ledge(x, end, y);
          this.put(end + 1, y, stop);
        }
        x = end + 2 + random.int(1, 3);
      }
    }
    return this;
  }

  // -- Compiling ------------------------------------------------------------

  /**
   * The ground as the file's rows, tidied: every 2x2 lattice cell is all trees
   * or none (a cell at least half trees, on open ground, grows whole; any less
   * is cleared to the ground beside it), and every ledge run gets its ends.
   * A tree never grows onto a building's lot. The lattice is the map's own,
   * starting at (0, 0): a district that will be stitched into a bigger map has
   * to start on an even tile.
   */
  public compile(): string[] {
    // A tree never grows onto a building's lot: the lot is what the building stands on.
    const lots = new Set<string>();
    for (const building of this.buildings) {
      const { width, height } = buildingSize(building.kind as MapFileOutdoorBuildingKind);
      for (let y = building.y; y < building.y + height; y += 1) {
        for (let x = building.x; x < building.x + width; x += 1) lots.add(`${x},${y}`);
      }
    }
    for (let cy = 0; cy < this.height; cy += 2) {
      for (let cx = 0; cx < this.width; cx += 2) {
        const cell = (
          [
            [cx, cy],
            [cx + 1, cy],
            [cx, cy + 1],
            [cx + 1, cy + 1],
          ] as const
        ).filter(([x, y]) => this.inside(x, y));
        if (cell.some(([x, y]) => this.locked[y][x])) continue;
        const trees = cell.filter(([x, y]) => this.ground[y][x] === 'T');
        if (trees.length === 0 || trees.length === cell.length) continue;
        const onLot = cell.some(([x, y]) => lots.has(`${x},${y}`));
        if (
          !onLot &&
          trees.length >= 2 &&
          cell.every(([x, y]) => /[T.fg"]/.test(this.ground[y][x]))
        ) {
          for (const [x, y] of cell) this.ground[y][x] = 'T';
          continue;
        }
        const fill =
          cell
            .map(([x, y]) => this.ground[y][x])
            .find((letter) => letter !== 'T' && /[."gdP~,]/.test(letter)) ?? '.';
        for (const [x, y] of trees) this.ground[y][x] = fill;
      }
    }
    for (const row of this.ground) {
      for (let x = 0; x < row.length; x += 1) {
        if (!LEDGE_LETTERS.has(row[x])) continue;
        const west = x > 0 && LEDGE_LETTERS.has(row[x - 1]);
        const east = x + 1 < row.length && LEDGE_LETTERS.has(row[x + 1]);
        row[x] = !west && !east ? '=' : !west ? '<' : !east ? '>' : '=';
      }
    }
    return this.ground.map((row) => row.join(''));
  }

  /** The compiled map file. */
  public toFile(details: MapFileDetails): MapFile {
    return {
      format: MAP_FILE_FORMAT,
      id: details.id,
      name: details.name,
      maker: details.maker ?? 'mapcraft',
      width: this.width,
      height: this.height,
      ground: this.compile(),
      buildings: [...this.buildings],
      dropIns: details.dropIns,
      exits: details.exits,
      itemSpots: details.itemSpots ?? [],
      wildlife: details.wildlife ?? 'meadow',
      people: [],
      signs: [],
      landmarks: [],
      districts: [],
      trainers: [],
      ...details.extra,
    };
  }

  private assertLetter(letter: string): void {
    if (!GROUND_LETTERS.has(letter)) throw new Error(`'${letter}' is not a map file ground letter`);
  }
}

function corners(x: number, y: number, width: number, height: number): Point[] {
  return [
    [x, y],
    [x + width - 1, y],
    [x, y + height - 1],
    [x + width - 1, y + height - 1],
  ];
}
