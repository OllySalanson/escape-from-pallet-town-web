import { describe, expect, it } from 'vitest';
import { decodeSurvey, encodeSurvey, mergeSurvey, surveyedTiles } from './survey';

describe('the survey a raid leaves behind', () => {
  it('carries a set of tiles through a save and back', () => {
    const tiles = new Set([0, 1, 7, 8, 63, 64, 4095]);
    const record = encodeSurvey(64, tiles);

    expect(decodeSurvey(record)).toEqual({ width: 64, tiles });
  });

  it('is small enough to live in a save: a whole map is under a kilobyte', () => {
    // Every walkable tile of the Floodplain, which is the worst case there is.
    const everything = new Set<number>();
    for (let index = 0; index < 64 * 64; index += 1) {
      everything.add(index);
    }
    // 4096 bits is 512 bytes, and base64 is four characters to three bytes.
    expect(encodeSurvey(64, everything).tiles.length).toBeLessThan(1024);
  });

  it('reads back nothing at all from a save that was written before it existed', () => {
    expect(surveyedTiles(undefined, 32)).toEqual(new Set());
    expect(decodeSurvey(undefined)).toEqual({ width: 0, tiles: new Set() });
  });

  it('reads a redrawn map at the width it was surveyed at, and clips the rest', () => {
    // Row 1 of a 10-wide map: tiles 10..19. Redrawn 8 wide, the two tiles past
    // the new edge are gone and the other eight stand where they stood.
    const record = encodeSurvey(10, new Set([10, 11, 17, 18, 19]));

    expect([...surveyedTiles(record, 8)].sort((a, b) => a - b)).toEqual([8, 9, 15]);
  });

  it('adds a raid to what the save already held rather than replacing it', () => {
    const first = encodeSurvey(16, new Set([1, 2, 3]));
    const merged = mergeSurvey(first, 16, [3, 4, 5]);

    expect([...decodeSurvey(merged).tiles].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('survives a survey that is not base64 at all rather than throwing', () => {
    expect(decodeSurvey({ width: 8, tiles: 'not really base64!!' }).width).toBe(8);
  });
});
