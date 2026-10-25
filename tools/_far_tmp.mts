import { permanentThingsOn } from '../src/game/world/shippedDensity';
import { nearestThingSteps } from '../src/game/world/nearestThing';
import { walkableTiles, isBlockedAt } from '../src/game/world/mapStructure';
import { districtAt } from '../src/game/world/districts';
const want = process.argv[2];
const limit = Number(process.argv[3] ?? 12);
const { map, things } = permanentThingsOn('greystone-vale');
const seeds = [...things];
const ground = walkableTiles(map.collision).filter((t) => districtAt('greystone-vale', t)?.name === want);
const mean = (n: readonly Int32Array[]) => { let s = 0, c = 0; for (const t of ground) { const v = n[t.y][t.x]; if (v >= 0) { s += v; c++; } } return (s / c).toFixed(1); };
let near = nearestThingSteps(map.collision, seeds, map.links);
console.log(want, ground.length, 'tiles, mean', mean(near));
const open = (x: number, y: number) => [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].every(([dx,dy]) => !isBlockedAt(map.collision, x+dx, y+dy));
for (let i = 0; i < 15; i++) {
  let best: [number, number, number] | undefined;
  for (const t of ground) { const v = near[t.y][t.x]; if (!open(t.x, t.y)) continue; if (!best || v > best[2]) best = [t.x, t.y, v]; }
  if (!best || best[2] < limit) break;
  seeds.push({ x: best[0], y: best[1] });
  const ox = Math.floor(best[0] / 64) * 64, oy = Math.floor(best[1] / 64) * 64;
  console.log(`  ${best[0]},${best[1]} (local ${best[0]-ox},${best[1]-oy}) was ${best[2]}`);
  near = nearestThingSteps(map.collision, seeds, map.links);
}
console.log('  after', mean(near));
