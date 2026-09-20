import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const stylesheet = await readFile(new URL('./style.css', import.meta.url), 'utf8');

/** Everything from the pixel-ui banner to the end of the file is that system. */
const pixelUi = stylesheet.slice(
  stylesheet.lastIndexOf('/*', stylesheet.indexOf('Pixel UI: the DOM screens')),
);
/** The drawn cursor and tick are SVG data, which is full of numbers that are not lengths. */
const pixelUiRules = pixelUi.replace(/url\("data:[^"]*"\)/g, 'url()').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the two boxes', () => {
  const rule = (selector: string): string =>
    new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(stylesheet)?.[1] ?? '';

  it('lays the DOM screens out against the window, not against the canvas', () => {
    // The whole fault this split exists for: `#app` was a container and the
    // screens measured themselves against it, so a stash on a 4K display got
    // exactly the room a stash gets on a laptop, only magnified.
    expect(rule('#app')).not.toMatch(/container-type/);
    const screens = rule('#screens');
    expect(screens).toMatch(/position:\s*fixed;/);
    expect(screens).toMatch(/container-type:\s*inline-size;/);
  });

  it('leaves the canvas its own box, so nothing anchored to a tile moves', () => {
    const app = rule('#app');
    expect(app).toMatch(/position:\s*relative;/);
    // The canvas is still the only thing sized to the stage, and the frame is
    // still drawn outside the layout box so it costs the art no pixels.
    expect(app).toMatch(/box-shadow:\s*0 0 0 2px/);
    expect(rule('#app > canvas')).toMatch(/image-rendering:\s*pixelated;/);
  });

  it('gives the empty layer back to whatever is under it', () => {
    expect(rule('#screens')).toMatch(/pointer-events:\s*none;/);
    expect(rule('#screens .menu-overlay')).toMatch(/pointer-events:\s*auto;/);
    // Including its frame: an empty layer drew a rectangle round the raid.
    expect(rule('#screens')).not.toMatch(/box-shadow/);
    expect(rule('#screens:not(:empty)')).toMatch(/box-shadow:\s*0 0 0 2px/);
  });
});

