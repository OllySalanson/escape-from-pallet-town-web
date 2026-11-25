import { describe, expect, it } from 'vitest';
import type { ExtractionReport } from './extractionReport';
import { resultMoment, STOW_LABEL, STOW_SHOWN } from './resultMoment';

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

/** The critic's problem 10: the result was a ledger. A raid that got out opens on what it did. */
describe("the moment a raid that got out opens on", () => {
  it('heads a catch with the catch, its picture, and what else came home', () => {
    const moment = resultMoment(
      report({
        ledgerFound: { pokemon: [pidgey], items: [{ itemId: 'money', label: 'Pokédollars', quantity: 85 }] },
        progress: [{ name: 'Charmander', dexId: 4, fromLevel: 5, toLevel: 6, experienceGained: 60, experienceToNextLevel: 40 }],
      }),
    );
    expect(moment).toEqual({
      headline: 'PIDGEY CAUGHT AND CARRIED HOME',
      picture: { kind: 'pokemon', dexId: 16, shiny: false },
      line: '₽85 came home too. CHARMANDER grew to Lv 6.',
      stow: null,
    });
  });

  it('names two catches, and counts more', () => {
    const meowth = { ...pidgey, name: 'Meowth', dexId: 52 };
    expect(resultMoment(report({ ledgerFound: { pokemon: [pidgey, meowth], items: [] } }))?.headline).toBe('PIDGEY AND MEOWTH CARRIED HOME');
    expect(resultMoment(report({ ledgerFound: { pokemon: [pidgey, meowth, pidgey], items: [] } }))?.headline).toBe('3 POKÉMON CARRIED HOME');
  });

  it('heads a banked job, and money with the money', () => {
    const job = resultMoment(
      report({
        contract: { description: 'Line survey', complete: true, reward: '1 Linen roll' },
        ledgerPaid: { pokemon: [], items: [{ itemId: 'linen-roll', label: 'Linen roll', quantity: 1 }] },
      }),
    );
    expect(job?.headline).toBe('JOB DONE AND BANKED');
    expect(job?.picture).toEqual({ kind: 'item', itemId: 'linen-roll' });
    expect(resultMoment(report({ ledgerFound: { pokemon: [], items: [{ itemId: 'money', label: 'P', quantity: 110 }] } }))?.headline).toBe(
      'HOME WITH ₽110',
    );
  });

  it('heads a badge with the badge', () => {
    const moment = resultMoment(report({ badgesWon: ['You won the CASCADE BADGE! MISTY no longer holds THE COAST.'] }));
    expect(moment?.headline).toBe('YOU WON THE CASCADE BADGE!');
    expect(moment?.line).toBe('MISTY no longer holds THE COAST.');
  });

  it('says an empty raid kindly, and leaves a lost one to its own sequence', () => {
    expect(resultMoment(report({}))?.headline).toBe('HOME SAFE, HANDS EMPTY');
    expect(resultMoment(report({ outcome: 'WIPED' }))).toBeNull();
  });

  describe('what is seen going into YOUR THINGS', () => {
    const item = (itemId: string, quantity = 1) => ({ itemId, label: itemId, quantity });
    const banked = (items: readonly ReturnType<typeof item>[]) =>
      report({ saved: true, ledger: { pokemon: [], items }, ledgerFound: { pokemon: [], items } });

    it('drops everything banked into the sack, money first, and names the screen and its key', () => {
      const moment = resultMoment(banked([item('potion', 2), item('money', 85), item('great-ball')]));
      expect(moment?.stow).toEqual({ things: [item('money', 85), item('potion', 2), item('great-ball')], more: 0 });
      expect(STOW_LABEL).toBe('IN YOUR THINGS · B AT BASE');
    });

    it('lets the things in the sack be the picture of a raid that brought home only things', () => {
      expect(resultMoment(banked([item('potion')]))?.picture).toBeNull();
    });

    it('does not say again in words what is seen going into the sack', () => {
      const pidgeyToo = report({
        saved: true,
        ledger: { pokemon: [pidgey], items: [item('potion', 2)] },
        ledgerFound: { pokemon: [pidgey], items: [item('potion', 2)] },
        progress: [{ name: 'Charmander', dexId: 4, fromLevel: 5, toLevel: 6, experienceGained: 60, experienceToNextLevel: 40 }],
      });
      expect(resultMoment(pidgeyToo)?.line).toBe('CHARMANDER grew to Lv 6.');
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
