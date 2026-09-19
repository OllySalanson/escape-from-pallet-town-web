// Fetches the generation III FireRed/LeafGreen sprite of every one of Kanto's
// original 151, front and back, into `public/assets/pokemon/`.
//
//   node scripts/fetch-pokemon-sprites.mjs [--force]
//
// The seven originals and the ten evolved forms already here came from these
// two directories; this is the same rip of the same generation's art, widened
// to the whole dex, so nothing on a battle screen is drawn in two hands.
// `public/assets/ASSET_PROVENANCE.md` carries the licence question these raise
// - the repository is CC0 and says in its own licence file that the images
// inside it are not - and adding art without an entry there is an incomplete
// change.
//
// Every file is checked as it lands: a PNG signature, and 64x64 or smaller,
// which is the bound `spriteAssets.test.ts` holds the shipped set to.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'public', 'assets', 'pokemon');
const BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/firered-leafgreen';
const SIDES = [
  { side: 'front', url: (dexId) => `${BASE}/${dexId}.png` },
  { side: 'back', url: (dexId) => `${BASE}/back/${dexId}.png` },
];
const force = process.argv.includes('--force');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const download = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status === 404) throw new Error(`no sprite at ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

let written = 0;
let kept = 0;
for (const { side, url } of SIDES) {
  await mkdir(join(root, side), { recursive: true });
  for (let dexId = 1; dexId <= 151; dexId += 1) {
    const path = join(root, side, `${dexId}.png`);
    if (!force && (await access(path).then(() => true, () => false))) {
      kept += 1;
      continue;
    }
    const bytes = await download(url(dexId));
    if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${side}/${dexId}.png is not a PNG`);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width > 64 || height > 64) throw new Error(`${side}/${dexId}.png is ${width}x${height}`);
    await writeFile(path, bytes);
    written += 1;
  }
}
process.stderr.write(`${written} written, ${kept} already here\n`);
