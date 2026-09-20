/**
 * Draws the drop-in screen's bird's-eye picture of a map, big enough to judge.
 *
 * The picture is one game pixel to the tile, which is 64 pixels square for the
 * Floodplain: on the screen it is read at a glance, and in a review it is too
 * small to say whether the dark is tempting or merely black. This prints the
 * same `buildMinimap` output the lobby paints, at any zoom, so the fog can be
 * criticised without a browser.
 *
 *   npx vite-node tools/tileset/minimap.mts -- <map-id|all> <out.png> [zoom]
 *
 * `--survey=path.json` takes a real save's `raidProgress.surveyed`
 * (`tools/playtest/raid.mjs --progress=...` writes one), so what is drawn is
 * ground a raid actually walked. `--beaten=bossId,..` opens those gates and
 * `--completed=contractId,..` banks those contracts, which are the other two
 * halves of what lights a map up.
 */
import { readFileSync } from 'node:fs';
import { writePng } from './tileSheet.mjs';
import { box, canvas } from './draw.mjs';
import { WORLD_MAPS, getWorldMap, type WorldMapId } from '../../src/game/worldMap';
import { buildMinimap, MINIMAP_PALETTE } from '../../src/game/world/minimap';
import { surveyedTiles } from '../../src/game/world/survey';
import { RUN_INSERTIONS } from '../../src/game/run/runGeneration';
import { gatesForMap, isGateOpen } from '../../src/game/world/gates';
import { workedLandmarksOn } from '../../src/game/world/workedLandmarks';

const args = process.argv.slice(2);
const option = (name: string) => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const [which = 'all', target = 'minimap.png', zoomArgument = '6'] = args.filter((v) => !v.startsWith('--'));
const zoom = Number(zoomArgument);
const beaten = (option('beaten') ?? '').split(',').filter(Boolean);
const completed = (option('completed') ?? '').split(',').filter(Boolean);
const survey = option('survey')
  ? (JSON.parse(readFileSync(option('survey')!, 'utf8')).surveyed ?? JSON.parse(readFileSync(option('survey')!, 'utf8')))
  : {};

const ink = (char: string): [number, number, number] => {
  const hex = MINIMAP_PALETTE[char] ?? '#ff00ff';
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
};

const ids = (which === 'all' ? Object.keys(WORLD_MAPS) : [which]) as WorldMapId[];
const pictures = ids.map((id) => {
  const map = getWorldMap(id, beaten);
  const ours = Object.values(RUN_INSERTIONS).filter((entry) => entry.mapId === id);
  const open = gatesForMap(id).filter((gate) => isGateOpen(gate, beaten));
  // A landmark this save finished with is lit and glyphed exactly as a door it
  // opened is - see `hub/dropIn.ts`, which is what the lobby actually paints.
  const worked = workedLandmarksOn(id, completed)
    .map((work) => getWorldMap(id, beaten).pois.find((poi) => poi.id === work.poiId)!)
    .filter(Boolean);
  return buildMinimap({
    map,
    surveyed: surveyedTiles(survey[id], map.width),
    lit: [
      ...ours.map((entry) => entry.position),
      ...open.flatMap((gate) => gate.tiles),
      ...worked.map((poi) => poi.position),
    ],
    marks: [
      ...ours.map((entry) => ({ position: entry.position, char: 'I', always: true })),
      ...gatesForMap(id).flatMap((gate) =>
        gate.tiles.map((tile) => ({
          position: tile,
          char: isGateOpen(gate, beaten) ? 'O' : 'H',
          always: isGateOpen(gate, beaten),
        })),
      ),
      ...worked.map((poi) => ({ position: poi.position, char: 'K', always: true })),
    ],
  });
});

const gap = 8;
const width = pictures.reduce((sum, picture) => sum + picture.width * zoom + gap, gap);
const height = Math.max(...pictures.map((picture) => picture.height * zoom)) + gap * 2;
const image = canvas(width, height, [20, 24, 30]);
let cursor = gap;
for (const picture of pictures) {
  for (let y = 0; y < picture.height; y += 1) {
    for (let x = 0; x < picture.width; x += 1) {
      box(image, cursor + x * zoom, gap + y * zoom, zoom, zoom, ink(picture.rows[y][x]));
    }
  }
  cursor += picture.width * zoom + gap;
}
writePng(target, image);
console.log(`${target}: ${ids.join(', ')} at ${zoom}x`);
