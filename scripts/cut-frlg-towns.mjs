// Cuts Kanto's town buildings out of FireRed's own maps, and the things that
// stand in its fields out of the game's own object graphics, onto
// `public/assets/frlg-towns.png`.
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git /tmp/pokefirered
//   git -C /tmp/pokefirered checkout 037335f -- data/tilesets data/layouts data/maps graphics/object_events/pics/misc
//   node scripts/cut-frlg-towns.mjs /tmp/pokefirered
//
// pret/pokefirered is the disassembly of the game: its tilesets and every map's
// block data, exactly as FireRed lays them out. The Spriters Resource renders the
// first Kanto cut came from (`cut-frlg-kanto.mjs`) now answer an automated fetch
// with a browser challenge, and pret is better anyway: a town is drawn here from
// its own metatiles, so a building comes off the map with nothing guessed, and
// the map says which cells are ground. Commit 037335f is the one the game
// already reads FireRed's rules from.
//
// Nothing from pret is committed: what ships is cut, trimmed and rearranged
// pieces, and `public/assets/ASSET_PROVENANCE.md` credits the origin.
//
// Three things happen to every piece on the way.
//
// **The colour is put on the other sheets' footing.** The tileset palettes are
// written eight bits a channel; every channel is read back to its five GBA bits
// and shifted (`x << 3`), the way `frlg-tiles.png` and `frlg-kanto.png` write it,
// so a roof meets the grass it stands on without a seam.
//
// **The ground is lifted out.** A town's common walkable ground - its grass, its
// paths, its paving: the metatiles a player can walk on that cover at least eight
// cells of that map (FireRed marks a rooftop walkable, because nobody can reach
// it, so a rarer walkable cell is part of a building) - is made transparent wherever it falls inside a piece's
// rectangle, and on the ring of solid cells round a building every pixel that
// matches the ground beside it is lifted too, so an eave over grass stands on
// whatever ground a map puts under it. A door is walkable but rare, so it stays.
//
// A cell of the rectangle that is something standing beside the building - a
// tree's crown, a ledge, a sign - is named in the piece's `drop` and left out.
// A cell the building is walked onto from - a gatehouse's porch, the ridge of
// its roof - is drawn over the path that leads to it, which is too rare on a
// route to count as its ground; such a cell is named in `scrub`, and every
// pixel in it coloured like the ground round the building is lifted.
//
// **The piece is trimmed** to the cells that still hold anything, so a rectangle
// read a little generously off the map does not carry a row of nothing with it.
//
// **Its doors are read off the map too.** Every warp the town's own map puts
// inside a piece's rectangle (`data/maps/<Town>/map.json`) that FireRed can
// fire is a door of that building, recorded in the piece's own cells after the
// trim with the way it is gone through, so a map maker's building opens where
// FireRed's does. A warp only fires on a cell whose floor says it is one
// (`src/field_control_avatar.c`): a door is walked up into, an arrow warp is
// stood on and pressed the way it points, and a warp on any other floor never
// takes anybody anywhere - FireRed puts some beside the ones that work.
// Where two maps meet, each warps only its own side of a building both of them
// draw, so a gatehouse reads its far side's doors off the map beyond it
// (`warpsFrom`), taking each only where that map draws the same cell.
//
// The script writes the sheet and `src/game/world/generated/townPieces.ts`, which
// is the only thing in the game that knows where a piece landed on it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { writePng } from '../tools/tileset/tileSheet.mjs';

const TILE = 16;
const SHEET_COLUMNS = 20;

/**
 * Each town: its layout's folder, its secondary tileset and its size in blocks
 * - and the routes FireRed's gatehouses stand on: Route 2's, and the two into
 * Saffron.
 */
