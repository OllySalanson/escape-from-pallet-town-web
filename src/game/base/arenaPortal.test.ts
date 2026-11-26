import { describe, expect, it } from 'vitest';
import { acrossOval } from './arenaHall';
import {
  AIM_HOP_MS,
  PORTAL_CLOSE_MS,
  PORTAL_FOOT_ROOM,
  PORTAL_OPEN_MS,
  aimHopAt,
  cutPortalFloor,
  paintPortalRing,
  portalDiveScales,
  portalFloorSquare,
  portalHopAt,
  portalOpenPose,
  portalPlace,
  portalPointOfFloor,
  portalShapeFor,
  portalStance,
} from './arenaPortal';

const alphaAt = (picture: { width: number; data: Uint8ClampedArray }, x: number, y: number): number => picture.data[(y * picture.width + x) * 4 + 3];

describe('the portal: the pit seen whole', () => {
  it('fits the room the card leaves, the player stood under it, and refuses a room too small to read', () => {
    // A 400x240 screen with the card down its right.
    const region = { left: 0, top: 0, width: 253, height: 240 };
    const shape = portalShapeFor(region)!;
    const place = portalPlace(shape, region);
    expect(shape.width).toBeLessThanOrEqual(region.width);
    expect(place.x).toBeGreaterThanOrEqual(region.left);
    expect(place.x + shape.width).toBeLessThanOrEqual(region.left + region.width);
    expect(place.y).toBeGreaterThanOrEqual(region.top);
    expect(place.y + shape.height + PORTAL_FOOT_ROOM).toBeLessThanOrEqual(region.top + region.height);
    // Big enough that the map in it is worth looking at.
    expect(shape.hole.rx * 2).toBeGreaterThan(150);
    expect(portalShapeFor({ left: 0, top: 0, width: 400, height: 90 })).toBeNull();
    // Whole pixels, and its middle on one.
    expect(Number.isInteger(place.x) && Number.isInteger(place.y) && shape.width % 2 === 0).toBe(true);
  });

  it('shows the whole map in its hole, with cloud round it', () => {
    const shape = portalShapeFor({ left: 0, top: 0, width: 253, height: 240 })!;
    const square = portalFloorSquare(1024, 384);
    expect(square.width).toBeGreaterThan(384);
    expect(square.left + square.width / 2).toBe(512);
    // The map's middle is the hole's middle, and every edge of the map is inside the hole.
    const middle = portalPointOfFloor({ x: 512, y: 512 }, square, shape);
    expect(Math.abs(middle.x - shape.hole.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(middle.y - shape.hole.y)).toBeLessThanOrEqual(1);
    for (const [x, y] of [[320, 512], [703, 512], [512, 320], [512, 703]]) {
      const at = portalPointOfFloor({ x, y }, square, shape);
      expect(acrossOval(shape.hole, at.x, at.y)).toBeLessThan(1);
    }
  });

  it('paints a ring with the hole open, and a floor only in the hole', () => {
    const shape = portalShapeFor({ left: 0, top: 0, width: 200, height: 200 })!;
    const ring = paintPortalRing(shape);
    expect(alphaAt(ring, Math.round(shape.hole.x), Math.round(shape.hole.y))).toBe(0);
    expect(alphaAt(ring, Math.round(shape.rim.x), Math.round(shape.rim.y - shape.rim.ry + 1))).toBe(255);
    expect(alphaAt(ring, 0, 0)).toBe(0);
    const size = { width: Math.round(shape.hole.rx * 2), height: Math.round(shape.hole.ry * 2) };
    const condensed = { ...size, data: new Uint8ClampedArray(size.width * size.height * 4).fill(200) };
    const floor = cutPortalFloor(condensed, shape);
    expect(alphaAt(floor, Math.round(shape.hole.x), Math.round(shape.hole.y))).toBe(255);
    expect(alphaAt(floor, Math.round(shape.rim.x), Math.round(shape.rim.y - shape.rim.ry + 1))).toBe(0);
  });

  it('stands the player on the edge nearest where they stand round the pit', () => {
    const shape = portalShapeFor({ left: 0, top: 0, width: 253, height: 240 })!;
    const pit = { x: 568, y: 528 };
    const south = portalStance(shape, pit, { x: 568, y: 900 });
    expect(south.y).toBeGreaterThan(shape.rim.y + shape.rim.ry - 1);
    expect(Math.abs(south.x - shape.rim.x)).toBeLessThanOrEqual(1);
    const west = portalStance(shape, pit, { x: 200, y: 528 });
    expect(west.x).toBeLessThan(shape.rim.x - shape.rim.rx + 1);
  });
});

describe('the portal in motion', () => {
  it('draws back from the rail to the whole portal, and back again quicker', () => {
    expect(portalOpenPose(0).drawn).toBe(0);
    expect(portalOpenPose(0).shown).toBe(0);
    expect(portalOpenPose(PORTAL_OPEN_MS).drawn).toBe(1);
    expect(portalOpenPose(PORTAL_OPEN_MS).shown).toBe(1);
    let last = -1;
    for (let ms = 0; ms <= PORTAL_OPEN_MS; ms += 16) {
      const { drawn } = portalOpenPose(ms);
      expect(drawn).toBeGreaterThanOrEqual(last);
      last = drawn;
    }
    // It shows over the pit before it has gone far, so the two are never seen apart.
    expect(portalOpenPose(PORTAL_OPEN_MS * 0.35).shown).toBe(1);
    expect(portalOpenPose(PORTAL_CLOSE_MS, true).shown).toBe(0);
    // Going back, it is still mostly there a third of the way, lying back over the pit.
    expect(portalOpenPose(PORTAL_CLOSE_MS * 0.3, true).shown).toBeGreaterThan(0.6);
    expect(portalOpenPose(PORTAL_CLOSE_MS, true).drawn).toBe(0);
    expect(PORTAL_CLOSE_MS).toBeLessThan(PORTAL_OPEN_MS);
  });

  it('hops the look mark from one way in to the next, up and over', () => {
    const from = { x: 10, y: 50 };
    const to = { x: 90, y: 50 };
    expect(aimHopAt(0, from, to)).toEqual(from);
    expect(aimHopAt(AIM_HOP_MS, from, to)).toEqual(to);
    expect(aimHopAt(AIM_HOP_MS / 2, from, to).y).toBeLessThan(50);
  });

  it('hops the player off the edge towards the middle', () => {
    const stance = { x: 100, y: 200 };
    const middle = { x: 100, y: 100 };
    expect(portalHopAt(0, stance, middle)).toEqual({ x: 0, y: 0 });
    expect(portalHopAt(1, stance, middle).y).toBeLessThan(0);
    expect(portalHopAt(0.5, stance, middle).y).toBeLessThan(portalHopAt(1, stance, middle).y);
  });

  it('keeps the hole full of map going down, and never draws it past three times over', () => {
    expect(portalDiveScales(1)).toEqual({ ring: 1, floor: 1 });
    expect(portalDiveScales(2).floor).toBe(portalDiveScales(2).ring);
    expect(portalDiveScales(6)).toEqual({ ring: 3, floor: 3 });
    // At its most the hole of the biggest portal is wider than the screen's diagonal.
    const shape = portalShapeFor({ left: 0, top: 0, width: 253, height: 240 })!;
    expect(shape.hole.ry * 2 * portalDiveScales(6).floor).toBeGreaterThan(Math.hypot(400, 256));
  });
});
