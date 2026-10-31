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
import { ArenaIntroScene, type ArenaIntroSceneData } from './ArenaIntroScene';
import type { BaseSceneData } from './BaseScene';
import { BASE_DOORS } from '../base/doors';
import { baseGame } from '../base/baseGames.testkit';
import { ARENA_INTRO_ARMING_MS } from '../cutscene/arenaIntro';

const game = baseGame();

/** Walks through a base door on a stand-in of the yard, and says where it went. */
function through(doorId: string, savedGame = game): unknown[][] {
  const door = BASE_DOORS.find((each) => each.id === doorId)!;
  const went: unknown[][] = [];
  const yard = {
    savedGame,
    learnKey: () => undefined,
    openArenaIntro: (payload: unknown) => went.push(['arenaIntro', payload]),
    openHub: (payload: unknown) => went.push(['hub', payload]),
    goTo: (payload: unknown) => went.push(['room', payload]),
  };
  (BaseScene.prototype as unknown as { enterRoom: (this: typeof yard, entered: typeof door) => void }).enterRoom.call(yard, door);
  return went;
}

/** The trailer, stood up just far enough to be pressed at and to leave. */
function trailer(startedAt: number, hall: BaseSceneData) {
  const scene = new ArenaIntroScene();
  const started: unknown[][] = [];
  const faded: (() => void)[] = [];
  const clock = { now: startedAt, removeAllEvents: () => undefined };
  Object.assign(scene, {
    hall,
    startedAt,
    time: clock,
    uiCamera: { fadeOut: () => undefined },
    cameras: { main: { fadeOut: () => undefined, once: (_event: string, done: () => void) => faded.push(done) } },
    scene: { start: (key: string, data: unknown) => started.push([key, data]) },
  });
  const press = (key: string, repeat = false) =>
    (scene as unknown as { onKey: (event: Partial<KeyboardEvent>) => void }).onKey({ key, repeat });
  const finishFade = () => faded.splice(0).forEach((done) => done());
  return { scene, clock, started, press, finishFade };
}

describe("THE RAID ARENA's door", () => {
  it('plays the trailer the first time, on the way into the great hall', () => {
    expect(through('raid-arena')).toEqual([
      ['arenaIntro', { savedGame: game, hall: { savedGame: game, room: 'raid-arena' } } satisfies ArenaIntroSceneData],
    ]);
  });

  it('is a door like any other once it has been seen', () => {
    const seen = { ...game, raidProgress: { ...game.raidProgress, arenaIntroSeen: true } };
    expect(through('raid-arena', seen)).toEqual([['room', { savedGame: seen, room: 'raid-arena' }]]);
  });

  it('is the only door that plays anything: every other is a room', () => {
    for (const door of BASE_DOORS.filter((each) => each.id !== 'raid-arena')) {
      expect(through(door.id).map(([where]) => where)).toEqual(['room']);
    }
  });
});

describe("THE RAID ARENA's trailer", () => {
  const hall: BaseSceneData = { savedGame: game, room: 'raid-arena' };

  it('does not count the key that walked the player into the door', () => {
    const { clock, started, press, finishFade } = trailer(1000, hall);
    clock.now = 1000 + ARENA_INTRO_ARMING_MS - 1;
    press('ArrowUp');
    finishFade();
    expect(started).toEqual([]);
  });

  it('is skipped by any key after that, straight to the loadout', () => {
    const { clock, started, press, finishFade } = trailer(1000, hall);
    clock.now = 1000 + ARENA_INTRO_ARMING_MS + 400;
    press('ArrowUp', true);
    press('f');
    finishFade();
    expect(started, 'a held key and the FEEDBACK key skip nothing').toEqual([]);
    press('KeyZ');
    press('Escape');
    finishFade();
    expect(started).toEqual([['base', hall]]);
  });

  it('is skipped by a click, too', () => {
    const { scene, clock, started, finishFade } = trailer(0, hall);
    clock.now = 20_000;
    (scene as unknown as { tryLeave: () => void }).tryLeave();
    finishFade();
    expect(started).toEqual([['base', hall]]);
  });
});