describe('the pixel-ui stylesheet', () => {
  it('is there at all', () => {
    expect(pixelUi.length).toBeGreaterThan(1000);
  });

  it('measures everything in game pixels, so nothing lands between two of them', () => {
    // `--u` itself falls back to two CSS pixels before the stage scaler has run.
    const lengths = pixelUiRules
      .replace('--u: var(--px, 2px);', '')
      .match(/\b\d*\.?\d+(?:px|vw|vh|cqw|cqh|em|rem|ch)\b/g);
    expect(lengths ?? []).toEqual([]);
  });

  it('only ever multiplies the game pixel by a whole number, except for the one type size', () => {
    const multiples = [...pixelUiRules.matchAll(/var\(--u\) \* (-?[\d.]+)/g)].map((match) => match[1]);
    expect(multiples.length).toBeGreaterThan(50);
    expect(multiples.filter((value) => !/^-?\d+$/.test(value))).toEqual(['12.5']);
  });

  it('has one type size: hierarchy is caps, ink and position', () => {
    const sizes = [...pixelUiRules.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1]);
    expect(new Set(sizes)).toEqual(new Set(['calc(var(--u) * 12.5)', 'inherit']));
  });

  it('draws square windows: no radius, no soft shadow', () => {
    const radii = [...pixelUiRules.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => match[1]);
    expect(radii.filter((value) => value !== '0')).toEqual([]);
    // A blur radius is the third length of a shadow; every shadow here is a hard edge.
    const shadows = [...pixelUiRules.matchAll(/box-shadow:\s*([^;]+);/g)].map((match) => match[1]);
    expect(shadows.filter((value) => /var\(--shadow\)|\dpx/.test(value))).toEqual([]);
  });

  it('is scoped: no rule reaches a screen that has not opted in', () => {
    // The older rounded screens share class names with the lobby (`confirm-bar`,
    // `loadout-layout`), and a view that has not been redrawn yet must be able to
    // stand beside one that has. `:where()` scopes without adding weight, so the
    // cascade inside the system reads exactly as it is written.
    // Whatever stands directly before an opening brace is a selector list or an
    // at-rule's prelude.
    const selectors = [...pixelUiRules.matchAll(/([^{}]+)\{/g)]
      .map((match) => match[1].trim())
      .filter((prelude) => !prelude.startsWith('@'))
      // Top-level commas only: `:where(h1, h2)` is one selector.
      .flatMap((list) => list.split(/,(?![^()]*\))/))
      .map((selector) => selector.trim());
    expect(selectors.length).toBeGreaterThan(100);
    expect(selectors.filter((selector) => !/^(:where\(\.pixel-ui\)|\.pixel-ui|\.menu-overlay\.pixel-ui)[ .:]/.test(`${selector} `))).toEqual([]);
  });

  it('ranks a heading above its own body: the face has no bold cut and one size', () => {
    // Weight and size are both off the table (`strong` is 400, one font-size),
    // so a heading is told from the sentences under it by inversion and ink.
    // Plain ink over a `--cream-dim` hairline is what the captain read as a
    // wall of equal text, and it must not come back.
    const heading = /:where\(\.pixel-ui\) \.px-heading \{([^}]*)\}/.exec(pixelUiRules)?.[1] ?? '';
    expect(heading).toMatch(/background:\s*var\(--bar\);/);
    expect(heading).toMatch(/color:\s*var\(--bar-text\);/);
    expect(heading).not.toMatch(/--cream-dim/);
    // A note is whole or it is not drawn: the strip wraps a note that does not
    // fit onto a line it clips away, and never shrinks or clips the note itself.
    expect(heading).toMatch(/flex-wrap:\s*wrap;/);
    expect(heading).toMatch(/overflow:\s*hidden;/);
    const note = /:where\(\.pixel-ui\) \.px-heading small \{([^}]*)\}/.exec(pixelUiRules)?.[1] ?? '';
    expect(note).toMatch(/flex:\s*0 0 auto;/);
    expect(note).not.toMatch(/overflow/);
    const subheading = /:where\(\.pixel-ui\) \.px-subheading \{([^}]*)\}/.exec(pixelUiRules)?.[1] ?? '';
    // Never `--ink-soft`: that is de-emphasis, and a heading is not that.
    expect(subheading).toMatch(/color:\s*var\(--ink\);/);
    // More room above than below, so it binds to what follows.
    const [, above, below] = /margin:\s*calc\(var\(--u\) \* (\d+)\) 0 (var\(--u\)|calc\(var\(--u\) \* (\d+)\));/.exec(subheading) ?? [];
    expect(Number(above)).toBeGreaterThan(Number(below === 'var(--u)' ? 1 : below));
  });

  it('never rules a divider in an ink that cannot be seen on cream', () => {
    // `--cream-dim` on `--cream` is a twelve per cent step: it reads as a fill
    // (the in-list band is one) and never as a line.
    const shadows = [...pixelUiRules.matchAll(/box-shadow:\s*([^;]+);/g)].map((match) => match[1]);
    expect(shadows.filter((value) => value.includes('--cream-dim'))).toEqual([]);
  });

  it('lets no child resize the screen it is drawn on', () => {
    // A grid's `auto` column takes its floor from the widest child's
    // min-content, and the title bar's back label and aside are both `nowrap`:
    // at the smallest stage the lobby pushed the whole screen past the canvas
    // and clipped its own count off the right edge.
    const screen = /:where\(\.pixel-ui\) \.px-screen \{([^}]*)\}/.exec(pixelUiRules)?.[1] ?? '';
    expect(screen).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    const aside = /:where\(\.pixel-ui\) \.px-title-aside \{([^}]*)\}/.exec(pixelUiRules)?.[1] ?? '';
    expect(aside).toMatch(/min-width:\s*0;/);
    expect(aside).toMatch(/overflow:\s*hidden;/);
  });

  it('says how much is below the fold of a pane, in words, over a drawn track', () => {
    // "There is more" and "there are fifteen more" are different answers, and
    // only the second tells a player whether what they want is one row down or
    // off the end of a list they cannot see the size of.
    const strip = /:where\(\.pixel-ui\) \.px-scroll\[data-more\]::after \{([^}]*)\}/.exec(pixelUiRules)?.[1] ?? '';
    expect(strip).toMatch(/content:\s*attr\(data-more\);/);
    // A whole line of the one type size, so the count is never half drawn.
    expect(strip).toMatch(/height:\s*var\(--more-cover, calc\(var\(--u\) \* 13\)\);/);
    const track = /::-webkit-scrollbar-track \{([^}]*)\}/.exec(pixelUiRules)?.[1] ?? '';
    expect(track).not.toMatch(/background:\s*transparent;/);
    expect(track).toMatch(/background:\s*var\(--cream-dim\);/);
  });

  it('lets wrapped copy break inside a narrow window instead of widening it', () => {
    expect(pixelUi).toMatch(
      /\.px-wrap\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*break-word;[^}]*\}/,
    );
  });
});
