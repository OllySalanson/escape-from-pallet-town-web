import { describe, expect, it, vi } from 'vitest';

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

        public setVisible(visible: boolean): this {
          this.visible = visible;
          return this;
        }
      },
    },
  },
}));

import { DialogBox } from './DialogBox';

function createDialogHarness(): { dialog: DialogBox; text: { value: string } } {
  const text = { value: '' };
  const scene = {
    scale: { height: 240 },
    add: {
      existing: vi.fn(),
      graphics: vi.fn(() => ({
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillRoundedRect: vi.fn(),
        lineStyle: vi.fn(),
        strokeRoundedRect: vi.fn(),
      })),
      image: vi.fn(() => ({
        setDisplaySize: vi.fn().mockReturnThis(),
      })),
      text: vi.fn((_x: number, _y: number, value: string) => ({
        setOrigin: vi.fn().mockReturnThis(),
        setText: vi.fn((nextValue: string) => {
          text.value = nextValue;
        }),
        setVisible: vi.fn().mockReturnThis(),
        value,
      })),
    },
  };

  return {
    dialog: new DialogBox(scene as never, { charsPerSecond: 40 }),
    text,
  };
}

describe('DialogBox', () => {
  it('renders a meaningful first character on entry and after advancing trainer narration', () => {
    const { dialog, text } = createDialogHarness();

    dialog.showMessages(['RIVAL wants to battle!', 'Go, CHARMANDER!']);
    expect(text.value).toBe('R');

    dialog.skip();
    dialog.advance();
    expect(text.value).toBe('G');
  });
});
