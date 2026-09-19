/**
 * Which trees hang a crown where one must not be.
 *
 * A crown is drawn over the figures, which is what gives a wood an inside - and
 * three ways it goes wrong, none of which any structure rule sees:
 *
 * - over ground that is not grass. A crown tile has this sheet's grass baked
 *   into its corners, so over a road it is a green square punched in the road;
 * - over a run of ground somebody walks. One tile is walking behind a tree; six
 *   is the player gone, and in a playtest the hunter stood under one unseen;
 * - over the seat a caption needs. Canopy is ground a caption may not take
 *   (`labelPlacement.ts`), so an exit ringed by crowns is an exit with no name.
 *   One band of sky, above or below, is kept clear beside everything the map
 *   captions, and `CLEAR_SKY` names the corners where several captioned things
 *   stand together and the whole corner is kept clear.
 *
 *   npx vite-node tools/tileset/crowns.mts -- <map-id>
 *
 * Prints the offending trees as JSON by the tile their letter is drawn on, with
 * the reason; a lattice tree is felled by redrawing its `t` as `T`. When a
 * caption is still missing after that, ask the game, not this:
 * `tools/playtest/whyHidden.mjs`.
 */
import { FLOOD_TOWN_TILESET } from '../../src/game/world/tileset/floodTownTileset';
import { sketchPalletTown } from '../../src/game/world/maps/palletTown';
import { sketchRoute1 } from '../../src/game/world/maps/route1';
import { sketchViridianForest } from '../../src/game/world/maps/viridianForest';
import { getWorldMap } from '../../src/game/worldMap';
import { gateBossIds, gatesForMap, WORLD_GATES } from '../../src/game/world/gates';
import { EXTRACTION_POINTS } from '../../src/game/world/extractionPoints';
import { WORLD_POIS } from '../../src/game/world/pois';
import { RUN_INSERTIONS } from '../../src/game/run/runGeneration';
import { RAID_CONTRACTS } from '../../src/game/objectives/contracts';
import { createRunTrainerEncounters } from '../../src/game/world/trainers';

const id = process.argv.slice(2).find((a) => a !== '--')! as 'pallet-town';
const sketch = { 'pallet-town': sketchPalletTown, 'route-1': sketchRoute1, 'viridian-forest': sketchViridianForest }[id]!();
const grid = sketch.toGrid();
const map = getWorldMap(id, gateBossIds(gatesForMap(id)));
const W = sketch.width, H = sketch.height;
const CLEAR_SKY: Record<string, number[][]> = {
  'route-1': [[18, 16, 31, 22], [21, 0, 31, 11], [0, 22, 9, 31]],
  'pallet-town': [],
  'viridian-forest': [],
};
const clearSky = (x: number, y: number) => (CLEAR_SKY[id] ?? []).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
type Subject = { x: number; y0: number; y1: number };
const at = (p: { x: number; y: number }): Subject => ({ x: p.x, y0: p.y, y1: p.y });
const subjects: Subject[] = [
  ...EXTRACTION_POINTS.filter((p) => p.mapId === id).map((p) => at(p.position)),
  ...WORLD_POIS.filter((p) => p.mapId === id).map((p) => at(p.position)),
  ...WORLD_GATES.filter((g) => g.mapId === id).map((g) => ({ x: g.tiles[0].x, y0: Math.min(...g.tiles.map((t) => t.y)), y1: Math.max(...g.tiles.map((t) => t.y)) })),
  ...Object.values(RUN_INSERTIONS).filter((p) => p.mapId === id).slice(1).map((p) => at(p.position)),
  ...RAID_CONTRACTS.filter((c) => c.mapId === id).flatMap((c) => c.markers.map((m) => at(m.position))),
  ...createRunTrainerEncounters().filter((t) => t.mapId === id && t.sightRange).map((t) => at(t.position)),
];
type Tree = { name: string; x: number; y: number; crown: [number, number][] };
const trees: Tree[] = [];
for (const planted of sketch.props()) {
  const prop = FLOOD_TOWN_TILESET.props[planted.name];
  const crown: [number, number][] = [];
  for (let r = 0; r < prop.height; r++) for (let c = 0; c < prop.width; c++) {
    const cell = prop.cells[r * prop.width + c];
    if (cell.tile >= 0 && cell.canopy) crown.push([planted.x + c, planted.y + r]);
  }
  if (crown.length > 0 && ['tree', 'pine', 'tallBush'].includes(planted.name)) trees.push({ name: planted.name, x: planted.x, y: planted.y, crown });
}
const under = new Map<string, Tree[]>();
for (const tree of trees) for (const [x, y] of tree.crown) under.set(`${x},${y}`, [...(under.get(`${x},${y}`) ?? []), tree]);
const walkable = (x: number, y: number) => map.collision[y]?.[x] === false;
const doomed = new Map<Tree, string>();
for (const tree of trees) for (const [x, y] of tree.crown) {
  const ch = grid[y]?.[x];
  if (ch !== 'T' && ch !== '.') doomed.set(tree, `crown over '${ch}' at ${x},${y}`);
  else if (clearSky(x, y)) doomed.set(tree, `crown in clear sky at ${x},${y}`);
}
// A caption needs one clear seat: the band above its subject or the band below,
// eleven tiles wide and three deep, wholly on the map. Whichever costs fewer
// trees is cleared.
for (const subject of subjects) {
  const x0 = Math.max(0, Math.min(subject.x - 5, W - 11));
  // A band with something else the map names inside it is no seat: a caption
  // never sits on another caption's subject.
  const free = ([a, b]: number[]) => a >= 0 && b < H && !subjects.some((other) => other !== subject && other.x >= x0 && other.x <= x0 + 10 && other.y1 >= a && other.y0 <= b);
  const all = [[subject.y0 - 3, subject.y0 - 1], [subject.y1 + 1, subject.y1 + 3]].filter(([a, b]) => a >= 0 && b < H);
  const bands = all.some(free) ? all.filter(free) : all;
  const cost = bands.map(([a, b]) => trees.filter((tree) => !doomed.has(tree) && tree.crown.some(([x, y]) => x >= x0 && x <= x0 + 10 && y >= a && y <= b)));
  const best = cost.sort((l, r) => l.length - r.length)[0] ?? [];
  for (const tree of best) doomed.set(tree, `crown in the caption seat of ${subject.x},${subject.y0}`);
}
// Runs of walkable ground under canopy: every tree over a run of two or more goes.
const seen = new Set<string>();
for (const key of under.keys()) {
  const [sx, sy] = key.split(',').map(Number);
  if (seen.has(key) || !walkable(sx, sy)) continue;
  const run = [[sx, sy]]; seen.add(key);
  for (let i = 0; i < run.length; i++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const nx = run[i][0] + dx, ny = run[i][1] + dy, k = `${nx},${ny}`;
    if (!seen.has(k) && under.has(k) && walkable(nx, ny)) { seen.add(k); run.push([nx, ny]); }
  }
  if (run.length >= 2) for (const [x, y] of run) for (const tree of under.get(`${x},${y}`)!) if (!doomed.has(tree)) doomed.set(tree, `hides a run of ${run.length} at ${x},${y}`);
}
const anchor = { tree: [1, 2], pine: [0, 2], tallBush: [0, 2] } as Record<string, [number, number]>;
const letters = [...doomed.entries()].map(([tree, why]) => ({ x: tree.x + anchor[tree.name][0], y: tree.y + anchor[tree.name][1], name: tree.name, why }));
console.log(JSON.stringify(letters));
console.error(`${id}: ${trees.length} crowned, ${letters.length} to fell`);
