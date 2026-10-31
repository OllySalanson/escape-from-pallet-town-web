import { describe, expect, it } from 'vitest';
import { ARRIVAL_CLOUD_MS, ARRIVAL_FALL_FROM_MS, ARRIVAL_FALL_MS, ARRIVAL_MS, DUST_MS, TOUCH_DOWN_MS, arrivalPose, cleanLandingLine, dustAt, isCleanLanding, landingRing } from '../world/raidArrival';
import {
  DIVE_MS,
  FALL_MS,
  HOP_MS,
  JUMP_MS,
  PARTNER_LAG_MS,
  PUFF_RADII,
  PURSUER_FROM_MS,
  TURN_BACK_MS,
  fallFacing,
  fallerAt,
  facingTowards,
  jumpPose,
  overTheFence,
  partnerLeap,
  puffsAt,
  pursuerAt,
  windAt,
  steered,
} from './arenaDive';

const over = { x: 0, y: -1 };

describe('the hunter comes over the rail after them', () => {
  const screens = [[320, 240], [400, 256]] as const;
  /** How long a figure is falling before the cloud starts to come in. */
  const clearOfTheCloud = FALL_MS + DIVE_MS * 0.74;

  it('is not there until the two of them have settled, and comes in from over the top of the screen', () => {
    expect(pursuerAt(PURSUER_FROM_MS - 1, 320, 240)).toBeNull();
    expect(pursuerAt(PURSUER_FROM_MS, 320, 240)!.y).toBeLessThan(-16);
  });

  it('is seen on every screen, hanging clear of them both, and is gone before the cloud shuts', () => {
    for (const [width, height] of screens) {
      const seen: { x: number; y: number }[] = [];
      for (let ms = 0; ms < FALL_MS + DIVE_MS; ms += 20) {
        const at = pursuerAt(ms, width, height);
        if (at) {
          expect(ms).toBeLessThan(clearOfTheCloud);
          seen.push(at);
        }
      }
      const inView = seen.filter((at) => at.y > 0 && at.y < height && at.x > 0 && at.x < width);
      expect(inView.length * 20).toBeGreaterThan(450);
      // Over the player's shoulder when it hangs, not on top of them.
      const hanging = pursuerAt(PURSUER_FROM_MS + 500, width, height)!;
      expect(hanging.y + 32).toBeLessThan(height / 2 - 12);
      expect(hanging.x + 32).toBeLessThan(width);
    }
  });

  it('goes on down past them, off the bottom of the screen', () => {
    for (const [width, height] of screens) {
      const last = [...Array(200).keys()].map((step) => pursuerAt(step * 20, width, height)).filter(Boolean).at(-1)!;
      expect(last.y).toBeGreaterThan(height - 20);
    }
  });

  it('moves in whole pixels', () => {
    for (let ms = PURSUER_FROM_MS; ms < FALL_MS + DIVE_MS; ms += 13) {
      const at = pursuerAt(ms, 320, 240);
      if (at) {
        expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true);
      }
    }
  });
});

