/**
 * Draws the base exactly as the game draws it, at any stage of building - the
 * yard, or any of the four rooms inside it.
 *
 * The point of the walkable base is that it fills up with the things you earn,
 * and that is a thing to look at rather than reason about:
 *
 *   npx vite-node tools/base/renderBase.mts -- out.png 3 --built=all
 *   npx vite-node tools/base/renderBase.mts -- out.png 3 --built=radio-mast,beacon
 *   npx vite-node tools/base/renderBase.mts -- out.png 3 --room=brocks-workshop --built=all
 *   npx vite-node tools/base/renderBase.mts -- out.png 3 --room=pokemon-centre --hurt=5
 *   npx vite-node tools/base/renderBase.mts -- out.png 3 --room=bills-cottage --traded=40
 *   npx vite-node tools/base/renderBase.mts -- out.png 3 --room=oaks-lab --beaten=overlook-warden --survey=save.json
 *
 * `--built=` is a list of rung ids from Brock's ladder, `all` or `none` (the
 * default). `--room=` draws the room behind that door instead of the yard, with
 * its keeper standing in it; `--hurt=N` puts that many Pokémon in the Center's
 * care, and `--traded=N` puts at least that many things on Bill's shelves
 * (`tradedBook` in `baseGames.testkit.ts`), with `--inspect=I` framing the
 * Ith of them the way looking at it in the game does. `--beaten=bossId,..`
 * and `--survey=path.json` (a save's `raidProgress.surveyed`) are what the
 * wall map in Oak's Lab draws: the keepers' signs, and the ground a raid has
 * walked. `--marks` names the doors, the mat, the keeper and every fixture,
 * `--collision` hatches what is solid, which is what says whether something
 * built has quietly walled a corner off, and `--walks` prints the one number
 * the base is designed against: how many steps each keeper is from where the
 * player is put down (`src/game/base/baseWalks.ts`).
 */
import { readFileSync } from 'node:fs';
import { readPng, writePng, TILE_SIZE } from '../tileset/tileSheet.mjs';
import { blit, box, canvas, drawTile, label, plot, upscale } from '../tileset/draw.mjs';
import { WORKSHOP_UPGRADES } from '../../src/game/hub/workshop';
import { BASE_TILESET } from '../../src/game/base/baseTileset';
import { BASE_SHEET_SOURCE } from '../../src/game/base/baseSheet';
import { BASE_PIECES } from '../../src/game/base/generated/basePieces';
import { BASE_DOORS } from '../../src/game/base/doors';
import { BASE_FIXTURES, standingFixtures } from '../../src/game/base/fixtures';
import { BASE_LANDING, BASE_SPAWN, getBaseMap } from '../../src/game/base/baseMap';
import { buildRoom, roomNamed } from '../../src/game/base/rooms';
import { wallMapPoster } from '../../src/game/base/wallMap';
import { BASE_STARTS, walksToKeepers } from '../../src/game/base/baseWalks';
import { baseGame } from '../../src/game/base/baseGames.testkit';
import { ODDITY_INK, oddityArt } from '../../src/game/base/cabinet';
import type { TileSource } from '../../src/game/world/tileset/catalogue';
import type { MapLayers } from '../../src/game/world/tiles';

const args = process.argv.slice(2).filter((value) => value !== '--');
const flags = new Set(args.filter((value) => value.startsWith('--')));
const option = (name: string) =>
  args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const builtFlag = option('built');
const roomFlag = option('room');
const hurt = Number(option('hurt') ?? '0');
const traded = Number(option('traded') ?? '0');
const inspected = option('inspect') === undefined ? undefined : Number(option('inspect'));
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
// What the wall map in Oak's Lab is a picture of: keepers beaten, and a real
// save's walked ground (`tools/playtest/raid.mjs --progress=` writes one).
const survey = option('survey');
const game = baseGame({
  built,
  hurt,
  traded,
  progress: {
    defeatedBosses: (option('beaten') ?? '').split(',').filter(Boolean),
    ...(survey === undefined
      ? {}
      : {
          surveyed:
            JSON.parse(readFileSync(survey, 'utf8')).surveyed ?? JSON.parse(readFileSync(survey, 'utf8')),
        }),
  },
});

const room = roomFlag === undefined ? null : roomNamed(roomFlag);
if (roomFlag !== undefined && !room) {
  throw new Error(
    `no room called '${roomFlag}' - one of ${BASE_DOORS.map((door) => door.id).join(', ')}`,
  );
}
const drawnRoom = room ? buildRoom(room, game) : null;
const yard = getBaseMap(built);
const place: {
  width: number;
  height: number;
  layers: MapLayers;
  collision: readonly boolean[][];
  sources: readonly TileSource[];
} =
  room && drawnRoom
    ? {
        width: room.width,
        height: room.height,
        layers: drawnRoom.layers,
        collision: drawnRoom.collision,
        sources: [BASE_SHEET_SOURCE.source],
      }
    : { ...yard, sources: BASE_TILESET.sources };

