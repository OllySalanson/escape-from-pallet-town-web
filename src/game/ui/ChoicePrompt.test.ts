import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Geom: {
      Rectangle: class {
        public readonly x: number;
        public readonly y: number;
        public readonly width: number;
        public readonly height: number;
        public constructor(x: number, y: number, width: number, height: number) {
          this.x = x;
          this.y = y;
          this.width = width;
          this.height = height;
        }
        public static Contains(): boolean {
          return true;
        }
      },
    },
    GameObjects: {
      Container: class {
        public x: number;
        public y: number;
        public constructor(_scene: unknown, x: number, y: number) {
          this.x = x;
          this.y = y;
        }
        public add(): this {
          return this;
        }
        public setDepth(): this {
          return this;
        }
        public setScrollFactor(): this {
          return this;
        }
      },
    },
  },
}));

import { trainerChallengePrompt } from '../world/trainerEngagement';
import { ChoicePrompt } from './ChoicePrompt';

/** A text that keeps what it says, which is all the prompt draws its cursor with. */
class FakeText {
  public text: string;
  public x: number;
  public y: number;
  public color = '';
  public hitArea: { x: number; y: number; width: number; height: number } | null = null;
  public constructor(text: string, x: number, y: number) {
    this.text = text;
    this.x = x;
    this.y = y;
  }
  /** Seven pixels a letter: near enough Orange Kid at dialogue size. */
  public get width(): number {
    return this.text.length * 7;
  }
  public setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  public setText(text: string): this {
    this.text = text;
    return this;
  }
  public setColor(color: string): this {
    this.color = color;
    return this;
  }
  public scrollFactor = 1;
  public setScrollFactor(factor: number): this {
    this.scrollFactor = factor;
    return this;
  }
  public setInteractive(config: { hitArea: FakeText['hitArea'] }): this {
    this.hitArea = config.hitArea;
    return this;
  }
  public on(): this {
    return this;
  }
}

const anything = (): unknown => new Proxy(() => anything(), { get: () => anything });

function ask(options: readonly string[], selected: number, y = 200) {
  const texts: FakeText[] = [];
  const scene = {
    add: {
      graphics: anything,
      text: (x: number, y: number, label: string) => {
        const text = new FakeText(label, x, y);
        texts.push(text);
        return text;
      },
      existing: () => undefined,
    },
  };
  const chosen: number[] = [];
  const prompt = new ChoicePrompt(scene as never, {
    x: 0,
    y,
    width: 300,
    height: 60,
    lines: ['A question?'],
    options,
    selected,
    onChoose: (index) => chosen.push(index),
  });
  return {
    texts,
    prompt,
    chosen,
    highlighted: () => [prompt.highlighted],
  };
}

describe('a choice in the world', () => {
  it('stays on BACK AWAY when the key points at it, so a trainer is never challenged by a press towards the safe answer', () => {
    const challenge = trainerChallengePrompt('LASS ADA');
    const { prompt, chosen, highlighted } = ask(challenge.options, challenge.selected);
    expect(highlighted()).toEqual([challenge.options[challenge.selected]]);

    // Right and Down point at BACK AWAY, which is already the last option.
    expect(prompt.moveSelection(1)).toBe(false);
    prompt.confirm();
    expect(challenge.options[chosen[0]]).toBe(challenge.options[challenge.selected]);
    expect(highlighted()).toEqual([challenge.options[challenge.selected]]);
  });

  it('rests on the end a key points at, however often it is pressed, as FireRed’s YES/NO box does', () => {
    const { prompt, highlighted } = ask(['YES', 'NO'], 1);

    expect(prompt.moveSelection(-1)).toBe(true);
    expect(highlighted()).toEqual(['YES']);
    // A second Left (or Up) after it is still YES - it used to toggle back to NO.
    expect(prompt.moveSelection(-1)).toBe(false);
    expect(highlighted()).toEqual(['YES']);
    expect(prompt.selected).toBe(0);

    expect(prompt.moveSelection(1)).toBe(true);
    expect(prompt.moveSelection(1)).toBe(false);
    expect(highlighted()).toEqual(['NO']);
  });

  it('walks a longer list one option a press and stops at either end', () => {
    const { prompt } = ask(['B1F', '1F', '2F', 'EXIT'], 1);
    prompt.moveSelection(1);
    prompt.moveSelection(1);
    prompt.moveSelection(1);
    expect(prompt.selected).toBe(3);
    for (let press = 0; press < 6; press += 1) prompt.moveSelection(-1);
    expect(prompt.selected).toBe(0);
  });
});

