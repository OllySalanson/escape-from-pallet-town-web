/**
 * Dead-end pockets on a shipped map that nothing stands on yet and no canopy
 * hangs over: where a new exit or crate can go without standing in a lane.
 *
 *   npx vite-node tools/tileset/pockets.mts -- <map-id> [--district=<id>]
 */
import type { BuiltInMapId } from '../../src/game/worldMap';
import { WORLD_MAPS } from '../../src/game/worldMap';
import { districtAt } from '../../src/game/world/districts';
import { permanentThingsOn } from '../../src/game/world/shippedDensity';
import { stepDistances } from '../../src/game/world/mapStructure';
import { extractionPointsOn } from '../../src/game/world/extractionPoints';
import { insertionsOn, frontDoorFor } from '../../src/game/run/runGeneration';
import { createRunTrainerEncounters } from '../../src/game/world/trainers';
import { trainerSightTiles } from '../../src/game/world/trainerSight';
import { ledgesForMap } from '../../src/game/world/ledges';

const mapId = (process.argv.slice(2).find((v) => !v.startsWith('--')) ?? 'route-1') as BuiltInMapId;
const shut = WORLD_MAPS[mapId];
const { map, things } = permanentThingsOn(mapId);
const taken = new Set<string>();
const key = (x: number, y: number) => `${x},${y}`;
things.forEach((t) => taken.add(key(t.x, t.y)));
map.loot.forEach((l) => taken.add(key(l.position.x, l.position.y)));
map.entities.forEach((e) => (e.idle?.roam ?? []).forEach((t) => taken.add(key(t.x, t.y))));
map.warps.forEach((w) => taken.add(key(w.source.x, w.source.y)));
ledgesForMap(mapId).forEach((l) => l.brow.forEach((t) => taken.add(key(t.x, t.y))));
for (const trainer of createRunTrainerEncounters().filter((t) => t.mapId === mapId)) {
  trainerSightTiles(trainer, (t) => map.collision[t.y]?.[t.x] ?? true).forEach((t) => taken.add(key(t.x, t.y)));
}
const front = frontDoorFor(mapId);
const fromFront = stepDistances(shut.collision, front.position);
const exits = extractionPointsOn(mapId);
const exitDist = exits.map((e) => stepDistances(map.collision, e.position));
const h = map.collision.length;
const w = map.collision[0].length;
const open = (x: number, y: number) => y >= 0 && x >= 0 && y < h && x < w && !map.collision[y][x];
const rows: string[] = [];
for (let y = 0; y < h; y += 1) {
  for (let x = 0; x < w; x += 1) {
    if (!open(x, y) || taken.has(key(x, y)) || map.layers.canopy.tiles[y][x] >= 0) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(x + dx, y + dy));
    if (n.length !== 1) continue;
    const nearest = Math.min(...exitDist.map((d) => (d[y][x] < 0 ? 9999 : d[y][x])));
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => map.terrain[y + dy]?.[x + dx] ?? '-').join('/');
    rows.push(
      `${String(x).padStart(3)},${String(y).padStart(3)}  ${(districtAt(mapId, { x, y })?.name ?? '?').padEnd(18)} ` +
        `exit ${String(nearest).padStart(4)}  front ${String(fromFront[y][x]).padStart(4)}  ${map.terrain[y][x]}  [${around}]`,
    );
  }
}
const districtFlag = process.argv.find((v) => v.startsWith('--district='))?.slice('--district='.length);
if (districtFlag) {
  // Free standing ground in one district, nearest its middle first: where a
  // piece of loot seated there can fall back to.
  const tiles: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (open(x, y) && !taken.has(key(x, y)) && map.layers.canopy.tiles[y][x] < 0 && districtAt(mapId, { x, y })?.id === districtFlag) {
        tiles.push({ x, y });
      }
    }
  }
  const cx = tiles.reduce((t, p) => t + p.x, 0) / tiles.length;
  const cy = tiles.reduce((t, p) => t + p.y, 0) / tiles.length;
  tiles.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  console.log(`${districtFlag}: ${tiles.length} free tiles, middle first:`, tiles.slice(0, 8).map((t) => `${t.x},${t.y}`).join('  '));
} else {
  console.log(`${mapId}: ${rows.length} free dead ends (x,y district nearest-exit front-door-shut terrain [E/W/S/N])`);
  console.log(rows.join('\n'));
}
