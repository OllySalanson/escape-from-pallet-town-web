import { describe, expect, it, vi } from 'vitest';

/** A row of the stand-in face is this many letters, and this many pixels tall. */
const ROW_LETTERS = 20;
const ROW_HEIGHT = 16;

/** Word-wraps the way Phaser does: whole words, `\n` kept, rows no longer than the width. */
function wrap(text: string): string[] {
  return text.split('\n').flatMap((paragraph) => {
    const rows: string[] = [];
    for (const word of paragraph.split(' ')) {
      const last = rows[rows.length - 1];
      if (last !== undefined && `${last} ${word}`.length <= ROW_LETTERS) {
        rows[rows.length - 1] = `${last} ${word}`;
      } else {
        rows.push(word);
      }
    }
    return rows.length ? rows : [''];
  });
}

class FakeText {
  public text = '';
  public get height(): number {
    return wrap(this.text).length * ROW_HEIGHT + 2;
  }
  public setText(value: string): this {
    this.text = value;
    return this;
  }
  public getWrappedText(value: string = this.text): string[] {
    return wrap(value);
  }
  public setOrigin(): this {
    return this;
  }
  public setVisible(): this {
    return this;
  }
}

vi.mock('phaser', () => ({
  default: {
    GameObjects: {
      Container: class {
        public visible = true;
        public add(): this {
          return this;
        }
        public setDepth(): this {
          return this;
        }
        public setVisible(value: boolean): this {
          this.visible = value;
          return this;
        }
      },
    },
  },
}));

import { DialogBox } from './DialogBox';
import { shareLine } from './dialogBoxes';

function sceneStandIn() {
  const graphics = {
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillRoundedRect: vi.fn(),
    lineStyle: vi.fn(),
    strokeRoundedRect: vi.fn(),
  };
  return {
    scale: { height: 240 },
    add: {
      graphics: () => graphics,
      text: () => new FakeText(),
      existing: vi.fn(),
    },
  };
}

/** The base's box: 56 tall with 10 of padding holds two rows and no more. */
function baseBox(onComplete = vi.fn()) {
  const box = new DialogBox(sceneStandIn() as never, {
    width: 232,
    height: 56,
    padding: 10,
    onComplete,
  });
  const shown = () => (box as unknown as { textObject: FakeText }).textObject.text;
  const read = () => {
    box.skip();
    return box.advance();
  };
  return { box, shown, read, onComplete };
}

describe('DialogBox', () => {
  it('shares a line too long for the box over as many boxes as the rows take, cut where a reader would pause', () => {
    const { box, shown, read, onComplete } = baseBox();
    const heard = vi.fn();
    // More rows than a box that holds two.
    const long =
      'KANTO TONIGHT: BLUE, grandson of PROFESSOR OAK, tells our reporter he is never far behind.';
    expect(wrap(long).length).toBeGreaterThan(2);
    const boxes = shareLine(long, 2, wrap);
    expect(boxes).toHaveLength(Math.ceil(wrap(long).length / 2));
    expect(boxes.join(' ')).toBe(long);

    box.showMessages([long, 'Next raid, BLUE.'], heard);
    for (const [index, text] of boxes.entries()) {
      if (index > 0) expect(read()).toBe(true);
      box.skip();
      expect(shown()).toBe(text);
      expect(wrap(shown()).length).toBeLessThanOrEqual(2);
      // Still the first line: its sound is not heard again for its later boxes.
      expect(heard.mock.calls).toEqual([[0]]);
    }

    expect(read()).toBe(true);
    box.skip();
    expect(shown()).toBe('Next raid, BLUE.');
    expect(heard.mock.calls).toEqual([[0], [1]]);
    expect(onComplete).not.toHaveBeenCalled();

    expect(read()).toBe(false);
    expect(box.visible).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('puts a line that fits up whole, in one box', () => {
    const { box, shown, read } = baseBox();
    box.showMessages(['You lie down in your own bed.']);
    box.skip();
    expect(shown()).toBe('You lie down in your own bed.');
    expect(read()).toBe(false);
  });

  /**
   * FireRed's obtained-an-item beat: the box waits out the jingle before a key
   * can move it on, so a player pressing through the lines before it cannot
   * press past the one that says what they were given (playtest 42: a boss's
   * Life Orb went by unread and was only met again in the wipe report).
   */
  it('holds a line it is told to hold until the time has passed, however often a key is pressed', () => {
    const { box, shown } = baseBox();
    box.showMessages(['The fight is won.', 'WREN was carrying a LIFE ORB.', 'Get it home.'], (index) => {
      if (index === 1) box.hold(1000);
    });
    box.skip();
    expect(box.advance()).toBe(true);

    // Pressed and pressed again inside the hold: the line stays up.
    for (let press = 0; press < 6; press += 1) {
      box.skip();
      expect(box.isCurrentMessageComplete).toBe(false);
      expect(box.advance()).toBe(false);
      box.update(150);
    }
    expect(shown()).toBe('WREN was carrying a LIFE ORB.');

    box.update(150);
    expect(box.isCurrentMessageComplete).toBe(true);
    expect(box.advance()).toBe(true);
    box.skip();
    expect(shown()).toBe('Get it home.');
    // The next line is not held unless asked.
    expect(box.isCurrentMessageComplete).toBe(true);
  });
});
