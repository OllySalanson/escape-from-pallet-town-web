import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const stylesheet = await readFile(new URL('./style.css', import.meta.url), 'utf8');

/** Everything from the pixel-ui banner to the end of the file is that system. */
const pixelUi = stylesheet.slice(
  stylesheet.lastIndexOf('/*', stylesheet.indexOf('Pixel UI: the DOM screens')),
);
/** The drawn cursor and tick are SVG data, which is full of numbers that are not lengths. */
const pixelUiRules = pixelUi.replace(/url\("data:[^"]*"\)/g, 'url()').replace(/\/\*[\s\S]*?\*\//g, '');

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

  it('lets wrapped copy break inside a narrow window instead of widening it', () => {
    expect(pixelUi).toMatch(
      /\.px-wrap\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*break-word;[^}]*\}/,
    );
  });
});
