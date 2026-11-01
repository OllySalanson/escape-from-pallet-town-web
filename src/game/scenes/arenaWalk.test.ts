/**
 * The hall's walk on a key held against a stair of its curve, through the scene's
 * own question (`base/arenaWalk.ts` is what it asks). A tap only turns; a key held,
 * or a walk already going, goes on round; and no other room does it at all.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown', UPDATE: 'update' } },
    Scale: { Events: { RESIZE: 'resize' } },
    BlendModes: { ADD: 1 },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

import { BaseScene } from './BaseScene';
import { ARENA_KEEPER_TILE, arenaCollision } from '../base/arenaHall';
import { SLIDE_AFTER_MS } from '../base/arenaWalk';
import type { GridPosition } from '../movement/gridMovement';

const SOLID = arenaCollision();
/** On the rail, pressing right along a stair of the south-east curve, which goes on up and round. */
const AT_THE_STAIR: GridPosition = { x: 52, y: 55 };
const held = { up: false, down: false, left: false, right: true };
const nobody = { up: false, down: false, left: false, right: false };
const planned = { facing: 'right' as const, target: null };

const scene = (arena: unknown) =>
  ({
    arena,
    currentTile: AT_THE_STAIR,
    walkPlan: null,
    pressedAtStairMs: 0,
    place: { room: { room: { keeper: { position: ARENA_KEEPER_TILE } } } },
    rivalHere: null,
    isBlocked: (tile: GridPosition) => SOLID[tile.y]?.[tile.x] ?? true,
    personOn: (BaseScene.prototype as unknown as { personOn: unknown }).personOn,
  }) as unknown as { pressedAtStairMs: number };

const round = (self: unknown, input: typeof held, walkingOn: boolean, deltaMs: number) =>
  (
    BaseScene.prototype as unknown as {
      roundTheStair(this: unknown, p: typeof planned, i: typeof held, w: boolean, d: number): { side: string | null; waiting: boolean };
    }
  ).roundTheStair.call(self, planned, input, walkingOn, deltaMs);

describe("a key held against a stair of THE RAID ARENA's curve", () => {
  it('waits a moment from standing, so a tap only turns the player', () => {
    const self = scene({});
    expect(round(self, held, false, SLIDE_AFTER_MS - 1)).toEqual({ side: null, waiting: true });
  });

  it('goes on round once the key has been held', () => {
    const self = scene({});
    round(self, held, false, SLIDE_AFTER_MS - 1);
    expect(round(self, held, false, 1).side).not.toBeNull();
  });

  it('goes straight round when the walk is already going', () => {
    expect(round(scene({}), held, true, 0).side).not.toBeNull();
  });

  it('forgets the press when the key comes up', () => {
    const self = scene({});
    round(self, held, false, SLIDE_AFTER_MS - 1);
    expect(round(self, nobody, false, 1)).toEqual({ side: null, waiting: false });
    expect(self.pressedAtStairMs).toBe(0);
  });

  it('is only ever the hall: no other room goes round anything', () => {
    expect(round(scene(null), held, true, 1000)).toEqual({ side: null, waiting: false });
  });
});
