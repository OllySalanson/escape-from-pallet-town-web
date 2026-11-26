import { afterEach, describe, expect, it } from 'vitest';
import { resetTouchPlay, setTouchPlay } from './touchPlay';
import { shortcutsInHint } from './touchShortcuts';
import { WINDOW_PAUSE_LINES } from '../world/windowPause';
import { READ_IN_A_RAID } from '../items/teaching';
import { helpLineKeys, installTouchWording, rewordTexts, sourceText, touchHelpLine, touchWording } from './touchWords';

afterEach(() => resetTouchPlay());

describe('the game\'s words for its keys, on the touch pad', () => {
  it('names the pad\'s own buttons for SPACE, ENTER, ESC and the arrows', () => {
    expect(touchWording('[SPACE] BULBASAUR')).toBe('[OK] BULBASAUR');
    expect(touchWording('WALK UP TO A POKÉ BALL AND PRESS [SPACE]')).toBe('WALK UP TO A POKÉ BALL AND PRESS [OK]');
    expect(touchWording('[ESC] SKIP')).toBe('[BACK] SKIP');
    // A button named for what it does is said once.
    expect(touchWording('[Z] ZOOM  [SPACE] DROP HERE  [ESC] BACK')).toBe('[ZOOM]  [OK] DROP HERE  [BACK]');
    expect(touchWording('[ARROWS] WALK')).toBe('[D-PAD] WALK');
    expect(touchWording('ARROWS move · ENTER choose · ESC back')).toBe('D-PAD move · OK choose · BACK');
    expect(touchWording('ARROWS: move · SPACE: dig · ESC: stop')).toBe('D-PAD: move · OK: dig · BACK: stop');
    expect(touchWording('Arrows choose · ENTER picks this one · ESC leaves')).toBe('D-PAD choose · OK picks this one · BACK leaves');
  });

  it('names a letter key by the word on its tray button', () => {
    expect(touchWording('[O] OAK  [L] LOOK  [B] PACK  [P] TEAM')).toBe('[OAK]  [LOOK]  [PACK]  [TEAM]');
    expect(touchWording('[H] DECORATE')).toBe('[DECORATE]');
    expect(touchWording('[SPACE] PUT DOWN  [R] TURN  [Q][E] BOX  [X] PUT AWAY')).toBe('[OK] PUT DOWN  [TURN]  [< BOX >]  [PUT AWAY]');
    expect(touchWording('[1] OVER HERE!')).toBe('[OVER HERE!]');
    expect(touchWording('Drop one [X]')).toBe('Drop one');
  });

  it('says the title\'s line whole', () => {
    expect(touchWording('ARROWS CHOOSE · SPACE SELECT')).toBe('D-PAD CHOOSES · OK SELECTS');
    expect(touchWording(WINDOW_PAUSE_LINES[1])).toBe('Tap anywhere to play on.');
    expect(touchWording(WINDOW_PAUSE_LINES.join('\n'))).toBe(`${WINDOW_PAUSE_LINES[0]}\nTap anywhere to play on.`);
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
  installTouchWording(FakeText);

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

describe('a menu\'s help line on the touch pad', () => {
  it('offers the letter keys it names, and not the pad\'s own or a key that only closes it', () => {
    expect(helpLineKeys('ARROWS move · ENTER use · X drop · ESC back to the raid')).toEqual([{ code: 'KeyX', label: 'DROP' }]);
    expect(helpLineKeys('ARROWS move · ENTER take or leave · L lead · FIND a name · P close')).toEqual([{ code: 'KeyL', label: 'LEAD' }]);
    expect(helpLineKeys('ARROWS look along the shelves · ENTER try it on, then ENTER buys · TAB shelves or bar · ESC leave')).toEqual([
      { code: 'Tab', label: 'SHELVES/BAR' },
    ]);
    expect(helpLineKeys('ARROWS read · O or ESC back to the raid')).toEqual([]);
    expect(helpLineKeys('ARROWS choose · ENTER play · N your name · ESC back to the house')).toEqual([{ code: 'KeyN', label: 'YOUR NAME' }]);
    expect(helpLineKeys('ARROWS move · LEFT/RIGHT a pocket · ENTER use a disc or stone · B close')).toEqual([]);
  });

  it('offers YOUR THINGS\' keys: OUT on Backspace and the pocket pair walking back and forward', () => {
    // 'BKSP out' and 'Q E tab' were read as nothing and as an E POCKET key on Q.
    expect(helpLineKeys('ARROWS move · ENTER pack · BKSP out · L lock · Q E tab · ESC back')).toEqual([
      { code: 'Backspace', label: 'OUT' },
      { code: 'KeyL', label: 'LOCK' },
      { code: 'KeyQ', label: '< TAB' },
      { code: 'KeyE', label: 'TAB >' },
    ]);
    expect(touchHelpLine('ARROWS move · ENTER pack · BKSP out · L lock · Q E tab · ESC back')).toBe(
      'D-PAD move · OK pack · [OUT] · [LOCK] · [< TAB >] · BACK',
    );
  });

  it('says each key by its tray word and the rest in the pad\'s words', () => {
    expect(touchHelpLine('ARROWS move · ENTER use · X drop · ESC back to the raid')).toBe('D-PAD move · OK use · [DROP] · BACK to the raid');
    expect(touchHelpLine('ARROWS read · O or ESC back to the raid')).toBe('D-PAD read · BACK to the raid');
    expect(touchHelpLine('ARROWS move · LEFT/RIGHT a pocket · ENTER use a disc or stone · B close')).toBe('D-PAD move · LEFT/RIGHT a pocket · OK use a disc or stone');
    expect(touchHelpLine('Arrows choose · ENTER asks to buy one · ESC leaves')).toBe('D-PAD choose · OK asks to buy one · BACK leaves');
  });
});

describe('a screen named by its key in a sentence, on the touch pad', () => {
  it('drops the key aside, because the tray\'s button is the screen\'s own name', () => {
    // A phone playtest (26 Nov 2026): the raid's result told a thumb to find
    // its haul in "YOUR THINGS (B at base)", a letter there is no key for.
    expect(touchWording('The things are in YOUR THINGS (B at base) and the Pokémon on YOUR TEAM (P at base), ready for your next raid.')).toBe(
      'The things are in YOUR THINGS and the Pokémon on YOUR TEAM, ready for your next raid.',
    );
    expect(touchWording(READ_IN_A_RAID)).toBe('Read it from YOUR THINGS anywhere at base, or pack it and read it from your pack in a raid.');
  });

  it('leaves a letter in brackets that names no screen\'s key alone', () => {
    expect(touchWording('Plan (A) at base')).toBe('Plan (A) at base');
    expect(touchWording('[B] PACK')).toBe('[PACK]');
  });
});
