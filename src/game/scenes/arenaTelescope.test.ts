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

import { ARENA_MAT, ARENA_TELESCOPES, railBeside } from '../base/arenaHall';
import { isAtRim } from '../base/arenaRim';
import { nextTileFromDirection, type GridPosition } from '../movement/gridMovement';
import { buildRoom, roomNamed } from '../base/rooms';
import { baseGame } from '../base/baseGames.testkit';
import { BaseScene } from './BaseScene';

const atTelescope = (standing: GridPosition, facing: GridPosition, visit: unknown = null): boolean =>
  (BaseScene.prototype as unknown as { atTelescope(this: unknown, facing: GridPosition): boolean }).atTelescope.call(
    { arena: {}, visit, currentTile: standing },
    facing,
  );

describe("THE RAID ARENA's telescopes", () => {
  const [west, east] = ARENA_TELESCOPES;

  it('answer whoever stands on their plate, whichever way they happen to be facing', () => {
    for (const telescope of ARENA_TELESCOPES) {
      for (const direction of ['up', 'down', 'left', 'right'] as const) {
        expect(atTelescope(telescope.stance, nextTileFromDirection(telescope.stance, direction))).toBe(true);
      }
    }
  });

  it('answer somebody who has walked up the rail and turned to them', () => {
    const beside = { x: east.tile.x + 1, y: east.tile.y };
    expect(isAtRim(beside)).toBe(true);
    expect(atTelescope(beside, east.tile)).toBe(true);
  });

  it('leave somebody at the rail looking the other way to the rail: the two presses to a raid never go through one', () => {
    const beside = { x: west.tile.x - 1, y: west.tile.y };
    expect(atTelescope(beside, { x: beside.x, y: beside.y - 1 })).toBe(false);
    const head = { x: ARENA_MAT.x, y: west.stance.y };
    expect(isAtRim(head)).toBe(true);
    expect(atTelescope(head, { x: head.x, y: head.y - 1 })).toBe(false);
  });

  it('have the rail either side of them, for going round to from the glass', () => {
    for (const telescope of ARENA_TELESCOPES) {
      for (const tile of railBeside(telescope)) {
        expect(isAtRim(tile), `${tile.x},${tile.y}`).toBe(true);
      }
    }
  });

  it('are nothing to look through in somebody else\'s house', () => {
    expect(atTelescope(east.stance, east.tile, { name: 'somebody' })).toBe(false);
  });

  it('stand in the hall as things that open, named, and solid', () => {
    const built = buildRoom(roomNamed('raid-arena')!, baseGame());
    const things = built.things.filter((thing) => thing.opens === 'telescope');
    expect(things.map((thing) => thing.tiles)).toEqual([[west.tile], [east.tile]]);
    for (const telescope of ARENA_TELESCOPES) {
      expect(built.collision[telescope.tile.y][telescope.tile.x]).toBe(true);
      expect(built.collision[telescope.stance.y][telescope.stance.x]).toBe(false);
    }
  });
});
