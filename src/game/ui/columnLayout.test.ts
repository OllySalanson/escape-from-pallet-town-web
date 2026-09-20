import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { columnTracks, planColumns, roomFor } from './columnLayout';

const GAP = 4;

describe('how many columns a list takes', () => {
  it('takes as many columns of its measure as the room holds', () => {
    expect(planColumns(232, { measure: 232, gap: GAP }).columns).toBe(1);
    expect(planColumns(467, { measure: 232, gap: GAP }).columns).toBe(1);
    expect(planColumns(468, { measure: 232, gap: GAP }).columns).toBe(2);
    expect(planColumns(732, { measure: 232, gap: GAP }).columns).toBe(3);
  });

  it('is one column in a narrow window rather than a broken one', () => {
    // The smallest stage is 320 game pixels wide; a list of two-line Pokemon
    // rows is one column there and that is the right answer, not a failure.
    expect(planColumns(180, { measure: 232, gap: GAP }).columns).toBe(1);
    expect(planColumns(0, { measure: 232, gap: GAP }).columns).toBe(1);
  });

  it('never divides by a measure that was never stated', () => {
    expect(planColumns(900, { measure: 0, gap: GAP }).columns).toBe(1);
  });

  it('keeps a ceiling on the count where the list is a fixed set of cards', () => {
    expect(planColumns(900, { measure: 100, gap: GAP, maximum: 3 }).columns).toBe(3);
  });
});

describe('the tracks themselves', () => {
  const widths = (available: number, rules = { measure: 232, gap: GAP }) =>
    planColumns(available, rules).tracks;

  it('is always a whole number of game pixels', () => {
    for (let available = 100; available < 1200; available += 1) {
      widths(available).forEach((track) => expect(Number.isInteger(track)).toBe(true));
    }
  });

  it('fills the room exactly, gaps included, so nothing is left ragged', () => {
    for (let available = 100; available < 1200; available += 1) {
      const tracks = widths(available);
      const used = tracks.reduce((total, track) => total + track, 0) + GAP * (tracks.length - 1);
      expect(used).toBe(available);
    }
  });

  it('shares an indivisible remainder out one pixel at a time', () => {
    const narrow = { measure: 160, gap: GAP };
    // 500 less two gaps is 492 over three columns: 164 each, exactly.
    expect(widths(500, narrow)).toEqual([164, 164, 164]);
    // 502 leaves two pixels over, so the first two columns take one each rather
    // than every column standing on two thirds of a pixel.
    expect(widths(502, narrow)).toEqual([165, 165, 164]);
  });

  it('centres a row of cards rather than stretching them', () => {
    const plan = planColumns(900, { measure: 100, gap: GAP, maximum: 3, widest: 160 });
    expect(plan.tracks).toEqual([160, 160, 160]);
  });

  it('still fills the room when the cards cannot reach their widest', () => {
    const plan = planColumns(308, { measure: 100, gap: GAP, maximum: 3, widest: 160 });
    expect(plan.tracks).toEqual([100, 100, 100]);
  });
});

describe('writing the plan out', () => {
  it('multiplies every track by the game pixel', () => {
    expect(columnTracks({ columns: 2, tracks: [165, 164] }, 3)).toBe('495px 492px');
  });
});

describe('how much room a screen has', () => {
  // What `computeMenuStage` gives at the windows that matter, in game pixels.
  const STAGES = {
    '640x480': [320, 240],
    '1024x640': [504, 312],
    '1280x720': [632, 352],
    '1366x768': [674, 376],
    '1920x950': [952, 466],
    '2560x1330': [848, 438],
    '3840x2000': [956, 496],
  } as const;

  it('is narrow only where a list and a band cannot share the screen', () => {
    const rooms = Object.fromEntries(
      Object.entries(STAGES).map(([window, [width, height]]) => [window, roomFor(width, height)]),
    );
    expect(rooms).toEqual({
      // `BASE_STAGE` itself, where a list, the band that answers for the row it
      // is on and a second band under that cannot share one pane at all.
      '640x480': 'tight',
      '1024x640': 'narrow',
      '1280x720': 'narrow',
      // A 1366 laptop is 674 game pixels across: wide enough for two columns of
      // Pokemon, not for the band's five blocks beside them.
      '1366x768': 'narrow',
      '1920x950': 'wide',
      // Drawn at 3x, so fewer game pixels than the window suggests - and still
      // enough for the band.
      '2560x1330': 'wide',
      '3840x2000': 'wide',
    });
  });

  it('needs both dimensions, because either can be the one that runs out', () => {
    expect(roomFor(2000, 200)).toBe('tight');
    expect(roomFor(700, 2000)).toBe('narrow');
    expect(roomFor(300, 2000)).toBe('tight');
  });

  /**
   * Three rungs and no fourth: a rule written for the smaller of two screens is
   * written for both of the smaller two, so every `[data-room='narrow']` rule in
   * the stylesheet carries a `[data-room='tight']` twin. Held here rather than
   * left to be remembered, because the failure is silent - the stash's band
   * would simply stand at its laptop height on a 320x240 screen.
   */
  it('is a ladder, so a rule for less room than wide is written for both rungs', async () => {
    const css = await readFile(new URL('../../style.css', import.meta.url), 'utf8');
    const narrow = [...css.matchAll(/\[data-room='narrow'\]\)\s*([^,{]+)[,{]/g)].map((match) =>
      match[1].trim(),
    );
    const tight = [...css.matchAll(/\[data-room='tight'\]\)\s*([^,{]+)[,{]/g)].map((match) =>
      match[1].trim(),
    );
    expect(narrow.length).toBeGreaterThan(4);
    expect(narrow.filter((selector) => !tight.includes(selector))).toEqual([]);
  });
});
