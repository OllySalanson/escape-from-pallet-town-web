import { afterEach, describe, expect, it } from 'vitest';
import { isPhysicalKeyPress, onTouchPlayChange, resetTouchPlay, touchPlay, watchTouchPlay } from './touchPlay';

afterEach(() => resetTouchPlay());

const key = (fields: Partial<{ key: string; isTrusted: boolean; target: unknown }>) =>
  ({ key: 'b', isTrusted: true, target: null, ...fields }) as unknown as KeyboardEvent;

describe('whether the game is played by touch', () => {
  it('starts on a finger for a pointer, and follows the player from there', () => {
    const listeners = new Map<string, (event: Event) => void>();
    const host = {
      addEventListener: (type: string, listener: (event: Event) => void) => listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
      dispatchEvent: (event: { type: string; [field: string]: unknown }) => listeners.get(event.type)?.(event as unknown as Event),
    };
    const changes: boolean[] = [];
    onTouchPlayChange((playing) => changes.push(playing));
    const stop = watchTouchPlay(host, true);
    expect(touchPlay()).toBe(true);
    host.dispatchEvent({ type: 'keydown', key: 'ArrowUp', isTrusted: true, target: null });
    expect(touchPlay()).toBe(false);
    host.dispatchEvent({ type: 'pointerdown', pointerType: 'mouse' });
    expect(touchPlay()).toBe(false);
    host.dispatchEvent({ type: 'pointerdown', pointerType: 'touch' });
    expect(touchPlay()).toBe(true);
    expect(changes).toEqual([true, false, true]);
    stop();
  });

  it('starts without the pad where the pointer is a mouse', () => {
    const stop = watchTouchPlay(new EventTarget(), false);
    expect(touchPlay()).toBe(false);
    stop();
  });

  it('never counts the pad, a field, or a phone\'s own keyboard as a keyboard', () => {
    expect(isPhysicalKeyPress(key({}))).toBe(true);
    expect(isPhysicalKeyPress(key({ isTrusted: false }))).toBe(false);
    expect(isPhysicalKeyPress(key({ key: 'Unidentified' }))).toBe(false);
    expect(isPhysicalKeyPress(key({ key: 'Process' }))).toBe(false);
    expect(isPhysicalKeyPress(key({ target: { tagName: 'INPUT' } }))).toBe(false);
    expect(isPhysicalKeyPress(key({ target: { tagName: 'textarea' } }))).toBe(false);
    expect(isPhysicalKeyPress(key({ target: { isContentEditable: true } }))).toBe(false);
    expect(isPhysicalKeyPress(key({ target: { tagName: 'BUTTON' } }))).toBe(true);
  });
});
