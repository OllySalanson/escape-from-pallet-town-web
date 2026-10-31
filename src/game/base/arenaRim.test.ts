import { describe, expect, it } from 'vitest';
import { insertionsOn } from '../run/runGeneration';
import { ARENA_FENCE, arenaCollision, cameraLean, pitFrameFor, pitPointOf, pitTileAt } from './arenaHall';
import {
  ARENA_RIM,
  fenceBeside,
  isAtRim,
  landingBelow,
  rimTileOver,
  shareTheRim,
  showsThroughTheHole,
  tileMiddle,
  type RimLanding,
} from './arenaRim';

const VALE = pitFrameFor(384, 384);
const valeLandings: readonly RimLanding[] = insertionsOn('greystone-vale').map((insertion) => ({
  id: insertion.id,
  tile: insertion.position,
}));

describe('the rim of the pit', () => {
  it('runs all the way round, on open floor with the fence beside it', () => {
    const solid = arenaCollision();
    expect(ARENA_RIM.length).toBeGreaterThan(100);
    for (const tile of ARENA_RIM) {
      expect(solid[tile.y][tile.x]).toBe(false);
      expect(isAtRim(tile)).toBe(true);
      expect(ARENA_FENCE).toContainEqual(fenceBeside(tile));
    }
    expect(isAtRim({ x: 32, y: 62 })).toBe(false);
  });

  it('gives every way in a stretch of fence of its own, the ones in the middle of the map too', () => {
    const share = shareTheRim(valeLandings, VALE);
    const stretches = new Map<string, number>();
    for (const tile of ARENA_RIM) {
      const id = landingBelow(tile, share)!.id;
      stretches.set(id, (stretches.get(id) ?? 0) + 1);
    }
    expect(stretches.size).toBe(valeLandings.length);
    for (const count of stretches.values()) {
      expect(count).toBeGreaterThanOrEqual(8);
    }
  });

  it('with one way in, is over it all the way round', () => {
    const share = shareTheRim([valeLandings[0]], VALE);
    for (const tile of ARENA_RIM) {
      expect(landingBelow(tile, share)?.id).toBe(valeLandings[0].id);
    }
  });

  it('with no way in on this map, is over nothing', () => {
    expect(landingBelow(ARENA_RIM[0], shareTheRim([], VALE))).toBeNull();
  });

  it('lays each stretch near over its own way in: the west of the vale from the west rail', () => {
    const share = shareTheRim(valeLandings, VALE);
    const standingOver = (id: string): { x: number; y: number } => {
      const tiles = ARENA_RIM.filter((tile) => landingBelow(tile, share)?.id === id);
      return { x: tiles.reduce((sum, tile) => sum + tile.x, 0) / tiles.length, y: tiles.reduce((sum, tile) => sum + tile.y, 0) / tiles.length };
    };
    // Moor Top is in the north-west of the map, the Salvage Camp in the south-east.
    const moor = standingOver('greystone-vale-moor-top');
    const salvage = standingOver('greystone-vale-salvage-camp');
    expect(moor.x).toBeLessThan(32);
    expect(moor.y).toBeLessThan(32);
    expect(salvage.x).toBeGreaterThan(32);
    expect(salvage.y).toBeGreaterThan(32);
  });

  it('shows every way in, through the hole, from most of its own stretch of rim', () => {
    const share = shareTheRim(valeLandings, VALE);
    for (const landing of share.landings) {
      const stretch = ARENA_RIM.filter((tile) => landingBelow(tile, share)?.id === landing.id);
      const seen = stretch.filter((tile) => {
        const middle = tileMiddle(tile);
        const lean = cameraLean(middle, 256);
        const point = pitPointOf(landing.tile, middle, VALE);
        return (
          showsThroughTheHole(landing.tile, middle, VALE) &&
          Math.abs(point.x - (middle.x + lean.x)) < 200 &&
          Math.abs(point.y - (middle.y + lean.y)) < 128
        );
      });
      expect(seen.length, landing.id).toBeGreaterThan(stretch.length / 2);
    }
  });

  it('finds the nearest tile over a way in for a pointer to walk to', () => {
    const share = shareTheRim(valeLandings, VALE);
    const from = { x: 32, y: 59 };
    const tile = rimTileOver('greystone-vale-the-quarry', share, from)!;
    expect(landingBelow(tile, share)?.id).toBe('greystone-vale-the-quarry');
    expect(rimTileOver('nowhere', share, from)).toBeNull();
  });

  it('finds a tile of the map and the point it lies at, one from the other, on a map of any size', () => {
    const player = { x: 300, y: 700 };
    for (const frame of [VALE, pitFrameFor(64, 64), pitFrameFor(128, 96)]) {
      const tile = { x: Math.floor(frame.width / 3), y: Math.floor(frame.height / 2) };
      expect(pitTileAt(pitPointOf(tile, player, frame), player, frame)).toEqual(tile);
    }
    // A smaller map is drawn bigger, but never bigger than the vale is across.
    expect(pitFrameFor(64, 64).scale).toBe(6);
    expect(pitFrameFor(256, 256).scale).toBe(1);
  });
});
