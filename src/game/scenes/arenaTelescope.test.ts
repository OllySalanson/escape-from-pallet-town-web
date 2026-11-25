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
import { ValeOverviewView } from '../base/valeOverviewView';

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

/**
 * The navigation audit (25 Nov 2026): the glass took SPACE as BACK and only
 * ENTER dropped, so the pad - whose one OK is SPACE - could not drop at all, and
 * offered the yard's LOOK, FAVOURS and the rest, dead, with no ZOOM or NEXT.
 * OK (SPACE or ENTER) drops and BACK (ESC) steps back, as everywhere else.
 */
describe("THE RAID ARENA's telescope keys", () => {
  const keys = ['space', 'enter', 'back', 'boxBack', 'boxNext', 'closer', 'left', 'right', 'up', 'down', 'w', 'a', 's', 'd'];
  /** The keys the glass is handed on a frame with `pressed` down. */
  const glassKeys = (pressed: string): Record<string, unknown> => {
    const key = (name: string) => ({ name, isDown: false });
    const controls = Object.fromEntries(keys.map((name) => [name, key(name)]));
    let handed: Record<string, unknown> = {};
    const scene = {
      telescope: { update: (_ms: number, given: Record<string, unknown>) => (handed = given), finished: null },
      controls: { ...controls, interact: [controls.space, controls.enter] },
      keyPresses: { justPressed: (each: { name: string }) => each.name === pressed },
    };
    (BaseScene.prototype as unknown as { advanceTelescope(this: unknown, ms: number): void }).advanceTelescope.call(scene, 16);
    return handed;
  };

  it('drops on OK, SPACE and ENTER alike', () => {
    expect(glassKeys('space')).toMatchObject({ go: true, stepBack: false });
    expect(glassKeys('enter')).toMatchObject({ go: true, stepBack: false });
  });

  it('steps back on BACK', () => {
    expect(glassKeys('back')).toMatchObject({ go: false, stepBack: true });
  });

  it('names ZOOM for the pad, and NEXT only while there is another way in', () => {
    const padKeys = (landings: number): string =>
      (ValeOverviewView.prototype as unknown as { padKeys(this: unknown): string }).padKeys.call({
        source: { landings: Array.from({ length: landings }, () => ({})) },
      });
    expect(padKeys(1)).toBe('[Z] ZOOM');
    expect(padKeys(3)).toBe('[Z] ZOOM  [Q][E] NEXT');
  });

  it('gives the pad its own keys and none of the yard\'s while it is up', () => {
    const shortcuts = (BaseScene.prototype as unknown as { touchShortcuts(this: unknown): readonly { code: string; label: string }[] }).touchShortcuts.call({
      telescope: { padKeys: () => '[Z] ZOOM  [Q][E] NEXT' },
    });
    expect(shortcuts.map(({ code, label }) => [code, label])).toEqual([
      ['KeyQ', '< NEXT'],
      ['KeyE', 'NEXT >'],
      ['KeyZ', 'ZOOM'],
    ]);
  });
});
