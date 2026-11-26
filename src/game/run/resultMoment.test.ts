import { describe, expect, it } from 'vitest';
import type { ExtractionReport } from './extractionReport';
import { resultMoment, STOW_SHOWN } from './resultMoment';

const EMPTY = { pokemon: [], items: [] };
const report = (more: Partial<ExtractionReport>): ExtractionReport =>
  ({
    outcome: 'ESCAPED',
    ledgerFound: EMPTY,
    ledgerPaid: EMPTY,
    progress: [],
    ...more,
  }) as unknown as ExtractionReport;
const pidgey = { name: 'Pidgey', dexId: 16, level: 3, currentHp: 5, maxHp: 15 };

/**
 * The critic's problem 10: the result was a ledger. Then the captain: "way too
 * much words" (25 Nov 2026). A raid that got out opens on its deed in a few
 * big words, and shows the rest.
 */
describe('the moment a raid that got out opens on', () => {
  const item = (itemId: string, quantity = 1) => ({ itemId, label: itemId, quantity });
  const banked = (items: readonly ReturnType<typeof item>[], more: Partial<ExtractionReport> = {}) =>
    report({ saved: true, ledger: { pokemon: [], items }, ledgerFound: { pokemon: [], items }, ...more });

  it('heads a catch with the catch and its picture, and says only what is not shown', () => {
    const moment = resultMoment(
      report({
        saved: true,
        ledger: { pokemon: [pidgey], items: [item('money', 85)] },
        ledgerFound: { pokemon: [pidgey], items: [item('money', 85)] },
        progress: [{ name: 'Charmander', dexId: 4, fromLevel: 5, toLevel: 6, experienceGained: 60, experienceToNextLevel: 40 }],
      }),
    );
    expect(moment).toEqual({
      headline: 'PIDGEY CAUGHT!',
      picture: { kind: 'pokemon', dexId: 16, shiny: false },
      line: 'CHARMANDER grew to Lv 6!',
      money: 85,
      stow: null,
    });
  });

  it('names two catches, and counts more', () => {
    const meowth = { ...pidgey, name: 'Meowth', dexId: 52 };
    expect(resultMoment(report({ ledgerFound: { pokemon: [pidgey, meowth], items: [] } }))?.headline).toBe('PIDGEY AND MEOWTH CAUGHT!');
    expect(resultMoment(report({ ledgerFound: { pokemon: [pidgey, meowth, pidgey], items: [] } }))?.headline).toBe('3 POKÉMON CAUGHT!');
  });

  it('heads a banked job, its reward dropping into HOME with the rest', () => {
    const reward = [item('linen-roll')];
    const job = resultMoment(
      report({
        saved: true,
        contract: { description: 'Line survey', complete: true, reward: '1 Linen roll' },
        ledger: { pokemon: [], items: reward },
        ledgerPaid: { pokemon: [], items: reward },
      }),
    );
    expect(job?.headline).toBe('JOB DONE!');
    expect(job?.picture).toBeNull();
    expect(job?.stow).toEqual({ things: reward, more: 0 });
  });

  it('heads a haul with getting out, and counts its money rather than dropping it', () => {
    const moment = resultMoment(banked([item('money', 10), item('mooring-rope'), item('lamp-oil')]));
    expect(moment).toEqual({
      headline: 'YOU GOT OUT!',
      picture: null,
      line: '',
      money: 10,
      stow: { things: [item('mooring-rope'), item('lamp-oil')], more: 0 },
    });
    expect(resultMoment(banked([item('money', 110)]))).toMatchObject({ headline: 'YOU GOT OUT!', money: 110, stow: null, picture: null });
  });

  it('heads a badge with the badge', () => {
    const moment = resultMoment(report({ badgesWon: ['You won the CASCADE BADGE! MISTY no longer holds THE COAST.'] }));
    expect(moment?.headline).toBe('YOU WON THE CASCADE BADGE!');
    expect(moment?.line).toBe('MISTY no longer holds THE COAST.');
    expect(moment?.picture).toBeNull();
  });

  it("shows a gym's badge as the player wearing its honour", () => {
    const moment = resultMoment(
      report({ badgesWon: ['You won the CASCADE BADGE! MISTY no longer holds THE COAST.'], honoursWon: ['cascade'] }),
    );
    expect(moment?.picture).toEqual({ kind: 'honour', honour: 'cascade' });
    expect(moment?.line).toBe('MISTY no longer holds THE COAST. You wear the CASCADE NECKERCHIEF now.');
  });

  it('says an empty raid kindly, and leaves a lost one to its own sequence', () => {
    expect(resultMoment(report({}))).toMatchObject({ headline: 'HOME SAFE', line: 'Nothing found this time.', money: 0, stow: null });
    expect(resultMoment(report({ outcome: 'WIPED' }))).toBeNull();
  });

  it('says in words a haul that could not be saved, which has nothing to show going in', () => {
    const unsaved = report({ saved: false, ledger: { pokemon: [], items: [item('potion')] }, ledgerFound: { pokemon: [], items: [item('money', 5), item('potion')] } });
    expect(resultMoment(unsaved)).toMatchObject({ money: 0, stow: null, line: 'Home with ₽5 and 1 Potion.' });
  });

  describe('what is seen dropping into HOME', () => {
    it('drops every kind of thing banked, never the money', () => {
      const moment = resultMoment(banked([item('potion', 2), item('money', 85), item('great-ball')]));
      expect(moment?.stow).toEqual({ things: [item('potion', 2), item('great-ball')], more: 0 });
      expect(moment?.money).toBe(85);
    });

    it('keeps the row to six, the last a count of the rest', () => {
      const many = Array.from({ length: STOW_SHOWN + 3 }, (_, index) => item(`thing-${index}`));
      const stow = resultMoment(banked(many))?.stow;
      expect(stow?.things).toHaveLength(STOW_SHOWN - 1);
      expect(stow?.more).toBe(4);
      expect(resultMoment(banked(many.slice(0, STOW_SHOWN)))?.stow).toEqual({ things: many.slice(0, STOW_SHOWN), more: 0 });
    });

    it('shows nothing going in when nothing did, or when the raid could not be saved', () => {
      expect(resultMoment(banked([]))?.stow).toBeNull();
      expect(resultMoment(report({ saved: false, ledger: { pokemon: [], items: [item('potion')] } }))?.stow).toBeNull();
    });
  });
});