const TOWNS = {
  pewter: ['PewterCity', 'pewter_city', 48, 40],
  cerulean: ['CeruleanCity', 'cerulean_city', 48, 40],
  vermilion: ['VermilionCity', 'vermilion_city', 48, 40],
  lavender: ['LavenderTown', 'lavender_town', 24, 20],
  celadon: ['CeladonCity', 'celadon_city', 60, 40],
  fuchsia: ['FuchsiaCity', 'fuchsia_city', 48, 40],
  saffron: ['SaffronCity', 'saffron_city', 66, 55],
  cinnabar: ['CinnabarIsland', 'cinnabar_island', 24, 20],
  route2: ['Route2', 'viridian_city', 24, 80],
  route5: ['Route5', 'cerulean_city', 48, 40],
  route7: ['Route7', 'celadon_city', 24, 20],
};

/**
 * What is cut: a name, the town, and a rectangle of blocks read a little
 * generously off the map. `drop` names cells of the rectangle that hold
 * something beside the building - a tuft of long grass, a sign, a bush.
 */
const PIECES = [
  {
    name: 'museum',
    town: 'pewter',
    at: [12, 0],
    size: [16, 8],
    // The ledge along the garden and the sign beside the steps.
    drop: [0, 1, 2, 3, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((q) => [q, 7]),
  },
  { name: 'pewterGym', town: 'pewter', at: [12, 12], size: [7, 5] },
  { name: 'greyHouse', town: 'pewter', at: [32, 8], size: [5, 4] },
  { name: 'deptStore', town: 'celadon', at: [9, 5], size: [9, 10] },
  { name: 'smallFlats', town: 'celadon', at: [4, 4], size: [5, 8] },
  { name: 'flats', town: 'celadon', at: [27, 4], size: [7, 8] },
  { name: 'terrace', town: 'celadon', at: [34, 7], size: [4, 5] },
  // The two bushes planted in front of the prize house.
  { name: 'gameCorner', town: 'celadon', at: [31, 17], size: [10, 6], drop: [[7, 4], [8, 4], [9, 4], [7, 5], [8, 5], [9, 5]] },
  { name: 'celadonGym', town: 'celadon', at: [8, 26], size: [8, 5] },
  { name: 'roundFountain', town: 'celadon', at: [12, 18], size: [3, 4] },
  { name: 'diner', town: 'celadon', at: [24, 16], size: [6, 3] },
  { name: 'blueHouse', town: 'cerulean', at: [8, 8], size: [7, 4] },
  { name: 'bikeShop', town: 'cerulean', at: [10, 23], size: [6, 7] },
  { name: 'ceruleanGym', town: 'cerulean', at: [28, 17], size: [7, 5] },
  { name: 'fanClub', town: 'vermilion', at: [11, 14], size: [5, 4] },
  { name: 'orangeHouse', town: 'vermilion', at: [18, 14], size: [4, 4] },
  { name: 'flowerHouse', town: 'vermilion', at: [8, 3], size: [5, 4] },
  { name: 'vermilionGym', town: 'vermilion', at: [11, 21], size: [7, 5] },
  { name: 'pier', town: 'vermilion', at: [20, 32], size: [7, 8] },
  { name: 'pokemonTower', town: 'lavender', at: [15, 0], size: [7, 7] },
  { name: 'purpleHouse', town: 'lavender', at: [8, 8], size: [5, 4] },
  { name: 'safariGate', town: 'fuchsia', at: [22, 0], size: [6, 6], flatRoof: true },
  { name: 'wardenHouse', town: 'fuchsia', at: [26, 12], size: [6, 5], flatRoof: true },
  { name: 'fuchsiaGym', town: 'fuchsia', at: [6, 28], size: [7, 4] },
  { name: 'brickRow', town: 'fuchsia', at: [13, 28], size: [10, 4] },
  { name: 'silphCo', town: 'saffron', at: [29, 16], size: [9, 15] },
  { name: 'dojo', town: 'saffron', at: [37, 8], size: [6, 5] },
  { name: 'saffronGym', town: 'saffron', at: [43, 8], size: [7, 5] },
  { name: 'cityGate', town: 'saffron', at: [32, 2], size: [6, 4] },
  { name: 'greenHouse', town: 'saffron', at: [21, 10], size: [4, 5] },
  { name: 'greenCottage', town: 'saffron', at: [22, 18], size: [4, 4] },
  { name: 'apartments', town: 'saffron', at: [19, 25], size: [5, 6] },
  // FireRed's gatehouses, walked through from one side to the other: Route
  // 2's, north to south, its roof's ridge stood on to go in from the north and
  // its door at the foot of the steps, both warped on Route 2; Route 5's into
  // Saffron, the same way through, whose south side Saffron City's map warps,
  // drawing the same building where the two maps meet; and Route 7's, west to
  // east, gone into from the porch at either end, its east porch warped by
  // Saffron's map in the same way. The fence posts either end of the north-
  // south ones are the fence they stand in, which a map draws for itself.
  {
    name: 'route2Gate',
    town: 'route2',
    at: [16, 41],
    size: [6, 7],
    drop: [[0, 0], [5, 0], [0, 6], [5, 6]],
    scrub: [[1, 0], [2, 0], [3, 0], [4, 0]],
  },
  {
    name: 'saffronGate',
    town: 'route5',
    at: [22, 32],
    size: [6, 8],
    drop: [[0, 0], [5, 0], [0, 7], [5, 7]],
    scrub: [[1, 0], [2, 0], [3, 0], [4, 0]],
    warpsFrom: [{ town: 'saffron', offset: [-10, 33] }],
  },
  {
    name: 'saffronSideGate',
    town: 'route7',
    at: [15, 7],
    size: [8, 5],
    drop: [[7, 0]],
    scrub: [1, 2, 3, 4].flatMap((r) => [[0, r], [7, r]]),
    warpsFrom: [{ town: 'saffron', offset: [14, -17] }],
  },
  { name: 'burntMansion', town: 'cinnabar', at: [5, 0], size: [7, 5], drop: [[1, 4]] },
  { name: 'cinnabarLab', town: 'cinnabar', at: [5, 6], size: [7, 5], drop: [[1, 4]] },
  { name: 'cinnabarGym', town: 'cinnabar', at: [17, 0], size: [6, 5], drop: [[5, 4]] },
];

/**
 * Things that stand in the field, cut from the game's own object-event
 * graphics (`graphics/object_events/pics/misc`): a name, the file, and the
 * width of one frame - the first frame is the one cut, standing on the bottom
 * of its cells.
 */
const OBJECTS = [
  { name: 'smashRock', file: 'rock_smash_rock', frame: 16 },
  { name: 'strengthBoulder', file: 'strength_boulder', frame: 16 },
  { name: 'itemBall', file: 'item_ball', frame: 16 },
  { name: 'fossil', file: 'fossil', frame: 16 },
  { name: 'oldAmber', file: 'old_amber', frame: 16 },
  { name: 'woodenSign', file: 'wooden_sign', frame: 16 },
  { name: 'metalSign', file: 'sign', frame: 16 },
  { name: 'gymStatue', file: 'gym_sign', frame: 16 },
  { name: 'townMap', file: 'town_map', frame: 16 },
  { name: 'pokedex', file: 'pokedex', frame: 16 },
  { name: 'clipboard', file: 'clipboard', frame: 16 },
  { name: 'laprasDoll', file: 'lapras_doll', frame: 32 },
  { name: 'ruby', file: 'ruby', frame: 16 },
  { name: 'sapphire', file: 'sapphire', frame: 16 },
  { name: 'ancientStone', file: 'birth_island_stone', frame: 32 },
  { name: 'ssAnne', file: 'ss_anne', frame: 128 },
  { name: 'seagallop', file: 'seagallop', frame: 64 },
];

const [pret] = process.argv.slice(2);
if (!pret || !existsSync(join(pret, 'data/tilesets/primary/general/tiles.png'))) {
  console.error('usage: node scripts/cut-frlg-towns.mjs <pret/pokefirered checkout> (see the top of this script)');
  process.exit(1);
}

/** A 4- or 8-bit indexed PNG as its palette indices. */
function indexed(path) {
  const file = readFileSync(path);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let depth = 8;
  let palette = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
    } else if (type === 'PLTE') {
      palette = Array.from({ length: body.length / 3 }, (_, i) => [body[i * 3], body[i * 3 + 1], body[i * 3 + 2]]);
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((width * depth) / 8);
  const pixels = new Uint8Array(width * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) {
      const a = i > 0 ? line[i - 1] : 0;
      const b = previous[i];
      const c = i > 0 ? previous[i - 1] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = depth === 4 ? (x & 1 ? line[x >> 1] & 15 : line[x >> 1] >> 4) : line[x];
    }
    previous = line;
  }
  return { width, height, pixels, palette };
}

