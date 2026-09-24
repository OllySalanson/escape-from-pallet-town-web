/**
 * Writes a plausible walked-ground record for every map, without playing a raid.
 *
 * The drop-in screen and the wall map in Oak's Lab are pictures of what has
 * been walked, and a fresh save has walked nothing - so a screenshot of either
 * on a fresh save is a picture of the dark. `tools/playtest/raid.mjs
 * --progress=` writes a real one, a raid at a time; this writes one that looks
 * like several raids have been run, by walking the shortest road from each
 * map's front door to its nearest ways out and landmarks and surveying a disc
 * round every step, exactly as `WorldScene` does (`SURVEY_RADIUS`).
 *
 *   npx vite-node tools/tileset/sampleSurvey.mts -- <out.json> [mapId=goals,..]
 *
 * `goals` is how many ways out and landmarks, nearest first, a map's raids
 * have walked to: `floodplain-relay=9 route-1=5`. A map left out is walked to
 * its nearest three, and `mapId=0` leaves it dark. The file is a
 * `raidProgress.surveyed` record, so it goes straight to `--survey=` on
 * `dropinShots.mjs`, `wallMapShots.mjs`, `renderBase.mts` and `minimap.mts`.
 */
import { writeFileSync } from 'node:fs';
import { getWorldMap, WORLD_MAPS, type WorldMapId } from '../../src/game/worldMap';
import { frontDoorFor } from '../../src/game/run/runGeneration';
import { EXTRACTION_POINTS } from '../../src/game/world/extractionPoints';
import { encodeSurvey } from '../../src/game/world/survey';
import { tilesAround, SURVEY_RADIUS } from '../../src/game/world/minimap';

const args = process.argv.slice(2);
const [target = 'survey.json'] = args.filter((arg) => !arg.includes('='));
const goals = Object.fromEntries(
  args
    .filter((arg) => arg.includes('='))
    .map((arg) => {
      const [mapId, count] = arg.split('=');
      return [mapId, Number(count)];
    }),
);

const record: Record<string, unknown> = {};
for (const mapId of Object.keys(WORLD_MAPS) as WorldMapId[]) {
  const map = getWorldMap(mapId, []);
  const { width, height } = map;
  const door = frontDoorFor(mapId);
  if (!door) continue;
  // One breadth-first walk from the front door, remembering where each tile
  // was reached from, so the road to any goal can be read back.
  const from = new Int32Array(width * height).fill(-2);
  const start = door.position.y * width + door.position.x;
  from[start] = -1;
  const queue = [start];
  const order = new Map<number, number>();
  for (let head = 0; head < queue.length; head += 1) {
    const tile = queue[head];
    order.set(tile, head);
    const x = tile % width;
    const y = Math.floor(tile / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (from[next] !== -2 || map.collision[ny][nx]) continue;
      from[next] = tile;
      queue.push(next);
    }
  }
  const places = [
    ...EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map((point) => point.position),
    ...map.pois.map((poi) => poi.position),
  ]
    .map((position) => position.y * width + position.x)
    .filter((tile) => order.has(tile))
    .sort((a, b) => order.get(a)! - order.get(b)!)
    .slice(0, goals[mapId] ?? 3);
  const walked = new Set<number>();
  for (const goal of places) {
    for (let tile = goal; tile >= 0; tile = from[tile]) {
      const position = { x: tile % width, y: Math.floor(tile / width) };
      for (const seen of tilesAround(position, SURVEY_RADIUS, width, height)) walked.add(seen);
    }
  }
  if (walked.size > 0) record[mapId] = encodeSurvey(width, walked);
  console.log(`${mapId}: ${places.length} places walked to, ${walked.size} tiles`);
}
writeFileSync(target, JSON.stringify({ surveyed: record }));
console.log(target);
