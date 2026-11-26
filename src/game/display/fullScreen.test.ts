import { describe, expect, it, vi } from 'vitest';
import { fullScreenOffered, isFullScreen, isFullScreenKey, onFullScreenChange, toggleFullScreen, watchFullScreenKey, type FullScreenDocument } from './fullScreen';

/** A document as a browser hands it over: standard, Safari's prefixed, or an iPhone's (neither). */
function page(kind: 'standard' | 'webkit' | 'none', enabled = true) {
  const listeners = new Map<string, Set<() => void>>();
  const state = { element: null as Element | null };
  const element = {} as Element;
  const document: FullScreenDocument & { fire(type: string): void } = {
    get fullscreenElement() {
      return kind === 'standard' ? state.element : undefined;
    },
    get webkitFullscreenElement() {
      return kind === 'webkit' ? state.element : undefined;
    },
    ...(kind === 'standard' ? { fullscreenEnabled: enabled } : {}),
    ...(kind === 'webkit' ? { webkitFullscreenEnabled: enabled } : {}),
    documentElement: {
      ...(kind === 'standard' ? { requestFullscreen: vi.fn(() => { state.element = element; return Promise.resolve(); }) } : {}),
      ...(kind === 'webkit' ? { webkitRequestFullscreen: vi.fn(() => { state.element = element; }) } : {}),
    },
    ...(kind === 'standard' ? { exitFullscreen: vi.fn(() => { state.element = null; return Promise.resolve(); }) } : {}),
    ...(kind === 'webkit' ? { webkitExitFullscreen: vi.fn(() => { state.element = null; }) } : {}),
    addEventListener: (type, listener) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type))!.add(listener),
    removeEventListener: (type, listener) => void listeners.get(type)?.delete(listener),
    fire: (type) => listeners.get(type)?.forEach((listener) => listener()),
  };
  return document;
}

const key = (over: Partial<KeyboardEvent> = {}) => ({ key: 'Enter', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, ...over });

describe('full screen', () => {
  it('is offered where the browser has it, standard or Safari\'s, and not on an iPhone', () => {
    expect(fullScreenOffered(page('standard'))).toBe(true);
    expect(fullScreenOffered(page('webkit'))).toBe(true);
    expect(fullScreenOffered(page('none'))).toBe(false);
    expect(fullScreenOffered(page('standard', false))).toBe(false);
  });

  it('goes in and comes back out, with either set of names', async () => {
    for (const kind of ['standard', 'webkit'] as const) {
      const document = page(kind);
      await toggleFullScreen(document);
      expect(isFullScreen(document)).toBe(true);
      await toggleFullScreen(document);
      expect(isFullScreen(document)).toBe(false);
    }
  });

  it('asks the phone to hide its navigation bar too', async () => {
    const document = page('standard');
    const request = vi.fn(() => Promise.resolve());
    (document.documentElement as { requestFullscreen: typeof request }).requestFullscreen = request;
    await toggleFullScreen(document);
    expect(request).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('leaves the game where it was when the browser refuses', async () => {
    const document = page('standard');
    (document.documentElement as { requestFullscreen: () => Promise<void> }).requestFullscreen = () => Promise.reject(new TypeError('Permissions check failed'));
    await expect(toggleFullScreen(document)).resolves.toBeUndefined();
    expect(isFullScreen(document)).toBe(false);
  });

  it('hears it change either way, and stops hearing when asked', () => {
    const document = page('webkit');
    const heard = vi.fn();
    const stop = onFullScreenChange(document, heard);
    document.fire('fullscreenchange');
    document.fire('webkitfullscreenchange');
    stop();
    document.fire('fullscreenchange');
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('is ALT ENTER, and only that', () => {
    expect(isFullScreenKey(key())).toBe(true);
    expect(isFullScreenKey(key({ altKey: false }))).toBe(false);
    expect(isFullScreenKey(key({ ctrlKey: true }))).toBe(false);
    expect(isFullScreenKey(key({ shiftKey: true }))).toBe(false);
    expect(isFullScreenKey(key({ repeat: true }))).toBe(false);
    expect(isFullScreenKey(key({ key: 'a' }))).toBe(false);
  });

  it('takes ALT ENTER before anything else hears it, and leaves it alone where there is no full screen', async () => {
    for (const [kind, taken] of [['standard', true], ['none', false]] as const) {
      const document = page(kind);
      let listener: ((event: KeyboardEvent) => void) | undefined;
      const window = { addEventListener: (_: string, l: (event: KeyboardEvent) => void, capture: boolean) => { expect(capture).toBe(true); listener = l; }, removeEventListener: vi.fn() } as unknown as Window;
      watchFullScreenKey(window, document);
      const preventDefault = vi.fn();
      const event = { ...key(), preventDefault, stopImmediatePropagation: vi.fn() } as unknown as KeyboardEvent;
      listener?.(event);
      await Promise.resolve();
      expect(preventDefault).toHaveBeenCalledTimes(taken ? 1 : 0);
      expect(isFullScreen(document)).toBe(taken);
    }
  });
});
