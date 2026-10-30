/**
 * What a player's screen holds, walked tile by walked tile: a map against the
 * harbour, which is the standard (the captain, 30 October 2026: he liked the
 * harbour and found Greystone Vale sparse).
 *
 * `density.mts` says how far it is to the nearest authored thing, and a wood with
 * a sign every ten steps does fine on it. This says what is on the screen when
 * you get there, which is what sparse is: for every tile a player can stand on,
 * the 25x16 view centred on them, and in it how many different tiles are drawn,
 * how many figures stand, how many things can be read, and how many things can be
 * found. Loot is left out, as `density.mts` leaves it out.
 *
 *   npx vite-node tools/tileset/screens.mts [-- --rings]
 *
 * It prints the harbour, the vale and each of the vale's districts, and with
 * `--rings` the emptiest screens ring by ring outwards in walking steps from Mill
 * Square: the vale is being filled from where a new game lands, sparsest first
 * at each step out, and this is the list of what to do next.
 */
import { BASE_SIGNS, getBaseMap } from '../../src/game/base/baseMap';
import { BASE_DOORS } from '../../src/game/base/doors';
import { HARBOUR_LIFE } from '../../src/game/base/harbourLife';
import { HARBOUR_LANDMARKS } from '../../src/game/base/landmarks';
import { getWorldMap } from '../../src/game/worldMap';
import type { MapLayers } from '../../src/game/world/tiles';
import vale from '../../src/game/world/maps/greystoneVale.json';

const VIEW = { width: 25, height: 16 };
const RINGS: readonly (readonly [number, number])[] = [[0, 40], [40, 80], [80, 130], [130, 200], [200, 300]];

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly area?: string;
}
interface Screen {
  readonly art: number;
  readonly figures: number;
  readonly readable: number;
  readonly finds: number;
}
type Viewer = (x: number, y: number) => Screen;

function viewer(
  layers: MapLayers,
  width: number,
  height: number,
  { figures, readable, finds }: Record<'figures' | 'readable' | 'finds', readonly Spot[]>,
): Viewer {
  return (cx, cy) => {
    const x0 = Math.max(0, Math.min(width - VIEW.width, cx - 12));
    const y0 = Math.max(0, Math.min(height - VIEW.height, cy - 8));
    const tiles = new Set<number>();
    for (let y = y0; y < y0 + VIEW.height; y += 1) {
      for (let x = x0; x < x0 + VIEW.width; x += 1) {
        for (const layer of [layers.ground, layers.overlay, layers.detail, layers.canopy]) {
          if (layer.tiles[y][x] >= 0) tiles.add(layer.tiles[y][x]);
        }
      }
    }
    const count = (spots: readonly Spot[]) =>
      spots.filter((s) => s.x >= x0 && s.x < x0 + VIEW.width && s.y >= y0 && s.y < y0 + VIEW.height).length;
    return { art: tiles.size, figures: count(figures), readable: count(readable), finds: count(finds) };
  };
}

function walkable(collision: readonly (readonly boolean[])[], width: number, height: number): Spot[] {
  const tiles: Spot[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (!collision[y][x]) tiles.push({ x, y });
  return tiles;
}

function report(name: string, tiles: readonly Spot[], view: Viewer): void {
  const screens = tiles.map((tile) => view(tile.x, tile.y));
  const mean = (key: keyof Screen) =>
    (screens.reduce((total, screen) => total + screen[key], 0) / screens.length).toFixed(1).padStart(6);
  const nobody = Math.round((screens.filter((screen) => screen.figures === 0).length / screens.length) * 100);
  console.log(
    `${name.padEnd(20)} ${String(screens.length).padStart(6)} screens   art ${mean('art')}   figures ${mean('figures')}   readable ${mean('readable')}   finds ${mean('finds')}   nobody in view ${String(nobody).padStart(3)}%`,
  );
}

const base = getBaseMap([]);
report(
  'THE HARBOUR',
  walkable(base.collision, base.width, base.height),
  viewer(base.layers, base.width, base.height, {
    figures: HARBOUR_LIFE.map((figure) => figure.position),
    readable: [...BASE_SIGNS, ...HARBOUR_LANDMARKS.map((landmark) => landmark.at), ...BASE_DOORS.map((door) => door.building)],
    finds: [],
  }),
);

const map = getWorldMap('greystone-vale');
const outdoors = (spot: Spot) => spot.area === undefined;
const { width, height } = vale;
const people = vale.people.filter(outdoors);
const trainers = vale.trainers.filter(outdoors);
const view = viewer(map.layers, width, height, {
  figures: [...people, ...vale.pokemon.filter(outdoors), ...trainers],
  readable: [...vale.signs, ...vale.landmarks, ...vale.exits, ...vale.dropIns, ...people, ...trainers].filter(outdoors),
  finds: [...vale.itemSpots, ...vale.berryTrees, ...vale.boulders].filter(outdoors),
});
const tiles = walkable(map.collision, width, height);
report('GREYSTONE VALE', tiles, view);
const districts = vale.districts.filter(outdoors);
for (const district of districts.filter((one) => one.width >= 32 && one.height >= 32)) {
  const inside = tiles.filter(
    (t) => t.x >= district.x && t.x < district.x + district.width && t.y >= district.y && t.y < district.y + district.height,
  );
  if (inside.length > 0) report(district.name, inside, view);
}

if (process.argv.includes('--rings')) {
  const steps = new Int32Array(width * height).fill(-1);
  const { x: startX, y: startY } = vale.dropIns[0];
  const queue = [startY * width + startX];
  steps[queue[0]] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const here = queue[head];
    const x = here % width;
    const y = (here - x) / width;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const there = ny * width + nx;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && !map.collision[ny][nx] && steps[there] < 0) {
        steps[there] = steps[here] + 1;
        queue.push(there);
      }
    }
  }
  const worth = ({ art, figures, readable, finds }: Screen) => figures * 3 + readable * 2 + finds + art / 8;
  const placeOf = (t: Spot) =>
    districts.find((d) => t.x >= d.x && t.x < d.x + d.width && t.y >= d.y && t.y < d.y + d.height)?.name ?? '?';
  for (const [low, high] of RINGS) {
    const ring = tiles.filter((t) => steps[t.y * width + t.x] >= low && steps[t.y * width + t.x] < high);
    if (ring.length === 0) continue;
    console.log(`\n${low}-${high} steps from ${vale.dropIns[0].name}:`);
    report('this ring', ring, view);
    const worst = ring
      .map((tile) => ({ tile, screen: view(tile.x, tile.y) }))
      .sort((a, b) => worth(a.screen) - worth(b.screen));
    const shown: typeof worst = [];
    for (const one of worst) {
      if (shown.every((s) => Math.abs(s.tile.x - one.tile.x) >= VIEW.width || Math.abs(s.tile.y - one.tile.y) >= VIEW.height)) {
        shown.push(one);
      }
      if (shown.length === 6) break;
    }
    for (const { tile, screen } of shown) {
      console.log(
        `  ${tile.x},${tile.y}`.padEnd(11) +
          `${placeOf(tile).padEnd(20)} ${String(steps[tile.y * width + tile.x]).padStart(3)} steps   art ${screen.art}  figures ${screen.figures}  readable ${screen.readable}  finds ${screen.finds}`,
      );
    }
  }
}
