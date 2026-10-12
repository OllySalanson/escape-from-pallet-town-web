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
  buildPlayerMap,
  playerMapId,
  readMapFile,
  type MapFile,
} from '../../src/game/world/mapFile';
import { registerPlayerMap } from '../../src/game/world/playerMaps';
import { composeMapFile } from '../../src/game/world/mapAreas';
import { readTiles, WALL_KINDS, type TileRect } from './tiles';
import type { DesignMoves } from './measures';
import { districtRect, openingsOf, planBounds, type Opening, type WorldPlan } from './worldPlan';

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
const KIND_COLOUR: Readonly<Record<string, [number, number, number]>> = {
  road: [235, 170, 70],
  trail: [150, 220, 120],
  river: [70, 130, 230],
  open: [235, 235, 200],
};

/**
 * The world plan as one picture: a box a district, green where it is drawn and
 * grey where it is not, its name and its one idea written in it; a bar on each
 * shared edge where a crossing is (orange road, green trail, blue river, pale
 * open country) and a red bar on the outer edge for each way out.
 */
export function planPicture(plan: WorldPlan, built: ReadonlySet<string> = new Set()): MapImage {
  const bounds = planBounds(plan);
  const image = canvas(bounds.columns * CELL + 16, bounds.rows * CELL + 40, [16, 18, 24]);
  label(image, plan.name, 8, 8, 2, [255, 214, 92]);
  const origin = (id: string) => {
    const rect = districtRect(plan, id);
    return {
      x: 8 + (rect.x / plan.districtSize) * CELL,
      y: 32 + (rect.y / plan.districtSize) * CELL,
    };
  };
  for (const district of plan.districts) {
    const { x, y } = origin(district.id);
    box(
      image,
      x + 2,
      y + 2,
      CELL - 4,
      CELL - 4,
      built.has(district.id) ? [52, 92, 60] : [58, 60, 66],
    );
    label(image, district.name, x + 8, y + 10, 2, [255, 255, 255]);
    wrap(district.idea, 44).forEach((line, index) =>
      label(image, line, x + 8, y + 34 + index * 9, 1, [220, 225, 210]),
    );
  }
  const bar = (id: string, opening: Opening, colour: [number, number, number]) => {
    const { x, y } = origin(id);
    const along = Math.round((opening.at / plan.districtSize) * CELL);
    const span = Math.max(6, Math.round((opening.width / plan.districtSize) * CELL));
    if (opening.side === 'north') box(image, x + along, y, span, 6, colour);
    if (opening.side === 'south') box(image, x + along, y + CELL - 6, span, 6, colour);
    if (opening.side === 'west') box(image, x, y + along, 6, span, colour);
    if (opening.side === 'east') box(image, x + CELL - 6, y + along, 6, span, colour);
  };
  for (const district of plan.districts) {
    for (const opening of openingsOf(plan, district.id)) {
      bar(
        district.id,
        opening,
        'exit' in opening.leadsTo ? [230, 60, 60] : KIND_COLOUR[opening.kind],
      );
    }
  }
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