/** A JASC palette, every channel put on the GBA's `<< 3` footing. */
function palette(dir, number) {
  return readFileSync(join(dir, 'palettes', `${String(number).padStart(2, '0')}.pal`), 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.trim().split(/\s+/).map((value) => Math.round((Number(value) * 31) / 255) << 3));
}

/**
 * The way a warp is gone through, from the behaviour of the floor it is on
 * (`include/constants/metatile_behaviors.h`): a door is walked up into, an
 * arrow warp is stood on and pressed the way it points, and anything else
 * does not fire.
 */
const WAYS = {
  0x60: 'door', // MB_CAVE_DOOR, a doorway with no door to open
  0x69: 'door', // MB_WARP_DOOR
  0x62: 'right', // MB_EAST_ARROW_WARP
  0x63: 'left', // MB_WEST_ARROW_WARP
  0x64: 'up', // MB_NORTH_ARROW_WARP
  0x65: 'down', // MB_SOUTH_ARROW_WARP
};
const throughWay = (behaviour) => WAYS[behaviour];

/** A town drawn whole, with each block's metatile and whether it can be walked on. */
function renderTown([layout, secondary, width, height]) {
  const primaryDir = join(pret, 'data/tilesets/primary/general');
  const secondaryDir = join(pret, 'data/tilesets/secondary', secondary);
  const tiles = [indexed(join(primaryDir, 'tiles.png')), indexed(join(secondaryDir, 'tiles.png'))];
  const palettes = Array.from({ length: 16 }, (_, n) => palette(n < 7 ? primaryDir : secondaryDir, n));
  const metatiles = [readFileSync(join(primaryDir, 'metatiles.bin')), readFileSync(join(secondaryDir, 'metatiles.bin'))];
  const attributes = [
    readFileSync(join(primaryDir, 'metatile_attributes.bin')),
    readFileSync(join(secondaryDir, 'metatile_attributes.bin')),
  ];
  /** A metatile's behaviour: what its floor does to whoever stands on it. */
  const behaviourOf = (metatile) =>
    (metatile < 640 ? attributes[0] : attributes[1]).readUInt32LE((metatile < 640 ? metatile : metatile - 640) * 4) & 0x1ff;
  const blocks = readFileSync(join(pret, 'data/layouts', layout, 'map.bin'));
  const image = { width: width * TILE, height: height * TILE, data: Buffer.alloc(width * height * TILE * TILE * 4) };
  const cells = [];
  const entriesOf = (metatile) => {
    const table = metatile < 640 ? metatiles[0] : metatiles[1];
    const local = metatile < 640 ? metatile : metatile - 640;
    return Array.from({ length: 8 }, (_, k) => table.readUInt16LE(local * 16 + k * 2));
  };
  const drawTile = (target, entry, dx, dy, layer) => {
    const index = entry & 1023;
    const source = index < 640 ? tiles[0] : tiles[1];
    const local = index < 640 ? index : index - 640;
    const columns = source.width / 8;
    const tx = (local % columns) * 8;
    const ty = Math.floor(local / columns) * 8;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const sx = tx + (entry & 1024 ? 7 - x : x);
        const sy = ty + (entry & 2048 ? 7 - y : y);
        if (sy >= source.height) continue;
        const colour = source.pixels[sy * source.width + sx];
        if (colour === 0 && layer === 1) continue;
        const rgb = palettes[entry >> 12][colour];
        const at = ((dy + y) * target.width + dx + x) * 4;
        target.data[at] = rgb[0];
        target.data[at + 1] = rgb[1];
        target.data[at + 2] = rgb[2];
        target.data[at + 3] = 255;
      }
    }
  };
  for (let by = 0; by < height; by += 1) {
    for (let bx = 0; bx < width; bx += 1) {
      const value = blocks.readUInt16LE((by * width + bx) * 2);
      const metatile = value & 1023;
      cells.push({ metatile, walkable: ((value >> 10) & 3) === 0 });
      entriesOf(metatile).forEach((entry, k) =>
        drawTile(image, entry, bx * TILE + (k & 1) * 8, by * TILE + ((k & 3) >> 1) * 8, k >> 2),
      );
    }
  }
  const uses = new Map();
  for (const cell of cells) uses.set(cell.metatile, (uses.get(cell.metatile) ?? 0) + 1);
  const isGround = (cell) => cell.walkable && uses.get(cell.metatile) >= 8;
  // The 8x8 tiles the town's forest is drawn with. Every Kanto town is ringed
  // by its wood (or its sea, or its cliff), so the solid cells of the map's
  // outer two rings that come from the shared tileset and that it uses twenty
  // times or more are that wood - a building against the edge is used a
  // handful of times, and a town's own roofs are its own tileset's - and their
  // tiles are its tiles. A crown that
  // hangs over a roof is drawn into the roof's own cell with them, so a piece
  // leaves them out tile by tile and keeps the roof underneath. Counting how
  // often a cell is used cannot say this: a city repeats its own facades and a
  // Gym roof as often as its trees.
  const forest = new Set();
  for (let by = 0; by < height; by += 1) {
    for (let bx = 0; bx < width; bx += 1) {
      const onRing = bx < 2 || by < 2 || bx >= width - 2 || by >= height - 2;
      const cell = cells[by * width + bx];
      if (onRing && !cell.walkable && cell.metatile < 640 && uses.get(cell.metatile) >= 20) {
        for (const entry of entriesOf(cell.metatile)) forest.add(entry & 1023);
      }
    }
  }
  /** One cell drawn alone, without any of the forest's tiles. */
  const cellArt = (bx, by) => {
    const out = { width: TILE, height: TILE, data: Buffer.alloc(TILE * TILE * 4) };
    entriesOf(cells[by * width + bx].metatile).forEach((entry, k) => {
      if (!forest.has(entry & 1023)) drawTile(out, entry, (k & 1) * 8, ((k & 3) >> 1) * 8, k >> 2);
    });
    return out;
  };
  // Where the town's map takes a player somewhere else: its doors, each with
  // the way it is gone through, and only the ones that fire.
  const warps = JSON.parse(readFileSync(join(pret, 'data/maps', layout, 'map.json'), 'utf8'))
    .warp_events.flatMap((warp) => {
      const way = throughWay(behaviourOf(cells[warp.y * width + warp.x].metatile));
      return way ? [[warp.x, warp.y, way]] : [];
    });
  return { image, width, height, cells, isGround, cellArt, warps };
}

