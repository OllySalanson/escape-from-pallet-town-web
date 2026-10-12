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
  it('shares a line too long for the box over as many boxes as it takes, a whole row at a time', () => {
    const { box, shown, read, onComplete } = baseBox();
    const heard = vi.fn();
    // More rows than a box that holds two.
    const long =
      'KANTO TONIGHT: BLUE, grandson of PROFESSOR OAK, tells our reporter he is never far behind.';
    expect(wrap(long).length).toBeGreaterThan(2);

    box.showMessages([long, 'Next raid, BLUE.'], heard);
    box.skip();
    expect(shown()).toBe(wrap(long).slice(0, 2).join('\n'));
    expect(heard.mock.calls).toEqual([[0]]);

    expect(read()).toBe(true);
    box.skip();
    expect(shown()).toBe(wrap(long).slice(2, 4).join('\n'));
    // Still the first line: its sound is not heard again for its second box.
    expect(heard.mock.calls).toEqual([[0]]);

    const rest = wrap(long).slice(4);
    if (rest.length) {
      expect(read()).toBe(true);
      box.skip();
      expect(shown()).toBe(rest.join('\n'));
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
});
