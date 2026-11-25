import { describe, expect, it } from 'vitest';
import { codeForHintKey, syntheticKey } from './syntheticKeys';

describe('keys pressed by the touch pad', () => {
  it('says what a keyboard says for every key the pad presses', () => {
    expect(syntheticKey('ArrowLeft')).toEqual({ code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 });
    expect(syntheticKey('Space')).toEqual({ code: 'Space', key: ' ', keyCode: 32 });
    expect(syntheticKey('Escape')).toEqual({ code: 'Escape', key: 'Escape', keyCode: 27 });
    // Letters arrive lower case, as from a keyboard without Shift: Phaser reads the code, a screen the key.
    expect(syntheticKey('KeyB')).toEqual({ code: 'KeyB', key: 'b', keyCode: 66 });
    expect(syntheticKey('Digit3')).toEqual({ code: 'Digit3', key: '3', keyCode: 51 });
    expect(() => syntheticKey('F13')).toThrow();
  });

  it('reads the key a hint writes in brackets', () => {
    expect(codeForHintKey('B')).toBe('KeyB');
    expect(codeForHintKey('7')).toBe('Digit7');
    expect(codeForHintKey('SPACE')).toBeUndefined();
  });
});
