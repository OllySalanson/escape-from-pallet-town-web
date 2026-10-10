import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));
vi.mock('../audio/AudioManager', () => ({ audioManager: { play: vi.fn() } }));

import sampleLane from '../../maps/sample/sample-lane.json';
import { setActiveSaveSlot, setTryItRules } from '../dev/playtestMode';
import { beginTry, endTry } from '../maker/tryIt';
import type { ExtractionReport } from '../run/extractionReport';
import type { MapFile } from '../world/mapFile';
import { hasMoreBelow, moreLabel, scrollCoverHeight, scrollTopCoverHeight } from '../ui/MenuOverlay';
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
      pack: null,
      packSummary: null,
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

  it('hides a row the top of a scrolled pane cuts through, down to the first whole row', () => {
    // Brock's ladder, walked down with the arrow keys: the pane scrolled 188px
    // and left SECURE LOCKER I with 32 of its 56 pixels showing.
    const pane = { top: 200, bottom: 516 };
    const rows = [
      { top: 176, bottom: 232 },
      { top: 234, bottom: 314 },
    ];
    expect(scrollTopCoverHeight(pane, 0, rows, 3)).toBe(33);
    // A line that falls between two rows leaves nothing to hide.
    expect(scrollTopCoverHeight(pane, 0, [{ top: 120, bottom: 200 }, ...rows.slice(1)], 3)).toBe(0);
    // Under a sticky head, the cut is measured at the head's foot.
    expect(scrollTopCoverHeight(pane, 34, rows, 3)).toBe(0);
    expect(scrollTopCoverHeight(pane, 40, rows, 3)).toBe(75);
    // A row that would swallow most of the pane is cut rather than hide it.
    expect(scrollTopCoverHeight(pane, 0, [{ top: 100, bottom: 480 }], 3)).toBe(0);
  });

  it('counts what is under the strip rather than only saying there is something', () => {
    // A pane whose fold is at 100: two rows are under it, and the third is the
    // one the strip is covering, so it is not yet read.
    expect(moreLabel([{ bottom: 40 }, { bottom: 80 }, { bottom: 120 }, { bottom: 160 }], 100)).toBe('2 MORE');
    expect(moreLabel([{ bottom: 40 }, { bottom: 100 }], 100)).toBe('MORE');
  });
});

/**
 * Playtest 46: a try of a map in the map maker ended on THE GAMBLE - "a wipe
 * would have cost you Charizard, Blastoise, Venusaur" - under a level 99 try
 * team in a save of its own, where nothing was ever at stake.
 */
describe('the result screen of a map maker try', () => {
  const gamble = (outcome: 'ESCAPED' | 'WIPED') => {
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const report = {
      outcome,
      secured: { pokemon: [], items: [] },
      risked: { pokemon: [], items: [{ itemId: 'potion', label: 'Potion', quantity: 5 }] },
      securedEmptyText: 'You protected nothing.',
      gambleVerdict: 'A wipe would have cost you Charizard and 5 Potions. It did not happen this time.',
    } as unknown as ExtractionReport;
    Object.assign(scene as object, { report });
    return (scene as unknown as { gamblePanel(): string }).gamblePanel();
  };

  afterEach(() => {
    endTry();
    setTryItRules(false);
    setActiveSaveSlot('normal');
  });

  it('says whether the walk counts instead of what a wipe would have cost', () => {
    beginTry('draft-a', sampleLane as MapFile, 'walk');
    setActiveSaveSlot('try-it');

    const escaped = gamble('ESCAPED');
    expect(escaped).toContain('Your try');
    expect(escaped).toContain('The walk counts');
    expect(escaped).toContain('your saved game was not touched');
    expect(escaped).not.toContain('The gamble');
    expect(escaped).not.toContain('A wipe would have cost you');

    const lost = gamble('WIPED');
    expect(lost).toContain('The walk does not count yet');
    expect(lost).not.toContain('The gamble');
  });

  it('says what happened on the map under the headline instead of what rode out unprotected', () => {
    const verdict = (outcome: 'ESCAPED' | 'WIPED', cause?: 'timer' | 'defeated') => {
      const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
      const report = {
        outcome,
        cause,
        summary: '5 entries and your Raid pack rode out unprotected and came home.',
      } as unknown as ExtractionReport;
      Object.assign(scene as object, { report });
      return (scene as unknown as { verdictSummary(): string }).verdictSummary();
    };
    expect(verdict('ESCAPED')).toContain('rode out unprotected');

    beginTry('draft-a', sampleLane as MapFile, 'walk');
    setActiveSaveSlot('try-it');
    const name = (sampleLane as MapFile).name;

    expect(verdict('ESCAPED')).toBe(`You walked out of ${name} by an exit.`);
    expect(verdict('WIPED', 'defeated')).toBe(`The try team went down inside ${name}.`);
    expect(verdict('WIPED', 'timer')).toBe(`The clock ran out before you found a way out of ${name}.`);
  });

  it('says how long a walked try took rather than counting it against the eight-hour stand-in clock', () => {
    const aside = () => {
      const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
      const report = { clockLabel: '0:07 of 480:00', elapsedMs: 7_000, durationMs: 480 * 60_000 } as unknown as ExtractionReport;
      Object.assign(scene as object, { report });
      return (scene as unknown as { clockAside(): string }).clockAside();
    };
    expect(aside()).toBe('Raid clock 0:07 of 480:00');

    beginTry('draft-a', sampleLane as MapFile, 'walk');
    setTryItRules(true);
    setActiveSaveSlot('try-it');
    expect(aside()).toBe('Time taken 0:07');

    // RAID IT plays under the game's own clock, so it still reads as one.
    setTryItRules(false);
    expect(aside()).toBe('Raid clock 0:07 of 480:00');
  });

  it('still lays out the gamble on a raid of the game', () => {
    const html = gamble('ESCAPED');
    expect(html).toContain('The gamble');
    expect(html).toContain('A wipe would have cost you Charizard');
  });
});
