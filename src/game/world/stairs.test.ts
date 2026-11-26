import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { plantedProp, type MapFileBuilding } from './mapFile';
import { builtInFileMaps } from './playerMaps';

/**
 * A flight of steps is a way up, so it is walked up.
 *
 * Gull Strand's cliff path came down to the cove by a flight of stone steps
 * cut in the rock, and the steps were the only ground in it: the captain stood
 * on them at night and could go no higher (26 Nov 2026), because the stair
 * planted was the extraction stair, whose steps are the end of a raid rather
 * than a way through. Every flight a shipped map file plants is walked here,
 * from the ground at its foot to the ground at its head, through the steps.
 */
const STAIR_LABELS = new Set(['stair', 'steps']);

type Tile = readonly [number, number];

function stairsOf(buildings: readonly MapFileBuilding[]): MapFileBuilding[] {
  return buildings.filter((building) => STAIR_LABELS.has(plantedProp(building.kind).label));
}

/** Whether the flight is climbed: from the foot of its steps to the ground over its head, on its own ground. */
function climb(collision: readonly (readonly boolean[])[], stair: MapFileBuilding): string | undefined {
  const prop = plantedProp(stair.kind);
  const open = (x: number, y: number) => collision[y]?.[x] === false;
  const ground = new Set<string>();
  prop.cells.forEach((cell, index) => {
    if (cell.solid === false) ground.add(`${stair.x + (index % prop.width)},${stair.y + Math.floor(index / prop.width)}`);
  });
  if (ground.size === 0) return 'has no steps to stand on';
  const inside = (x: number, y: number) => ground.has(`${x},${y}`);
  const bottom = stair.y + prop.height - 1;
  const top = stair.y;
  const feet: Tile[] = [];
  const heads = new Set<string>();
  for (let x = stair.x; x < stair.x + prop.width; x += 1) {
    if (inside(x, bottom) && open(x, bottom + 1)) feet.push([x, bottom + 1]);
    if (inside(x, top) && open(x, top - 1)) heads.add(`${x},${top - 1}`);
  }
  if (feet.length === 0) return 'has no ground at its foot';
  if (heads.size === 0) return 'has no ground at its head';
  for (const key of ground) {
    const [x, y] = key.split(',').map(Number);
    if (!open(x, y)) return `has a step at ${key} that cannot be stood on`;
  }
  const seen = new Set(feet.map(([x, y]) => `${x},${y}`));
  const queue: Tile[] = [...feet];
  while (queue.length > 0) {
    const [x, y] = queue.shift() as Tile;
    if (heads.has(`${x},${y}`)) return undefined;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const key = `${nx},${ny}`;
      const onWay = inside(nx, ny) || heads.has(key);
      if (onWay && !seen.has(key)) {
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return 'cannot be climbed from its foot to its head';
}

describe('stairs', () => {
  const cases = builtInFileMaps().flatMap((map) =>
    stairsOf(map.file.buildings).map((stair) => [map.id, stair.kind, stair.x, stair.y, stair] as const),
  );

  it('are planted on the shipped maps, so this is asked of something', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)('%s: the %s at %i,%i is walked up from its foot to its head', (id, _kind, _x, _y, stair) => {
    expect(climb(getWorldMap(id, []).layers.collision, stair)).toBeUndefined();
  });
});