describe('over the fence and down', () => {
  it('starts with the view on its way back to the figure, which has not moved', () => {
    const start = jumpPose(0, over);
    expect(start.figure).toMatchObject({ falling: false, seen: true });
    expect(Math.abs(start.figure.x) + Math.abs(start.figure.y)).toBe(0);
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

  it('keeps the figure in sight until the cloud has the whole screen', () => {
    for (let ms = 0; ms < JUMP_MS; ms += 20) {
      const pose = jumpPose(ms, over);
      expect(pose.figure.seen).toBe(pose.cloud < 1);
    }
    expect(jumpPose(TURN_BACK_MS + HOP_MS - 1, over).figure.falling).toBe(false);
    expect(jumpPose(TURN_BACK_MS + HOP_MS, over).figure.falling).toBe(true);
    // The cloud comes last: the first of the dive is the hall going past.
    expect(jumpPose(TURN_BACK_MS + HOP_MS + FALL_MS + DIVE_MS / 2, over).cloud).toBe(0);
  });

  it('goes in on the place, and ends with nothing but cloud', () => {
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

describe('falling', () => {
  it('sends the partner after the player, a beat behind, by way of the same place', () => {
    const from = { x: 100, y: 200 };
    const to = { x: 120, y: 160 };
    expect(partnerLeap(TURN_BACK_MS + PARTNER_LAG_MS, from, to)).toEqual({ ...from, falling: false });
    expect(partnerLeap(TURN_BACK_MS + PARTNER_LAG_MS + HOP_MS / 2, from, to).y).toBeLessThan(180);
    expect(partnerLeap(TURN_BACK_MS + PARTNER_LAG_MS + HOP_MS, from, to)).toEqual({ ...to, falling: true });
  });

  it('turns a falling figure through all four of its sides, and two of them out of step', () => {
    const sides = new Set(Array.from({ length: 8 }, (_each, step) => fallFacing(step * 95)));
    expect(sides).toEqual(new Set(['down', 'left', 'up', 'right']));
    expect(fallFacing(0, 1)).not.toBe(fallFacing(0));
  });

  it('brings a figure from where it left the rail to its place, always on whole pixels', () => {
    const start = { x: 10, y: 20 };
    const place = { x: 200, y: 120 };
    expect(fallerAt(0, start, place)).toEqual(start);
    for (let ms = 600; ms < 2000; ms += 17) {
      const at = fallerAt(ms, start, place);
      expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true);
      expect(Math.abs(at.x - place.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(at.y - place.y)).toBeLessThanOrEqual(2);
    }
  });

  it('tears pieces of cloud past the middle and off the screen, keeping the dive full of them', () => {
    let most = 0;
    for (let dive = 0.1; dive < 0.95; dive += 0.01) {
      const puffs = puffsAt(dive, 400, 256);
      expect(puffs.length).toBeGreaterThan(0);
      most = Math.max(most, puffs.length);
    }
    expect(most).toBeLessThan(10);
    // The oldest of them has got clean off a screen by the time it would stop.
    const big = PUFF_RADII[2];
    const last = puffsAt(0.3 - 0.001, 400, 256).find((puff) => puff.index === 0);
    expect(last?.size).toBe(2);
    expect(Math.hypot(last?.x ?? 0, last?.y ?? 0)).toBeGreaterThan(big);
  });

  it('blows harder as it goes on, and never at all at the rail', () => {
    expect(windAt(500, jumpPose(0, over).wind, 400, 256)).toHaveLength(0);
    const early = windAt(1000, jumpPose(TURN_BACK_MS + HOP_MS + FALL_MS / 2, over).wind, 400, 256);
    const late = windAt(2000, jumpPose(TURN_BACK_MS + HOP_MS + FALL_MS + DIVE_MS * 0.7, over).wind, 400, 256);
    expect(late.length).toBeGreaterThan(early.length);
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

  it('clears the cloud before the figure is down, so the fall can be watched', () => {
    expect(arrivalPose(ARRIVAL_CLOUD_MS).cloud).toBe(0);
    expect(arrivalPose(ARRIVAL_CLOUD_MS).height).toBeGreaterThan(50);
    expect(ARRIVAL_CLOUD_MS).toBeLessThan(ARRIVAL_FALL_FROM_MS + ARRIVAL_FALL_MS);
  });

  it('takes the impact in the knees, whole pixels, and stands up', () => {
    const down = ARRIVAL_FALL_FROM_MS + ARRIVAL_FALL_MS;
    expect(arrivalPose(down - 1).crouch).toBe(0);
    expect(arrivalPose(down).crouch).toBe(2);
    expect(arrivalPose(down + 130).crouch).toBe(1);
    expect(arrivalPose(down + 300).crouch).toBe(0);
  });

  it('brings the partner down a moment after, with a bounce, and it is down by the end', () => {
    const down = ARRIVAL_FALL_FROM_MS + ARRIVAL_FALL_MS;
    expect(arrivalPose(down).partnerLanded).toBe(false);
    expect(arrivalPose(down).partnerHeight).toBeGreaterThan(0);
    let bounced = false;
    for (let ms = down + 131; ms < ARRIVAL_MS; ms += 10) {
      bounced ||= arrivalPose(ms).partnerHeight > 0;
      expect(arrivalPose(ms).partnerHeight).toBeLessThanOrEqual(7);
    }
    expect(bounced).toBe(true);
    expect(arrivalPose(ARRIVAL_MS).partnerHeight).toBe(0);
    expect(arrivalPose(ARRIVAL_MS).partnerLanded).toBe(true);
  });

  it('throws out a ring of dust that thins and settles while the player waits', () => {
    const early = dustAt(10);
    const late = dustAt(DUST_MS - 10);
    expect(early.length).toBeGreaterThan(8);
    expect(early[0].size).toBeGreaterThan(late[0].size);
    expect(Math.max(...late.map((puff) => Math.abs(puff.x)))).toBeGreaterThan(Math.max(...early.map((puff) => Math.abs(puff.x))));
    // Flattened by the slant of the view: wider than it is tall.
    expect(Math.max(...late.map((puff) => Math.abs(puff.x)))).toBeGreaterThan(Math.max(...late.map((puff) => Math.abs(puff.y))));
    expect(dustAt(DUST_MS)).toEqual([]);
    expect(DUST_MS).toBeLessThanOrEqual(ARRIVAL_MS - ARRIVAL_FALL_FROM_MS - ARRIVAL_FALL_MS);
  });
});

describe('sticking the landing', () => {
  it('is pressed as the ring shuts, and the ring is ripe exactly then', () => {
    expect(isCleanLanding(TOUCH_DOWN_MS)).toBe(true);
    expect(isCleanLanding(TOUCH_DOWN_MS - 100)).toBe(true);
    expect(isCleanLanding(TOUCH_DOWN_MS + 80)).toBe(true);
    expect(isCleanLanding(TOUCH_DOWN_MS - 300)).toBe(false);
    expect(isCleanLanding(TOUCH_DOWN_MS + 200)).toBe(false);
    for (let ms = 0; ms <= TOUCH_DOWN_MS; ms += 10) {
      const ring = landingRing(ms);
      if (ring) {
        expect(ring.ripe).toBe(isCleanLanding(ms));
      }
    }
  });

  it('closes on the tile, on whole pixels, and is gone by touch down', () => {
    const early = landingRing(200)!;
    const late = landingRing(TOUCH_DOWN_MS - 20)!;
    expect(late.across).toBeLessThan(early.across);
    expect(Number.isInteger(early.across)).toBe(true);
    expect(landingRing(TOUCH_DOWN_MS + 1)).toBeNull();
    expect(landingRing(0)).toBeNull();
  });

  it('takes no longer than any other landing, and a miss is exactly any other landing', () => {
    expect(arrivalPose(ARRIVAL_MS, false).landed).toBe(arrivalPose(ARRIVAL_MS, true).landed);
    for (let ms = 0; ms <= TOUCH_DOWN_MS - 1; ms += 40) {
      expect(arrivalPose(ms, true).height).toBe(arrivalPose(ms, false).height);
    }
    expect(arrivalPose(TOUCH_DOWN_MS + 20).crouch).toBeGreaterThan(0);
    expect(arrivalPose(TOUCH_DOWN_MS + 20, true).crouch).toBe(0);
    const wide = (clean: boolean): number => Math.max(...dustAt(200, clean).map((puff) => Math.abs(puff.x)));
    expect(wide(true)).toBeGreaterThan(wide(false));
    expect(dustAt(200)).toEqual(dustAt(200, false));
  });

  it('says how many are running, once there is a run', () => {
    expect(cleanLandingLine(1)).toBe('CLEAN LANDING');
    expect(cleanLandingLine(4)).toBe('CLEAN LANDING x4');
  });
});

describe('steering the fall', () => {
  it('drifts towards the keys held, and comes back when they are let go', () => {
    let steer = { x: 0, y: 0 };
    for (let frame = 0; frame < 30; frame += 1) {
      steer = steered(steer, { x: 1, y: -1 }, 16);
    }
    expect(steer.x).toBeGreaterThan(20);
    expect(steer.y).toBeLessThan(-10);
    for (let frame = 0; frame < 60; frame += 1) {
      steer = steered(steer, { x: 0, y: 0 }, 16);
    }
    expect(Math.abs(steer.x)).toBeLessThan(1);
  });
});
