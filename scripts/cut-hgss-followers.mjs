// Cuts the walking art in `public/assets/followers/` out of Pokemon
// HeartGold/SoulSilver's own following-Pokemon sprites, as the pret
// disassembly of that game carries them.
//
//   node scripts/cut-hgss-followers.mjs            # fetches the textures
//   node scripts/cut-hgss-followers.mjs <dir>      # or reads them from <dir>
//
// FireRed draws no Pokemon walking behind the player; HeartGold/SoulSilver is
// the game that does, and every following sprite it has is one Nitro texture
// file (`.NSBTX`) in `files/data/mmodel/mmodel/` of `pret/pokeheartgold`. Which
// file is which Pokemon is that repository's own `include/constants/mmodel.h`
// (`MMODEL_FOLLOWER_MON_BULBASAUR` is 297, and so on), read here rather than
// copied, so nothing is a guess about which picture is whose. The repository
// is pinned to one commit.
//
// A following texture holds eight 32x32 frames, four-bit, and two palettes:
// `tsure_poke0`, its colours, and `tsure_poke1`, its shiny colours. Two frames
// a facing, in the order up, down, left, right. What ships is one 64x128 sheet
// a species and a second in its shiny colours under `shiny/`, two columns of
// frames in four rows - down, up, left, right - with the pixels exactly as the
// game draws them: nothing is scaled, filtered or moved, so a frame row here
// is a frame row there.
//
// Every one of Kanto's 151 is cut (the species catalogue's own list), because
// on a raid whoever leads the party walks at the player's heel
// (`world/raidFollower.ts`), and the harbour's partner is one of the starters'
// lines among them (`base/partner.ts`).
//
// The harbour's own Pokemon - the ones that live about THE HARBOUR rather
// than following anybody (`src/game/base/harbourLife.ts`) - are cut the same
// way into `public/assets/harbour-pokemon/`, with their metrics in
// `src/game/base/generated/harbourPokemonArt.ts`, and kept apart so the
// harbour's crowd is its own list.
//
// It also writes `src/game/base/generated/followerArt.ts`: where each species'
// art starts and ends inside its frame, read off the pixels, because the
// emotion bubble is seated over a head and a Venusaur's head is not a
// Charmander's.
//
// No dependencies: the PNG writer below is the whole of what is needed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const PRET_COMMIT = '9d8b7591f09b65804da2fb2dfd56f320633e0d36';
const SOURCE_URL = (path) => `https://raw.githubusercontent.com/pret/pokeheartgold/${PRET_COMMIT}/${path}`;
const TEXTURE_PATH = (file) => `files/data/mmodel/mmodel/${file}`;
const MODEL_HEADER = 'include/constants/mmodel.h';

/** Kanto's 151, by the id the game knows each one by, read off the generated species catalogue. */
function kantoSpecies() {
  const catalogue = readFileSync(new URL('../src/game/pokemon/generated/speciesCatalogue.ts', import.meta.url), 'utf8');
  const species = [...catalogue.matchAll(/dexId: (\d+),\n\s+id: '([a-z-]+)'/g)]
    .filter(([, dexId]) => Number(dexId) <= 151)
    .map(([, , id]) => id);
  if (species.length !== 151) throw new Error(`expected Kanto's 151 in the species catalogue, found ${species.length}`);
  return species;
}

/**
 * Every Pokemon that can walk at the player's heel, and the texture each is
 * cut from: `MMODEL_FOLLOWER_MON_<ID>` in pret's header, the id in capitals
 * with its hyphen an underscore (NIDORAN_F, MR_MIME). HeartGold also draws a
 * female form of some (VENUSAUR_F, a seed on her flower); a save records no
 * gender, so the one drawn is the male, as the battle sprite is.
 */
