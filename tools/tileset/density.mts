/**
 * How far is the nearest authored thing, from anywhere on a map?
 *
 * `mapReport.mts` says whether a map is a network of passages. This says
 * whether it is a network with anything *in* it, which is the other half of the
 * captain's standing complaint: "quite thin paths, still quite computer
 * generated, not how a human would do it". A map can pass every structural rule
 * and still be a trail through trees.
 *
 * The measure, set when Viridian Forest was made vast and kept so the four maps
 * compare: for every walkable tile, the walking steps to the nearest
 * **permanent** authored thing - an exit, a drop-in, a landmark, a sign or
 * townsperson, a gate tile, a trainer, a contract stop. Loot is deliberately NOT counted: it is
 * re-seated map-wide every raid (`generateLoot`), so counting it flatters a map
 * that has nothing standing in it.
 *
 *   npx vite-node tools/tileset/density.mts -- <map-id> [--old=x0,y0,x1,y1] [--far=N]
 *
 * `--old=` splits the answer in two, which is the number an expanded map is
 * judged on: a map whose new ground is much thinner than its old ground is one
 * the player can feel the seam in. Route 1 was expanded against its own shipped
 * quarter at `--old=0,0,31,31`.
 *
 * Every gate is opened before measuring, because ground behind a door is ground
 * the map has to be worth walking once the door is open.
 */
import type { BuiltInMapId } from '../../src/game/worldMap';
import { walkableTiles } from '../../src/game/world/mapStructure';
import { districtAt } from '../../src/game/world/districts';
import { densityOf } from '../../src/game/world/nearestThing';
import { shippedNearestSteps } from '../../src/game/world/shippedDensity';

const args = process.argv.slice(2);
const option = (name: string) => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const mapId = (args.find((value) => !value.startsWith('--')) ?? 'route-1') as BuiltInMapId;
// The things counted and the walk out of them are shared with the review
// summary of a player's map (`world/nearestThing.ts`), so the two compare.
const { map, things, nearest } = shippedNearestSteps(mapId);

const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const report = (name: string, tiles: { x: number; y: number }[]): number | undefined => {
  const density = densityOf(tiles.map((tile) => nearest[tile.y][tile.x]));
  if (!density) {
    console.log(`${name}: no ground`);
    return undefined;
  }
  console.log(
    `${name.padEnd(12)} ${String(density.tiles).padStart(5)} tiles   mean ${density.mean.toFixed(1)}` +
      `   median ${density.median}   90th ${density.ninetieth}   worst ${density.worst}`,
  );
  return density.mean;
};

const ground = walkableTiles(map.collision);
console.log(`${mapId}: ${things.length} permanent authored things over ${ground.length} walkable tiles`);
report('whole map', ground);

const split = option('old');
if (split) {
  const [x0, y0, x1, y1] = split.split(',').map(Number);
  const isOld = (tile: { x: number; y: number }) => tile.x >= x0 && tile.x <= x1 && tile.y >= y0 && tile.y <= y1;
  const old = report('old ground', ground.filter(isOld));
  const fresh = report('new ground', ground.filter((tile) => !isOld(tile)));
  if (old !== undefined && fresh !== undefined) {
    console.log(`new ground is ${Math.round((old / fresh) * 100)}% as dense as the old`);
  }
}

const byPlace = new Map<string, number[]>();
for (const tile of ground) {
  const steps = nearest[tile.y][tile.x];
  if (steps < 0) {
    continue;
  }
  const place = districtAt(mapId, tile)?.name ?? '(nameless)';
  byPlace.set(place, [...(byPlace.get(place) ?? []), steps]);
}
if (byPlace.size > 0) {
  console.log('\nthinnest places first:');
  [...byPlace]
    .map(([place, steps]) => [place, mean(steps), steps.length, Math.max(...steps)] as const)
    .sort((a, b) => b[1] - a[1])
    .forEach(([place, average, tiles, worst]) =>
      console.log(`  ${place.padEnd(22)} mean ${average.toFixed(1).padStart(5)}  worst ${String(worst).padStart(3)}  over ${tiles} tiles`),
    );
}

const far = Number(option('far') ?? 14);
const furthest = ground
  .map((tile) => ({ tile, steps: nearest[tile.y][tile.x] }))
  .filter((row) => row.steps >= far)
  .sort((a, b) => b.steps - a.steps);
if (furthest.length > 0) {
  console.log(`\nground ${far} steps or more from anything authored (${furthest.length} tiles):`);
  for (const { tile, steps } of furthest.slice(0, 20)) {
    console.log(`  ${tile.x},${tile.y}  ${steps} steps  ${districtAt(mapId, tile)?.name ?? '(nameless)'}`);
  }
}
