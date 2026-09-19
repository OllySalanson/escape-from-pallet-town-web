import { describe, expect, it, vi } from 'vitest';
import {
  HP_BAR_WIDTH,
  PIXEL_STATUS_SELECTOR,
  escapeAttribute,
  pixelCommitBar,
  pixelHpBar,
  pixelRail,
  pixelScreen,
  pixelTag,
  pixelWindow,
  takeDownPixelStatus,
} from './pixelUi';

const fillOf = (bar: string): number => Number(/--fill:(\d+)/.exec(bar)?.[1]);

describe('pixelHpBar', () => {
  it('fills a whole number of game pixels, never a percentage', () => {
    for (let hp = 0; hp <= 23; hp += 1) {
      const bar = pixelHpBar(hp, 23);
      expect(bar).not.toContain('%');
      expect(Number.isInteger(fillOf(bar))).toBe(true);
    }
    expect(fillOf(pixelHpBar(23, 23))).toBe(HP_BAR_WIDTH);
  });

  it('shows anyone still standing at least one pixel, and only the fainted none', () => {
    expect(fillOf(pixelHpBar(1, 400))).toBe(1);
    expect(fillOf(pixelHpBar(0, 400))).toBe(0);
    expect(fillOf(pixelHpBar(0, 0))).toBe(0);
  });

  it('colours the bar by the same thresholds the rest of the game uses', () => {
    expect(pixelHpBar(11, 20)).toContain('healthy');
    expect(pixelHpBar(10, 20)).toContain('warning');
    expect(pixelHpBar(4, 20)).toContain('critical');
  });

  it('still says the number to a screen reader', () => {
    expect(pixelHpBar(7, 22)).toContain('aria-label="HP 7 of 22"');
  });
});

describe('pixelScreen', () => {
  const screen = (status?: string): string =>
    pixelScreen({ title: 'Base', body: '<main></main>', hints: 'ARROWS move', status });

  it('gives the help bar a default it can fall back to when the cursor has nothing to say', () => {
    expect(screen()).toContain('data-help-text data-help-default="ARROWS move"');
  });

  it('hands the help bar to a status message while there is one', () => {
    const withStatus = screen('Charmander recovered.');

    expect(withStatus).toContain('role="status">Charmander recovered.');
    // The help text stays underneath, hidden by `has-status`, so the message can
    // be taken down without rebuilding the screen under the pointer.
    expect(withStatus).toContain('class="px-help has-status"');
    expect(withStatus).toContain('data-help-text');
  });

  it('takes a status line down in place, leaving the help text it stood over', () => {
    const classes = new Set(['px-help', 'has-status']);
    const line = {
      parentElement: { classList: { remove: (name: string) => classes.delete(name) } },
      remove: vi.fn(),
    };
    const root = {
      querySelector: (selector: string) => (selector === PIXEL_STATUS_SELECTOR ? line : null),
    } as unknown as ParentNode;

    takeDownPixelStatus(root);

    expect(line.remove).toHaveBeenCalledOnce();
    expect([...classes]).toEqual(['px-help']);
    // And a screen with no status is left alone rather than throwing.
    expect(() => takeDownPixelStatus({ querySelector: () => null })).not.toThrow();
  });

  it('only draws a way back on a screen that has one', () => {
    expect(screen()).not.toContain('px-back');
    expect(
      pixelScreen({
        title: 'Stash',
        body: '',
        hints: '',
        back: { label: 'Base', attribute: 'data-back' },
      }),
    ).toContain('<button class="px-back" data-back>Base</button>');
  });
});

describe('pixelCommitBar', () => {
  it('is the full-width bar every committing screen ends on, with the title beside its actions', () => {
    const bar = pixelCommitBar({
      title: '1/6 packed',
      lines: ['<span>Charmander</span>'],
      actions: '<button data-advance>Go</button>',
      className: 'px-tone-secure',
    });

    expect(bar).toContain('class="px-window confirm-bar px-tone-secure"');
    expect(bar.indexOf('1/6 packed')).toBeLessThan(bar.indexOf('data-advance'));
    expect(bar.indexOf('data-advance')).toBeLessThan(bar.indexOf('Charmander'));
  });
});

describe('the small parts', () => {
  it('marks where the route is, what is behind it and what is ahead', () => {
    const rail = pixelRail(['Loadout', 'Final check', 'Raid'], 2);

    expect(rail).toContain('<li class="done">Loadout</li>');
    expect(rail).toContain('<li class="current" aria-current="step">Final check</li>');
    expect(rail).toContain('<li class="upcoming">Raid</li>');
  });

  it('draws the tick rather than typing one', () => {
    expect(pixelTag('Added', 'good', true)).toBe('<span class="px-tag px-tag-good has-tick">Added</span>');
    expect(pixelTag('Add')).toBe('<span class="px-tag px-tag-plain">Add</span>');
  });

  it('frames a window with an optional heading and note', () => {
    expect(pixelWindow('x', { heading: 'Stash', note: '2 hurt', className: 'wide' })).toBe(
      '<section class="px-window wide"><header class="px-heading"><h2>Stash</h2><small>2 hurt</small></header>x</section>',
    );
    expect(pixelWindow('x', { tag: 'div' })).toBe('<div class="px-window">x</div>');
  });

  it('keeps a quoted name from closing the attribute it is written into', () => {
    expect(escapeAttribute('Farfetch"d <& co>')).toBe('Farfetch&quot;d &lt;&amp; co>');
  });
});
