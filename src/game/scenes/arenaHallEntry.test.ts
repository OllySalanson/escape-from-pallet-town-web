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
import { flowForGame } from '../base/arenaKit';
import { FIRST_WORDS } from '../hub/firstWords';
import type { RestoredGame } from '../save/SaveManager';

const hall = roomNamed('raid-arena')!;

/** Speaks to the hall's marshal on a stand-in of the room, and says what happened. */
function speak(game: RestoredGame) {
  const said: (readonly string[])[] = [];
  const heard: string[] = [];
  const room = {
    savedGame: game,
    saveManager: { hearFirstWords: (id: string) => heard.push(id) },
    kit: { flow: flowForGame(game) },
    clearKeeperMark: () => undefined,
    standStill: () => undefined,
    hearLoadoutWords: (BaseScene.prototype as unknown as { hearLoadoutWords: () => void }).hearLoadoutWords,
    say: (lines: readonly string[]) => said.push(lines),
  };
  (BaseScene.prototype as unknown as { speakToMarshal: (this: typeof room, entered: typeof hall) => void }).speakToMarshal.call(room, hall);
  return { said, heard, game: room.savedGame };
}

describe("THE RAID ARENA's marshal", () => {
  it('tells a newcomer what the room is for, once, and opens no screen: the room is the screen', () => {
    const first = speak(baseGame());
    expect(first.said).toEqual([FIRST_WORDS.loadout.lines]);
    expect(first.heard).toEqual(['loadout']);
    const second = speak(first.game);
    expect(second.heard).toEqual([]);
    expect(second.said[0]).not.toEqual(FIRST_WORDS.loadout.lines);
  });

  it('puts the player on the mat, with the door behind them', () => {
    expect(hall.mat).toEqual(ARENA_MAT);
    expect(hall.screen).toBe('arena');
  });
});
