import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    AUTO: 0,
    GameObjects: { Container: class {} },
    Input: { Keyboard: { KeyCodes: { ENTER: 13, SPACE: 32 } } },
    Math: {
      Vector2: class {
        public set(): void {}
      },
    },
    Scale: { CENTER_BOTH: 0, FIT: 0, NONE: 0, Events: { RESIZE: 'resize' } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scene: class {},
  },
}));

import { audioManager } from '../audio/AudioManager';
import { createStubAudioContext } from '../audio/audioTestStub';
import { titleMenu } from '../ui/titleMenu';
import { TitleScene } from './TitleScene';

describe('the title screen sounds', () => {
  it('sounds the very first cursor move, waking audio the browser kept asleep (playtest 41)', async () => {
    const stub = createStubAudioContext();
    // A browser hands out audio asleep until somebody presses something, and
    // the first thing anybody presses on the title is an arrow key.
    const context = stub.context as unknown as { state: string; resume(): Promise<void> };
    context.state = 'suspended';
    context.resume = () => {
      context.state = 'running';
      return Promise.resolve();
    };
    Object.assign(audioManager as unknown as Record<string, unknown>, { contextFactory: () => stub.context });

    const menu = titleMenu({ kind: 'none' });
    const title = Object.create(TitleScene.prototype) as TitleScene;
    Object.assign(title as unknown as Record<string, unknown>, {
      menu,
      choice: menu.initial,
      hasStarted: false,
      redraw: () => {},
    });

    (title as unknown as { moveCursor(step: 1): void }).moveCursor(1);
    await vi.waitFor(() => expect(stub.sources.length).toBeGreaterThan(0));

    expect(context.state).toBe('running');
    expect(stub.sources.every((source) => source.started)).toBe(true);
    expect(audioManager.recentlyPlayed.map((sound) => sound.name)).toContain('select');
  });
});
