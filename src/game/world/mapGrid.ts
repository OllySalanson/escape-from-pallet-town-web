import { MATERIAL_CHARS, isSolidMaterial, materialForChar, type Material } from './tileset/materials';

/**
 * Maps are drawn, not generated.
 *
 * A map's terrain is authored as character art - one character per tile, laid
 * out in the source in the shape it has on screen - and its landmarks are
 * planted on top by name. That is deliberate. The previous pass built maps out
 * of one-tile polylines and `for` loops over staggered offsets, and it produced
 * exactly what it was: shelves at rows 9, 11, 13, 15 and lanes one tile wide
 * everywhere. Character art cannot be regular by accident, it diffs tile for
 * tile in review, and a bank that bulges where a person would bulge it costs
 * the author one keystroke.
 *
 * `MapSketch` is the authoring surface; `buildMapLayers` turns a finished
 * sketch and a tileset catalogue into the layers and collision the engine
 * needs.
 */

/**
 * What the ground is. Every material has a one-character name, and two legacy
 * spellings are kept because three maps were authored with them: `T` for a
 * wall of growth, which is now `tree`, and `,` for a worn lane.
 */
export type TerrainChar = string;

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

/**
 * One character of an authored map. Terrain and content share the alphabet -
 * `isContentChar` is what tells them apart - so a drawn block can put a
 * landmark on the ground in the same picture.
 */
export type MapChar = string;

const CONTENT_CHARS = new Set<string>(['I', 'X', 'O', 'L', 'H', 'S', 'N', '*']);

export function isContentChar(char: string): char is ContentChar {
  return CONTENT_CHARS.has(char);
}

/** `' '` in a drawn block means "leave whatever is already here". */
export const KEEP = ' ';

export function materialFor(char: string): Material {
  const material = materialForChar(char);
  if (material === undefined) {
    throw new Error(`unknown terrain character '${char}'`);
  }
  return material;
}

export function isSolidTerrain(char: string): boolean {
  return isSolidMaterial(materialFor(char));
}

export interface PlantedProp<PropName extends string = string> {
  readonly name: PropName;
  readonly x: number;
  readonly y: number;
}

/**
 * A letter of a map's own, which stands a landmark where it is drawn.
 *
 * A wood is hundreds of trees, and a tree named by a coordinate in a list under
 * the picture is a tree that drifts: move the river three tiles and the list
 * still says where the bank used to be. A stamp puts the tree in the drawing,
 * so the picture that is reviewed is the map that is built.
 */
export interface PropStamp<PropName extends string = string> {
  readonly prop: PropName;
  /**
   * Which cell of the prop the letter marks, counted from its top-left. A tree
   * is marked at its trunk rather than its corner, because the trunk is where
   * it blocks and where the eye says it stands.
   */
  readonly anchor: readonly [number, number];
  /** What the letter's own tile is made of - a letter can only say one thing. */
  readonly ground: TerrainChar;
  /**
   * The other tiles the landmark blocks, as offsets from its letter. A map cut
   * out of a forest leaves a tree at the edge of every cut, and one whose trunk
   * overhangs the lane makes a two-wide road one wide without anyone drawing
   * that. So walkable ground cut under any of these takes the landmark away,
   * exactly as ground drawn over the letter does. A crown is not listed: it
   * blocks nothing, and one hanging over a lane is what a wood's edge looks like.
   */
  readonly blocks?: readonly (readonly [number, number])[];
  /**
   * What the letter's tile goes back to when a cut takes the landmark away. A
   * forest tree stands on a tile of grass in a sea of thicket; take the tree
   * and leave the grass, and the wood has a one-tile hole in it that nobody
   * drew. Left out, the tile stays as `ground` - right for an orchard tree,
   * which stood in grass to begin with.
   */
  readonly bare?: TerrainChar;
}

export interface MapSketchOptions<PropName extends string = string> {
  readonly width: number;
  readonly height: number;
  readonly fill: TerrainChar;
  /** This map's own letters. None may be a material's or a content mark's. */
  readonly stamps?: Readonly<Record<string, PropStamp<PropName>>>;
  /**
   * When set, `set` refuses to write the outermost ring, so drawing a lane that
   * runs to the edge cannot punch a hole in the map boundary. `raw` still can,
   * which is how gates through the boundary are authored.
   */
  readonly sealBorder?: boolean;
}

type Point = readonly [number, number];

/**
 * A map under construction. Terrain, content and props are kept apart so a
 * landmark never erases the ground it stands on, and so an authored grid can be
 * compared against the approved design character for character.
 */
export class MapSketch<PropName extends string = string> {
  public readonly width: number;
  public readonly height: number;
  private readonly sealBorder: boolean;
  private readonly terrain: TerrainChar[][];
  private readonly content: (ContentChar | null)[][];
  private readonly planted: PlantedProp<PropName>[] = [];
  private readonly stamps: Readonly<Record<string, PropStamp<PropName>>>;
  /** Stamped landmarks by the tile their letter was drawn on. */
  private readonly stamped = new Map<string, PlantedProp<PropName>>();
  /** For each tile a stamped landmark blocks, the letters of the landmarks that do. */
  private readonly blockedBy = new Map<string, Set<string>>();
  /** What each stamped letter's tile reverts to if its landmark is cut away. */
  private readonly bareUnder = new Map<string, TerrainChar>();

