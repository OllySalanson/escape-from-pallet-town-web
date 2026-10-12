/**
 * Pictures of a map program's result, for the look-and-fix round: the map as
 * the game draws it, the same with tile numbers (so a critique can name
 * coordinates and a fix can use them), and the same with the design moves
 * washed in colour - blue the border, orange the road, pink the plain lawn,
 * green the tall grass, purple what stands in the open, red outline ledges,
 * white outline fences - so what a mapper sees is on the page. And for a huge
 * map, the world plan as one picture and the whole map shrunk to a glance.
 */
import { TILE_SIZE } from '../tileset/tileSheet.mjs';
import { blit, box, canvas, label } from '../tileset/draw.mjs';
import { drawWorldMap, type MapImage } from '../tileset/mapPicture.mts';
import {
  MAP_FILE_LIMITS,
  buildPlayerMap,
  playerMapId,
  readMapFile,
  type MapFile,
} from '../../src/game/world/mapFile';
import { registerPlayerMap } from '../../src/game/world/playerMaps';
import { composeMapFile } from '../../src/game/world/mapAreas';
import { readTiles, WALL_KINDS, type TileRect } from './tiles';
import type { DesignMoves } from './measures';
import {
  districtRect,
  openingsOf,
  planBounds,
  type Opening,
  type PlannedLandmark,
  type Side,
  type Terrain,
  type WorldPlan,
} from './worldPlan';

/** The map (or the part of it in `crop`) exactly as the game draws it. */
export function mapPicture(file: MapFile, crop?: TileRect): MapImage {
  const reading = readMapFile(file);
  if (!reading.ok) throw new Error(reading.problems.join(' '));
  registerPlayerMap(buildPlayerMap(reading.file));
  const { x, y, width, height } = crop ?? { x: 0, y: 0, width: file.width, height: file.height };
  return drawWorldMap(playerMapId(file), [x, y, width, height]);
}

const MARGIN = 28;

/** The picture with a grid: a faint line every tile, a strong one every four, numbers in the margin. */
export function griddedPicture(
  image: MapImage,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): MapImage {
  const columns = image.width / TILE_SIZE;
  const rows = image.height / TILE_SIZE;
  const panel = canvas(image.width + MARGIN, image.height + MARGIN, [16, 18, 24]);
  blit(panel, image, 0, 0, image.width, image.height, MARGIN, MARGIN);
  const darken = (px: number, py: number, amount: number) => {
    const at = (py * panel.width + px) * 4;
    for (let k = 0; k < 3; k += 1)
      panel.data[at + k] = Math.round(panel.data[at + k] * (1 - amount));
  };
  for (let j = 0; j <= rows; j += 1) {
    const py = Math.min(panel.height - 1, MARGIN + j * TILE_SIZE);
    for (let px = MARGIN; px < panel.width; px += 1)
      darken(px, py, (origin.y + j) % 4 === 0 ? 0.75 : 0.25);
  }
  for (let i = 0; i <= columns; i += 1) {
    const px = Math.min(panel.width - 1, MARGIN + i * TILE_SIZE);
    for (let py = MARGIN; py < panel.height; py += 1)
      darken(px, py, (origin.x + i) % 4 === 0 ? 0.75 : 0.25);
  }
  for (let i = 0; i < columns; i += 1) {
    if ((origin.x + i) % 4 === 0)
      label(panel, String(origin.x + i), MARGIN + i * TILE_SIZE + 2, 8, 1, [255, 214, 92]);
  }
  for (let j = 0; j < rows; j += 1) {
    if ((origin.y + j) % 4 === 0)
      label(panel, String(origin.y + j), 2, MARGIN + j * TILE_SIZE + 4, 1, [255, 214, 92]);
  }
  return panel;
}

const WASH = {
  border: [40, 80, 220],
  road: [255, 140, 0],
  lawn: [255, 60, 160],
  grass: [0, 200, 60],
  standing: [150, 40, 220],
} as const;