async function followerModels() {
  const header = (await readSource(MODEL_HEADER)).toString('utf8');
  const models = new Map(
    [...header.matchAll(/#define MMODEL_FOLLOWER_MON_([A-Z0-9_]+)\s+(\d+)/g)].map(([, name, model]) => [name, Number(model)]),
  );
  return Object.fromEntries(
    kantoSpecies().map((species) => {
      const model = models.get(species.toUpperCase().replace(/-/g, '_'));
      if (model === undefined) throw new Error(`${species}: no MMODEL_FOLLOWER_MON_ in ${MODEL_HEADER}`);
      return [species, model];
    }),
  );
}

/**
 * The Pokemon that live about the harbour, by the same header: the ones a
 * FireRed port has (Vermilion, Cinnabar, the Sevii quays) and nothing a raid
 * does not already meet.
 */
const HARBOUR = {
  pidgey: 313,
  meowth: 350,
  psyduck: 352,
  growlithe: 356,
  machop: 364,
  tentacool: 370,
  slowpoke: 377,
  krabby: 396,
  magikarp: 427,
  lapras: 429,
};

/**
 * The Pokemon a raid's way out can be (`world/exitVehicles.ts`): Pidgeot, who
 * waits on high ground for whoever is leaving and flies them out, as the
 * games' own Fly does. Kept apart again, in `public/assets/rides/`, for the
 * harbour's reason: nothing about a way out changes who walks a raid.
 */
const RIDES = {
  pidgeot: 315,
};

const FRAME = 32;
/** The texture's frame order, two a facing. */
const SOURCE_FACINGS = ['up', 'down', 'left', 'right'];
/** The sheet's row order, the one `playerFrames.ts` reads people in, less the walk columns. */
const OUTPUT_FACINGS = ['down', 'up', 'left', 'right'];

/** Reads one Nitro dictionary: its entries and their names, in file order. */
function dictionary(bytes, at) {
  const count = bytes[at + 1];
  let cursor = at + 4 + 8 + 4 * count;
  const unit = bytes.readUInt16LE(cursor);
  cursor += 4;
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    entries.push(bytes.subarray(cursor + index * unit, cursor + (index + 1) * unit));
  }
  cursor += count * unit;
  return entries.map((entry, index) => ({
    entry,
    name: bytes
      .subarray(cursor + index * 16, cursor + index * 16 + 16)
      .toString('latin1')
      .replace(/\0.*$/s, ''),
  }));
}

/** Every frame of one following texture, as palette indices, and its two palettes - ordinary and shiny - as RGB. */
function decodeTexture(bytes) {
  if (bytes.subarray(0, 4).toString('latin1') !== 'BTX0') throw new Error('not a BTX0 file');
  const tex0 = bytes.readUInt32LE(0x10);
  if (bytes.subarray(tex0, tex0 + 4).toString('latin1') !== 'TEX0') throw new Error('no TEX0 block');
  const textureInfo = tex0 + bytes.readUInt16LE(tex0 + 0x0e);
  const textureData = tex0 + bytes.readUInt32LE(tex0 + 0x14);
  const paletteInfo = tex0 + bytes.readUInt32LE(tex0 + 0x34);
  const paletteData = tex0 + bytes.readUInt32LE(tex0 + 0x38);
  const palettes = dictionary(bytes, paletteInfo).map((palette) => {
    const paletteAt = paletteData + (palette.entry.readUInt16LE(0) << 3);
    return Array.from({ length: 16 }, (_, index) => {
      const bgr = bytes.readUInt16LE(paletteAt + index * 2);
      // Five bits a channel, widened the way every GBA and DS rip in this
      // repository is (`ASSET_PROVENANCE.md`: every colour a multiple of 8).
      return [(bgr & 31) << 3, ((bgr >> 5) & 31) << 3, ((bgr >> 10) & 31) << 3];
    });
  });
  const [colours, shinyColours] = palettes;
  const frames = dictionary(bytes, textureInfo).map(({ entry, name }) => {
    const offset = entry.readUInt16LE(0) << 3;
    const params = entry.readUInt16LE(2);
    const width = 8 << ((params >> 4) & 7);
    const height = 8 << ((params >> 7) & 7);
    const format = (params >> 10) & 7;
    const transparentZero = (params >> 13) & 1;
    if (width !== FRAME || height !== FRAME || format !== 3 || !transparentZero) {
      throw new Error(`${name}: expected a 32x32 four-bit frame with colour 0 clear`);
    }
    const pixels = new Uint8Array(FRAME * FRAME);
    for (let index = 0; index < pixels.length; index += 1) {
      const byte = bytes[textureData + offset + (index >> 1)];
      pixels[index] = index & 1 ? byte >> 4 : byte & 15;
    }
    return pixels;
  });
  if (frames.length !== 8) throw new Error(`expected eight frames, found ${frames.length}`);
  return { colours, shinyColours, frames };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A file of the pinned repository, by its path there; from a directory, by its name alone. */
async function readSource(path) {
  const fromDir = process.argv[2];
  if (fromDir) return readFileSync(`${fromDir}/${path.split('/').pop()}`);
  const response = await fetch(SOURCE_URL(path));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** One sheet of a species, its frames in `colours`, and where its art starts and ends inside a frame. */
function cutSheet(frames, colours) {
  const width = FRAME * 2;
  const height = FRAME * OUTPUT_FACINGS.length;
  const sheet = Buffer.alloc(width * height * 4);
  let top = FRAME;
  let bottom = -1;
  OUTPUT_FACINGS.forEach((facing, row) => {
    const first = SOURCE_FACINGS.indexOf(facing) * 2;
    for (let column = 0; column < 2; column += 1) {
      const frame = frames[first + column];
      for (let y = 0; y < FRAME; y += 1) {
        for (let x = 0; x < FRAME; x += 1) {
          const index = frame[y * FRAME + x];
          if (index === 0) continue;
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          const at = ((row * FRAME + y) * width + column * FRAME + x) * 4;
          sheet.set([...colours[index], 255], at);
        }
      }
    }
  });
  return { png: encodePng(width, height, sheet), top, bottom };
}

/**
 * Cuts every texture in `set` into `folder`, and its shiny colours into
 * `folder/shiny/` when `shiny` is asked for, and hands back where each one's
 * art sits.
 */
async function cutSheets(set, folder, { shiny = false } = {}) {
  const outputRoot = new URL(`../public/assets/${folder}/`, import.meta.url);
  mkdirSync(outputRoot, { recursive: true });
  if (shiny) mkdirSync(new URL('shiny/', outputRoot), { recursive: true });
  const metrics = {};
  for (const [species, model] of Object.entries(set)) {
    const file = `mmodel_${String(model).padStart(8, '0')}.NSBTX`;
    const { colours, shinyColours, frames } = decodeTexture(await readSource(TEXTURE_PATH(file)));
    const { png, top, bottom } = cutSheet(frames, colours);
    writeFileSync(new URL(`${species}.png`, outputRoot), png);
    if (shiny) {
      if (!shinyColours) throw new Error(`${file}: no shiny palette`);
      writeFileSync(new URL(`shiny/${species}.png`, outputRoot), cutSheet(frames, shinyColours).png);
    }
    metrics[species] = { model, topPixelY: top, bottomPixelY: bottom };
    console.log(`${species}: ${file}, art rows ${top}-${bottom}`);
  }
  return metrics;
}

const artTable = (metrics) =>
  Object.entries(metrics)
    .map(
      ([species, { model, topPixelY, bottomPixelY }]) =>
        `  ${/^[a-z]+$/.test(species) ? species : `'${species}'`}: { model: ${model}, topPixelY: ${topPixelY}, bottomPixelY: ${bottomPixelY} },`,
    )
    .join('\n');

const metrics = await cutSheets(await followerModels(), 'followers', { shiny: true });
const harbour = await cutSheets(HARBOUR, 'harbour-pokemon');
const rides = await cutSheets(RIDES, 'rides');

const generated = `// Generated by scripts/cut-hgss-followers.mjs from pret/pokeheartgold@${PRET_COMMIT.slice(0, 7)}.
// Do not edit by hand: run the script again.

/**
 * Where each following Pokemon's art sits inside its 32x32 frame, read off the
 * pixels of every frame: the highest and lowest painted rows, and the
 * \`MMODEL_FOLLOWER_MON_*\` texture it was cut from.
 */
export const FOLLOWER_ART = {
${artTable(metrics)}
} as const;
`;
writeFileSync(new URL('../src/game/base/generated/followerArt.ts', import.meta.url), generated);

const harbourGenerated = `// Generated by scripts/cut-hgss-followers.mjs from pret/pokeheartgold@${PRET_COMMIT.slice(0, 7)}.
// Do not edit by hand: run the script again.

/**
 * The harbour's own Pokemon (\`base/harbourLife.ts\`), cut as the partners are
 * into \`public/assets/harbour-pokemon/\`: where each one's art sits inside its
 * 32x32 frame, and the \`MMODEL_FOLLOWER_MON_*\` texture it was cut from.
 */
export const HARBOUR_POKEMON_ART = {
${artTable(harbour)}
} as const;
`;
writeFileSync(new URL('../src/game/base/generated/harbourPokemonArt.ts', import.meta.url), harbourGenerated);

const ridesGenerated = `// Generated by scripts/cut-hgss-followers.mjs from pret/pokeheartgold@${PRET_COMMIT.slice(0, 7)}.
// Do not edit by hand: run the script again.

/**
 * The Pokemon a way out can be (\`world/exitVehicles.ts\`), cut as the partners
 * are into \`public/assets/rides/\`: where each one's art sits inside its 32x32
 * frame, and the \`MMODEL_FOLLOWER_MON_*\` texture it was cut from.
 */
export const RIDE_ART = {
${artTable(rides)}
} as const;
`;
writeFileSync(new URL('../src/game/world/generated/rideArt.ts', import.meta.url), ridesGenerated);
