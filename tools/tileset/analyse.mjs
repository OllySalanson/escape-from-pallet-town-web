/**
 * Prune before you name.
 *
 * 1440 slots is not 1440 tiles. Most of a sheet this size is empty, and a good
 * many of the rest are the same tile drawn twice. Grouping by content first is
 * what makes cataloguing the distinct set by hand a day's work rather than a
 * week's, and it is what stops the catalogue claiming a tile that is really a
 * duplicate of one already named.
 *
 *   node tools/tileset/analyse.mjs public/assets/Overworld.png
 */
import { readPng, tileBytes, tileCount, tileHash, TILE_SIZE } from './tileSheet.mjs';

const path = process.argv[2] ?? 'public/assets/Overworld.png';
const sheet = readPng(path);
const columns = sheet.width / TILE_SIZE;
const total = tileCount(sheet);

const groups = new Map();
let blank = 0;
const blankIndices = [];
for (let index = 0; index < total; index += 1) {
  const bytes = tileBytes(sheet, index);
  let opaque = 0;
  for (let i = 3; i < bytes.length; i += 4) if (bytes[i] > 0) opaque += 1;
  if (opaque === 0) {
    blank += 1;
    blankIndices.push(index);
    continue;
  }
  const hash = tileHash(bytes);
  const group = groups.get(hash);
  if (group) {
    group.indices.push(index);
  } else {
    groups.set(hash, { indices: [index], opaque });
  }
}

const duplicated = [...groups.values()].filter((group) => group.indices.length > 1);
const distinct = groups.size;

console.log(`sheet      ${path}  ${sheet.width}x${sheet.height}  ${columns} columns`);
console.log(`slots      ${total}`);
console.log(`blank      ${blank}`);
console.log(`non-blank  ${total - blank}`);
console.log(`distinct   ${distinct}`);
console.log(`duplicate groups ${duplicated.length}, covering ${duplicated.reduce((n, g) => n + g.indices.length, 0)} slots`);
console.log('');
console.log('largest duplicate groups (a repeat is usually a fill tile stamped across a structure):');
for (const group of duplicated.sort((a, b) => b.indices.length - a.indices.length).slice(0, 12)) {
  console.log(`  x${String(group.indices.length).padStart(3)}  first ${group.indices[0]}  [${group.indices.slice(0, 10).join(' ')}${group.indices.length > 10 ? ' ...' : ''}]`);
}

// Which rows carry anything at all: the quickest read on where content lives.
console.log('');
console.log('content by row (non-blank slots of 40):');
const rows = sheet.height / TILE_SIZE;
for (let row = 0; row < rows; row += 1) {
  let filled = 0;
  for (let column = 0; column < columns; column += 1) {
    if (!blankIndices.includes(row * columns + column)) filled += 1;
  }
  const bar = '#'.repeat(filled) + '.'.repeat(columns - filled);
  console.log(`  ${String(row).padStart(2)} ${bar} ${filled}`);
}
