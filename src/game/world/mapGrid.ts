/**
 * Maps are authored as tile grids, not as painted rectangles.
 *
 * A map's shape is a skeleton: it starts solid, lanes are carved through it as
 * polylines, and plots are cut off those lanes. That keeps the network
 * connected by construction and is what makes the acceptance test in
 * `mapStructure.test.ts` - no long straight walks, no open ground - achievable
 * by hand. `MapSketch` is the authoring surface; `buildMapLayers` turns a
 * finished sketch into the render layers and collision the engine needs.
 */

/** What the ground is. Every terrain character is either solid or walkable. */
export type TerrainChar =
  | 'T' // hedge or tree - solid
  | 'F' // fence - solid, and the material that has gates in it
  | 'W' // water - solid, absolutely
  | '.' // open grass
  | ',' // dirt lane
  | 'P' // paved yard
  | 'g'; // tall grass - walkable, and the only ground that costs encounters

/**
 * What stands on the ground. Content never decides collision - entities block
 * their own tile at run time - it only records where authored content sits so
 * the map data and the design grid can be compared tile for tile.
 */
export type ContentChar =
  | 'I' // insertion
  | 'X' // extraction
  | 'O' // objective
  | 'L' // loot
  | 'H' // trainer
  | 'S' // sign
  | 'N' // townsfolk
  | '*'; // point of interest

export type MapChar = TerrainChar | ContentChar;

const CONTENT_CHARS = new Set<string>(['I', 'X', 'O', 'L', 'H', 'S', 'N', '*']);

export function isContentChar(char: string): char is ContentChar {
  return CONTENT_CHARS.has(char);
}

const SOLID_TERRAIN = new Set<TerrainChar>(['T', 'F', 'W']);

export function isSolidTerrain(char: TerrainChar): boolean {
  return SOLID_TERRAIN.has(char);
}

export interface MapSketchOptions {
  readonly width: number;
  readonly height: number;
  readonly fill: TerrainChar;
  /**
   * When set, `set` refuses to write the outermost ring, so carving a lane that
   * runs to the edge cannot punch a hole in the map boundary. `raw` still can,
   * which is how gates through the boundary are authored.
   */
  readonly sealBorder?: boolean;
}

type Point = readonly [number, number];

/**
 * A map under construction. Terrain and content are kept apart so a landmark
 * never erases the ground it stands on, and so an authored grid can be compared
 * against the approved design character for character.
 */
export class MapSketch {
  public readonly width: number;
  public readonly height: number;
  private readonly sealBorder: boolean;
  private readonly terrain: TerrainChar[][];
  private readonly content: (ContentChar | null)[][];

  public constructor(options: MapSketchOptions) {
    this.width = options.width;
    this.height = options.height;
    this.sealBorder = options.sealBorder ?? false;
    this.terrain = Array.from({ length: this.height }, () =>
      Array<TerrainChar>(this.width).fill(options.fill),
    );
    this.content = Array.from({ length: this.height }, () =>
      Array<ContentChar | null>(this.width).fill(null),
    );
  }

  /** Writes a tile, honouring the sealed border. */
  public set(x: number, y: number, char: MapChar): this {
    if (this.sealBorder) {
      if (x <= 0 || y <= 0 || x >= this.width - 1 || y >= this.height - 1) {
        return this;
      }
    }
    return this.raw(x, y, char);
  }

  /** Writes a tile anywhere, including the map boundary. */
  public raw(x: number, y: number, char: MapChar): this {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return this;
    }
    if (isContentChar(char)) {
      this.content[y][x] = char;
    } else {
      this.terrain[y][x] = char;
      this.content[y][x] = null;
    }
    return this;
  }

  public rect(x0: number, y0: number, x1: number, y1: number, char: MapChar): this {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        this.set(x, y, char);
      }
    }
    return this;
  }

  public hLine(x0: number, x1: number, y: number, char: MapChar): this {
    return this.rect(x0, y, x1, y, char);
  }

  public vLine(x: number, y0: number, y1: number, char: MapChar): this {
    return this.rect(x, y0, x, y1, char);
  }

  /**
   * Carves a polyline. Each leg must be orthogonal, which is what keeps a lane
   * a lane rather than a diagonal smear the player cannot actually walk.
   */
  public lane(points: readonly Point[], char: MapChar = ','): this {
    for (let index = 1; index < points.length; index += 1) {
      const [ax, ay] = points[index - 1];
      const [bx, by] = points[index];
      if (ax !== bx && ay !== by) {
        throw new Error(`lane leg is not orthogonal: ${ax},${ay} -> ${bx},${by}`);
      }
      const dx = Math.sign(bx - ax);
      const dy = Math.sign(by - ay);
      let x = ax;
      let y = ay;
      this.set(x, y, char);
      while (x !== bx || y !== by) {
        x += dx;
        y += dy;
        this.set(x, y, char);
      }
    }
    return this;
  }

  /** A fenced plot: a fence ring with something inside it worth crossing for. */
  public pen(x0: number, y0: number, x1: number, y1: number, fill: MapChar = 'g'): this {
    this.rect(x0, y0, x1, y1, 'F');
    this.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill);
    return this;
  }

  /**
   * Repaints one surface as another inside a region. Arteries are dirt and
   * everything else is grass, so the player reads the route off the ground.
   */
  public resurface(
    region: readonly [number, number, number, number],
    from: TerrainChar,
    to: TerrainChar,
  ): this {
    const [x0, y0, x1, y1] = region;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (this.terrainAt(x, y) === from) {
          this.terrain[y][x] = to;
        }
      }
    }
    return this;
  }

  public terrainAt(x: number, y: number): TerrainChar | undefined {
    return this.terrain[y]?.[x];
  }

  public contentAt(x: number, y: number): ContentChar | null {
    return this.content[y]?.[x] ?? null;
  }

  /** Every tile carrying the given content marker, in reading order. */
  public find(char: ContentChar): { readonly x: number; readonly y: number }[] {
    const found: { x: number; y: number }[] = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.content[y][x] === char) {
          found.push({ x, y });
        }
      }
    }
    return found;
  }

  /**
   * The terrain a tile actually renders as. Content always stands on ground the
   * player can reach, so a marker dropped on water or hedge dries to grass.
   */
  public surfaceAt(x: number, y: number): TerrainChar {
    const terrain = this.terrain[y][x];
    if (this.content[y][x] !== null && isSolidTerrain(terrain)) {
      return '.';
    }
    return terrain;
  }

  /** The sketch as one character per tile, content drawn over terrain. */
  public toGrid(): string[] {
    return this.terrain.map((row, y) =>
      row.map((char, x) => this.content[y][x] ?? char).join(''),
    );
  }
}
