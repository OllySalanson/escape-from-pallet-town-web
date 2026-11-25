import { describe, expect, it, vi } from 'vitest';
import { POINTABLE, POINTER_GROUP, PointerPreview, type PointerTarget } from './pointerPreview';

/**
 * The captain's complaint of 2026-09-27, held as a rule: on the screen where a
 * move is taught, resting the pointer on a Pokemon made it the chosen one.
 *
 * There is no DOM in this suite, so an element is faked down to what the rule
 * asks of one - where it sits (`closest`) and whether it was focused.
 */
class FakeElement implements PointerTarget {
  public readonly focus = vi.fn();
  public readonly name: string;
  private readonly matches: readonly string[];
  private readonly parent: FakeElement | null;

  public constructor(name: string, matches: readonly string[] = [], parent: FakeElement | null = null) {
    this.name = name;
    this.matches = matches;
    this.parent = parent;
  }

  public closest(selector: string): FakeElement | null {
    if (this.matches.includes(selector)) {
      return this;
    }
    return this.parent?.closest(selector) ?? null;
  }
}

/** A list of three Pokemon cards, a gap between them, and the TEACH button. */
function screen() {
  const list = new FakeElement('list', [POINTER_GROUP]);
  const cards = ['squirtle', 'lapras', 'seel'].map((name) => new FakeElement(name, [POINTABLE], list));
  // The name inside a card is a child of the card, as the pointer finds it.
  const seelName = new FakeElement('seel-name', [], cards[2]);
  const teach = new FakeElement('teach', [POINTABLE]);
  const backdrop = new FakeElement('backdrop');
  let cursor: FakeElement | null = cards[0];
  const help: (string | null)[] = [];
  const pointed: (string | null)[] = [];
  const preview = new PointerPreview<FakeElement>({
    help: (control) => help.push(control?.name ?? null),
    pointed: (control) => pointed.push(control?.name ?? null),
    cursor: () => cursor,
  });
  const click = (control: FakeElement): void => {
    // A button takes focus when it is pressed; that, not the pointer, is what
    // moves the cursor - and the overlay tells the preview it moved.
    cursor = control;
    preview.cursorMoved();
  };
  return { list, cards, seelName, teach, backdrop, preview, help, pointed, click, cursor: () => cursor };
}

describe('a pointer that only previews', () => {
  it('never moves the cursor, whatever it rests on', () => {
    const { cards, seelName, teach, preview, cursor } = screen();
    for (const target of [cards[1], seelName, teach, cards[2]]) {
      preview.moved(target);
    }
    expect(cursor()?.name).toBe('squirtle');
    for (const element of [...cards, seelName, teach]) {
      expect(element.focus).not.toHaveBeenCalled();
    }
  });

  it('reads the help of whatever it rests on, found from inside it', () => {
    const { seelName, preview, help } = screen();
    preview.moved(seelName);
    expect(preview.pointed?.name).toBe('seel');
    expect(help).toEqual(['seel']);
  });

  it('keeps its answer across the gap between two cards', () => {
    const { cards, list, preview, help } = screen();
    preview.moved(cards[1]);
    preview.moved(list);
    preview.moved(cards[2]);
    // No flick back to the cursor's line in the gap.
    expect(help).toEqual(['lapras', 'seel']);
  });

  it('gives the help back to the cursor when it leaves', () => {
    const { cards, backdrop, preview, help } = screen();
    preview.moved(cards[2]);
    preview.moved(backdrop);
    expect(help).toEqual(['seel', 'squirtle']);
    preview.moved(cards[1]);
    preview.left();
    expect(help).toEqual(['seel', 'squirtle', 'lapras', 'squirtle']);
    expect(preview.pointed).toBeNull();
  });

  it('lets a click choose, and the arrow keys still carry the cursor', () => {
    const { cards, teach, preview, click, cursor } = screen();
    preview.moved(cards[2]);
    click(cards[2]);
    expect(cursor()?.name).toBe('seel');
    expect(preview.pointed).toBeNull();
    // An arrow key moves the cursor the same way; resting the pointer on the
    // TEACH button after that still moves nothing.
    click(cards[1]);
    preview.moved(teach);
    expect(cursor()?.name).toBe('lapras');
    expect(teach.focus).not.toHaveBeenCalled();
  });
});

/**
 * The navigation audit (25 Nov 2026): every other screen let the pointer move
 * the cursor, so a pointer left resting on JUMP IN decided what the next Enter
 * did. Olly ruled that pointing only lights a thing, on every screen, so there
 * is no rule to choose any more - and a screen whose card follows its cursor
 * is told what is pointed at instead, to answer it the same way.
 */
describe('a pointer on any screen', () => {
  it('tells the screen what it rests on, and when it has left, without focusing anything', () => {
    const { cards, backdrop, preview, pointed, cursor } = screen();
    preview.moved(cards[2]);
    preview.moved(cards[1]);
    preview.moved(backdrop);
    expect(pointed).toEqual(['seel', 'lapras', null]);
    expect(cursor()?.name).toBe('squirtle');
    for (const card of cards) {
      expect(card.focus).not.toHaveBeenCalled();
    }
  });
});
