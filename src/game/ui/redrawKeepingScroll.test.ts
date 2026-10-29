import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  },
}));

import { redrawKeepingScroll, type RedrawnRoot } from './MenuOverlay';

/** A screen whose elements are read off the classes in its markup, in order. */
class FakeScreen implements RedrawnRoot {
  public elements: { getAttribute(name: 'class'): string | null; scrollTop: number }[] = [];
  private markup = '';

  public get innerHTML(): string {
    return this.markup;
  }

  public set innerHTML(markup: string) {
    this.markup = markup;
    // A new element always starts at its top, as the browser's does.
    this.elements = [...markup.matchAll(/class="([^"]*)"/g)].map(([, classes]) => ({
      getAttribute: () => classes,
      scrollTop: 0,
    }));
  }

  public querySelectorAll(): Iterable<{ getAttribute(name: 'class'): string | null; scrollTop: number }> {
    return this.elements;
  }
}

const LOADOUT = '<div class="px-screen"><div class="px-list px-scroll"></div><div class="px-list px-scroll"></div><div class="px-grid"></div></div>';

describe('redrawKeepingScroll', () => {
  it('keeps each list where it was scrolled when the same screen is drawn again (the captain, 2026-10-29)', () => {
    const screen = new FakeScreen();
    screen.innerHTML = LOADOUT;
    // The second list - the stash's supplies - scrolled down to pack one.
    screen.elements[2].scrollTop = 140;

    redrawKeepingScroll(screen, LOADOUT.replace('px-grid', 'px-grid is-fuller'));

    expect(screen.elements.map((element) => element.scrollTop)).toEqual([0, 0, 140, 0]);
  });

  it('tells two lists with the same classes apart by their order', () => {
    const screen = new FakeScreen();
    screen.innerHTML = LOADOUT;
    screen.elements[1].scrollTop = 30;
    screen.elements[2].scrollTop = 90;

    redrawKeepingScroll(screen, LOADOUT);

    expect(screen.elements[1].scrollTop).toBe(30);
    expect(screen.elements[2].scrollTop).toBe(90);
  });

  it('leaves a list it cannot match at its top', () => {
    const screen = new FakeScreen();
    screen.innerHTML = LOADOUT;
    screen.elements[1].scrollTop = 30;

    redrawKeepingScroll(screen, '<div class="px-screen"><div class="px-detail px-scroll"></div></div>');

    expect(screen.elements[1].scrollTop).toBe(0);
  });
});
