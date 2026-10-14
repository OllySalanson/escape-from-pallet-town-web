import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { TILE_SIZE } from '../worldMap';
import { WorldScene } from './WorldScene';

interface Place {
  x: number;
  y: number;
  visible: boolean;
}

interface Driven {
  settleHeadMark(): void;
}

/**
 * The player standing at `player` (sprite pixels, as the scene places them),
 * with people at `figures`, and the head mark's alpha as the scene sets it.
 */
function scene(player: { x: number; y: number }, figures: Record<string, Place>) {
  const mark = { alpha: 1, setAlpha(alpha: number) { this.alpha = alpha; return this; } };
  const world = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(world as object, {
    player,
    playerHeadMark: mark,
    npcSprites: new Map(Object.entries(figures)),
    npcAppearances: new Map(Object.keys(figures).map((id) => [id, {}])),
  });
  return { world: world as unknown as Driven, mark };
}

const at = (tileX: number, tileY: number) => ({ x: tileX * TILE_SIZE, y: tileY * TILE_SIZE - 11 });

describe("the player's head mark", () => {
  it("gives way to somebody standing in the tile above, instead of covering their face", () => {
    const { world, mark } = scene(at(10, 10), { giver: { ...at(10, 9), visible: true } });
    world.settleHeadMark();
    expect(mark.alpha).toBe(0);
  });

  it('comes back once they are gone, and stays for anybody beside, below or out of sight', () => {
    const giver = { ...at(10, 9), visible: true };
    const { world, mark } = scene(at(10, 10), {
      giver,
      beside: { ...at(11, 10), visible: true },
      below: { ...at(10, 11), visible: true },
      twoAbove: { ...at(10, 8), visible: true },
    });
    world.settleHeadMark();
    expect(mark.alpha).toBe(0);
    giver.visible = false;
    world.settleHeadMark();
    expect(mark.alpha).toBe(1);
  });

  it('counts a figure part way through a step once it is mostly in that tile', () => {
    const walker = { ...at(10, 9), visible: true };
    walker.x += TILE_SIZE * 0.75;
    const { world, mark } = scene(at(10, 10), { walker });
    world.settleHeadMark();
    expect(mark.alpha).toBe(1);
    walker.x = at(10, 9).x + TILE_SIZE * 0.25;
    world.settleHeadMark();
    expect(mark.alpha).toBe(0);
  });
});
