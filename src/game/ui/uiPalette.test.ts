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
    new RegExp(`\\.menu-overlay\\.pixel-ui \\{[^}]*--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(stylesheet)?.[1]?.toLowerCase() ?? '';

  it.each([
    ['cream', UI.paper],
    ['cream-lit', UI.paperLit],
    ['cream-dim', UI.paperSunk],
    ['ink', UI.ink],
    ['ink-soft', UI.inkSoft],
    ['frame', UI.frameLine],
    ['rim', UI.frameRim],
    ['rim-light', UI.frameLight],
    ['rim-shade', UI.frameShade],
    ['cursor', UI.cursor],
  ])('paint --%s as the pop-ups do', (name, colour) => {
    expect(token(name)).toBe(colour.css);
  });
});
