import { writePng, TILE_SIZE } from '../../../tileset/tileSheet.mjs';
import { box, upscale } from '../../../tileset/draw.mjs';
import { griddedPicture, mapPicture } from '../../picture.mts';
import { beatSpots, playerMapId } from '../../../../src/game/world/mapFile';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import { getWorldMap } from '../../../../src/game/worldMap';
import greystoneVale from './index';
import { GREYSTONE_VALE } from './plan';
const [out, name] = process.argv.slice(2);
const id = process.env.D!;
const d = GREYSTONE_VALE.districts.find((x) => x.id === id)!;
const { file } = (greystoneVale().districts as any)[id];
const WHEN = process.env.WHEN ?? '-before';
if (!process.env.CROP) writePng(`${out}/${name}${WHEN}.png`, mapPicture(file));
const picture = mapPicture(file);
const own = getWorldMap(playerMapId(file)).collision;
const ORIGIN = { x: (d.cell[0] + 1) * 64, y: (d.cell[1] + 1) * 64 };
const map = getWorldMap('greystone-vale', gatesForMap('greystone-vale').map(gateKey));
const OUT = (s: { area?: string }) => s.area === undefined;
for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
  const g = file.ground[y][x];
  if ((process.env.STITCHED ? map.collision[ORIGIN.y + y][ORIGIN.x + x] : own[y][x]) && g !== 'T' && g !== 'W') box(picture, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, [230, 40, 40], 120);
}
const held: { x: number; y: number }[] = [];
for (const f of [...(file.people ?? []), ...(file.pokemon ?? [])].filter(OUT)) held.push(f, ...beatSpots(f));
for (const t of [...(file.trainers ?? []), ...(file.berryTrees ?? []), ...(file.landmarks ?? []), ...(file.signs ?? [])].filter(OUT)) held.push(t);
for (const s of held) box(picture, s.x * TILE_SIZE, s.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, [40, 90, 240], 150);
if (!process.env.CROP) writePng(`${out}/collision${WHEN}.png`, picture);
else {
  const [cx, cy, cw, ch] = process.env.CROP.split(',').map(Number);
  const crop = { width: cw * TILE_SIZE, height: ch * TILE_SIZE, data: Buffer.alloc(cw * TILE_SIZE * ch * TILE_SIZE * 4) } as typeof picture;
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const from = ((cy * TILE_SIZE + y) * picture.width + cx * TILE_SIZE + x) * 4, to = (y * crop.width + x) * 4;
    for (let k = 0; k < 4; k++) crop.data[to + k] = picture.data[from + k];
  }
  writePng(`${out}/${name}.png`, upscale(griddedPicture(crop, { x: cx, y: cy }), 2));
}
