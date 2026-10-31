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

import { ARENA_MAT, arenaCollision } from '../base/arenaHall';
import { roomNamed, type BaseRoom } from '../base/rooms';
import type { GridPosition } from '../movement/gridMovement';
import { BaseScene } from './BaseScene';

const onMat = (room: BaseRoom, tile: GridPosition): boolean =>
  (BaseScene.prototype as unknown as { onMat(this: unknown, room: BaseRoom): boolean }).onMat.call({ currentTile: tile }, room);

describe('the way out of the Raid Arena', () => {
  const hall = roomNamed('raid-arena')!;

  it('takes whoever stands on any of the three tiles of red, because all three are walked on and all three look like the mat', () => {
    for (const x of [ARENA_MAT.x - 1, ARENA_MAT.x, ARENA_MAT.x + 1]) {
      expect(arenaCollision()[ARENA_MAT.y][x]).toBe(false);
      expect(onMat(hall, { x, y: ARENA_MAT.y })).toBe(true);
    }
  });

  it('takes nobody off the mat', () => {
    expect(onMat(hall, { x: ARENA_MAT.x, y: ARENA_MAT.y - 1 })).toBe(false);
    expect(onMat(hall, { x: ARENA_MAT.x + 2, y: ARENA_MAT.y })).toBe(false);
  });

  it('leaves every other room to the one tile its mat is', () => {
    const lab = roomNamed('oaks-lab')!;
    expect(onMat(lab, lab.mat!)).toBe(true);
    expect(onMat(lab, { x: lab.mat!.x + 1, y: lab.mat!.y })).toBe(false);
  });
});
