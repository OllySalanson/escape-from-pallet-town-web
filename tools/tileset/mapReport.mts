/**
 * What a map measures, printed.
 *
 * The invariants in `mapStructure.test.ts` are pass/fail; while a map is being
 * drawn what you need is the number and *where*. This prints the same
 * measurements plus the one thing a test cannot: a picture of which pieces of
 * ground are joined to which, so a district drawn one tile short of its
 * neighbour shows up as a second component rather than as a mystery.
 *
 *   npx vite-node tools/tileset/mapReport.mts -- <map-id> [--components] [--clashes] [--runs]
 */
import { WORLD_MAPS, getWorldMap, type WorldMapId } from '../../src/game/worldMap';
import { gateKeys, gatesForMap } from '../../src/game/world/gates';
import {
  openGround,
  slideLength,
  straightWalk,
  walkableTiles,
} from '../../src/game/world/mapStructure';
import { EXTRACTION_POINTS } from '../../src/game/world/extractionPoints';
import { isSolidTerrain } from '../../src/game/world/mapGrid';
import { sketchFloodplainRelay } from '../../src/game/world/maps/floodplainRelay';
import { sketchPalletTown } from '../../src/game/world/maps/palletTown';
import { sketchRoute1 } from '../../src/game/world/maps/route1';
import { sketchViridianForest } from '../../src/game/world/maps/viridianForest';
import { RUN_INSERTIONS } from '../../src/game/run/runGeneration';

const args = process.argv.slice(2);
const id = (args.find((value) => !value.startsWith('--')) ?? 'floodplain-relay') as WorldMapId;
// Every door open - a boss's and a field move's alike.
const bosses = gateKeys(gatesForMap(id));
const map = getWorldMap(id, bosses);
const collision = map.collision;

const key = (x: number, y: number) => `${x},${y}`;
const seen = new Set<string>();
const components: { size: number; tiles: { x: number; y: number }[] }[] = [];
for (const start of walkableTiles(collision)) {
  if (seen.has(key(start.x, start.y))) continue;
  const queue = [start];
  seen.add(key(start.x, start.y));
  const tiles: { x: number; y: number }[] = [];
  for (let i = 0; i < queue.length; i += 1) {
    const tile = queue[i];
    tiles.push(tile);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (collision[ny]?.[nx] !== false || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      queue.push({ x: nx, y: ny });
    }
  }
  components.push({ size: tiles.length, tiles });
}
components.sort((a, b) => b.size - a.size);

const walk = straightWalk(collision);
const open = openGround(collision);
const walkable = walkableTiles(collision);

console.log(`${id}  ${map.width}x${map.height}  ${bosses.length} boss${bosses.length === 1 ? '' : 'es'}`);
console.log(`  walkable          ${walkable.length} of ${map.width * map.height} (${Math.round((100 * walkable.length) / (map.width * map.height))}%)`);
console.log(`  tall grass        ${map.tallGrass.flat().filter(Boolean).length}`);
console.log(`  longest straight  ${walk.longest}  (limit 9)`);
console.log(`  average straight  ${walk.average.toFixed(2)}`);
console.log(`  open blobs        ${open.blobs.filter((b) => b > 1).length} over one tile ${JSON.stringify(open.blobs.slice(0, 6))}`);
console.log(`  components        ${components.length} ${JSON.stringify(components.map((c) => c.size).slice(0, 8))}`);

if (components.length > 1) {
  console.log('  stranded pieces (top-left corner of each):');
  for (const component of components.slice(1, 12)) {
    const top = component.tiles.reduce((best, tile) =>
      tile.y < best.y || (tile.y === best.y && tile.x < best.x) ? tile : best,
    );
    console.log(`    ${String(component.size).padStart(4)} tiles from ${top.x},${top.y}`);
  }
}