const towns = new Map(Object.entries(TOWNS).map(([name, town]) => [name, renderTown(town)]));

const blank = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });

function cellImage(town, bx, by) {
  const out = blank(TILE, TILE);
  for (let y = 0; y < TILE; y += 1) {
    town.image.data.copy(out.data, y * TILE * 4, ((by * TILE + y) * town.image.width + bx * TILE) * 4, ((by * TILE + y) * town.image.width + bx * TILE + TILE) * 4);
  }
  return out;
}

/** Every ground cell of a town, as images to match an eave against. */
const groundsOf = new Map(
  [...towns].map(([name, town]) => {
    const seen = new Map();
    town.cells.forEach((cell, index) => {
      if (town.isGround(cell) && !seen.has(cell.metatile)) {
        seen.set(cell.metatile, cellImage(town, index % town.width, Math.floor(index / town.width)));
      }
    });
    return [name, seen];
  }),
);

function liftGround(tile, grounds) {
  let best = null;
  let bestShared = 0;
  for (const ground of grounds) {
    let shared = 0;
    for (let i = 0; i < tile.data.length; i += 4) {
      if (tile.data[i] === ground.data[i] && tile.data[i + 1] === ground.data[i + 1] && tile.data[i + 2] === ground.data[i + 2]) shared += 1;
    }
    if (shared > bestShared) {
      best = ground;
      bestShared = shared;
    }
  }
  if (!best || bestShared < 12) return tile;
  for (let i = 0; i < tile.data.length; i += 4) {
    if (tile.data[i] === best.data[i] && tile.data[i + 1] === best.data[i + 1] && tile.data[i + 2] === best.data[i + 2]) tile.data[i + 3] = 0;
  }
  return tile;
}

