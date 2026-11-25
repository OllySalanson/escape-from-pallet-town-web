// The lines of a race on Greystone Vale, drawn on the real map and measured
// (`src/game/world/races.ts`): the racer's road (red, made ground only), the line
// that will not set foot in wild grass (yellow), the line that minds it - a wild
// tile costs three steps - (pink), and the fewest steps whatever the grass (cyan).
// Figures stand where their beats put them, ledges are hopped.
//
//   npx vite-node tools/race/lines.mts -- out.png x0,y0,w,h fromX,fromY toX,toY
//   env: OPEN=gateId,..  CARVE=x,y,w,h;..  DRY=x,y,w,h;..  BLOCK=x,y,w,h;..  SHOW=1
//
// CARVE opens solid tiles and DRY makes tiles made ground, to try a shortcut on
// paper before drawing it; SHOW prints the wild tiles each line wades.
import { getWorldMap } from '../../src/game/worldMap';
import { ledgesForMap } from '../../src/game/world/ledges';
import { drawWorldMap } from '../tileset/mapPicture.mts';
import { writePng, TILE_SIZE } from '../tileset/tileSheet.mjs';
import { box, label, upscale } from '../tileset/draw.mjs';
const [out, cropS, sS, eS] = process.argv.slice(2);
const crop = cropS.split(',').map(Number) as [number, number, number, number];
const [sx, sy] = sS.split(',').map(Number);
const [ex, ey] = eS.split(',').map(Number);
const map = getWorldMap('greystone-vale', (process.env.OPEN ?? '').split(',').filter(Boolean));
const rects = (v?: string) => (v ?? '').split(';').filter(Boolean).map((s) => s.split(',').map(Number));
const inR = (rs: number[][], x: number, y: number) => rs.some(([cx, cy, w, h]) => x >= cx && x < cx + w && y >= cy && y < cy + h);
const carve = rects(process.env.CARVE), dry = rects(process.env.DRY), block = rects(process.env.BLOCK);
const ledges = ledgesForMap('greystone-vale');
import file from '../../src/game/world/maps/greystoneVale.json';
const figures = new Set<number>();
for (const p of [...(file as any).people, ...((file as any).pokemon ?? [])]) {
  figures.add(p.y * 384 + p.x);
  for (const [dx, dy] of p.beat?.roam ?? []) figures.add((p.y + dy) * 384 + p.x + dx);
}
for (const s of (file as any).signs) figures.add(s.y * 384 + s.x);
const ROAD = new Set(['sand', 'stone', 'earth', 'paving', 'boards', 'gravel']);
const W = 384;
const solid = (x: number, y: number) => figures.has(y * 384 + x) || x < 0 || y < 0 || x >= W || y >= W || inR(block, x, y) || (map.collision[y][x] && !inR(carve, x, y));
const road = (x: number, y: number) => ROAD.has(String(map.terrain[y][x])) || inR(dry, x, y);
const grass = (x: number, y: number) => map.tallGrass[y][x] && !inR(dry, x, y) && !inR(carve, x, y);
const ledgeAt = new Map<number, number>();
for (const l of ledges) for (const t of l.brow) ledgeAt.set(t.y * W + t.x, l.depth + 1);
function path(mode: 'road' | number): number[] {
  const dist = new Int32Array(W * W).fill(-1), prev = new Int32Array(W * W).fill(-1);
  const s = sy * W + sx; dist[s] = 0;
  const buckets: number[][] = [[s]];
  for (let d = 0; d < buckets.length; d++) for (const i of buckets[d] ?? []) {
    if (dist[i] !== d) continue;
    const x = i % W, y = (i / W) | 0;
    const nb: [number, number, number][] = [[x + 1, y, 1], [x - 1, y, 1], [x, y + 1, 1], [x, y - 1, 1]];
    if (mode !== 'road' && ledgeAt.has(i)) nb.push([x, y + ledgeAt.get(i)!, 2]);
    for (const [nx, ny, c0] of nb) {
      if (solid(nx, ny)) continue;
      if (mode === 'road' && !road(nx, ny)) continue;
      const c = c0 + (mode !== 'road' && grass(nx, ny) ? mode : 0);
      const j = ny * W + nx;
      if (dist[j] !== -1 && dist[j] <= d + c) continue;
      dist[j] = d + c; prev[j] = i; (buckets[d + c] ??= []).push(j);
    }
  }
  const e = ey * W + ex; const p: number[] = [];
  if (dist[e] < 0) { console.log(mode, 'unreachable'); return p; }
  for (let i = e; i !== -1; i = prev[i]) p.push(i);
  p.reverse();
  console.log(`${mode === "road" ? "road" : "grass+" + mode}: ${p.length - 1} steps, grass ${p.filter((i) => grass(i % W, (i / W) | 0)).length}`, process.env.SHOW ? p.filter((i) => grass(i % W, (i / W) | 0)).map((i) => `${i % W},${(i / W) | 0}`).join(" ") : "");
  return p;
}
const image = upscale(drawWorldMap('greystone-vale', crop), 2);
const t = TILE_SIZE * 2;
const paint = (p: number[], colour: [number, number, number], off: number) => {
  for (const i of p) { const x = (i % W) - crop[0], y = ((i / W) | 0) - crop[1]; if (x >= 0 && y >= 0 && x < crop[2] && y < crop[3]) box(image, x * t + off, y * t + off, 8, 8, colour, 230); }
};
for (const [cx, cy, w, h] of carve) box(image, (cx - crop[0]) * t, (cy - crop[1]) * t, w * t, h * t, [255, 255, 255], 90);
for (const [cx, cy, w, h] of dry) box(image, (cx - crop[0]) * t, (cy - crop[1]) * t, w * t, h * t, [200, 150, 80], 110);
paint(path('road'), [230, 40, 40], 4);
paint(path(30), [250, 220, 40], 12);
paint(path(3), [250, 120, 250], 16);
paint(path(0), [40, 220, 250], 20);
for (let x = crop[0]; x < crop[0] + crop[2]; x += 2) label(image, x % 100, (x - crop[0]) * t + 2, 2, 1, [255, 255, 255]);
for (let y = crop[1]; y < crop[1] + crop[3]; y += 2) label(image, y % 100, 2, (y - crop[1]) * t + 2, 1, [255, 255, 255]);
writePng(out, image);
