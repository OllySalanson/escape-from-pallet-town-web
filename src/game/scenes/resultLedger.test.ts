import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));
vi.mock('../audio/AudioManager', () => ({ audioManager: { play: vi.fn() } }));

import type { ExtractionReport } from '../run/extractionReport';
import { hasMoreBelow, moreLabel, scrollCoverHeight } from '../ui/MenuOverlay';
import { ExtractionScene } from './ExtractionScene';

/**
 * Playtest 4: the first level-up of a save was below the fold of the result
 * screen's ledger, under a four-line contract row, in a pane with nothing to say
 * it scrolled.
 */
describe('the result screen ledger', () => {
  it('lists field experience above the contract the verdict has already spoken for', () => {
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const report = {
      outcome: 'ESCAPED',
      ledger: { pokemon: [], items: [] },
      ledgerHeading: 'Banked',
      ledgerEmptyText: 'Nothing.',
      contract: { description: 'Recover the lost field kit', complete: true, reward: 'Three more insertions.' },
      progress: [
        { name: 'Charmander', fromLevel: 5, toLevel: 6, experienceGained: 40, experienceToNextLevel: 20 },
      ],
      gear: [],
      gearSummary: null,
    } as unknown as ExtractionReport;
    Object.assign(scene as object, { report });

    const html = (scene as unknown as { ledgerPanel(): string }).ledgerPanel();

    expect(html).toContain('Level 5 to 6');
    expect(html.indexOf('Field experience')).toBeLessThan(html.indexOf('Contract complete'));
  });

  it('knows a pane has more below the fold, and that a rounding error is not more', () => {
    expect(hasMoreBelow({ scrollHeight: 180, clientHeight: 110, scrollTop: 0 })).toBe(true);
    expect(hasMoreBelow({ scrollHeight: 180, clientHeight: 110, scrollTop: 70 })).toBe(false);
    expect(hasMoreBelow({ scrollHeight: 110.6, clientHeight: 110, scrollTop: 0 })).toBe(false);
    // Rounding is a fraction of a *game* pixel, so how many screen pixels that
    // is depends on the scale: half a game pixel at 4x is two screen pixels and
    // is still not a row.
    expect(hasMoreBelow({ scrollHeight: 112, clientHeight: 110, scrollTop: 0 }, 4)).toBe(false);
    expect(hasMoreBelow({ scrollHeight: 126, clientHeight: 110, scrollTop: 0 }, 4)).toBe(true);
  });

  it('covers a row the pane would cut through, whole, and leaves a clean cut alone', () => {
    const pane = { top: 0, bottom: 168 };
    // The strip is thirteen game pixels of three screen pixels each - a line of
    // the one type size, plus its rule - so a row spanning the line 39px above
    // the edge is taken in full, to a whole game pixel.
    expect(scrollCoverHeight(pane, [{ top: 0, bottom: 78 }, { top: 81, bottom: 159 }], 3)).toBe(87);
    expect(scrollCoverHeight(pane, [{ top: 0, bottom: 78 }, { top: 81, bottom: 128 }], 3)).toBe(39);
    // A row that would swallow most of the pane is cut rather than hide it.
    expect(scrollCoverHeight(pane, [{ top: 20, bottom: 300 }], 3)).toBe(39);
  });

  it('counts what is under the strip rather than only saying there is something', () => {
    // A pane whose fold is at 100: two rows are under it, and the third is the
    // one the strip is covering, so it is not yet read.
    expect(moreLabel([{ bottom: 40 }, { bottom: 80 }, { bottom: 120 }, { bottom: 160 }], 100)).toBe('2 MORE');
    expect(moreLabel([{ bottom: 40 }, { bottom: 100 }], 100)).toBe('MORE');
  });
});
