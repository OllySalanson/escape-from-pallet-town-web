import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BIRD_CROSSING_MS, birdAt } from './harbourBird';

describe('the bird over the harbour', () => {
  const [width, height] = [1024, 544];

  it('comes in from beyond the top right and leaves past the bottom left, the way its art faces', () => {
    const start = birdAt(0, width, height)!;
    const end = birdAt(BIRD_CROSSING_MS, width, height)!;
    expect(start.x).toBeGreaterThan(width);
    expect(end.x).toBeLessThan(0);
    expect(end.y).toBeGreaterThan(start.y);
    let last = start.x;
    for (let ms = 0; ms <= BIRD_CROSSING_MS; ms += 250) {
      const here = birdAt(ms, width, height)!;
      expect(here.x).toBeLessThanOrEqual(last);
      last = here.x;
    }
  });

  it('is nowhere before or after a crossing', () => {
    expect(birdAt(-1, width, height)).toBeNull();
    expect(birdAt(BIRD_CROSSING_MS + 1, width, height)).toBeNull();
  });

  it('is FireRed\'s own Fly bird and shadow, recorded in the provenance file', () => {
    const png = readFileSync(join(__dirname, '../../../public/assets/harbour-bird.png'));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([80, 64]);
    const provenance = readFileSync(join(__dirname, '../../../public/assets/ASSET_PROVENANCE.md'), 'utf8');
    expect(provenance).toContain('harbour-bird.png');
  });
});
