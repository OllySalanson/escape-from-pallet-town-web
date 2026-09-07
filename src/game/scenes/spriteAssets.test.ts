import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { SPECIES_BY_ID } from '../pokemon/species';

const SPRITE_ROOT = new URL('../../../public/assets/pokemon/', import.meta.url);
const SIDES = ['front', 'back'] as const;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads the IHDR dimensions, which is the only thing a renderer needs to size a texture. */
const readPngSize = (bytes: Buffer): { width: number; height: number } => {
  expect(bytes.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

describe('Pokemon sprite assets', () => {
  it('gives every species a front and back PNG with usable intrinsic dimensions', async () => {
    for (const species of Object.values(SPECIES_BY_ID)) {
      for (const side of SIDES) {
        const path = new URL(`${side}/${species.dexId}.png`, SPRITE_ROOT);
        const bytes = await readFile(path).catch(() => null);

        expect(bytes, `${species.name} is missing ${side}/${species.dexId}.png`).not.toBeNull();
        const { width, height } = readPngSize(bytes!);
        // Squirtle shipped as an SVG with a viewBox but no width or height. It
        // rasterised to 150x150 and, drawn at scale 1.55, covered the battle
        // screen as a dark block. Bounding the size catches that class of art.
        expect(width, `${species.name} ${side} width`).toBeGreaterThan(0);
        expect(height, `${species.name} ${side} height`).toBeGreaterThan(0);
        expect(width, `${species.name} ${side} width`).toBeLessThanOrEqual(64);
        expect(height, `${species.name} ${side} height`).toBeLessThanOrEqual(64);
      }
    }
  });

  it('keeps every sprite directory free of formats the loader does not request', async () => {
    for (const side of SIDES) {
      const entries = await readdir(new URL(side, SPRITE_ROOT));

      expect(entries.filter((entry) => !entry.endsWith('.png'))).toEqual([]);
      expect(entries.sort()).toEqual(
        Object.values(SPECIES_BY_ID)
          .map((species) => `${species.dexId}.png`)
          .sort(),
      );
    }
  });

  it('loads sprites by dex id with no per-species file-format exception', async () => {
    const source = await readFile(new URL('./BootScene.ts', import.meta.url), 'utf8');

    expect(source).toContain('`assets/pokemon/front/${species.dexId}.png`');
    expect(source).toContain('`assets/pokemon/back/${species.dexId}.png`');
    expect(source).not.toMatch(/dexId === \d/);
    expect(source).not.toContain('svg');
  });

  it('draws menu avatars from the same PNGs, so no hub screen requests a deleted file', async () => {
    const source = await readFile(new URL('../ui/MenuOverlay.ts', import.meta.url), 'utf8');

    expect(source).toContain('/assets/pokemon/front/${dexId}.png');
    expect(source).not.toMatch(/dexId === \d/);
    expect(source).not.toContain('svg');
  });
});