/** The picture with the design moves washed over it and the headline numbers underneath. */
export function movesPicture(
  image: MapImage,
  file: MapFile,
  moves: DesignMoves,
  title: string,
  crop?: TileRect,
): MapImage {
  const map = readTiles(file, crop);
  const panel = canvas(image.width, image.height + 40, [16, 18, 24]);
  blit(panel, image, 0, 0, image.width, image.height, 0, 0);
  const wash = (x: number, y: number, colour: readonly number[], amount: number) => {
    for (let j = 0; j < TILE_SIZE; j += 1) {
      for (let i = 0; i < TILE_SIZE; i += 1) {
        const at = ((y * TILE_SIZE + j) * panel.width + x * TILE_SIZE + i) * 4;
        for (let k = 0; k < 3; k += 1)
          panel.data[at + k] = Math.round(panel.data[at + k] * (1 - amount) + colour[k] * amount);
      }
    }
  };
  const outline = (x: number, y: number, colour: [number, number, number]) => {
    box(panel, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, 2, colour);
    box(panel, x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE - 2, TILE_SIZE, 2, colour);
    box(panel, x * TILE_SIZE, y * TILE_SIZE, 2, TILE_SIZE, colour);
    box(panel, x * TILE_SIZE + TILE_SIZE - 2, y * TILE_SIZE, 2, TILE_SIZE, colour);
  };
  // The border is the wall that can be followed in from the map's rim.
  const border = map.kinds.map((row) => row.map(() => false));
  const queue: [number, number][] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const onRim = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
      if (onRim && WALL_KINDS.has(map.kinds[y][x])) {
        border[y][x] = true;
        queue.push([x, y]);
      }
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const kind = map.kinds[ny]?.[nx];
      if ((kind === 'wood' || kind === 'rock') && !border[ny][nx]) {
        border[ny][nx] = true;
        queue.push([nx, ny]);
      }
    }
  }
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const kind = map.kinds[y][x];
      if (border[y][x]) wash(x, y, WASH.border, 0.28);
      else if (kind === 'road' || kind === 'ford') wash(x, y, WASH.road, 0.35);
      else if (kind === 'lawn') wash(x, y, WASH.lawn, 0.22);
      else if (kind === 'grass') wash(x, y, WASH.grass, 0.25);
      else if (kind === 'wood' || kind === 'rock' || kind === 'bush')
        wash(x, y, WASH.standing, 0.35);
      if (kind === 'ledge') outline(x, y, [255, 30, 30]);
      if (kind === 'fence') outline(x, y, [255, 255, 255]);
    }
  }
  label(panel, title.toUpperCase(), 4, image.height + 4, 2, [255, 214, 92]);
  label(
    panel,
    `BORDER ${moves.frameDepth}  ROAD ${Math.round(moves.roadShare * 100)}%  LAWN ${Math.round(moves.plainShare * 100)}%  OPEN ${Math.round(moves.biggestQuiet * 100)}%  LEDGES ${moves.ledges} STACKED ${Math.round((moves.ledgeParallel ?? 0) * 100)}%  FENCES ${moves.fenceRuns}  GROUPS ${moves.clusters}`,
    4,
    image.height + 22,
    1,
    [235, 235, 210],
  );
  return panel;
}

const CELL = 192;
type Rgb = [number, number, number];
const KIND_COLOUR: Readonly<Record<string, Rgb>> = {
  road: [235, 170, 70],
  trail: [150, 220, 120],
  river: [70, 130, 230],
  open: [235, 235, 200],
};
const TERRAIN_COLOUR: Readonly<Record<Terrain, Rgb>> = {
  town: [120, 104, 84],
  forest: [40, 84, 52],
  mountain: [104, 92, 88],
  river: [52, 88, 120],
  coast: [60, 104, 128],
  marsh: [72, 92, 64],
  farmland: [92, 112, 60],
  moor: [100, 80, 100],
};
const MARK_COLOUR: Readonly<Record<PlannedLandmark['kind'], Rgb>> = {
  landmark: [255, 214, 92],
  landing: [120, 240, 255],
  secret: [255, 120, 220],
};

/** A line `thickness` pixels wide, solid or dashed. */
function line(
  image: MapImage,
  from: readonly [number, number],
  to: readonly [number, number],
  colour: Rgb,
  thickness: number,
  dashed = false,
): void {
  const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), 1);
  for (let k = 0; k <= steps; k += 1) {
    if (dashed && Math.floor(k / 6) % 2 === 1) continue;
    const x = Math.round(from[0] + ((to[0] - from[0]) * k) / steps);
    const y = Math.round(from[1] + ((to[1] - from[1]) * k) / steps);
    box(
      image,
      x - Math.floor(thickness / 2),
      y - Math.floor(thickness / 2),
      thickness,
      thickness,
      colour,
    );
  }
}

