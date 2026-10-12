import { describe, expect, it, vi } from 'vitest';
import { CONSOLE_GAME_CLASS } from '../console/consoleGames';
import { isFeedbackKey } from './feedbackDesk';

vi.mock('phaser', () => ({ default: {} }));

const body = { tagName: 'BODY', closest: () => null };
const press = (key: string, target: unknown = body, extra: Partial<KeyboardEvent> = {}) =>
  ({ key, repeat: false, ctrlKey: false, metaKey: false, altKey: false, target, ...extra }) as KeyboardEvent;
const running = (...keys: string[]) => ({ isActive: (key: string) => keys.includes(key) });

describe('the F key', () => {
  it('opens the panel on a raid, at base and on a menu', () => {
    expect(isFeedbackKey(press('f'), running('world'))).toBe(true);
    expect(isFeedbackKey(press('F'), running('base'))).toBe(true);
    expect(isFeedbackKey(press('f'), running('hub'))).toBe(true);
  });

  it('is FILL in the map maker, the tool key its own screen names', () => {
    expect(isFeedbackKey(press('f'), running('mapmaker'))).toBe(false);
    expect(isFeedbackKey(press('F'), running('mapmaker'))).toBe(false);
  });

  it('is a letter in a text field and the game in a console game', () => {
    expect(isFeedbackKey(press('f', { tagName: 'INPUT' }), running('world'))).toBe(false);
    const inGame = { tagName: 'CANVAS', closest: (selector: string) => (selector === `.${CONSOLE_GAME_CLASS}` ? {} : null) };
    expect(isFeedbackKey(press('f', inGame), running('console'))).toBe(false);
  });

  it('is nothing held, repeated, with a modifier or with the panel already up', () => {
    expect(isFeedbackKey(press('f', body, { repeat: true }), running('world'))).toBe(false);
    expect(isFeedbackKey(press('f', body, { ctrlKey: true }), running('world'))).toBe(false);
    expect(isFeedbackKey(press('f'), running('world', 'feedback'))).toBe(false);
    expect(isFeedbackKey(press('g'), running('world'))).toBe(false);
  });
});
