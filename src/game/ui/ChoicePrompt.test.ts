import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    GameObjects: {
      Container: class {
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
  public constructor(text: string) {
    this.text = text;
  }
  public setText(text: string): this {
    this.text = text;
    return this;
  }
  public setColor(): this {
    return this;
  }
  public setInteractive(): this {
    return this;
  }
  public on(): this {
    return this;
  }
}

const anything = (): unknown => new Proxy(() => anything(), { get: () => anything });

function ask(options: readonly string[], selected: number) {
  const texts: FakeText[] = [];
  const scene = {
    add: {
      graphics: anything,
      text: (_x: number, _y: number, label: string) => {
        const text = new FakeText(label);
        texts.push(text);
        return text;
      },
      existing: () => undefined,
    },
  };
  const chosen: number[] = [];
  const prompt = new ChoicePrompt(scene as never, {
    x: 0,
    y: 0,
    width: 300,
    height: 60,
    lines: ['A question?'],
    options,
    selected,
    onChoose: (index) => chosen.push(index),
  });
  return {
    prompt,
    chosen,
    highlighted: () =>
      texts.filter((text) => text.text.startsWith('▶')).map((text) => text.text.slice(2)),
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
