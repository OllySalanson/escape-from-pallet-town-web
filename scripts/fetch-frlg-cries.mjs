// Fetches FireRed/LeafGreen's own cry for every one of Kanto's original 151
// into `public/assets/cries/<dexId>.wav`.
//
//   node scripts/fetch-frlg-cries.mjs [--force]
//
// The cries are the game's own samples as pret/pokefirered (the decompilation
// the battle rules and the house's tiles are already read from, pinned at the
// same commit) keeps them: `sound/direct_sound_samples/cries/<name>.wav`, one
// mono 8-bit sample a species at the GBA's 10512 Hz, which FireRed plays as
// they are for an ordinary cry and lower for a faint (`world/cries.ts`). Only
// the two chunks a browser reads are kept - the format and the samples - and
// the GBA's own loop and pitch chunks (`smpl`, `agbp`, `agbl`) are dropped,
// because nothing here reads them and a decoder that met one it did not know
// would be within its rights to refuse the file.
//
// Every file is checked as it lands: a RIFF WAVE, PCM, one channel, 8 bits,
// and no longer than FireRed lets one sound (140 ticks of its cry song, 2.33s), which is the bound `cries.test.ts` holds the
// shipped set to. `public/assets/ASSET_PROVENANCE.md` carries where they came
// from and on what standing.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'public', 'assets', 'cries');
const COMMIT = '037335f';
const BASE = `https://raw.githubusercontent.com/pret/pokefirered/${COMMIT}/sound/direct_sound_samples/cries`;
const force = process.argv.includes('--force');

const species = JSON.parse(
  await readFile(join(here, '..', 'tools', 'species', 'frlg-species.json'), 'utf8'),
).species;

/** PokeAPI's slug as pret names the file: `mr-mime` is `mr_mime`, `nidoran-f` is `nidoran_f`. */
const pretName = (slug) => slug.replace(/-/g, '_');

const download = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status === 404) throw new Error(`no cry at ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

/** The `fmt ` and `data` chunks of a RIFF WAVE, and nothing else, as a new file. */
const plainWave = (bytes, label) => {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${label} is not a RIFF WAVE`);
  }
  let format;
  let data;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = bytes.subarray(offset + 8, offset + 8 + size);
    if (id === 'fmt ') format = body;
    if (id === 'data') data = body;
    offset += 8 + size + (size % 2);
  }
  if (!format || !data) throw new Error(`${label} has no fmt or data chunk`);
  const pcm = format.readUInt16LE(0);
  const channels = format.readUInt16LE(2);
  const rate = format.readUInt32LE(4);
  const bits = format.readUInt16LE(14);
  if (pcm !== 1 || channels !== 1 || bits !== 8) {
    throw new Error(`${label} is not mono 8-bit PCM (${pcm}/${channels}/${bits})`);
  }
  if (data.length / rate > 2.34) throw new Error(`${label} is ${(data.length / rate).toFixed(2)}s long`);
  const pad = data.length % 2;
  const out = Buffer.alloc(12 + 8 + 16 + 8 + data.length + pad);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(out.length - 8, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16);
  format.copy(out, 20, 0, 16);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(data.length, 40);
  data.copy(out, 44);
  return out;
};

await mkdir(root, { recursive: true });
let written = 0;
let kept = 0;
for (const { dexId, name } of species) {
  if (dexId > 151) continue;
  const path = join(root, `${dexId}.wav`);
  if (!force && (await access(path).then(() => true, () => false))) {
    kept += 1;
    continue;
  }
  const file = `${pretName(name)}.wav`;
  await writeFile(path, plainWave(await download(`${BASE}/${file}`), file));
  written += 1;
}
console.log(`cries: ${written} written, ${kept} already here`);