const colourKey = (data, i) => (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];

/** A cell with every pixel coloured like the ground round it lifted. */
function scrub(tile, colours) {
  for (let i = 0; i < tile.data.length; i += 4) {
    if (colours.has(colourKey(tile.data, i))) tile.data[i + 3] = 0;
  }
  return tile;
}

const opaque = (tile) => {
  for (let i = 3; i < tile.data.length; i += 4) if (tile.data[i] > 0) return true;
  return false;
};

/** Clears every 8-connected run of drawn pixels smaller than `SPECK` across a grid of cells. */
const SPECK = 48;
function sweepSpecks(grid, w, h) {
  const width = w * TILE;
  const height = h * TILE;
  const index = (x, y) => ((y % TILE) * TILE + (x % TILE)) * 4;
  const tileAt = (x, y) => grid[Math.floor(y / TILE)][Math.floor(x / TILE)];
  const drawn = (x, y) => tileAt(x, y).data[index(x, y) + 3] > 0;
  const seen = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (seen[y * width + x] || !drawn(x, y)) continue;
      const run = [[x, y]];
      seen[y * width + x] = 1;
      for (let i = 0; i < run.length; i += 1) {
        const [cx, cy] = run[i];
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[ny * width + nx] || !drawn(nx, ny)) continue;
            seen[ny * width + nx] = 1;
            run.push([nx, ny]);
          }
        }
      }
      if (run.length < SPECK) {
        for (const [px, py] of run) tileAt(px, py).data[index(px, py) + 3] = 0;
      }
    }
  }
}

