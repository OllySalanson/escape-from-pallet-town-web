import { describe, expect, it } from 'vitest';
import { menuClickSound } from './menuSounds';

describe('menuClickSound', () => {
  it('blips for an ordinary button', () => {
    expect(menuClickSound({ view: 'stash' })).toBe('select');
    expect(menuClickSound({})).toBe('select');
  });

  it('sounds a way out as a way out, on every screen that has one', () => {
    for (const key of ['back', 'backStep', 'close', 'swapCancel']) {
      expect(menuClickSound({ [key]: '' }), key).toBe('cancel');
    }
  });

  it('stays silent for a button its screen always answers', () => {
    for (const key of ['advance', 'start', 'continue', 'recover', 'treatItem', 'pokemon', 'target']) {
      expect(menuClickSound({ [key]: '' }), key).toBeNull();
    }
  });

  it('lets a button say what it is, or say nothing', () => {
    expect(menuClickSound({ confirm: '', sfx: 'confirm' })).toBe('confirm');
    expect(menuClickSound({ back: '', sfx: 'none' })).toBeNull();
  });
});
