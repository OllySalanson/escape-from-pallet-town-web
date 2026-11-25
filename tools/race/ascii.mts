// A stretch of Greystone Vale as text, for planning a race on: '#' solid, '~'
// water, ',' wild grass, '-' made ground, '=' plank, '.' open ground.
//
//   OPEN=gateId,.. npx vite-node tools/race/ascii.mts -- x0,y0,x1,y1
import { getWorldMap } from '../../src/game/worldMap';
const [x0, y0, x1, y1] = process.argv[2].split(',').map(Number);
const map = getWorldMap('greystone-vale', (process.env.OPEN ?? '').split(',').filter(Boolean));
const ROAD = new Set(['sand', 'stone', 'earth', 'paving', 'boards', 'gravel']);
const lines: string[] = [];
let hdr = '    '; for (let x = x0; x < x1; x++) hdr += x % 10 === 0 ? String((x / 10) % 10) : ' ';
lines.push(hdr);
for (let y = y0; y < y1; y++) {
  let s = String(y).padStart(4);
  for (let x = x0; x < x1; x++) {
    const t = String(map.terrain[y][x]);
    if (map.collision[y][x]) s += t === 'water' ? '~' : '#';
    else if (map.tallGrass[y][x]) s += ',';
    else if (ROAD.has(t)) s += t === 'boards' ? '=' : '-';
    else s += '.';
  }
  lines.push(s);
}
console.log(lines.join('\n'));