function cutPiece(piece) {
  const town = towns.get(piece.town);
  // A metatile the building itself draws solid is part of it, never ground:
  // FireRed marks a roof walkable where nobody can reach it, and a route with
  // three gatehouses on it has enough of one roof to count it as its ground.
  const own = new Set();
  for (let r = 0; r < piece.size[1]; r += 1) {
    for (let q = 0; q < piece.size[0]; q += 1) {
      const cell = town.cells[(piece.at[1] + r) * town.width + piece.at[0] + q];
      if (!cell.walkable) own.add(cell.metatile);
    }
  }
  const grounds = [...groundsOf.get(piece.town)]
    .filter(([metatile]) => !own.has(metatile))
    .map(([, image]) => image);
  const [ax, ay] = piece.at;
  const [w, h] = piece.size;
  // Cells of the rectangle that are something standing beside the piece - a
  // tree's crown over a roof, a ledge along a garden - named per piece.
  const dropped = new Set((piece.drop ?? []).map(([q, r]) => `${q},${r}`));
  const scrubbed = new Set((piece.scrub ?? []).map(([q, r]) => `${q},${r}`));
  // The colours of the ground round the building: the cells of the map that
  // touch its rectangle from outside and can be walked on.
  const groundColours = new Set();
  for (let r = -1; r <= h; r += 1) {
    for (let q = -1; q <= w; q += 1) {
      const outer = q === -1 || r === -1 || q === w || r === h;
      const x = ax + q;
      const y = ay + r;
      if (!outer || x < 0 || y < 0 || x >= town.width || y >= town.height || !town.cells[y * town.width + x].walkable) continue;
      const image = cellImage(town, x, y);
      for (let i = 0; i < image.data.length; i += 4) groundColours.add(colourKey(image.data, i));
    }
  }
  // Ground is only lifted where it reaches the rectangle's edge through more
  // ground. A big flat roof is walkable on paper - nobody can get onto it, so
  // FireRed never shuts it - and as common as a lawn, so a building that has
  // one (`flatRoof`) keeps every cell and has its ground lifted pixel by pixel.
  const cellAt = (q, r) => town.cells[(ay + r) * town.width + ax + q];
  const outside = new Set();
  const queue = [];
  for (let r = 0; r < h; r += 1) {
    for (let q = 0; q < w; q += 1) {
      if (!piece.flatRoof && (r === 0 || q === 0 || r === h - 1 || q === w - 1) && town.isGround(cellAt(q, r))) {
        outside.add(`${q},${r}`);
        queue.push([q, r]);
      }
    }
  }
  while (queue.length > 0) {
    const [q, r] = queue.pop();
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nq = q + dq;
      const nr = r + dr;
      if (nq < 0 || nr < 0 || nq >= w || nr >= h || outside.has(`${nq},${nr}`)) continue;
      if (town.isGround(cellAt(nq, nr))) {
        outside.add(`${nq},${nr}`);
        queue.push([nq, nr]);
      }
    }
  }
  const grid = [];
  for (let r = 0; r < h; r += 1) {
    const row = [];
    for (let q = 0; q < w; q += 1) {
      if (outside.has(`${q},${r}`) || dropped.has(`${q},${r}`)) {
        row.push(blank(TILE, TILE));
        continue;
      }
      const tile = town.cellArt(ax + q, ay + r);
      row.push(scrubbed.has(`${q},${r}`) ? scrub(tile, groundColours) : liftGround(tile, grounds));
    }
    grid.push(row);
  }
  // A wisp of long grass at a piece's edge survives the ground lift as a few
  // pixels on their own: anything smaller than a sign that touches nothing
  // else of the piece is left behind.
  sweepSpecks(grid, w, h);
  // Trim to the cells that still hold anything.
  const used = (r, q) => opaque(grid[r][q]);
  let top = 0;
  while (top < h && grid[top].every((_, q) => !used(top, q))) top += 1;
  let bottom = h - 1;
  while (bottom > top && grid[bottom].every((_, q) => !used(bottom, q))) bottom -= 1;
  let left = 0;
  while (left < w && grid.every((_, r) => !used(r, left))) left += 1;
  let right = w - 1;
  while (right > left && grid.every((_, r) => !used(r, right))) right -= 1;
  const width = right - left + 1;
  const height = bottom - top + 1;
  const out = blank(width * TILE, height * TILE);
  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      const tile = grid[top + r][left + q];
      for (let y = 0; y < TILE; y += 1) {
        tile.data.copy(out.data, ((r * TILE + y) * out.width + q * TILE) * 4, y * TILE * 4, (y + 1) * TILE * 4);
      }
    }
  }
  // Which cells hold anything: '#' drawn, '-' left empty, so a piece's wall
  // can follow its art instead of standing on air.
  const mask = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, q) => (opaque(grid[top + r][left + q]) ? '#' : '-')).join(''),
  );
  // The building's doors, in its own trimmed cells, bottom row first: the
  // town's own warps, and any the map beyond it puts on a cell of the
  // building that both maps draw.
  const borrowed = (piece.warpsFrom ?? []).flatMap(({ town: name, offset: [dx, dy] }) => {
    const beyond = towns.get(name);
    return beyond.warps.flatMap(([x, y, way]) => {
      const [hx, hy] = [x + dx, y + dy];
      const inside = hx >= 0 && hy >= 0 && hx < town.width && hy < town.height;
      const same = inside && beyond.cells[y * beyond.width + x].metatile === town.cells[hy * town.width + hx].metatile;
      return same ? [[hx, hy, way]] : [];
    });
  });
  const doors = [...town.warps, ...borrowed]
    .filter(([x, y]) => x >= ax + left && x <= ax + right && y >= ay + top && y <= ay + bottom)
    .map(([x, y, way]) => [x - ax - left, y - ay - top, way])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return { name: piece.name, width, height, image: out, mask, doors };
}

