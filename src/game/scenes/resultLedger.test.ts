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
import { hasMoreBelow } from '../ui/MenuOverlay';
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
  });
});