  public constructor(options: MapSketchOptions<PropName>) {
    this.width = options.width;
    this.height = options.height;
    this.sealBorder = options.sealBorder ?? false;
    this.stamps = options.stamps ?? {};
    for (const [char, stamp] of Object.entries(this.stamps)) {
      if (char.length !== 1 || char === KEEP || isContentChar(char) || materialForChar(char)) {
        throw new Error(`'${char}' cannot be a stamp: it already means something in a drawing`);
      }
      materialFor(stamp.ground);
      if (stamp.bare !== undefined) {
        materialFor(stamp.bare);
      }
    }
    materialFor(options.fill);
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
      materialFor(char);
      this.terrain[y][x] = char;
      this.content[y][x] = null;
      // Ground drawn over a stamp takes the landmark with it. Blocks are meant
      // to be drawn over each other, and a tree left behind by the block under
      // it is a tree standing in whatever was painted on top - a river, usually.
      // With everything it was blocking: left behind, a felled tree's claims
      // outlive it, and the next landmark stamped on the same tile is taken
      // away by ground cut beside a tree that is no longer there - a ledge
      // drawn over a lattice trunk lost its west end that way.
      this.forgetStamp(`${x},${y}`);
      // And so does ground cut to be walked under any tile it blocks.
      if (!isSolidTerrain(char)) {
        for (const letter of this.blockedBy.get(`${x},${y}`) ?? []) {
          const bare = this.bareUnder.get(letter);
          if (this.stamped.delete(letter) && bare !== undefined) {
            const [lx, ly] = letter.split(',').map(Number);
            this.terrain[ly][lx] = bare;
          }
        }
        this.blockedBy.delete(`${x},${y}`);
      }
    }
    return this;
  }

  /** Takes a stamped landmark off the map, and its claims on the tiles round it with it. */
  private forgetStamp(letter: string): void {
    this.stamped.delete(letter);
    this.bareUnder.delete(letter);
    for (const [tile, letters] of this.blockedBy) {
      letters.delete(letter);
      if (letters.size === 0) {
        this.blockedBy.delete(tile);
      }
    }
  }

  /**
   * Draws a block of character art at a position, one character per tile.
   *
   * This is the main way a map is authored: the source holds the picture, so
   * what is reviewed is the map rather than the instructions that would build
   * it. A space leaves the tile alone, so blocks can be drawn over each other.
   */
  public draw(x0: number, y0: number, rows: readonly string[]): this {
    // A row that is short by one character shifts nothing and silently leaves
    // water where a bank should be, which is invisible in review and obvious
    // only in a render. A block is a rectangle or it is a mistake.
    const width = rows[0]?.length ?? 0;
    for (const [rowIndex, row] of rows.entries()) {
      if (row.length !== width) {
        throw new Error(
          `drawn block is ragged: row ${rowIndex} is ${row.length} characters, row 0 is ${width}`,
        );
      }
    }
    // Ground first, then what stands on it. A block is one picture: the grass
    // beside a tree in the same drawing is the grass that tree stands in, and
    // laying it after the tree would cut the tree down with its own lawn. Only
    // a *later* block cutting under a landmark takes it away.
    for (const [rowIndex, row] of rows.entries()) {
      for (let column = 0; column < row.length; column += 1) {
        const char = row[column];
        if (char !== KEEP && !this.stamps[char]) {
          this.raw(x0 + column, y0 + rowIndex, char);
        }
      }
    }
    for (const [rowIndex, row] of rows.entries()) {
      for (let column = 0; column < row.length; column += 1) {
        const char = row[column];
        if (char === KEEP) {
          continue;
        }
        const stamp = this.stamps[char];
        if (stamp) {
          const x = x0 + column;
          const y = y0 + rowIndex;
          this.raw(x, y, stamp.ground);
          this.stamped.set(`${x},${y}`, {
            name: stamp.prop,
            x: x - stamp.anchor[0],
            y: y - stamp.anchor[1],
          });
          if (stamp.bare !== undefined) {
            this.bareUnder.set(`${x},${y}`, stamp.bare);
          }
          for (const [dx, dy] of stamp.blocks ?? []) {
            const tile = `${x + dx},${y + dy}`;
            const letters = this.blockedBy.get(tile) ?? new Set<string>();
            letters.add(`${x},${y}`);
            this.blockedBy.set(tile, letters);
          }
        }
      }
    }
    return this;
  }

  /** Stands a named landmark on the map. The prop's own art decides collision. */
  public plant(x: number, y: number, name: PropName): this {
    this.planted.push({ name, x, y });
    return this;
  }

  public props(): readonly PlantedProp<PropName>[] {
    return [...this.stamped.values(), ...this.planted];
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
   * Draws a polyline. Each leg must be orthogonal, which is what keeps a lane a
   * lane rather than a diagonal smear the player cannot actually walk.
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

  /** Repaints one surface as another inside a region. */
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

  public materialAt(x: number, y: number): Material | undefined {
    const char = this.terrain[y]?.[x];
    return char === undefined ? undefined : materialFor(char);
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
   * The material a tile actually renders as. Content always stands on ground
   * the player can reach, so a marker dropped on water or hedge dries to grass.
   */
  public surfaceAt(x: number, y: number): Material {
    const material = materialFor(this.terrain[y][x]);
    if (this.content[y][x] !== null && isSolidMaterial(material)) {
      return 'grass';
    }
    return material;
  }

  /** The sketch as one character per tile, content drawn over terrain. */
  public toGrid(): string[] {
    return this.terrain.map((row, y) =>
      row
        .map((char, x) => this.content[y][x] ?? MATERIAL_CHARS[materialFor(char)])
        .join(''),
    );
  }
}
