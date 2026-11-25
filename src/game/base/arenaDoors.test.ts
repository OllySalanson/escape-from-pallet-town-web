import { describe, expect, it } from 'vitest';
import {
  DOOR_FRAMES,
  DOOR_LIGHT_ORIGIN,
  DOORS_OPEN_MS,
  doorFrameAt,
  doorsBar,
  doorsOpenShare,
  doorsWelcome,
  paintDoorLight,
  paintDoors,
  paintDoorStrip,
} from './arenaDoors';
import { crowdShare } from './arenaCrowd';
import { ARENA_DOOR, ARENA_DOOR_STEP, DOOR_OPENING, inDoorOpening } from './arenaHall';

const inked = (picture: { readonly data: Uint8ClampedArray }, at: number): boolean => picture.data[at * 4 + 3] > 0;

describe("THE RAID ARENA's great doors", () => {
  it('swing from shut to open in a little over two steps, never back, and come to rest', () => {
    expect(doorsOpenShare(0)).toBe(0);
    expect(doorsOpenShare(DOORS_OPEN_MS)).toBe(1);
    expect(doorsOpenShare(DOORS_OPEN_MS * 5)).toBe(1);
    let last = 0;
    for (let ms = 0; ms <= DOORS_OPEN_MS; ms += 10) {
      const share = doorsOpenShare(ms);
      expect(share).toBeGreaterThanOrEqual(last);
      last = share;
    }
    // Heavy to start: the first tenth of the time moves them less than a tenth of the way.
    expect(doorsOpenShare(DOORS_OPEN_MS / 10)).toBeLessThan(0.1);
    expect(DOORS_OPEN_MS).toBeLessThanOrEqual(700);
  });

  it('draws every step of the swing, shut first and open last', () => {
    expect(doorFrameAt(0)).toBe(0);
    expect(doorFrameAt(1)).toBe(DOOR_FRAMES - 1);
    expect(doorFrameAt(2)).toBe(DOOR_FRAMES - 1);
    const strip = paintDoorStrip();
    expect(strip.width).toBe(DOOR_OPENING.width * DOOR_FRAMES);
    expect(strip.height).toBe(DOOR_OPENING.height);
  });

  it('fill their opening exactly when shut, and leave it all but clear when open', () => {
    const { width, height, left, top } = DOOR_OPENING;
    const shut = paintDoors(0);
    const open = paintDoors(1);
    let openInk = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = y * width + x;
        expect(inked(shut, at), `${x},${y}`).toBe(inDoorOpening(left + x, top + y));
        openInk += inked(open, at) ? 1 : 0;
      }
    }
    // Back against the jambs, the edge of each leaf and no more.
    expect(openInk).toBeGreaterThan(0);
    expect(openInk).toBeLessThan(width * height * 0.2);
  });

  it('stand across the way through only while shut', () => {
    for (let y = ARENA_DOOR.top; y <= ARENA_DOOR.bottom; y += 1) {
      for (let x = ARENA_DOOR.left; x <= ARENA_DOOR.right; x += 1) {
        expect(doorsBar({ x, y }, false)).toBe(true);
        expect(doorsBar({ x, y }, true)).toBe(false);
      }
    }
    expect(doorsBar(ARENA_DOOR_STEP, false)).toBe(false);
  });

  it('open on a welcome the player has earned: hands for a newcomer, more for every raid brought home', () => {
    expect(doorsWelcome(crowdShare(undefined))).toBe('clap');
    const moods = ['clap', 'cheer', 'roar'];
    let last = 0;
    for (let out = 0; out <= 30; out += 1) {
      const mood = doorsWelcome(crowdShare({ 'greystone-vale': { deployed: out, extracted: out, wiped: 0 } }));
      expect(moods.indexOf(mood)).toBeGreaterThanOrEqual(last);
      last = moods.indexOf(mood);
    }
    expect(last).toBe(2);
  });

  it('throw the hall\'s light through the opening and out across the floor, never up the wall beside them', () => {
    const light = paintDoorLight();
    let onTheFloor = 0;
    for (let y = 0; y < light.height; y += 1) {
      for (let x = 0; x < light.width; x += 1) {
        if (!inked(light, y * light.width + x)) {
          continue;
        }
        const hallX = DOOR_LIGHT_ORIGIN.x + x;
        const hallY = DOOR_LIGHT_ORIGIN.y + y;
        if (hallY < DOOR_OPENING.top + DOOR_OPENING.height) {
          expect(inDoorOpening(hallX, hallY), `${hallX},${hallY}`).toBe(true);
        } else {
          onTheFloor += 1;
        }
      }
    }
    expect(onTheFloor).toBeGreaterThan(200);
  });
});
