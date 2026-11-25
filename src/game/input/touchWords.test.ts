import { afterEach, describe, expect, it } from 'vitest';
import { resetTouchPlay, setTouchPlay } from './touchPlay';
import { shortcutsInHint } from './touchShortcuts';
import { WINDOW_PAUSE_LINES } from '../world/windowPause';
import { installTouchWording, rewordTexts, sourceText, touchWording } from './touchWords';

afterEach(() => resetTouchPlay());

describe('the game\'s words for its keys, on the touch pad', () => {
  it('names the pad\'s own buttons for SPACE, ENTER, ESC and the arrows', () => {
    expect(touchWording('[SPACE] BULBASAUR')).toBe('[OK] BULBASAUR');
    expect(touchWording('WALK UP TO A POKÉ BALL AND PRESS [SPACE]')).toBe('WALK UP TO A POKÉ BALL AND PRESS [OK]');
    expect(touchWording('[ESC] SKIP')).toBe('[BACK] SKIP');
    expect(touchWording('[ARROWS] WALK')).toBe('[D-PAD] WALK');
    expect(touchWording('ARROWS move · ENTER choose · ESC back')).toBe('D-PAD move · OK choose · BACK back');
    expect(touchWording('ARROWS: move · SPACE: dig · ESC: stop')).toBe('D-PAD: move · OK: dig · BACK: stop');
    expect(touchWording('Arrows choose · ENTER picks this one · ESC leaves')).toBe('D-PAD choose · OK picks this one · BACK leaves');
  });

  it('names a letter key by the word on its tray button', () => {
    expect(touchWording('[O] OAK  [L] LOOK  [B] PACK  [P] TEAM')).toBe('[OAK]  [LOOK]  [PACK]  [TEAM]');
    expect(touchWording('[H] DECORATE')).toBe('[DECORATE]');
    expect(touchWording('[SPACE] PUT DOWN  [R] TURN  [Q][E] BOX  [X] PUT AWAY')).toBe('[OK] PUT DOWN  [TURN]  [< BOX >]  [PUT AWAY]');
    expect(touchWording('[1] OVER HERE!')).toBe('[OVER HERE!]');
  });

  it('says the title\'s line whole', () => {
    expect(touchWording('ARROWS CHOOSE · SPACE SELECT')).toBe('D-PAD CHOOSES · OK SELECTS');
    expect(touchWording(WINDOW_PAUSE_LINES[1])).toBe('Tap anywhere to play on.');
  });

  it('leaves words that are not keys alone', () => {
    expect(touchWording('Your first raid! Follow the gold arrow.')).toBe('Your first raid! Follow the gold arrow.');
    expect(touchWording('THE HARBOUR')).toBe('THE HARBOUR');
    expect(touchWording('[DOWN] OUT')).toBe('[DOWN] OUT');
  });

  it('reads the house\'s box keys as a pair on the tray', () => {
    expect(shortcutsInHint('[Q][E] BOX  [X] PUT AWAY')).toEqual([
      { code: 'KeyQ', label: '< BOX' },
      { code: 'KeyE', label: 'BOX >' },
      { code: 'KeyX', label: 'PUT AWAY' },
    ]);
  });
});

describe('a Text that says its keys the pad\'s way', () => {
  class FakeText {
    text = '';
    setText(value: string | string[]): this {
      this.text = Array.isArray(value) ? value.join('\n') : value;
      return this;
    }
  }
  installTouchWording(FakeText as never);

  it('draws the pad\'s words while played by touch, and keeps what it was given', () => {
    const hint = new FakeText();
    hint.setText('[B] PACK');
    expect(hint.text).toBe('[B] PACK');
    setTouchPlay(true);
    hint.setText('[B] PACK');
    expect(hint.text).toBe('[PACK]');
    expect(sourceText(hint)).toBe('[B] PACK');
  });

  it('says every text on screen again when touch play starts or stops', () => {
    const hint = new FakeText();
    hint.setText('[SPACE] FISH');
    setTouchPlay(true);
    rewordTexts([{ children: { list: [{ list: [hint] }] } }]);
    expect(hint.text).toBe('[OK] FISH');
    setTouchPlay(false);
    rewordTexts([{ children: { list: [hint] } }]);
    expect(hint.text).toBe('[SPACE] FISH');
  });
});
