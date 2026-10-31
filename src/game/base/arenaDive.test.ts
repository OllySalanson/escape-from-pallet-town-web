import { describe, expect, it } from 'vitest';
import { ARRIVAL_MS, arrivalPose } from '../world/raidArrival';
import { JUMP_MS, TURN_BACK_MS, jumpPose, overTheFence, facingTowards } from './arenaDive';

const over = { x: 0, y: -1 };

describe('over the fence and down', () => {
  it('starts with the view on its way back to the figure, which has not moved', () => {
    const start = jumpPose(0, over);
    expect(start.figure).toMatchObject({ x: 0, y: 0, scale: 1, seen: true });
    expect(start.back).toBe(0);
    expect(jumpPose(TURN_BACK_MS, over).back).toBe(1);
    expect(jumpPose(TURN_BACK_MS, over).swing).toBe(0);
  });

  it('goes over the fence the way the fence is, with an arc on the way', () => {
    const halfway = jumpPose(TURN_BACK_MS + 170, over);
    expect(halfway.figure.y).toBeLessThan(0);
    expect(jumpPose(TURN_BACK_MS + 170, { x: 1, y: 0 }).figure.x).toBeGreaterThan(0);
    expect(overTheFence({ x: 5, y: 5 }, { x: 5, y: 4 })).toEqual({ x: 0, y: -1 });
    expect(facingTowards({ x: 5, y: 5 }, { x: 5, y: 4 })).toBe('up');
    expect(facingTowards({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe('right');
  });

  it('loses sight of the figure, goes in on the place, and ends with nothing but cloud', () => {
    const end = jumpPose(JUMP_MS, over);
    expect(end.figure.seen).toBe(false);
    expect(end.swing).toBe(1);
    expect(end.zoom).toBeGreaterThan(4);
    expect(end.cloud).toBe(1);
  });

  it('only ever goes further in, and only ever thickens', () => {
    let zoom = 1;
    let cloud = 0;
    for (let ms = 0; ms <= JUMP_MS; ms += 50) {
      const pose = jumpPose(ms, over);
      expect(pose.zoom).toBeGreaterThanOrEqual(zoom);
      expect(pose.cloud).toBeGreaterThanOrEqual(cloud);
      zoom = pose.zoom;
      cloud = pose.cloud;
    }
  });
});

describe('landing in the raid', () => {
  it('opens under nothing but cloud, with the figure out of sight above its tile', () => {
    const start = arrivalPose(0);
    expect(start.cloud).toBe(1);
    expect(start.height).toBeGreaterThan(100);
    expect(start.landed).toBe(false);
  });

  it('touches down, clear of the cloud, inside what a self-running beat may take', () => {
    const end = arrivalPose(ARRIVAL_MS * 2);
    expect(end.height).toBe(0);
    expect(end.cloud).toBe(0);
    expect(end.landed).toBe(true);
    expect(ARRIVAL_MS).toBeLessThan(2000);
  });
});