/**
 * The world plan as one picture: each district a square in the colour of its
 * terrain, its name and its one idea written in it; the ways through it drawn
 * from each crossing to the district's heart (orange road, green trail, dashed
 * a hidden one, blue the river); red bars for the ways out of the map; yellow
 * landmarks, cyan landings and pink secrets where the plan puts them; black
 * cave mouths joined by the dashed way underground; a tick on every district
 * already drawn; and dotted squares where the map still has room to grow.
 */
export function planPicture(plan: WorldPlan, built: ReadonlySet<string> = new Set()): MapImage {
  const bounds = planBounds(plan);
  const growsEast = (bounds.columns + 1) * plan.districtSize <= MAP_FILE_LIMITS.maxWidth;
  const growsSouth = (bounds.rows + 1) * plan.districtSize <= MAP_FILE_LIMITS.maxHeight;
  const width = (bounds.columns + (growsEast ? 1 : 0)) * CELL + 16;
  const height = (bounds.rows + (growsSouth ? 1 : 0)) * CELL + 40 + 52;
  const image = canvas(width, height, [16, 18, 24]);
  label(
    image,
    `${plan.name}: ${bounds.columns * plan.districtSize}X${bounds.rows * plan.districtSize} TILES, ${plan.districts.length} DISTRICTS`,
    8,
    10,
    2,
    [255, 214, 92],
  );
  const scale = CELL / plan.districtSize;
  const origin = (id: string) => {
    const rect = districtRect(plan, id);
    return { x: 8 + rect.x * scale, y: 32 + rect.y * scale };
  };
  const at = (id: string, point: readonly [number, number]): [number, number] => {
    const { x, y } = origin(id);
    return [Math.round(x + point[0] * scale), Math.round(y + point[1] * scale)];
  };
  // Room to grow: a dotted square beyond the east and south edges.
  const dotted = (x: number, y: number) => {
    for (let i = 0; i < CELL - 4; i += 6) {
      box(image, x + 2 + i, y + 2, 2, 2, [90, 94, 104]);
      box(image, x + 2 + i, y + CELL - 4, 2, 2, [90, 94, 104]);
      box(image, x + 2, y + 2 + i, 2, 2, [90, 94, 104]);
      box(image, x + CELL - 4, y + 2 + i, 2, 2, [90, 94, 104]);
    }
  };
  if (growsEast)
    for (let row = 0; row < bounds.rows; row += 1)
      dotted(8 + bounds.columns * CELL, 32 + row * CELL);
  if (growsSouth)
    for (let column = 0; column < bounds.columns; column += 1)
      dotted(8 + column * CELL, 32 + bounds.rows * CELL);
  if (growsEast || growsSouth)
    label(
      image,
      'ROOM TO GROW',
      8 + (growsEast ? bounds.columns : 0) * CELL + 12,
      32 + (growsEast ? 0 : bounds.rows) * CELL + 12,
      1,
      [120, 124, 134],
    );

  for (const district of plan.districts) {
    const { x, y } = origin(district.id);
    box(image, x + 2, y + 2, CELL - 4, CELL - 4, TERRAIN_COLOUR[district.terrain ?? 'forest']);
  }
  // The ways through each district, from every opening to its heart.
  const heart = (id: string): [number, number] => {
    const landing = (plan.landmarks ?? []).find(
      (landmark) => landmark.district === id && landmark.kind === 'landing',
    );
    return at(id, landing?.at ?? [plan.districtSize / 2, plan.districtSize / 2]);
  };
  const edgePoint = (id: string, opening: Opening): [number, number] => {
    const middle = opening.at + opening.width / 2;
    const size = plan.districtSize;
    const point: Record<Side, [number, number]> = {
      north: [middle, 0],
      south: [middle, size],
      west: [0, middle],
      east: [size, middle],
    };
    return at(id, point[opening.side]);
  };
  for (const district of plan.districts) {
    const openings = openingsOf(plan, district.id);
    // A river runs straight from one of its openings to the next; with one, it
    // rises or reaches the sea in the district.
    const rivers = openings.filter((opening) => opening.kind === 'river');
    for (let k = 1; k < rivers.length; k += 1)
      line(
        image,
        edgePoint(district.id, rivers[k - 1]),
        edgePoint(district.id, rivers[k]),
        KIND_COLOUR.river,
        8,
      );
    if (rivers.length === 1)
      line(
        image,
        edgePoint(district.id, rivers[0]),
        at(district.id, [plan.districtSize / 2, plan.districtSize / 2]),
        KIND_COLOUR.river,
        8,
      );
    for (const opening of openings) {
      if (opening.kind === 'river') continue;
      const thickness = opening.kind === 'open' ? 6 : opening.kind === 'road' ? 4 : 3;
      line(
        image,
        edgePoint(district.id, opening),
        heart(district.id),
        KIND_COLOUR[opening.kind],
        thickness,
        opening.hidden,
      );
      if ('exit' in opening.leadsTo) {
        const [ex, ey] = edgePoint(district.id, opening);
        box(image, ex - 5, ey - 5, 10, 10, [230, 60, 60]);
      }
    }
  }
  // Caves: their mouths, and the way underground between them.
  for (const cave of plan.caves ?? []) {
    const mouths = cave.mouths.map((mouth) => at(mouth.district, mouth.at));
    for (let k = 1; k < mouths.length; k += 1)
      line(image, mouths[k - 1], mouths[k], [10, 10, 14], 2, true);
    mouths.forEach(([mx, my]) => {
      box(image, mx - 5, my - 5, 11, 11, [10, 10, 14]);
      box(image, mx - 3, my - 3, 7, 7, [140, 120, 100]);
    });
  }
  for (const landmark of plan.landmarks ?? []) {
    const [lx, ly] = at(landmark.district, landmark.at);
    box(image, lx - 3, ly - 3, 7, 7, MARK_COLOUR[landmark.kind]);
    label(image, landmark.name, lx + 6, ly - 2, 1, MARK_COLOUR[landmark.kind]);
  }
  for (const district of plan.districts) {
    const { x, y } = origin(district.id);
    box(image, x + 2, y + 2, CELL - 4, 48, [16, 18, 24], 170);
    label(image, district.name, x + 8, y + 8, 2, [255, 255, 255]);
    wrap(district.idea, 44)
      .slice(0, 3)
      .forEach((text, index) => label(image, text, x + 8, y + 24 + index * 8, 1, [220, 225, 210]));
    if (built.has(district.id))
      label(image, 'DRAWN', x + CELL - 34, y + CELL - 12, 1, [160, 255, 160]);
  }
  // The legend.
  const legendY = height - 44;
  const keys: [string, Rgb][] = [
    ['ROAD', KIND_COLOUR.road],
    ['TRAIL', KIND_COLOUR.trail],
    ['RIVER', KIND_COLOUR.river],
    ['WAY OUT', [230, 60, 60]],
    ['LANDMARK', MARK_COLOUR.landmark],
    ['LANDING', MARK_COLOUR.landing],
    ['SECRET', MARK_COLOUR.secret],
    ['CAVE MOUTH', [140, 120, 100]],
  ];
  keys.forEach(([name, colour], index) => {
    const lx = 8 + (index % 4) * 150;
    const ly = legendY + Math.floor(index / 4) * 18;
    box(image, lx, ly, 10, 10, colour);
    label(image, name, lx + 16, ly + 2, 1, [220, 225, 210]);
  });
  label(
    image,
    'DASHED: A HIDDEN TRAIL, OR THE WAY UNDERGROUND',
    8,
    legendY + 36,
    1,
    [150, 154, 164],
  );
  return image;
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** A picture made smaller by averaging `factor` x `factor` blocks: a whole huge map at a glance. */
export function shrunk(image: MapImage, factor: number): MapImage {
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const out = canvas(width, height, [0, 0, 0]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sum = [0, 0, 0];
      for (let j = 0; j < factor; j += 1) {
        for (let i = 0; i < factor; i += 1) {
          const at = ((y * factor + j) * image.width + x * factor + i) * 4;
          for (let k = 0; k < 3; k += 1) sum[k] += image.data[at + k];
        }
      }
      const at = (y * width + x) * 4;
      for (let k = 0; k < 3; k += 1) out.data[at + k] = Math.round(sum[k] / (factor * factor));
      out.data[at + 3] = 255;
    }
  }
  return out;
}

/** One inside or cave floor of a map file, as the game draws it. */
export function areaPicture(file: MapFile, areaId: string): MapImage {
  const placed = composeMapFile(file).areas.find((area) => area.id === areaId);
  if (!placed) throw new Error(`the map has no place called '${areaId}'`);
  const reading = readMapFile(file);
  if (!reading.ok) throw new Error(reading.problems.join(' '));
  registerPlayerMap(buildPlayerMap(reading.file));
  const { x, y, width, height } = placed.rect;
  return drawWorldMap(playerMapId(file), [x, y, width, height]);
}
