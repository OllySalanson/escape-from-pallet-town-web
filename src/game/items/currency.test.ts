import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { TRADER_STANDINGS } from '../hub/trader';
import { POKEDOLLAR_SIGN } from '../ui/gameFont';
import {
  CURRENCY_ITEM_ID,
  currentItemId,
  formatMoney,
  getItemById,
  itemAmountFor,
  itemCountTag,
  itemNameFor,
} from './items';

/**
 * The money is the Pokedollar (the captain, 2026-09-23: "why are we using
 * scrip ... what do they use in pokemon"), and an amount of it is written the
 * way those games write one. These hold the name, the sign, and the one thing a
 * rename can silently get wrong: a word left behind on some screen.
 */
describe('the Pokedollar', () => {
  it('is the money, and an amount of it is a sum with the sign in front', () => {
    expect(POKEDOLLAR_SIGN).toBe('₽');
    expect(getItemById(CURRENCY_ITEM_ID)?.displayName).toBe('Pokedollars');
    expect(formatMoney(40)).toBe('₽40');
    expect(itemAmountFor(CURRENCY_ITEM_ID, 40)).toBe('₽40');
    expect(itemCountTag(CURRENCY_ITEM_ID, 250)).toBe('₽250');
    // Money is a mass noun; everything else is still counted.
    expect(itemNameFor(CURRENCY_ITEM_ID, 40)).toBe('Pokedollars');
    expect(itemAmountFor('potion', 3)).toBe('3 Potions');
    expect(itemAmountFor('potion', 1)).toBe('1 Potion');
    expect(itemCountTag('potion', 3)).toBe('×3');
  });

  it('answers to its old name when a save still uses it', () => {
    expect(currentItemId('scrip')).toBe(CURRENCY_ITEM_ID);
    expect(currentItemId('potion')).toBe('potion');
  });

  it('leaves no "scrip" anywhere a player could read it', async () => {
    // Every string in the game's own source, with comments taken out. What is
    // left that may still say it is the migration that reads old saves, which
    // no player ever sees.
    const root = new URL('../../', import.meta.url);
    const files = (await readdir(root, { recursive: true })).filter(
      (file) => /\.(ts|css)$/.test(file) && !file.endsWith('.test.ts'),
    );
    const offenders: string[] = [];
    for (const file of files) {
      const code = (await readFile(new URL(file, root), 'utf8'))
        .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
        .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
      code.split('\n').forEach((line, index) => {
        if (/\bscrip\b/i.test(line) && !/^\s*scrip: 'money',$/.test(line)) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    const html = await readFile(new URL('../index.html', root), 'utf8');
    if (/\bscrip\b/i.test(html)) {
      offenders.push('index.html');
    }

    expect(offenders).toEqual([]);
    expect(TRADER_STANDINGS.map((standing) => standing.note).join(' ')).not.toMatch(/scrip/i);
  });
});

/**
 * Orange Kid has no glyph for the sign, so the game ships its own one-glyph face
 * in the same family. What matters is that it covers the sign, is declared for
 * that sign only, is fetched with the document, and does not make a line with a
 * price in it any taller than one without.
 */
describe('the Pokedollar glyph', () => {
  const fontFile = new URL('../../../public/assets/battle/pokedollar.ttf', import.meta.url);

  const tables = (font: Buffer): Map<string, Buffer> => {
    const count = font.readUInt16BE(4);
    const found = new Map<string, Buffer>();
    for (let index = 0; index < count; index += 1) {
      const entry = 12 + index * 16;
      const offset = font.readUInt32BE(entry + 8);
      found.set(font.toString('ascii', entry, entry + 4), font.subarray(offset, offset + font.readUInt32BE(entry + 12)));
    }
    return found;
  };

  it('maps U+20BD to a drawn glyph, on Orange Kid\'s own vertical metrics', async () => {
    const font = await readFile(fontFile);
    const table = tables(font);
    const cmap = table.get('cmap')!;
    const format4 = cmap.subarray(cmap.readUInt32BE(8));
    const segments = format4.readUInt16BE(6) / 2;
    const ends = Array.from({ length: segments }, (_, i) => format4.readUInt16BE(14 + i * 2));
    const starts = Array.from({ length: segments }, (_, i) => format4.readUInt16BE(16 + segments * 2 + i * 2));
    const deltas = Array.from({ length: segments }, (_, i) => format4.readInt16BE(16 + segments * 4 + i * 2));
    const segment = ends.findIndex((end, i) => starts[i] <= 0x20bd && end >= 0x20bd);
    expect(segment).toBeGreaterThanOrEqual(0);
    expect((0x20bd + deltas[segment]) & 0xffff).toBe(1);
    // Glyph 1 has contours: it is drawn, not a blank that would print a gap.
    expect(table.get('glyf')!.readInt16BE(0)).toBeGreaterThan(0);

    const hhea = table.get('hhea')!;
    expect([hhea.readInt16BE(4), hhea.readInt16BE(6), hhea.readInt16BE(8)]).toEqual([978, -222, 0]);
    const os2 = table.get('OS/2')!;
    expect([os2.readUInt16BE(74), os2.readUInt16BE(76)]).toEqual([978, 222]);
    expect(table.get('head')!.readUInt16BE(18)).toBe(1000);
  });

  it('joins the game family for the sign alone, and is fetched with the document', async () => {
    const [css, html] = await Promise.all([
      readFile(new URL('../../style.css', import.meta.url), 'utf8'),
      readFile(new URL('../../../index.html', import.meta.url), 'utf8'),
    ]);
    const face = css.match(/@font-face\s*\{[^}]*pokedollar\.ttf[^}]*\}/)?.[0] ?? '';
    expect(face).toContain("font-family: 'Orange Kid'");
    expect(face).toContain('unicode-range: U+20BD;');
    expect(html).toMatch(/rel="preload"[\s\S]*pokedollar\.ttf/);
  });
});
