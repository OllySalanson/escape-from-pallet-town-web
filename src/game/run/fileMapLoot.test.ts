import { describe, expect, it } from 'vitest';
import { PUBLISHED_FIXTURE_MAP_ID } from '../world/publishedMapFixture.testkit';
import { playerMap } from '../world/playerMaps';
import {
  frontDoorFor,
  generateRunPlan,
  RUN_INSERTIONS,
  type RunInsertionId,
} from './runGeneration';

const SEEDS = Array.from({ length: 12 }, (_, index) => index * 7_919 + 1);

/** One number for every piece of loot a shipped landing lays across these seeds. */
function shippedLootFingerprint(): string {
  let hash = 0x811c9dc5;
  for (const insertionId of Object.keys(RUN_INSERTIONS) as RunInsertionId[]) {
    for (const seed of SEEDS) {
      const plan = generateRunPlan(seed, undefined, insertionId);
      const text = Object.entries(plan.loot)
        .map(
          ([mapId, pieces]) =>
            `${mapId}:${pieces
              .map(
                (piece) =>
                  `${piece.id}@${piece.position.x},${piece.position.y}=${piece.itemId}x${piece.quantity}`,
              )
              .join(';')}`,
        )
        .join('|');
      for (let index = 0; index < text.length; index += 1) {
        hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
      }
    }
  }
  return hash.toString(16);
}

describe("a file map's item spots", () => {
  const map = playerMap(PUBLISHED_FIXTURE_MAP_ID)!;
  const spots = map.file.itemSpots;
  const door = frontDoorFor(PUBLISHED_FIXTURE_MAP_ID)!;

  it('are laid on the tile the maker drew them on, every raid', () => {
    for (const seed of SEEDS) {
      const laid = generateRunPlan(seed, undefined, door.id).loot[PUBLISHED_FIXTURE_MAP_ID];
      expect(laid.length).toBeGreaterThan(0);
      for (const piece of laid) {
        const index = Number(piece.id.slice(piece.id.lastIndexOf('-') + 1)) - 1;
        expect(piece.position).toEqual({ x: spots[index].x, y: spots[index].y });
      }
    }
  });

  it('roll whether each one appears and what is in it', () => {
    const laidSpots = new Set<string>();
    const contents = new Map<string, Set<string>>();
    const counts = new Set<number>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const laid = generateRunPlan(seed, undefined, door.id).loot[PUBLISHED_FIXTURE_MAP_ID];
      counts.add(laid.length);
      expect(laid.length).toBeGreaterThanOrEqual(Math.ceil(spots.length / 2));
      for (const piece of laid) {
        laidSpots.add(piece.id);
        const held = contents.get(piece.id) ?? new Set<string>();
        held.add(`${piece.itemId}x${piece.quantity}`);
        contents.set(piece.id, held);
      }
    }
    expect(counts.size).toBeGreaterThan(1);
    expect(laidSpots.size).toBe(spots.length);
    expect([...contents.values()].some((held) => held.size > 1)).toBe(true);
  });

  it('leave every shipped map laying exactly the loot it laid before', () => {
    expect(shippedLootFingerprint()).toBe('e7143d72');
  });
});
