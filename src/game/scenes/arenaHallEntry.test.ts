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
import { baseGame } from '../base/baseGames.testkit';
import { ARENA_MAT } from '../base/arenaHall';
import { roomNamed } from '../base/rooms';
import { FIRST_WORDS } from '../hub/firstWords';
import type { RestoredGame } from '../save/SaveManager';

const hall = roomNamed('raid-arena')!;

/** Speaks to the hall's marshal on a stand-in of the room, and says what happened. */
function speak(game: RestoredGame) {
  const said: (readonly string[])[] = [];
  const opened: string[] = [];
  const heard: string[] = [];
  const room = {
    savedGame: game,
    saveManager: { hearFirstWords: (id: string) => heard.push(id) },
    favourHere: () => undefined,
    openScreen: (_room: unknown, screen: string) => opened.push(screen),
    hearLoadoutWords: (BaseScene.prototype as unknown as { hearLoadoutWords: () => void }).hearLoadoutWords,
    say: (lines: readonly string[], _about: unknown, then: () => void) => {
      said.push(lines);
      then();
    },
  };
  (BaseScene.prototype as unknown as { speakToKeeper: (this: typeof room, entered: typeof hall, screen: string) => void }).speakToKeeper.call(
    room,
    hall,
    'arena',
  );
  return { said, opened, heard, game: room.savedGame };
}

describe("THE RAID ARENA's marshal", () => {
  it('tells a newcomer what the loadout is for, once, and then opens it', () => {
    const first = speak(baseGame());
    expect(first.said).toEqual([FIRST_WORDS.loadout.lines]);
    expect(first.opened).toEqual(['arena']);
    expect(first.heard).toEqual(['loadout']);
    const second = speak(first.game);
    expect(second.said).toEqual([]);
    expect(second.opened).toEqual(['arena']);
  });

  it('is one key from the door, as every keeper is: the room puts the player on its mat', () => {
    expect(hall.mat).toEqual(ARENA_MAT);
    expect(hall.screen).toBe('arena');
  });
});
