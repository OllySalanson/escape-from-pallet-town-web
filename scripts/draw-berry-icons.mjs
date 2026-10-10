// Draws the berry icons into public/assets/icons.
//
//   node scripts/draw-berry-icons.mjs
//
// 16x16 RGBA on the set's own rules (see ASSET_PROVENANCE.md): the shared
// outline #241f2e and a handful of tones per berry. FireRed draws its berries
// as 24x24 item icons with about twenty pixels of fruit in them, which the
// set's 16x16 cannot hold without resampling, so each berry is redrawn here at
// 16x16 after FireRed's own icon and in FireRed's own colours - read out of
// pret/pokefirered's `graphics/items/icon_palettes/<berry>_berry.pal` - which is
// what tells seven round fruits apart at 3x on the ground: Oran is the blue one
// with the pale cap, Sitrus the yellow one with a leaf, Pecha the peach, Cheri
// the red cherry on its curled stalk, Rawst the pale one under its leaves,
// Chesto the purple-capped acorn and Aspear the yellow pear with grey marks.
//
// The berries are written as character art for the same reason a map is: a
// grid of numbers cannot be looked at.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 16;
const OUT = new URL('../public/assets/icons/', import.meta.url);

const hex = (value) => [
  parseInt(value.slice(0, 2), 16),
  parseInt(value.slice(2, 4), 16),
  parseInt(value.slice(4, 6), 16),
  255,
];

