import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS } from '../items';
import { ICON_NAMES, ICON_SIZE, ITEM_ICONS, iconMarkup, itemIcon, objectiveIcon } from './icons';

const ICON_ROOT = new URL('../../../public/assets/icons/', import.meta.url);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const readPngSize = (bytes: Buffer): { width: number; height: number } => {
  expect(bytes.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

describe('pixel icon assets', () => {
  it('ships every named icon as a PNG at the one authored size', async () => {
    for (const name of ICON_NAMES) {
      const bytes = await readFile(new URL(`${name}.png`, ICON_ROOT)).catch(() => null);

      expect(bytes, `missing icons/${name}.png`).not.toBeNull();
      // Every icon is one tile square. A marker drawn at the centre of a tile
      // then lands on whole pixels, and a menu box that is a whole multiple of
      // 16 never resamples the art. A replacement has to match.
      expect(readPngSize(bytes!), `icons/${name}.png`).toEqual({
        width: ICON_SIZE,
        height: ICON_SIZE,
      });
    }
  });

  it('keeps the icon directory free of anything the loader does not request', async () => {
    const entries = await readdir(ICON_ROOT);

    expect(entries.sort()).toEqual([...ICON_NAMES].map((name) => `${name}.png`).sort());
  });

  it('gives every bag item an icon of its own rather than one shared glyph', () => {
    for (const item of ITEM_DEFINITIONS) {
      expect(ITEM_ICONS, `no icon named for ${item.id}`).toHaveProperty(item.id);
    }

    const drawn = ITEM_DEFINITIONS.map((item) => itemIcon(item.id, item.displayName));
    expect(new Set(drawn).size, 'two items share an icon').toBe(ITEM_DEFINITIONS.length);
  });

  it('falls back to a real icon rather than an empty slot for an unknown item', () => {
    expect(itemIcon('not-an-item', 'Mystery')).toContain('/assets/icons/supply-crate.png');
  });

  it('marks the icon decorative and leaves the name to a screen reader', () => {
    const markup = iconMarkup('potion', 'Potion');

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('<span class="visually-hidden">Potion</span>');
    expect(objectiveIcon()).toContain('/assets/icons/field-kit.png');
  });

  it('has no scene left drawing an item as a text glyph', async () => {
    const scenes = new URL('../scenes/', import.meta.url);
    for (const entry of await readdir(scenes)) {
      if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) {
        continue;
      }
      const source = await readFile(new URL(entry, scenes), 'utf8');
      expect(source, `${entry} still draws an item with a glyph`).not.toContain('✦');
    }
  });
});
