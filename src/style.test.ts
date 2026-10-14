import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const stylesheet = await readFile(new URL('./style.css', import.meta.url), 'utf8');

/** Every module of the game, so the classes the markup pairs with a shared one can be read off it. */
const gameSources = await Promise.all(
  (await readdir(new URL('./game', import.meta.url), { recursive: true }))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => readFile(new URL(`./game/${file}`, import.meta.url), 'utf8')),
);
/** Every module that draws a scrolling pane, so the panes' own classes can be read off the markup. */
const scrollPaneMarkup = gameSources.filter((source) => source.includes('px-scroll'));

/**
 * The bottom padding a rule gives, if it gives one that is not zero - from
 * `padding-bottom` or from the third (or only) value of the `padding` shorthand.
 */
function footOf(body: string): string | null {
  const longhand = /padding-bottom:\s*([^;]+);/.exec(body)?.[1]?.trim();
  if (longhand !== undefined) {
    return longhand === '0' ? null : `padding-bottom: ${longhand}`;
  }
  const shorthand = /(?:^|[\s;])padding:\s*([^;]+);/.exec(body)?.[1]?.trim();
  if (shorthand === undefined) {
    return null;
  }
  // Split on spaces outside brackets, so `calc(var(--u) * 2)` is one value.
  const values: string[] = [''];
  let depth = 0;
  for (const character of shorthand) {
    depth += character === '(' ? 1 : character === ')' ? -1 : 0;
    if (depth === 0 && /\s/.test(character)) {
      if (values.at(-1) !== '') values.push('');
    } else {
      values[values.length - 1] += character;
    }
  }
  const bottom = values[2] ?? values[0];
  return bottom === '0' ? null : `padding: ${shorthand}`;
}

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
    // The scope may carry a state - `:where(.pixel-ui[data-room='narrow'])` is
    // how the one rule that needs to know how much room the screen has asks -
    // but it is still the screen's own class that it hangs from.
    expect(selectors.filter((selector) => !/^(:where\(\.pixel-ui(\[[^\]]*\])?\)|\.pixel-ui|\.menu-overlay\.pixel-ui)[ .:]/.test(`${selector} `))).toEqual([]);
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

  it('gives no scrolling pane a foot of its own, whatever else it is', () => {
    // `.px-scroll` sets `padding-bottom: 0` because a sticky MORE strip sticks
    // to the *content* edge: a pane with bottom padding draws the tops of the
    // next line's letters in the gap under its own cue. The dossier re-added
    // two pixels of it further down the file and had exactly that at 640x480.
    // Bill's shop pane did the same thing again, two pixels that showed a red
    // stub of the next line under his MORE strip. So every class the markup
    // ever puts beside `px-scroll` is held to it, read off the markup rather
    // than listed here, and the `padding` shorthand is read as well as the
    // longhand.
    expect(/:where\(\.pixel-ui\) \.px-scroll \{([^}]*)\}/.exec(pixelUiRules)?.[1] ?? '').toMatch(
      /padding-bottom:\s*0;/,
    );
    const paneClasses = new Set(
      scrollPaneMarkup.flatMap((source) =>
        [...source.matchAll(/(?:class="|className: ')([^"']*\bpx-scroll\b[^"']*)["']/g)].flatMap((match) =>
          match[1].split(/\s+/).filter((name) => name !== '' && name !== 'px-scroll'),
        ),
      ),
    );
    expect([...paneClasses]).toEqual(expect.arrayContaining(['px-list', 'px-detail', 'px-dossier', 'shop-detail']));
    const feet = [...pixelUiRules.matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap(([, selector, body]) => {
      const subjects = selector.split(',').map((one) => one.trim().split(/\s+/).at(-1) ?? '');
      const pane = [...paneClasses].find((name) =>
        subjects.some((subject) => new RegExp(`\\.${name}(?![\\w-])`).test(subject)),
      );
      return pane && footOf(body) ? [`${selector.trim()} { ${footOf(body)} }`] : [];
    });
    expect(feet).toEqual([]);
  });

  it('never pads a window from a rule the window itself outranks', () => {
    // `.pixel-ui .px-window` sets the padding every window has, two classes
    // deep, and nearly everything else here is scoped through `:where()` and
    // weighs one. So a rule that pads a class the markup always draws as a
    // window - `:where(.pixel-ui[data-room='tight']) .trader-standing` - loses
    // to it and is simply never applied. That one sat dead for a whole release:
    // Bill's standing kept a blank band under its strip at 320x240 and both of
    // his lists lost their only whole row to it. The window classes are read off
    // the markup, every class that stands beside `px-window` or is handed to
    // `pixelWindow` as its `className`.
    const windowClasses = new Set(
      gameSources.flatMap((source) => [
        ...[...source.matchAll(/class="([^"]*\bpx-window\b[^"]*)"/g)].flatMap((match) => match[1].split(/\s+/)),
        ...[...source.matchAll(/pixelWindow\([\s\S]*?className: ['`]([^'`$]*)/g)].flatMap((match) => match[1].split(/\s+/)),
      ].filter((name) => /^[\w-]+$/.test(name) && name !== 'px-window')),
    );
    expect([...windowClasses]).toEqual(expect.arrayContaining(['trader-standing', 'trader-shelf', 'objectives-panel']));
    const dead = [...pixelUiRules.matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap(([, selectors, body]) => {
      if (!/(?:^|[\s;])padding(?:-top|-right|-bottom|-left)?\s*:/.test(body)) return [];
      return selectors.split(',').map((one) => one.trim()).filter((one) => {
        if (!one.startsWith(':where(')) return false;
        const weighed = one.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
        const weight = (weighed.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
        const subject = weighed.trim().split(/\s+/).at(-1) ?? '';
        return weight < 2 && [...windowClasses].some((name) => new RegExp(`\\.${name}(?![\\w-])`).test(subject));
      });
    });
    // One that was already dead when this was written, on a screen that is not
    // Bill's, left for its own change rather than restyled in passing: the
    // one-Pokemon reselect message (`px-window px-empty`). The workshop's
    // "Materials spent" window was the second, and went with Brock's payment
    // screen when the ladder stopped taking Pokemon.
    expect(dead).toEqual([':where(.pixel-ui) .px-empty']);
  });

  it('lets wrapped copy break inside a narrow window instead of widening it', () => {
    expect(pixelUi).toMatch(
      /\.px-wrap\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*break-word;[^}]*\}/,
    );
  });

  it('keeps each stat nearer its own number than the next stat', () => {
    // A column is as wide as its widest stat, so the pair's own gap is all
    // that stands between `Defense` and its number, and the gap between pairs
    // is all that stands between that number and `Sp. Atk`. At two pixels
    // and four the dossier read `Defense7 Sp. Atk 8`.
    const units = (selector: string, property: string): number => {
      const body = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(pixelUiRules)?.[1] ?? '';
      const value = new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`).exec(body)?.[1] ?? '';
      const lengths = [...value.matchAll(/calc\(var\(--u\) \* (\d+)\)/g)].map((match) => Number(match[1]));
      return lengths.at(-1) ?? 0;
    };
    const withinPair = units(':where(.pixel-ui) .summary-stats > div', 'gap');
    const betweenPairs = units(':where(.pixel-ui) .summary-stats', 'gap');
    // A word space in Orange Kid at the one type size is two game pixels and a
    // bit, which is exactly what read as no space at all after `Defense`.
    expect(withinPair).toBeGreaterThanOrEqual(4);
    expect(betweenPairs).toBeGreaterThanOrEqual(withinPair * 2);
  });
});

describe('the box strip that leads a list of Pokemon', () => {
  // The strip's lines are centred against each other on one row wherever they
  // fit (`align-items: center` on `.box-bar`), so a line with a foot of its own
  // is a taller box and its chips sit higher than its neighbours'. The naming
  // line carried the padding it had as a row of the list (#127) into the strip,
  // and RENAME and NEW BOX stood a game pixel above PREV, NEXT, SORT and FIND
  // on the Pokemon Center at 1280x800 - and indented three when it wrapped.
  const lineClasses = [
    ...new Set(
      gameSources.flatMap((source) =>
        [...source.matchAll(/class="box-line([^"]*)"/g)].flatMap((match) => match[1].trim().split(/\s+/).filter(Boolean)),
      ),
    ),
  ];

  it('is read off the markup, so a new kind of line is asked about too', () => {
    expect(lineClasses).toContain('box-manage');
  });

  it('pads no line of its own, so every chip in the strip stands on one line', () => {
    const padded = ['box-line', ...lineClasses].flatMap((name) =>
      [...pixelUiRules.matchAll(new RegExp(`([^{}]*\\.${name}(?![\\w-])[^{}]*)\\{([^}]*)\\}`, 'g'))]
        .filter((match) => /(?:^|[\s;])padding(?:-[a-z]+)?:\s*(?!0;)/.test(match[2]))
        .map((match) => match[1].trim()),
    );
    expect(padded).toEqual([]);
  });
});

describe('a card on the teaching screen', () => {
  // At 1280x800 a card listed its four moves one a line, which made each card
  // so tall that a party of four showed two cards, a blank band and "2 MORE"
  // over the other two - one of them the Seel the disc was meant for. Short of
  // the room for a band the moves stand two abreast, and a move too long to
  // share half the card keeps a line of its own rather than being clipped.
  const bodiesFor = (room: 'narrow' | 'tight', selector: string): string[] =>
    [...pixelUiRules.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) =>
        selectors.split(',').some((one) => one.trim() === `:where(.pixel-ui[data-room='${room}']) ${selector}`),
      )
      .map(([, , body]) => body);

  it.each(['narrow', 'tight'] as const)('stands its moves two abreast in %s room', (room) => {
    const list = bodiesFor(room, '.teach-moves').join(';');
    expect(list).toMatch(/display:\s*flex;/);
    expect(list).toMatch(/flex-wrap:\s*wrap;/);
    const move = bodiesFor(room, '.teach-moves > li').join(';');
    const basis = Number(/flex:\s*1 0 (\d+)%;/.exec(move)?.[1]);
    expect(basis).toBeGreaterThan(25);
    expect(basis).toBeLessThan(50);
    expect(move).toMatch(/min-width:\s*max-content;/);
  });
});

describe('a row of wrapped copy', () => {
  // A pane's fold may fall between such a row's lines (`rowPieces`), so its icon
  // stands beside the first line rather than centred down all of them, where
  // the result screen's contract lost it to the MORE strip.
  it('keeps its icon beside its first line', () => {
    const body = [...pixelUiRules.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) =>
        selectors.split(',').some((one) => one.trim() === ':where(.pixel-ui) .px-row.has-icon:has(.px-wrap) > .item-icon'),
      )
      .map(([, , rule]) => rule)
      .join(';');
    expect(body).toMatch(/align-self:\s*start;/);
  });
});

describe('the defeat line-up', () => {
  // The line-up in front of a lost raid's report is not a pixel-ui screen, but
  // it is set in the same face, and the face has two limits that hold anywhere
  // it is drawn: there is no bold cut, so a weight above 400 is the browser
  // smearing the letters sideways, and below twelve pixels `W` reads `V`.
  const block = stylesheet
    .slice(stylesheet.indexOf('.defeat-stage {'), stylesheet.indexOf('@media (prefers-reduced-motion: reduce)'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string): string =>
    new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(block)?.[1] ?? '';
  const declared = (body: string, property: string): string | undefined =>
    new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`).exec(body)?.[1]?.trim();

  it('never asks the face for a bold it does not have', () => {
    const weights = [...block.matchAll(/font-weight:\s*([^;]+);/g)].map((match) => match[1].trim());
    expect(weights.filter((weight) => weight !== '400')).toEqual([]);
    // A plate's name is a `<b>`, which the browser draws bold unless told not to.
    expect(declared(rule('.defeat-plate b'), 'font-weight')).toBe('400');
  });

  it('writes a plate at one readable size: the level, the count and the verdict as large as the name', () => {
    // Orange Kid's own grid is 12.5 pixels: at that size a stem is one pixel.
    expect(declared(rule('.defeat-plate'), 'font-size')).toBe('12.5px');
    for (const selector of ['.defeat-meta', '.defeat-tag', '.defeat-plate b']) {
      expect({ selector, size: declared(rule(selector), 'font-size') }).toEqual({ selector, size: undefined });
    }
    // The level and the count are a `<small>`, which the browser draws a size
    // down unless told to keep its parent's.
    expect(declared(rule('.defeat-meta small'), 'font-size')).toBe('inherit');
  });

  /**
   * The player is the first column of the line-up, and slumped at full size
   * they lay half out of it - with a full line-up, half off the screen
   * (playtest 47). This lays the drawn figure out frame by frame, as the
   * stepped animation shows it, at real window sizes, and holds it inside its
   * own column: never past the column's left edge, which is the line-up's, and
   * never further right than the gap to the next column.
   */
  it('lays the fallen player inside their own column at every window size', () => {
    const keyframes = /@keyframes defeat-slump \{([\s\S]*?)\n\}/.exec(block)?.[1] ?? '';
    const tall = String.raw`calc\(var\(--defeat-tall\) \* (-?[\d.]+)\)`;
    const frame = new RegExp(
      String.raw`(\d+)% \{\s*transform: translate\((?:${tall}|0), (?:${tall}|0)\) rotate\((-?[\d.]+)deg\) scale\(([\d.]+)\);`,
      'g',
    );
    const frames = [...keyframes.matchAll(frame)].map((match) => ({
      at: Number(match[1]) / 100,
      x: Number(match[2] ?? 0),
      degrees: Number(match[4]),
      scale: Number(match[5]),
    }));
    // Every frame says the same functions, so the browser interpolates each
    // number rather than a matrix, and this can do the same.
    expect(frames.map((one) => one.at)).toEqual([0, 0.55, 1]);
    const steps = Number(/defeat-slump \d+ms steps\((\d+)\)/.exec(block)?.[1]);
    const shown = Array.from({ length: steps + 1 }, (_, index) => index / steps).map((at) => {
      const next = frames.findIndex((one) => one.at >= at);
      const from = frames[Math.max(0, next - 1)];
      const to = frames[next];
      const part = to.at === from.at ? 1 : (at - from.at) / (to.at - from.at);
      const mix = (key: 'x' | 'degrees' | 'scale') => from[key] + (to[key] - from[key]) * part;
      return { x: mix('x'), degrees: mix('degrees'), scale: mix('scale') };
    });
    const clampTo = (low: number, value: number, high: number) => Math.min(high, Math.max(low, value));
    for (const [width, height] of [[640, 480], [800, 600], [1024, 768], [1280, 800], [1366, 768], [1920, 1080], [2560, 1440]]) {
      // `.defeat-figure`'s column, and the trainer's `--defeat-tall`.
      const column = clampTo(72, width * 0.105, 116);
      const figure = clampTo(126, height * 0.23, 182);
      // `.defeat-cast`'s gap, which is empty ground between two columns.
      const gap = clampTo(4, width * 0.014, 16);
      for (const { x, degrees, scale } of shown) {
        // The drawn figure, from the middle of its feet: 12 of 22 rows wide.
        const half = (figure * 12) / 22 / 2;
        const radians = (degrees * Math.PI) / 180;
        const across = [
          [-half, 0],
          [half, 0],
          [-half, -figure],
          [half, -figure],
        ].map(([px, py]) => (px * Math.cos(radians) - py * Math.sin(radians)) * scale + x * figure);
        expect({ width, height, degrees, left: Math.min(...across) >= -column / 2 }).toEqual({
          width,
          height,
          degrees,
          left: true,
        });
        expect({ width, height, degrees, right: Math.max(...across) <= column / 2 + gap }).toEqual({
          width,
          height,
          degrees,
          right: true,
        });
      }
    }
  });

  it('fits a full line-up in the window rather than scrolling it sideways (playtest 42)', () => {
    // Nine figures (you, six Pokemon, two kinds of ball) at their roomy widths
    // are wider than a 1280 window: every column has to be able to give way,
    // and nothing inside one may hold it open at a fixed width.
    expect(declared(rule('.defeat-stage'), 'grid-template-columns')).toBe('minmax(0, 1fr)');
    expect(declared(rule('.defeat-figure'), 'min-width')).toBe('0');
    expect(declared(rule('.defeat-figure'), 'flex')).toBe('0 1 auto');
    expect(declared(rule('.defeat-cast'), 'width')).toBe('100%');
    expect(declared(rule('.defeat-item-glyph'), 'width')).toMatch(/^min\(.*100%\)$/);
    expect(declared(rule('.defeat-trainer'), 'width')).toMatch(/^min\(100%,/);
    // The trainer falls to the left, so the line-up keeps a margin either side
    // that its body can lie in when the columns fill the window.
    expect(declared(rule('.defeat-cast'), 'padding-inline')).toBeDefined();
  });

  it('keeps a ten-letter name whole in a full line-up on a 900-pixel window (playtest 42)', () => {
    // Measured in the browser: at 900x600 nine columns came out 67 pixels
    // wide, a plate's inside 61, and CHARMANDER is 62 - so it broke as
    // CHARMANDE / R. A crowded line-up (seven figures or more after you)
    // closes the gaps, stops widening the last stand and lets a supply's
    // column give way first; it came out 83 at 900 and 71 at 800.
    const crowded = '.defeat-cast:has(> .defeat-figure:nth-child(7))';
    const roomyGap = declared(rule('.defeat-cast'), 'gap') ?? '';
    const crowdedGap = declared(rule(crowded), 'gap') ?? '';
    const middle = (value: string) => Number(/,\s*([\d.]+)vw/.exec(value)?.[1]);
    expect(middle(crowdedGap)).toBeLessThan(middle(roomyGap));
    expect(declared(rule(`${crowded} .defeat-figure.is-last-stand`), 'width')).toBe(
      declared(rule('.defeat-figure'), 'width'),
    );
    const supply = rule(`${crowded} .defeat-figure[data-kind='item']`);
    expect(Number(declared(supply, 'flex-shrink'))).toBeGreaterThan(1);
    // ...but never so far that its count breaks from its number.
    expect(declared(supply, 'min-width')).toMatch(/^\d+px$/);
    expect(declared(rule('.defeat-meta'), 'white-space')).toBe('nowrap');
  });
});

describe('the ghost of a carried piece', () => {
  // Playtest 40: carried over a seat another piece already holds, the ghost was
  // marked "will not fit" and nothing red showed. A block is positioned (its
  // stack count is pinned to its corner), and a positioned box paints over every
  // box that is not, whatever the order of the markup - so the ghost was drawn
  // under the very block it collides with, the one place "no" is ever needed.
  const bodyOf = (selector: string): string =>
    [...pixelUiRules.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some((one) => one.trim() === selector))
      .map(([, , rule]) => rule)
      .join(';');
  const declared = (body: string, property: string): string | undefined =>
    new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`).exec(body)?.[1]?.trim();

  it('is drawn over the blocks it lands on, not under them', () => {
    expect(declared(bodyOf(':where(.pixel-ui) .px-grid-block'), 'position')).toBe('relative');
    const ghost = bodyOf(':where(.pixel-ui) .px-grid-ghost');
    expect(declared(ghost, 'position')).toMatch(/^(relative|absolute)$/);
    expect(Number(declared(ghost, 'z-index'))).toBeGreaterThan(0);
  });

  it('says "will not fit" with a heavier edge as well as a red one, so it is not colour alone', () => {
    const good = declared(bodyOf(':where(.pixel-ui) .px-grid-ghost'), 'box-shadow') ?? '';
    const bad = declared(bodyOf(':where(.pixel-ui) .px-grid-ghost.is-bad'), 'box-shadow') ?? '';
    expect(good).toMatch(/var\(--u\) var\(--ink\)/);
    expect(bad).toMatch(/calc\(var\(--u\) \* 2\) var\(--red\)/);
  });
});

describe('the map maker check marks', () => {
  // Playtest 40 #6: a check still waiting and a check that failed were both a
  // plain 5x5 square, grey or red - the same square to anybody who cannot tell
  // those two apart. Each state is its own drawn shape now, as passed is a tick.
  const bodyOf = (selector: string): string =>
    [...pixelUiRules.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some((one) => one.trim() === selector))
      .map(([, , rule]) => rule)
      .join(';');
  const maskOf = (state: string): string | undefined =>
    /(?:^|[\s;])mask:\s*([^;]+);/.exec(bodyOf(state === '' ? ':where(.pixel-ui) .maker-check-mark' : `:where(.pixel-ui) .maker-check${state} .maker-check-mark`))?.[1]?.trim();

  it('draws passed, waiting and failed as three different shapes, not one square in two colours', () => {
    const passed = maskOf('') ?? '';
    const waiting = maskOf('.is-waiting') ?? '';
    const failed = maskOf('.is-failed') ?? '';
    for (const mask of [passed, waiting, failed]) {
      expect(mask).toMatch(/^var\(--px-[a-z-]+\)/);
    }
    expect(new Set([passed, waiting, failed].map((mask) => /var\((--px-[a-z-]+)\)/.exec(mask)?.[1])).size).toBe(3);
  });

  it('declares every shape it draws', () => {
    for (const state of ['', '.is-waiting', '.is-failed']) {
      const name = /var\((--px-[a-z-]+)\)/.exec(maskOf(state) ?? '')?.[1];
      expect(stylesheet).toMatch(new RegExp(`${name}: url\\("data:image/svg\\+xml`));
    }
  });
});

describe('the deploy progress rail', () => {
  // Playtest 40 #7: a step already done was teal and a step to come grey-blue,
  // the same grey to anybody who cannot tell those two apart. A done step
  // carries the drawn tick, as a fact on a tag does.
  const bodyOf = (selector: string): string =>
    [...pixelUiRules.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some((one) => one.trim() === selector))
      .map(([, , rule]) => rule)
      .join(';');

  it('draws a tick after a done step and nothing after a step to come', () => {
    const done = bodyOf(':where(.pixel-ui) .px-rail .done::after');
    expect(done).toMatch(/mask:\s*var\(--px-tick\)/);
    expect(done).toMatch(/content:\s*''/);
    expect(bodyOf(':where(.pixel-ui) .px-rail .upcoming::after')).toBe('');
    expect(bodyOf(':where(.pixel-ui) .px-rail .current::after')).toBe('');
  });
});

describe('the map maker chosen tool, brush, place and zoom', () => {
  // Playtest 40 #8: which tool, brush, place and zoom were chosen was a pale
  // teal wash and nothing else, the same as cream to an eye that sees no
  // colour, and once the cursor left for the map nothing else said it. Each
  // chosen one carries the drawn tick; one not chosen keeps the tick's room
  // and draws nothing in it, so choosing never moves a button along its row.
  const bodyOf = (selector: string): string =>
    [...pixelUiRules.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some((one) => one.trim() === selector))
      .map(([, , rule]) => rule)
      .join(';');

  it.each(['.maker-tool', '.maker-area', '.maker-zoom', '.maker-choice'])(
    'draws a tick on a chosen %s and none on one not chosen',
    (control) => {
      const every = bodyOf(`:where(.pixel-ui) ${control}[aria-pressed]::after`);
      expect(every).toMatch(/content:\s*''/);
      expect(every).toMatch(/mask:\s*var\(--px-tick\)/);
      expect(every).toMatch(/background:\s*transparent/);
      expect(bodyOf(`:where(.pixel-ui) ${control}[aria-pressed='true']::after`)).toMatch(
        /background:\s*currentColor/,
      );
    },
  );
});

describe('a type tag', () => {
  /** WCAG 2.x relative luminance of a `#rrggbb` colour. */
  function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((at) => {
      const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  }
  const ink = /--cream-lit:\s*(#[0-9a-f]{6});/i.exec(stylesheet)?.[1] ?? '';
  const fills = [...stylesheet.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selectors]) => /\.px-type\b/.test(selectors) || /\.px-type-[a-z]+/.test(selectors))
    .map(([, selectors, rule]) => ({
      selectors: selectors.trim(),
      fill: /background:\s*(#[0-9a-f]{6})/i.exec(rule)?.[1],
    }))
    .filter((entry): entry is { selectors: string; fill: string } => entry.fill !== undefined);

  it('is lettered in the cream ink every fill is measured against', () => {
    expect(ink).toMatch(/^#[0-9a-f]{6}$/i);
    expect(fills.length).toBeGreaterThanOrEqual(8);
  });

  it('can be read by everybody: every fill holds its letters at WCAG AA, 4.5 to 1 (playtest 40)', () => {
    const faint = fills
      .map(({ selectors, fill }) => ({ selectors, fill, ratio: Number(contrast(ink, fill).toFixed(2)) }))
      .filter(({ ratio }) => ratio < 4.5);
    expect(faint).toEqual([]);
  });

  it('tells every one of the seventeen types apart by its own fill', async () => {
    const { PokemonType } = await import('./game/pokemon/PokemonType');
    const fillOf = (type: string): string | undefined =>
      fills.find(({ selectors }) =>
        selectors.split(',').some((selector) => selector.trim().endsWith(`.px-type-${type.toLowerCase()}`)),
      )?.fill;
    const types = Object.values(PokemonType);
    expect(types.filter((type) => fillOf(type) === undefined)).toEqual([]);
    const shared = types.filter(
      (type, index) => types.findIndex((other) => fillOf(other)?.toLowerCase() === fillOf(type)?.toLowerCase()) !== index,
    );
    expect(shared).toEqual([]);
  });
});
