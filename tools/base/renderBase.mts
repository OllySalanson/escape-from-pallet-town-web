/**
 * Draws the base exactly as the game draws it, at any stage of building.
 *
 * The point of the walkable base is that it fills up with the things you earn,
 * and that is a thing to look at rather than reason about:
 *
 *   npx vite-node tools/base/renderBase.mts -- out.png 3 --built=all
 *   npx vite-node tools/base/renderBase.mts -- out.png 3 --built=radio-mast,beacon
 *
 * `--built=` is a list of rung ids from Brock's ladder, `all` or `none` (the default).
 * `--marks` names the doors, the keepers and every fixture standing,
 * `--collision` hatches what is solid, which is what says whether something
 * built has quietly walled a corner of the yard off, and `--walks` prints the
 * one number this map is designed against: how many steps each door is from
 * where the player is put down, with every keeper standing in the way.
 */
import { readPng, writePng, TILE_SIZE } from '../tileset/tileSheet.mjs';
import { box, canvas, drawTile, label, plot, upscale } from '../tileset/draw.mjs';
import { WORKSHOP_UPGRADES } from '../../src/game/hub/workshop';
import { BASE_TILESET } from '../../src/game/base/baseTileset';
import { BASE_DOORS } from '../../src/game/base/doors';
import { BASE_FIXTURES, standingFixtures } from '../../src/game/base/fixtures';
import { BASE_LANDING, BASE_SPAWN, getBaseMap } from '../../src/game/base/baseMap';

const args = process.argv.slice(2).filter((value) => value !== '--');
const flags = new Set(args.filter((value) => value.startsWith('--')));
const builtFlag = args.find((value) => value.startsWith('--built='))?.slice('--built='.length);
const [target = 'base.png', zoomArgument = '3'] = args.filter((value) => !value.startsWith('--'));
const zoom = Number(zoomArgument);

const built =
  builtFlag === 'all'
    ? WORKSHOP_UPGRADES.map((upgrade) => upgrade.id)
    : builtFlag && builtFlag !== 'none'
      ? builtFlag.split(',')
      : [];
for (const id of built) {
  if (!WORKSHOP_UPGRADES.some((upgrade) => upgrade.id === id)) {
    throw new Error(`no rung of Brock's ladder called '${id}'`);
  }
}

const map = getBaseMap(built);
const sheets = new Map<string, ReturnType<typeof readPng>>();
const spans = BASE_TILESET.sources.map((source) => {
  let sheet = sheets.get(source.imagePath);
  if (!sheet) {
    sheet = readPng(`public/${source.imagePath}`);
    sheets.set(source.imagePath, sheet);
  }
  return { sheet, from: source.firstIndex, to: source.firstIndex + source.columns * source.rows };
});

const image = canvas(map.width * TILE_SIZE, map.height * TILE_SIZE, [8, 10, 14]);
const { ground, overlay, detail, canopy } = map.layers;
for (const layer of [ground, overlay, detail, canopy]) {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = layer.tiles[y][x];
      if (tile < 0) continue;
      const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
      if (!span) throw new Error(`tile ${tile} is on none of the base's sheets`);
      const tint = layer.tints[y][x];
      drawTile(
        image,
        span.sheet,
        tile - span.from,
        x,
        y,
        tint >= 0 ? tint : undefined,
        layer.flips[y][x],
      );
    }
  }
}

if (flags.has('--collision')) {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!map.collision[y][x]) continue;
      for (let py = 0; py < TILE_SIZE; py += 1) {
        for (let px = 0; px < TILE_SIZE; px += 1) {
          if ((px + py) % 6 !== 0) continue;
          plot(image, x * TILE_SIZE + px, y * TILE_SIZE + py, [255, 80, 80], 150);
        }
      }
    }
  }
}

const drawn = upscale(image, zoom);

if (flags.has('--marks')) {
  const mark = (x: number, y: number, text: string, colour: [number, number, number]) => {
    const left = x * TILE_SIZE * zoom;
    const top = y * TILE_SIZE * zoom;
    box(drawn, left, top, text.length * 6 * 2 + 4, 12, [12, 13, 17]);
    label(drawn, text, left + 2, top + 2, 2, colour);
  };
  mark(BASE_SPAWN.x, BASE_SPAWN.y, 'SPAWN', [120, 240, 255]);
  mark(BASE_LANDING.x, BASE_LANDING.y, 'LAND', [120, 240, 255]);
  for (const door of BASE_DOORS) {
    for (const tile of door.tiles) mark(tile.x, tile.y, 'DOOR', [255, 214, 92]);
    mark(door.keeper.position.x, door.keeper.position.y, door.keeper.name.slice(0, 5), [255, 160, 80]);
  }
  for (const fixture of standingFixtures(built)) {
    mark(fixture.at.x, fixture.at.y, fixture.name.replace('THE ', '').slice(0, 6), [190, 140, 255]);
  }
}

if (flags.has('--walks')) {
  const people = new Set(
    BASE_DOORS.map((door) => `${door.keeper.position.x},${door.keeper.position.y}`),
  );
  const stepsFrom = (start: { x: number; y: number }) => {
    const grid = Array.from({ length: map.height }, () =>
      Array<number>(map.width).fill(Number.POSITIVE_INFINITY),
    );
    grid[start.y][start.x] = 0;
    let frontier = [start];
    while (frontier.length > 0) {
      const next: { x: number; y: number }[] = [];
      for (const tile of frontier) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const x = tile.x + dx;
          const y = tile.y + dy;
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
          if (map.collision[y][x] || people.has(`${x},${y}`)) continue;
          if (grid[y][x] <= grid[tile.y][tile.x] + 1) continue;
          grid[y][x] = grid[tile.y][tile.x] + 1;
          next.push({ x, y });
        }
      }
      frontier = next;
    }
    return grid;
  };
  const reach = (door: (typeof BASE_DOORS)[number]) =>
    door.tiles.length > 0
      ? door.tiles
      : [[0, -1], [0, 1], [-1, 0], [1, 0]]
          .map(([dx, dy]) => ({ x: door.keeper.position.x + dx, y: door.keeper.position.y + dy }))
          .filter((tile) => !map.collision[tile.y]?.[tile.x] && !people.has(`${tile.x},${tile.y}`));
  for (const [name, start] of [
    ['yard', BASE_SPAWN],
    ['quay (home from a raid)', BASE_LANDING],
  ] as const) {
    const grid = stepsFrom(start);
    const walks = BASE_DOORS.map(
      (door) => `${door.name} ${Math.min(...reach(door).map((tile) => grid[tile.y][tile.x]))}`,
    );
    console.log(`from the ${name}: ${walks.join(' · ')}`);
  }
}

writePng(target, drawn);
const walkable = map.collision.flat().filter((solid) => !solid).length;
console.log(
  `${target}  ${drawn.width}x${drawn.height}  ${map.width}x${map.height}  ${walkable} walkable  ` +
    `${built.length}/${BASE_FIXTURES.length} built`,
);
