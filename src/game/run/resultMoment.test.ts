import { describe, expect, it } from 'vitest';
import type { ExtractionReport } from './extractionReport';
import { resultMoment } from './resultMoment';

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
});
