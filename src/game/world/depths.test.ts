import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  CAPTION_BAND,
  FIGURE_BAND,
  MARKER_BAND,
  TERRAIN_DEPTH,
  WATCH_SHADING_DEPTH,
  atRow,
} from './depths';
import { PLAYER_MARKER_DEPTH } from './characterPresentation';

/** Maps are at most this tall, so a row offset must never reach the next band. */
const TALLEST_MAP_ROWS = 64;

describe('what is drawn over what on the overworld', () => {
  it('puts a caption over the art it explains and under everyone on the map', () => {
    expect(TERRAIN_DEPTH).toBeLessThan(WATCH_SHADING_DEPTH);
    expect(WATCH_SHADING_DEPTH).toBeLessThan(MARKER_BAND);
    expect(MARKER_BAND).toBeLessThan(CAPTION_BAND);
    // The rule the whole finding turns on: writing may never cover a figure,
    // and least of all the player or the hunter.
    expect(CAPTION_BAND).toBeLessThan(FIGURE_BAND);
  });

  it('keeps a whole map of row offsets inside its own band', () => {
    for (const band of [MARKER_BAND, CAPTION_BAND, FIGURE_BAND]) {
      expect(atRow(band, 0)).toBe(band);
      expect(atRow(band, TALLEST_MAP_ROWS)).toBeLessThan(band + 0.1);
    }
    expect(atRow(MARKER_BAND, TALLEST_MAP_ROWS)).toBeLessThan(CAPTION_BAND);
    expect(atRow(CAPTION_BAND, TALLEST_MAP_ROWS)).toBeLessThan(FIGURE_BAND);
    // The player's head chevron clears every figure on the map, which is what
    // keeps the player findable when someone is standing in front of them.
    expect(atRow(FIGURE_BAND, TALLEST_MAP_ROWS)).toBeLessThan(PLAYER_MARKER_DEPTH);
  });

  it('sorts within a band so the southern object is drawn in front', () => {
    expect(atRow(FIGURE_BAND, 9)).toBeLessThan(atRow(FIGURE_BAND, 10));
  });

  it('is the only place the overworld names a depth', async () => {
    const scene = await readFile(new URL('../scenes/WorldScene.ts', import.meta.url), 'utf8');

    // A raw `setDepth(3 + y / 1000)` is how captions ended up above the player
    // in the first place: three call sites, three opinions. Every band in the
    // scene comes from here now, so the rule is changed once or not at all.
    expect(scene).not.toMatch(/setDepth\(\s*\d+(\.\d+)?\s*\+/);
    expect(scene.match(/atRow\(/g)?.length ?? 0).toBeGreaterThan(10);
  });
});
