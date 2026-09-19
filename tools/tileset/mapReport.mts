/**
 * What a map measures, printed.
 *
 * The invariants in `mapStructure.test.ts` are pass/fail; while a map is being
 * drawn what you need is the number and *where*. This prints the same
 * measurements plus the one thing a test cannot: a picture of which pieces of
 * ground are joined to which, so a district drawn one tile short of its
 * neighbour shows up as a second component rather than as a mystery.
 *
 *   npx vite-node tools/tileset/mapReport.mts -- <map-id> [--components]
 */
import { WORLD_MAPS, getWorldMap, type WorldMapId } from '../../src/game/worldMap';
import { gateBossIds, gatesForMap } from '../../src/game/world/gates';
import {
  openGround,
  slideLength,
  straightWalk,
  walkableTiles,
} from '../../src/game/world/mapStructure';
import { EXTRACTION_POINTS } from '../../src/game/world/extractionPoints';
import { RUN_INSERTIONS } from '../../src/game/run/runGeneration';

const args = process.argv.slice(2);
const id = (args.find((value) => !value.startsWith('--')) ?? 'floodplain-relay') as WorldMapId;
const bosses = gateBossIds(gatesForMap(id));
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
}

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
