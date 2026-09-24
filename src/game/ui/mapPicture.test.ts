import { describe, expect, it } from 'vitest';
import { WORLD_MAPS } from '../worldMap';
import { largestMapSize } from '../hub/dropIn';
import { mapPictureFrame, planOwnFrame, planSharedRow, shareTracks, PICTURE_RING } from './mapPicture';

const FLOODPLAIN = { width: 128, height: 128 };
const ROUTE_1 = { width: 64, height: 72 };
const PALLET = { width: 64, height: 76 };

describe('one place in a frame sized for the biggest', () => {
  it('sizes the frame by the biggest map, so the screen does not move with the cursor', () => {
    // The drop-in screen at the lobby's usual 592x376: the frame has 270 of
    // height to give, which draws the Floodplain two pixels to the tile.
    const vast = planOwnFrame(FLOODPLAIN, FLOODPLAIN, { width: 400, height: 270 });
    const small = planOwnFrame(ROUTE_1, FLOODPLAIN, { width: 400, height: 270 });
    expect(vast.frame).toEqual({ width: 256 + PICTURE_RING * 2, height: 256 + PICTURE_RING * 2 });
    expect(small.frame).toEqual(vast.frame);
    expect(vast.fit).toEqual({ step: 1, zoom: 2 });
  });

  it('draws a smaller map as big as it goes in that frame', () => {
    // Route 1 is half the Floodplain's width and fits the same frame at three.
    expect(planOwnFrame(ROUTE_1, FLOODPLAIN, { width: 400, height: 270 }).fit).toEqual({ step: 1, zoom: 3 });
  });

  it('draws every shipped map tile for tile in any window the lobby is played in', () => {
    // The banner this replaced drew the Floodplain at two tiles to the pixel.
    // The smallest stage is 320x240 and at it the frame has about 126 pixels
    // of height, which is the one place a map is still condensed.
    const largest = largestMapSize();
    for (const [id, map] of Object.entries(WORLD_MAPS)) {
      expect([id, planOwnFrame(map, largest, { width: 180, height: 180 }).fit.step]).toEqual([id, 1]);
    }
    expect(planOwnFrame(FLOODPLAIN, largest, { width: 131, height: 126 }).fit).toEqual({ step: 2, zoom: 1 });
  });
});

describe('several maps side by side at one scale', () => {
  it('takes the largest scale at which every map fits its own card', () => {
    // Cards shared out by map width: the Floodplain's card is twice the others.
    const row = planSharedRow([
      { size: FLOODPLAIN, room: { width: 270, height: 300 } },
      { size: PALLET, room: { width: 135, height: 300 } },
      { size: ROUTE_1, room: { width: 135, height: 300 } },
    ]);
    expect(row.fit).toEqual({ step: 1, zoom: 2 });
    // One card too narrow for two pixels to the tile brings the whole wall down
    // to one, so the Floodplain is always four times Route 1 on it.
    const cramped = planSharedRow([
      { size: FLOODPLAIN, room: { width: 270, height: 300 } },
      { size: ROUTE_1, room: { width: 120, height: 300 } },
    ]);
    expect(cramped.fit).toEqual({ step: 1, zoom: 1 });
  });

  it('makes every frame as tall as the tallest picture, so the maps stand on one line', () => {
    const row = planSharedRow([
      { size: FLOODPLAIN, room: { width: 140, height: 300 } },
      { size: ROUTE_1, room: { width: 70, height: 300 } },
    ]);
    expect(row.frames.map((frame) => frame.height)).toEqual([130, 130]);
    expect(row.frames.map((frame) => frame.width)).toEqual([130, 66]);
  });

  it('shares a row out by the maps’ widths, in whole pixels, with every pixel spent', () => {
    const tracks = shareTracks(584, [128, 64, 64, 64], 4, 16);
    expect(tracks.every((track) => Number.isInteger(track))).toBe(true);
    expect(tracks.reduce((sum, track) => sum + track, 0) + 4 * 3).toBe(584);
    // The Floodplain's picture gets twice the room of each of the others.
    expect(Math.abs(tracks[0] - 16 - 2 * (tracks[1] - 16))).toBeLessThanOrEqual(2);
  });
});

describe('the markup', () => {
  it('names the picture and its size in tiles, and leaves the pixels to the window', () => {
    const markup = mapPictureFrame({
      key: 'wall:route-1',
      label: 'Route 1, "19%" known',
      size: ROUTE_1,
      mode: 'shared',
    });
    expect(markup).toContain('data-picture="wall:route-1" data-picture-width="64" data-picture-height="72"');
    expect(markup).toContain('data-fit="shared"');
    expect(markup).toContain('aria-label="Route 1, &quot;19%&quot; known"');
    // A span, so it can stand in a button.
    expect(markup.startsWith('<span')).toBe(true);
  });
});