const sheets = new Map<string, ReturnType<typeof readPng>>();
const sheetOf = (source: TileSource) => {
  let sheet = sheets.get(source.imagePath);
  if (!sheet) {
    sheet = readPng(`public/${source.imagePath}`);
    sheets.set(source.imagePath, sheet);
  }
  return sheet;
};
const spans = place.sources.map((source) => ({
  sheet: sheetOf(source),
  from: source.firstIndex,
  to: source.firstIndex + source.columns * source.rows,
}));

const image = canvas(place.width * TILE_SIZE, place.height * TILE_SIZE, [0, 0, 0]);
const { ground, overlay, detail } = place.layers;
const drawLayer = (layer: MapLayers['ground']) => {
  for (let y = 0; y < place.height; y += 1) {
    for (let x = 0; x < place.width; x += 1) {
      const tile = layer.tiles[y][x];
      if (tile < 0) continue;
      const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
      if (!span) throw new Error(`tile ${tile} is on none of this place's sheets`);
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
};
for (const layer of [ground, overlay, detail]) drawLayer(layer);

// What a room sets on its furniture, and who is standing in it - drawn the way
// the scene draws them, above the tiles and below the canopy.
if (room && drawnRoom) {
  const baseSheet = sheetOf(BASE_SHEET_SOURCE.source);
  for (const sprite of drawnRoom.sprites) {
    const piece = BASE_PIECES[sprite.piece];
    blit(
      image,
      baseSheet,
      piece.column * TILE_SIZE,
      piece.row * TILE_SIZE,
      piece.width * TILE_SIZE,
      piece.height * TILE_SIZE,
      sprite.x * TILE_SIZE,
      sprite.y * TILE_SIZE,
    );
  }
  // Bill's oddities, each painted from its pixel table as the scene paints it.
  for (const placed of drawnRoom.cabinet?.layout.placed ?? []) {
    oddityArt(placed.oddity.itemId).forEach((row, y) =>
      [...row].forEach((ink, x) => {
        if (ink === '.') return;
        const colour = ODDITY_INK[ink];
        plot(image, placed.x + x, placed.y + y, [colour >> 16, (colour >> 8) & 0xff, colour & 0xff]);
      }),
    );
    if (placed.index === inspected) {
      for (let x = -1; x <= placed.width; x += 1) {
        plot(image, placed.x + x, placed.y - 1, [0xf7, 0xd3, 0x6b]);
        plot(image, placed.x + x, placed.y + placed.height, [0xf7, 0xd3, 0x6b]);
      }
      for (let y = 0; y < placed.height; y += 1) {
        plot(image, placed.x - 1, placed.y + y, [0xf7, 0xd3, 0x6b]);
        plot(image, placed.x + placed.width, placed.y + y, [0xf7, 0xd3, 0x6b]);
      }
    }
  }
  // The wall map, painted from the save exactly as `BaseScene.drawWallMap` does.
  if (drawnRoom.wallMap) {
    const poster = wallMapPoster(game, drawnRoom.wallMap);
    const { x, y } = drawnRoom.wallMap;
    blit(image, poster, 0, 0, poster.width, poster.height, x * TILE_SIZE, y * TILE_SIZE);
  }
  const figure = readPng(`public/assets/characters/${room.keeper.design}.png`);
  // The down-idle frame: 16x32, soles on row 27, the tile's foot on row 31.
  blit(
    image,
    figure,
    0,
    0,
    16,
    32,
    room.keeper.position.x * TILE_SIZE,
    room.keeper.position.y * TILE_SIZE - 11,
  );
}
drawLayer(place.layers.canopy);

if (flags.has('--collision')) {
  for (let y = 0; y < place.height; y += 1) {
    for (let x = 0; x < place.width; x += 1) {
      if (!place.collision[y][x]) continue;
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
  if (room && drawnRoom) {
    mark(room.mat.x, room.mat.y, 'MAT', [120, 240, 255]);
    for (const thing of drawnRoom.things) {
      mark(
        thing.tiles[0].x,
        thing.tiles[0].y,
        thing.name.replace('THE ', '').slice(0, 6),
        [190, 140, 255],
      );
    }
  } else {
    mark(BASE_SPAWN.x, BASE_SPAWN.y, 'SPAWN', [120, 240, 255]);
    mark(BASE_LANDING.x, BASE_LANDING.y, 'LAND', [120, 240, 255]);
    for (const door of BASE_DOORS) {
      for (const tile of door.tiles) mark(tile.x, tile.y, 'DOOR', [255, 214, 92]);
    }
    for (const fixture of standingFixtures(built)) {
      mark(
        fixture.at.x,
        fixture.at.y,
        fixture.name.replace('THE ', '').slice(0, 6),
        [190, 140, 255],
      );
    }
  }
}

if (flags.has('--walks')) {
  for (const start of BASE_STARTS) {
    const walks = walksToKeepers(start.tile, game).map(
      (walk) => `${walk.door.name} ${walk.yard} (+${walk.acrossTheRoom} across the room)`,
    );
    console.log(`from ${start.name}: ${walks.join(' · ')}`);
  }
}

writePng(target, drawn);
const walkable = place.collision.flat().filter((solid) => !solid).length;
console.log(
  `${target}  ${drawn.width}x${drawn.height}  ${place.width}x${place.height}  ${walkable} walkable  ` +
    `${built.length}/${BASE_FIXTURES.length} built`,
);