/** An object's first frame, on the `<< 3` footing, standing on the bottom of whole cells. */
function cutObject(object) {
  const source = indexed(join(pret, 'graphics/object_events/pics/misc', `${object.file}.png`));
  const width = Math.ceil(object.frame / TILE);
  const height = Math.ceil(source.height / TILE);
  const out = blank(width * TILE, height * TILE);
  const top = height * TILE - source.height;
  const left = Math.floor((width * TILE - object.frame) / 2);
  const toFooting = (value) => Math.round((value * 31) / 255) << 3;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < object.frame; x += 1) {
      const colour = source.pixels[y * source.width + x];
      if (colour === 0) continue;
      const at = ((top + y) * out.width + left + x) * 4;
      const [r, g, b] = source.palette[colour];
      out.data[at] = toFooting(r);
      out.data[at + 1] = toFooting(g);
      out.data[at + 2] = toFooting(b);
      out.data[at + 3] = 255;
    }
  }
  const cellHasInk = (q, r) => {
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        if (out.data[((r * TILE + y) * out.width + q * TILE + x) * 4 + 3] > 0) return true;
      }
    }
    return false;
  };
  const mask = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, q) => (cellHasInk(q, r) ? '#' : '-')).join(''),
  );
  return { name: object.name, width, height, image: out, mask, doors: [] };
}