// Where the long straight runs are: the captain's own test, located.
const runs: string[] = [];
for (const tile of walkable) {
  for (const [dx, dy, name] of [[0, 1, 'down'], [1, 0, 'right']] as const) {
    const length = slideLength(collision, tile, dx, dy);
    if (length > 9) runs.push(`${tile.x},${tile.y} ${name} ${length}`);
  }
}
if (runs.length) {
  console.log(`  runs over 9 (${runs.length}): ${runs.slice(0, 12).join('  ')}`);
  if (args.includes('--runs')) {
    // One line per offending lane rather than per tile in it: a corridor twelve
    // long is one mistake, and listing it as twelve hides the other forty.
    const lanes = new Map<string, number>();
    for (const tile of walkable) {
      for (const [dx, dy, name] of [[1, 0, 'row'], [0, 1, 'col']] as const) {
        if (collision[tile.y - dy]?.[tile.x - dx] === false) continue;
        const length = slideLength(collision, tile, dx, dy) + 1;
        if (length > 10) lanes.set(`${name} from ${tile.x},${tile.y}`, length);
      }
    }
    for (const [lane, length] of [...lanes].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${lane}: ${length} tiles`);
    }
  }
}

// Landmarks drawn over each other. A tree's crown is drawn above everything, so
// a tree stamped one tile too close to a house eats the roof - invisible in the
// drawing, obvious in the render, and a class of mistake rather than a mistake.
// The one overlap that is meant is a crown over the trunk of the tree behind it,
// which is how a wood interlocks; everything else is reported.
const SKETCHES = {
  'floodplain-relay': sketchFloodplainRelay,
  'pallet-town': sketchPalletTown,
  'route-1': sketchRoute1,
  'viridian-forest': sketchViridianForest,
} as const;
const GROWTH = new Set(['tree', 'treeAlt', 'pine', 'pineAlt', 'treeWall', 'tallBush']);
const planted = SKETCHES[id]().props();
const drawnCells = planted.map((prop) => {
  const definition = map.tileset.props[prop.name];
  const cells = new Map<string, boolean>();
  for (let row = 0; row < definition.height; row += 1) {
    for (let column = 0; column < definition.width; column += 1) {
      const cell = definition.cells[row * definition.width + column];
      if (cell.tile >= 0) cells.set(key(prop.x + column, prop.y + row), cell.canopy === true);
    }
  }
  return { prop, cells };
});
const clashes: string[] = [];
for (let a = 0; a < drawnCells.length; a += 1) {
  for (let b = a + 1; b < drawnCells.length; b += 1) {
    const [first, second] = [drawnCells[a], drawnCells[b]];
    const bothGrowth = GROWTH.has(first.prop.name) && GROWTH.has(second.prop.name);
    for (const [cell, firstIsCrown] of first.cells) {
      const secondIsCrown = second.cells.get(cell);
      if (secondIsCrown === undefined) continue;
      if (bothGrowth && firstIsCrown !== secondIsCrown) continue;
      clashes.push(`${first.prop.name}@${first.prop.x},${first.prop.y} x ${second.prop.name}@${second.prop.x},${second.prop.y}`);
      break;
    }
  }
}
// Growth standing on ground that was cut to be walked. A map carved out of a
// forest leaves trees at the edge of every cut, and one whose trunk overhangs
// the lane turns a two-wide road into a one-wide road nobody drew.
const sketchForLint = SKETCHES[id]();
const overhangs: string[] = [];
for (const { prop } of drawnCells) {
  if (!GROWTH.has(prop.name)) continue;
  const definition = map.tileset.props[prop.name];
  for (let row = 0; row < definition.height; row += 1) {
    for (let column = 0; column < definition.width; column += 1) {
      const cell = definition.cells[row * definition.width + column];
      if (cell.tile < 0 || !cell.solid || cell.canopy) continue;
      const x = prop.x + column;
      const y = prop.y + row;
      if (sketchForLint.terrainAt(x, y) === 't') continue;
      // A tree standing in grass or reeds is a tree. The defect is a trunk on
      // a road: earth, paving, stone or gravel that somebody laid to be walked.
      if (!',PMv'.includes(sketchForLint.terrainAt(x, y) ?? 'T')) continue;
      if (!isSolidTerrain(sketchForLint.terrainAt(x, y) ?? 'T')) overhangs.push(`${prop.name}@${prop.x},${prop.y} on ${x},${y}`);
    }
  }
}
// The trunk's own tile is grass by definition, so only its neighbours count.
const realOverhangs = overhangs.filter((entry) => {
  const [, at, on] = /@(\d+,\d+) on (\d+,\d+)/.exec(entry) ?? [];
  const [px, py] = at.split(',').map(Number);
  const [ox, oy] = on.split(',').map(Number);
  return !(ox === px + 1 && oy === py + 2);
});
console.log(`  trees over lanes  ${realOverhangs.length}${realOverhangs.length ? `: ${realOverhangs.slice(0, 10).join('  ')}` : ''}`);
if (args.includes('--clashes')) for (const entry of realOverhangs) console.log(`    over: ${entry}`);

console.log(`  landmark clashes  ${clashes.length}${clashes.length ? `: ${clashes.slice(0, 14).join('  ')}` : ''}`);
if (args.includes('--clashes')) for (const clash of clashes) console.log(`    ${clash}`);

const edges: string[] = [];
const gates = new Set(
  EXTRACTION_POINTS.filter((point) => point.mapId === id).map((point) => key(point.position.x, point.position.y)),
);
for (let y = 0; y < map.height; y += 1) {
  for (let x = 0; x < map.width; x += 1) {
    const onEdge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
    if (onEdge && collision[y][x] === false && !gates.has(key(x, y))) edges.push(key(x, y));
  }
}
if (edges.length) console.log(`  unsealed edge tiles: ${edges.slice(0, 12).join(' ')}`);

console.log('  content on this map:');
for (const insertion of Object.values(RUN_INSERTIONS)) {
  if (insertion.mapId !== id) continue;
  const at = insertion.position;
  console.log(`    insertion ${insertion.id} ${at.x},${at.y} ${collision[at.y]?.[at.x] === false ? 'ok' : 'BLOCKED'}`);
}
for (const point of EXTRACTION_POINTS) {
  if (point.mapId !== id) continue;
  const at = point.position;
  console.log(`    exit ${point.label} ${at.x},${at.y} ${collision[at.y]?.[at.x] === false ? 'ok' : 'BLOCKED'}`);
}
for (const poi of map.pois) {
  console.log(`    landmark ${poi.label} ${poi.position.x},${poi.position.y} ${collision[poi.position.y]?.[poi.position.x] === false ? 'ok' : 'BLOCKED'}`);
}
void WORLD_MAPS;