/** Each berry: its own tones, by the letter its rows use. `o` is the set's outline. */
const BERRIES = {
  'oran-berry': {
    tones: { l: '5ad5ff', b: '52a4f6', s: '527bcd', d: '6a6abd', w: 'e6eeff', c: 'bdc5ff', g: '9ca4bd' },
    rows: [
      '................',
      '.......ooo......',
      '......owcgo.....',
      '....ooocggooo...',
      '...olllbbbbbbo..',
      '..ollbbbbbbbbso.',
      '.ollbbbbdbbbbso.',
      '.olbbbbbbbbbbso.',
      '.olbbdbbbbbbdso.',
      '.obbbbbbbbbbsso.',
      '.obbbbbbbdbbsso.',
      '.osbbbbbbbbssso.',
      '..osbbbbbbssso..',
      '...osssssssso...',
      '....oooooooo....',
      '................',
    ],
  },
  'sitrus-berry': {
    tones: { l: 'ffee6a', b: 'eed55a', s: 'd5b44a', d: '8b7339', g: '6ad55a', G: '52834a', t: 'ac7331' },
    rows: [
      '..........oo....',
      '.........oggo...',
      '........ogGGo...',
      '.....oooGGto....',
      '...oollllbtoo...',
      '..ollllbbbbbso..',
      '..olldbbbbdbso..',
      '.ollbbbbbbbbsso.',
      '.olbbbdbbbbbsso.',
      '.obbbbbbbdbbsso.',
      '.obdbbbbbbbbsso.',
      '.obbbbbbdbbssso.',
      '..osbbbbbbssso..',
      '..ossdsssssdso..',
      '...osssssssso...',
      '....oooooooo....',
    ],
  },
  'pecha-berry': {
    tones: { w: 'ffe69c', l: 'ffc59c', b: 'ffb473', s: 'ee9473', S: 'ac5a41', g: '62cd52', G: '317341' },
    rows: [
      '................',
      '................',
      '.....oooooo.....',
      '...oowwwlllloo..',
      '..owwwllllllbo..',
      '.owwllllllllbso.',
      '.owllllllllbbso.',
      'owlllllllllbbsso',
      'ollllllllllbbsso',
      'olllllllllbbbsso',
      'olbbbbbbbbbbssSo',
      '.osbbbbbbbbsssSo',
      '.ogSsssssssssSgo',
      '..oggGGggGGggoo.',
      '...ooooooooooo..',
      '................',
    ],
  },
  'cheri-berry': {
    tones: { h: 'ffdebd', l: 'ff9c8b', b: 'ee6252', s: 'cd5a41', S: 'bd4a31', d: '834131', g: 'd5f67b', G: 'a4e673', v: '7bbd4a', V: '296a08' },
    rows: [
      '.....oooo.......',
      '....oggGVo......',
      '...ogVooGVo.....',
      '...oGo..oGVo..o.',
      '...oGVooGVo..oGo',
      '....oGGVVo..oGVo',
      '.....oGVo..oGVo.',
      '...ooooVoooGVo..',
      '..ollbbbboVVo...',
      '.olhlbbbbbsoGo..',
      '.ollbbbbbbsoGVo.',
      '.obbbbbbbbsSoGVo',
      '.obbbbbbbssSooGo',
      '..osbbbsssSo..o.',
      '..ooSSSSSSdo....',
      '....oooooo......',
    ],
  },
  'rawst-berry': {
    tones: { w: '94e6e6', l: '94d5d5', b: '8bb4d5', s: '8394ac', S: '625a7b', g: '5ad552', G: '419c41', V: '316a41' },
    rows: [
      '................',
      '....oo....oo....',
      '...ogGo..oGgo...',
      '..ogGGVooVGGgo..',
      '..oGgGGVVGGgGo..',
      '.ogGoGGgGGGoGVo.',
      '.oGooGVGgVGoooo.',
      '.oo.ooGVVGooo...',
      '...owwoVVowlo...',
      '..owwlloolllso..',
      '.owllllllllsso..',
      '.olllllllllssSo.',
      '.obllllllllsSSo.',
      '..obbbbbbbsSSo..',
      '...ooSSSSSSoo...',
      '.....oooooo.....',
    ],
  },
  'chesto-berry': {
    tones: { l: 'cd94ff', b: '9473e6', p: '835acd', s: '625aac', S: '39417b', y: 'eed56a', Y: 'c5b46a', t: 'acac6a', d: '7b5a4a' },
    rows: [
      '.......oo.......',
      '......opso......',
      '....oooppooo....',
      '...ollbbbbpso...',
      '..ollbbbbbbpso..',
      '.ollbbbbbbbbpso.',
      '.olbbbbbbbbbpso.',
      '.olbbbbbbbbppSo.',
      '.ospbbbbbpppSSo.',
      '.oSspppppppSSSo.',
      '.odyyyyyyyyYYdo.',
      '.oyyyYyyyYyYttdo',
      '.oyYyyyyYyyyttdo',
      '..oyyyyyyyYttdo.',
      '...odtttttttdo..',
      '....ooooooooo...',
    ],
  },
  'aspear-berry': {
    tones: { w: 'ffff6a', l: 'f6e652', b: 'e6d55a', s: 'cdb44a', m: 'acc5b4', M: '839483', t: '837341' },
    rows: [
      '.........oo.....',
      '........oto.....',
      '......ooto......',
      '.....owwloo.....',
      '....owwllbbo....',
      '...owwlmmlbso...',
      '...owlmlMlbso...',
      '..owllmMmlbsso..',
      '..owllllllbsso..',
      '.owlmmlllmmbsso.',
      '.owmlMlllmMlsso.',
      '.olllmlllllmsso.',
      '.olllllmmllbsso.',
      '..osbblmMlbsso..',
      '...ossssssssoo..',
      '....oooooooo....',
    ],
  },
};

const OUTLINE = hex('241f2e');

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function encodePng(width, height, rgba) {
  const chunk = (type, body) => {
    const out = Buffer.alloc(body.length + 12);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'ascii');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, { tones, rows }] of Object.entries(BERRIES)) {
  if (rows.length !== SIZE) throw new Error(`${name}: expected ${SIZE} rows, got ${rows.length}`);
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(`${name}: row ${y} is ${row.length} wide: "${row}"`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const colour = ch === 'o' ? OUTLINE : tones[ch] ? hex(tones[ch]) : null;
      if (!colour) throw new Error(`${name}: no colour "${ch}"`);
      Buffer.from(colour).copy(rgba, (y * SIZE + x) * 4);
    });
  });
  writeFileSync(new URL(`${name}.png`, OUT), encodePng(SIZE, SIZE, rgba));
}
console.log(`drew ${Object.keys(BERRIES).length} berry icons`);
