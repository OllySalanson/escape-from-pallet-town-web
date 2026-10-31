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
    hearFirstWords: (BaseScene.prototype as unknown as { hearFirstWords: (id: string) => void }).hearFirstWords,
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

describe('coming home to the cloud lifting', () => {
  /** A lift under way on a stand-in of the hall, with the keys pressed as told. */
  function lifting(pressed: { interact?: boolean; other?: boolean }, heldMs = 1000) {
    const hall = {
      fogLift: { elapsedMs: 100, steps: 0, tile: { x: 1, y: 1 }, sign: { show: () => undefined, update: () => undefined, destroy: () => undefined }, heldMs, line: '+1%' } as object | null,
      crowdLookMs: 0,
      arena: { endFog: () => undefined, thinTheFog: () => undefined },
      isInteractionPressed: () => pressed.interact === true,
      anyKeyPressed: () => pressed.other === true,
    };
    const answer = (BaseScene.prototype as unknown as { advanceFogLift: (this: typeof hall, deltaMs: number) => unknown }).advanceFogLift.call(hall, 16);
    return { answer, lifted: hall.fogLift === null };
  }

  it('says which key cut it short, so that the same press goes on to do its job', () => {
    expect(lifting({ interact: true })).toEqual({ answer: 'interact', lifted: true });
    expect(lifting({ other: true })).toEqual({ answer: 'other', lifted: true });
  });

  it('runs on with nothing pressed', () => {
    expect(lifting({})).toEqual({ answer: null, lifted: false });
  });

  it('does not count a key still on its way up from the result screen', () => {
    expect(lifting({ interact: true }, 100)).toEqual({ answer: null, lifted: false });
  });
});
