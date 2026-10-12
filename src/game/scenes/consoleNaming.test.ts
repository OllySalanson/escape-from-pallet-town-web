import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn(() => Promise.resolve()) }),
}));

import { ConsoleScene } from './ConsoleScene';

interface ConsoleHarness {
  onKey(event: KeyboardEvent): void;
  naming: { value: string } | null;
  closed: number;
  rendered: number;
}

/** The GAMES menu with the name form open on a half-typed name. */
function namingConsole(): ConsoleHarness {
  const scene = Object.create(ConsoleScene.prototype) as ConsoleScene;
  const harness = scene as unknown as ConsoleHarness;
  Object.assign(scene as object, {
    naming: { value: 'AS' },
    status: undefined,
    closed: 0,
    rendered: 0,
    close: () => {
      harness.closed += 1;
    },
    render: () => {
      harness.rendered += 1;
    },
  });
  return harness;
}

/** A key pressed on a control of the menu, never on the text field. */
function pressOnButton(key: string): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: { tagName: 'BUTTON' },
    preventDefault: () => undefined,
  } as unknown as KeyboardEvent;
}

describe('the console name form', () => {
  it('is put down by Escape from its own buttons, leaving the GAMES menu open', () => {
    const scene = namingConsole();
    scene.onKey(pressOnButton('Escape'));
    expect(scene.naming).toBeNull();
    expect(scene.rendered).toBe(1);
    expect(scene.closed).toBe(0);
  });

  it('still lets Escape leave the console once no name is being typed', () => {
    const scene = namingConsole();
    scene.naming = null;
    scene.onKey(pressOnButton('Escape'));
    expect(scene.closed).toBe(1);
  });
});