describe('a question under a camera that has scrolled', () => {
  it('has answers a pointer finds where they are drawn: a hit is tested against each one\'s own scroll factor', () => {
    const { texts } = ask(['YES', 'NOT NOW'], 0);
    expect(texts.slice(-2).map((text) => text.scrollFactor)).toEqual([0, 0]);
  });
});

describe('the answer window', () => {
  it('stands on top of the question box, so a question of two lines never has an answer printed over it', () => {
    const { texts } = ask(['YES', 'NOT NOW'], 0);
    const answers = texts.slice(-2);
    // The question box is y 0 to 60; every answer is above it.
    expect(answers.every((text) => text.y < 0)).toBe(true);
    // One under another, as FireRed's YES/NO is.
    expect(answers[0].x).toBe(answers[1].x);
    expect(answers[1].y).toBeGreaterThan(answers[0].y);
  });

  it('stands at the right end of the box, as wide as its longest answer', () => {
    const { texts } = ask(['YES', 'NOT NOW'], 0);
    const longest = texts[texts.length - 1];
    expect(longest.x + longest.width).toBeLessThanOrEqual(300);
    expect(longest.x).toBeGreaterThan(150);
  });

  it('answers a press anywhere on the row, not only on the letters', () => {
    const { texts } = ask(['YES', 'NOT NOW'], 0);
    const yes = texts[texts.length - 2];
    expect(yes.hitArea!.width).toBeGreaterThan(yes.width);
    expect(yes.hitArea!.height).toBeGreaterThanOrEqual(16);
    expect(yes.hitArea!.x).toBeLessThan(0);
  });

  it('writes every answer in full ink, so the one the cursor is not on never reads as one that cannot be chosen', () => {
    const { texts, prompt } = ask(['YES', 'NOT NOW'], 1);
    const [yes, notNow] = texts.slice(-2);
    expect(yes.color).toBe(notNow.color);
    prompt.moveSelection(-1);
    expect(prompt.highlighted).toBe('YES');
  });

  it('shares one frame line with the question box beneath it', () => {
    const { prompt } = ask(['YES', 'NOT NOW'], 0);
    // The answer window's bottom line is the box's top line, y 200.
    const bounds = prompt.bounds;
    expect(bounds.y + bounds.height).toBe(260);
    expect(bounds.y).toBeLessThan(200);
  });

  it('hangs its answers under a question seated at the top of the screen, never off it', () => {
    // Seated clear of somebody standing below (the race judge asking which stone):
    // there is no room above, so the answers share the box's bottom line instead.
    const { prompt } = ask(['THUNDER', 'FIRE', 'WATER', 'LEAF', 'MOON'], 0, 4);
    const bounds = prompt.bounds;
    expect(bounds.y).toBe(4);
    expect(bounds.y + bounds.height).toBeGreaterThan(4 + 60);
  });

  it('says where its box and its answers are apart, so a chip beside the answers is not stood aside for nothing', () => {
    const { prompt } = ask(['FLOOR 1', 'FLOOR 2', 'FLOOR 3', 'EXIT'], 0);
    const [box, answers] = prompt.rects;
    expect(box).toMatchObject({ x: 0, y: 200, width: 300, height: 60 });
    expect(answers.y + answers.height).toBe(201);
    expect(answers.width).toBeLessThan(300);
  });
});