const cut = [...PIECES.map(cutPiece), ...OBJECTS.map(cutObject)];

// Shelf packing: tallest first, so a building's rows are not split by singles.
const order = [...cut].sort((a, b) => b.height - a.height || b.width - a.width);
const placed = new Map();
let shelfTop = 0;
let shelfHeight = 0;
let cursor = 0;
for (const piece of order) {
  if (cursor + piece.width > SHEET_COLUMNS) {
    shelfTop += shelfHeight;
    shelfHeight = 0;
    cursor = 0;
  }
  placed.set(piece.name, { column: cursor, row: shelfTop, width: piece.width, height: piece.height });
  cursor += piece.width;
  shelfHeight = Math.max(shelfHeight, piece.height);
}
const rows = shelfTop + shelfHeight;
const sheet = blank(SHEET_COLUMNS * TILE, rows * TILE);
for (const piece of cut) {
  const at = placed.get(piece.name);
  for (let y = 0; y < piece.image.height; y += 1) {
    piece.image.data.copy(sheet.data, ((at.row * TILE + y) * sheet.width + at.column * TILE) * 4, y * piece.image.width * 4, (y + 1) * piece.image.width * 4);
  }
}
writePng(new URL('../public/assets/frlg-towns.png', import.meta.url).pathname, sheet);

const masks = new Map(cut.map((piece) => [piece.name, piece.mask]));
const doorsOf = new Map(cut.map((piece) => [piece.name, piece.doors]));
const entries = [...PIECES, ...OBJECTS].map(({ name }) => {
  const at = placed.get(name);
  const mask = masks.get(name).map((row) => `'${row}'`).join(', ');
  const doors = doorsOf.get(name).map(([x, y, way]) => `[${x}, ${y}, '${way}']`).join(', ');
  return `  ${name}: {\n    column: ${at.column},\n    row: ${at.row},\n    width: ${at.width},\n    height: ${at.height},\n    cells: [${mask}],\n    doors: [${doors}],\n  },`;
});
writeFileSync(
  new URL('../src/game/world/generated/townPieces.ts', import.meta.url),
  `// Generated by scripts/cut-frlg-towns.mjs from pret/pokefirered's own Kanto
// town maps. Do not edit: re-run the script.

/** The sheet Kanto's town buildings are cut onto. */
export const TOWN_SHEET = {
  imagePath: 'assets/frlg-towns.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/**
 * Where each named piece sits on the sheet, in tiles, which of its cells hold
 * anything ('#') or nothing ('-'), and its doors: the cells FireRed's own map
 * warps a player from, bottom row first, each with the way it is gone through -
 * a door walked up into, or the direction an arrow warp is pressed.
 */
export const TOWN_PIECES = {
${entries.join('\n')}
} as const;

export type TownPieceName = keyof typeof TOWN_PIECES;
`,
);
console.log(`frlg-towns.png ${SHEET_COLUMNS}x${rows} tiles, ${cut.length} pieces`);
