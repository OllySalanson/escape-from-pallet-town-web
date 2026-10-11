import { describe, expect, it } from 'vitest';
import { pausesForWindow, watchWindowFocus, type PausesForWindow } from './windowPause';

/**
 * The window is a stand-in `EventTarget`, which dispatches capture listeners in
 * the order they were added exactly as a window does. A second listener added
 * after the watcher plays Phaser's keyboard, so "the key was spent on the
 * plate" is asked as "did the game ever see it".
 */
class InputEvent extends Event {
  public readonly code: string;
  public readonly target2: unknown;

  public constructor(type: string, code = '', options: { readonly into?: unknown } = {}) {
    super(type, { cancelable: true });
    this.code = code;
    this.target2 = options.into;
  }
}

function aRaid(walking = true) {
  const raid = {
    walking,
    paused: false,
    pauses: 0,
    resumes: 0,
    canPauseForWindow: () => raid.walking && !raid.paused,
    pauseForWindow: () => {
      raid.paused = true;
      raid.pauses += 1;
    },
    resumeFromWindowPause: () => {
      raid.paused = false;
      raid.resumes += 1;
    },
  };
  return raid;
}

function aWindow(raid: PausesForWindow | null, ignores?: (event: { readonly target?: unknown }) => boolean) {
  const target = new EventTarget();
  const stop = watchWindowFocus(target, () => raid, {
    ignores: ignores ? (event) => ignores({ target: (event as unknown as InputEvent).target2 }) : undefined,
  });
  // What reaches the game behind the watcher.
  const gameSaw: string[] = [];
  target.addEventListener('keydown', (event) => gameSaw.push((event as InputEvent).code), true);
  const send = (type: string, code = '', into?: unknown): InputEvent => {
    const event = new InputEvent(type, code, { into });
    target.dispatchEvent(event);
    return event;
  };
  return { target, stop, gameSaw, send };
}

describe('a raid when the window is not in use', () => {
  it('pauses when the window loses focus, and stays paused when it comes back', () => {
    const raid = aRaid();
    const page = aWindow(raid);

    page.send('blur');
    expect(raid.paused).toBe(true);
    // Focus coming back is not the player being ready: alt-tabbing back to
    // read the screen is exactly when they are not.
    page.send('focus');
    expect(raid.paused).toBe(true);
    expect(raid.resumes).toBe(0);
  });

  it('resumes on a key, and spends that key on the plate - repeats and all', () => {
    const raid = aRaid();
    const page = aWindow(raid);
    page.send('blur');

    const press = page.send('keydown', 'ArrowLeft');
    expect(raid.paused).toBe(false);
    expect(press.defaultPrevented).toBe(true);
    // Held, the browser repeats it: none of it walks.
    page.send('keydown', 'ArrowLeft');
    page.send('keydown', 'ArrowLeft');
    expect(page.gameSaw).toEqual([]);
    page.send('keyup', 'ArrowLeft');
    page.send('keydown', 'ArrowLeft');
    expect(page.gameSaw).toEqual(['ArrowLeft']);
  });

  it('resumes on a click', () => {
    const raid = aRaid();
    const page = aWindow(raid);
    page.send('blur');
    page.send('pointerdown');
    expect(raid.paused).toBe(false);
    expect(raid.resumes).toBe(1);
  });

  it('leaves the game every key while nothing is paused', () => {
    const raid = aRaid();
    const page = aWindow(raid);
    page.send('keydown', 'KeyB');
    page.send('pointerdown');
    expect(page.gameSaw).toEqual(['KeyB']);
    expect(raid.pauses + raid.resumes).toBe(0);
  });

  it('pauses nothing that is not a raid being walked', () => {
    const resting = aRaid(false);
    aWindow(resting).send('blur');
    expect(resting.pauses).toBe(0);

    const page = aWindow(null);
    page.send('blur');
    page.send('keydown', 'Space');
    expect(page.gameSaw).toEqual(['Space']);
  });

  it('pauses once however often the window is left', () => {
    const raid = aRaid();
    const page = aWindow(raid);
    page.send('blur');
    page.send('blur');
    expect(raid.pauses).toBe(1);
  });

  it('is not resumed by the feedback panel opened over the plate', () => {
    const raid = aRaid();
    const panel = { panel: true };
    const page = aWindow(raid, (event) => event.target === panel);
    page.send('blur');
    page.send('keydown', 'KeyH', panel);
    page.send('pointerdown', '', panel);
    expect(raid.paused).toBe(true);
    expect(page.gameSaw).toEqual(['KeyH']);
    page.send('keydown', 'Enter');
    expect(raid.paused).toBe(false);
  });

  it('forgets a spent key the window lost while it was held', () => {
    const raid = aRaid();
    const page = aWindow(raid);
    page.send('blur');
    page.send('keydown', 'ArrowUp');
    // The window goes again before the key comes up; its keyup is never seen.
    raid.walking = false;
    page.send('blur');
    page.send('keydown', 'ArrowUp');
    expect(page.gameSaw).toEqual(['ArrowUp']);
  });

  it('stops watching when asked', () => {
    const raid = aRaid();
    const page = aWindow(raid);
    page.stop();
    page.send('blur');
    expect(raid.pauses).toBe(0);
  });

  it('knows a scene that can be paused for the window', () => {
    expect(pausesForWindow(aRaid())).toBe(true);
    expect(pausesForWindow({})).toBe(false);
    expect(pausesForWindow(null)).toBe(false);
  });
});
