import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UI } from './uiPalette';

/** WCAG relative luminance of a 0xRRGGBB colour. */
function luminance(value: number): number {
  const channel = (shift: number): number => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

function contrast(a: number, b: number): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('the pop-up palette', () => {
  it('holds words and notes to WCAG AA on every paper they are written on', () => {
    for (const paper of [UI.paper, UI.paperLit, UI.paperSunk]) {
      expect(contrast(UI.ink.value, paper.value)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(UI.inkSoft.value, paper.value)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('draws a cursor that stands out from the lit row it points along', () => {
    expect(contrast(UI.cursor.value, UI.paperLit.value)).toBeGreaterThanOrEqual(3);
  });

  it('gives each colour as the same thing twice: a number for graphics, a string for text', () => {
    for (const colour of Object.values(UI)) {
      expect(Number.parseInt(colour.css.slice(1), 16)).toBe(colour.value);
      expect(colour.css).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('the menus and the pop-ups', () => {
  // One surface: a question asked in the yard and the screen it opens are
  // drawn in the same colours, so the stylesheet's tokens are these.
  const stylesheet = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
  const token = (name: string): string =>
    new RegExp(`:root \\{[^}]*--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(stylesheet)?.[1]?.toLowerCase() ?? '';

  it.each([
    ['paper', UI.paper],
    ['paper-lit', UI.paperLit],
    ['paper-sunk', UI.paperSunk],
    ['ink', UI.ink],
    ['ink-soft', UI.inkSoft],
    ['line', UI.frameLine],
    ['red', UI.seam],
    ['cursor', UI.cursor],
  ])('paint --%s as the pop-ups do', (name, colour) => {
    expect(token(name)).toBe(colour.css);
  });
});

describe('the wood floor', () => {
  // A screen on the wood floor remaps what its body is drawn in (`.wood-floor`
  // in the stylesheet). Wood is a middle tone: only the palest inks read on a
  // board and only dark ones on a raised plate, so each is held to WCAG AA on
  // what it is written on, as the paper's inks are.
  const stylesheet = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
  const block = /\.pixel-ui\.wood-floor \.px-body \{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';
  const colour = (name: string): number => {
    const found = new RegExp(`--${name}:\\s*#([0-9a-f]{6});`, 'i').exec(block);
    if (!found) {
      throw new Error(`the wood floor does not set --${name}`);
    }
    return Number.parseInt(found[1], 16);
  };
  const channel = (value: number, shift: number): number => (value >> shift) & 0xff;

  it.each(['ink', 'ink-soft', 'safe-ink', 'red-ink', 'gold-ink'])('writes --%s where it can be read on a board and in an empty square', (ink) => {
    for (const board of ['paper', 'paper-sunk']) {
      expect(contrast(colour(ink), colour(board)), `--${ink} on --${board}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['raised-ink', 'raised-ink-soft'])('writes --%s where it can be read on every raised plate', (ink) => {
    for (const plate of ['paper-raised', 'paper-lit', 'gold-wash', 'safe-wash', 'risk-wash']) {
      expect(contrast(colour(ink), colour(plate)), `--${ink} on --${plate}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is warm brown wood: never white, never black, never grey', () => {
    for (const board of ['paper', 'paper-raised', 'paper-sunk']) {
      const value = colour(board);
      expect(luminance(value), `--${board}`).toBeGreaterThan(0.05);
      expect(luminance(value), `--${board}`).toBeLessThan(0.45);
      expect(channel(value, 16), `--${board} red over green`).toBeGreaterThan(channel(value, 8) + 20);
      expect(channel(value, 8), `--${board} green over blue`).toBeGreaterThan(channel(value, 0) + 20);
    }
  });

  it('stands a thing up off its board and sinks an empty square into it', () => {
    expect(luminance(colour('paper-raised'))).toBeGreaterThan(luminance(colour('paper')));
    expect(luminance(colour('paper-sunk'))).toBeLessThan(luminance(colour('paper')));
  });

  it('leaves a plate of paper its own palette: the page names it beside :root', () => {
    expect(stylesheet).toMatch(/\.pixel-ui \.px-plate,[^{]*:root \{/);
  });
});

describe("the Pokédex's glass", () => {
  // The Pokédex is drawn as the thing it is (`.dex-floor`): a red machine with
  // a screen of green glass. Its words are held to WCAG AA on the glass, lit or
  // not, and on the casing; a key is a white plate lettered in ink.
  const stylesheet = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
  const block = /\.pixel-ui\.dex-floor \.px-body \{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';
  const colour = (name: string): number => {
    const found = new RegExp(`--${name}:\\s*#([0-9a-f]{6});`, 'i').exec(block);
    if (!found) {
      throw new Error(`the Pokédex does not set --${name}`);
    }
    return Number.parseInt(found[1], 16);
  };
  const channel = (value: number, shift: number): number => (value >> shift) & 0xff;

  it.each(['ink', 'ink-soft', 'safe-ink', 'red-ink', 'gold-ink'])('writes --%s where it can be read on the glass', (ink) => {
    for (const glass of ['paper', 'paper-sunk']) {
      expect(contrast(colour(ink), colour(glass)), `--${ink} on --${glass}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('writes white and the casing\'s soft ink where they can be read on the casing', () => {
    expect(contrast(colour('ink'), colour('casing'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour('casing-soft'), colour('casing'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour('ink'), colour('heading'))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['raised-ink', 'raised-ink-soft'])('writes --%s where it can be read on a key and on a lit panel', (ink) => {
    for (const plate of ['paper-raised', 'paper-lit', 'lcd']) {
      expect(contrast(colour(ink), colour(plate)), `--${ink} on --${plate}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is a red machine with a green screen, lit in three steps: never met, met, owned', () => {
    const casing = colour('casing');
    expect(channel(casing, 16)).toBeGreaterThan(channel(casing, 8) * 3);
    for (const glass of ['paper', 'paper-sunk', 'lcd-dim', 'lcd']) {
      const value = colour(glass);
      expect(channel(value, 8), `--${glass} is green`).toBeGreaterThan(channel(value, 16));
      expect(channel(value, 8), `--${glass} is green`).toBeGreaterThan(channel(value, 0));
    }
    expect(luminance(colour('paper-sunk'))).toBeLessThan(luminance(colour('lcd-dim')));
    expect(luminance(colour('lcd-dim'))).toBeLessThan(luminance(colour('lcd')));
  });
});
