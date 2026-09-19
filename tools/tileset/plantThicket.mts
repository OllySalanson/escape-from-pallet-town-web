/**
 * Proposes what to plant in a map's thicket, as a drawing to paste and edit.
 *
 * A map cut out of lattice forest leaves most of its wood only a hedge thick,
 * and a hedge of one round bush reads as generated. This walks a finished
 * sketch and finds where something taller fits - a broadleaf where three tiles
 * by two are left standing, a pine where there are two, a tall bush where there
 * is one - and prints them as one `map.draw` block of stamp letters. It is an
 * aid, not an author: the block is pasted under WHAT GROWS IN THE THICKET and
 * edited by hand from there.
 *
 *   npx vite-node tools/tileset/plantThicket.mts -- <map-id> [trees 0-1] [pines 0-1] [bushes 0-1]
 *
 * A crown it plants only ever hangs over thicket, never inside `CLEAR_SKY` -
 * see `crowns.mts` for why, and for the check to run afterwards.
 */
import { FLOOD_TOWN_TILESET } from '../../src/game/world/tileset/floodTownTileset';
import { sketchPalletTown } from '../../src/game/world/maps/palletTown';
import { sketchRoute1 } from '../../src/game/world/maps/route1';
import { sketchViridianForest } from '../../src/game/world/maps/viridianForest';
import { EXTRACTION_POINTS } from '../../src/game/world/extractionPoints';
import { WORLD_POIS } from '../../src/game/world/pois';
import { WORLD_ENTITIES } from '../../src/game/world/npcs';
import { WORLD_GATES } from '../../src/game/world/gates';
import { RUN_INSERTIONS } from '../../src/game/run/runGeneration';
import { RAID_CONTRACTS } from '../../src/game/objectives/contracts';
import { createRunTrainerEncounters } from '../../src/game/world/trainers';

const [id, treeShare = '1', pineShare = '0.6', bushShare = '0.25'] = process.argv.slice(2).filter((a) => a !== '--');
const sketch = { 'pallet-town': sketchPalletTown, 'route-1': sketchRoute1, 'viridian-forest': sketchViridianForest }[id]!();
const grid = sketch.toGrid();
const W = sketch.width, H = sketch.height;
const detail = Array.from({ length: H }, () => Array(W).fill(false));
const crown = Array.from({ length: H }, () => Array(W).fill(false));
for (const planted of sketch.props()) {
  const prop = FLOOD_TOWN_TILESET.props[planted.name];
  for (let r = 0; r < prop.height; r++) for (let c = 0; c < prop.width; c++) {
    const cell = prop.cells[r * prop.width + c];
    if (cell.tile < 0) continue;
    const x = planted.x + c, y = planted.y + r;
    if (y < 0 || y >= H || x < 0 || x >= W) continue;
    (cell.canopy ? crown : detail)[y][x] = true;
  }
}
const facts = [
  ...EXTRACTION_POINTS.filter((p) => p.mapId === id).map((p) => p.position),
  ...WORLD_POIS.filter((p) => p.mapId === id).map((p) => p.position),
  ...WORLD_ENTITIES.filter((p) => p.mapId === id).map((p) => p.position),
  ...WORLD_GATES.filter((g) => g.mapId === id).flatMap((g) => g.tiles),
  ...Object.values(RUN_INSERTIONS).filter((p) => p.mapId === id).map((p) => p.position),
  ...RAID_CONTRACTS.filter((c) => c.mapId === id).flatMap((c) => c.markers.map((m) => m.position)),
  ...createRunTrainerEncounters().filter((t) => t.mapId === id).map((t) => t.position),
];
const nearFact = (x: number, y: number) => facts.some((f) => Math.abs(f.x - x) <= 3 && Math.abs(f.y - y) <= 3);
const thicket = (x: number, y: number) => grid[y]?.[x] === 'T' && !detail[y][x];
const walkable = (x: number, y: number) => grid[y]?.[x] !== undefined && !'TWCF#B'.includes(grid[y][x]);
const CLEAR_SKY: Record<string, number[][]> = {
  'route-1': [[18, 16, 31, 22], [21, 0, 31, 11], [0, 22, 9, 31]],
  'pallet-town': [],
  'viridian-forest': [],
};
const clearSky = (x: number, y: number) => (CLEAR_SKY[id] ?? []).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
const hash = (x: number, y: number) => { let h = (Math.imul(x, 0x27d4eb2d) + Math.imul(y, 0x165667b1)) | 0; h ^= h >>> 15; h = Math.imul(h, 0x2545f491); h ^= h >>> 13; return (h >>> 0) / 2 ** 32; };
const out = Array.from({ length: H }, () => Array(W).fill(' '));
function tryPlant(letter: string, width: number, anchorX: number, share: number) {
  for (let y = 2; y < H; y++) for (let x0 = 0; x0 + width <= W; x0++) {
    if (hash(x0 * 7 + letter.charCodeAt(0), y) > share) continue;
    let ok = true;
    for (let c = 0; c < width && ok; c++) {
      if (!thicket(x0 + c, y) || !thicket(x0 + c, y - 1)) ok = false;
      const cy = y - 2;
      if (crown[cy][x0 + c] || detail[cy][x0 + c]) ok = false;
      if ('Ww'.includes(grid[cy]?.[x0 + c] ?? ' ')) ok = false;
      if ('Ww'.includes(grid[cy]?.[x0 + c] ?? ' ')) ok = false;
      if (grid[cy]?.[x0 + c] !== 'T' || clearSky(x0 + c, cy)) ok = false;
    }
    if (!ok) continue;
    for (let c = 0; c < width; c++) { detail[y][x0 + c] = true; detail[y - 1][x0 + c] = true; crown[y - 2][x0 + c] = true; }
    out[y][x0 + anchorX] = letter;
  }
}
tryPlant('t', 3, 1, Number(treeShare));
tryPlant('p', 2, 0, Number(pineShare));
tryPlant('b', 1, 0, Number(bushShare));
console.log(`  map.draw(0, 0, [`);
for (const row of out) console.log(`    '${row.join('')}',`);
console.log('  ]);');
console.log('// planted', out.flat().filter((c) => c !== ' ').length);
