// How far every tile of Greystone Vale is from the nearest way out, as a text
// map: '.' under 40 steps, '-' 40-59, '+' 60-89, '@' 90 and over. A race's line
// that ends under 60 is a race and a walk out; see `src/game/world/races.ts`.
//
//   npx vite-node tools/race/exitfar.mts -- x0,y0,x1,y1
import { getWorldMap } from '../../src/game/worldMap';
import file from '../../src/game/world/maps/greystoneVale.json';
const map = getWorldMap('greystone-vale');
const W = 384;
const dist = new Int32Array(W * W).fill(-1);
const q: number[] = [];
for (const e of (file as any).exits) if (e.opens.when === 'always' || e.opens.when === 'after') { const i = e.y * W + e.x; if (!map.collision[e.y][e.x]) { dist[i] = 0; q.push(i); } }
for (let h = 0; h < q.length; h++) { const i = q[h]; const x = i % W, y = (i / W) | 0;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= W || map.collision[ny][nx]) continue; const j = ny * W + nx; if (dist[j] !== -1) continue; dist[j] = dist[i] + 1; q.push(j); } }
const [x0, y0, x1, y1] = process.argv[2].split(',').map(Number);
const out: string[] = [];
for (let y = y0; y < y1; y++) { let s = String(y).padStart(4); for (let x = x0; x < x1; x++) { const d = dist[y * W + x]; s += d < 0 ? (map.collision[y][x] ? '#' : '?') : d >= 90 ? '@' : d >= 60 ? '+' : d >= 40 ? '-' : '.'; } out.push(s); }
console.log(out.join('\n'));
