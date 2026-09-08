import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { GAME_FONT, GAME_FONT_FAMILY, GAME_FONT_SIZES, awaitGameFont, isGameFontReady } from './gameFont';

describe('the game font', () => {
  it('asks for every size the game draws, because a face is only ready per size', async () => {
    const load = vi.fn<(request: string) => Promise<unknown>>().mockResolvedValue([]);

    await expect(awaitGameFont({ fonts: { load } })).resolves.toBe(true);

    expect(load.mock.calls.map((call): unknown => call[0])).toEqual(
      GAME_FONT_SIZES.map((size) => `${size}px "${GAME_FONT_FAMILY}"`),
    );
  });

  it('lets the game start when the face cannot be loaded at all', async () => {
    const load = vi.fn().mockRejectedValue(new Error('404'));

    await expect(awaitGameFont({ fonts: { load } })).resolves.toBe(false);
  });

  it('lets the game start in a browser with no font loading API', async () => {
    await expect(awaitGameFont(undefined)).resolves.toBe(false);
    await expect(awaitGameFont({})).resolves.toBe(false);
  });

  it('gives up rather than hanging boot on a font that never resolves', async () => {
    vi.useFakeTimers();
    try {
      const pending = awaitGameFont({ fonts: { load: () => new Promise(() => {}) } }, 50);
      await vi.advanceTimersByTimeAsync(60);

      await expect(pending).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports readiness only when every drawn size is ready', () => {
    const ready = (size: number): boolean => size < 16;

    expect(isGameFontReady({ fonts: { load: vi.fn(), check: () => true } })).toBe(true);
    expect(
      isGameFontReady({
        fonts: { load: vi.fn(), check: (request) => ready(Number.parseInt(request, 10)) },
      }),
    ).toBe(false);
    expect(isGameFontReady({})).toBe(false);
  });

  it('names one face, and it is the one the stylesheet and the document declare', async () => {
    const [css, html] = await Promise.all([
      readFile(new URL('../../style.css', import.meta.url), 'utf8'),
      readFile(new URL('../../../index.html', import.meta.url), 'utf8'),
    ]);

    expect(GAME_FONT).toBe(`"${GAME_FONT_FAMILY}", monospace`);
    expect(css).toContain(`font-family: '${GAME_FONT_FAMILY}'`);
    // Preloaded with the document, so the fetch is not waiting on BootScene to
    // ask for it: without this the file was not requested at all until some DOM
    // screen happened to render a glyph in it.
    expect(html).toMatch(/rel="preload"[\s\S]*orange-kid\.woff2/);
    expect(html).toMatch(/orange-kid\.woff2[\s\S]*as="font"/);
  });

  it('is what every canvas scene draws with, so no screen falls back to monospace', async () => {
    const battle = await readFile(new URL('../scenes/BattleScene.ts', import.meta.url), 'utf8');
    const hud = await readFile(new URL('./RaidHud.ts', import.meta.url), 'utf8');
    const label = await readFile(new URL('./WorldLabel.ts', import.meta.url), 'utf8');

    expect(battle).toContain('const BATTLE_FONT = GAME_FONT;');
    for (const source of [hud, label]) {
      expect(source).toContain('fontFamily: GAME_FONT');
      expect(source).not.toContain("fontFamily: 'monospace'");
    }
  });
});
