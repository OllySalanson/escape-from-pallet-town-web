import { describe, expect, it } from 'vitest';
import { getSpeciesById } from '../pokemon';
import { IN_GAME_TRADES } from './trades';
import { tradesBody, type TradeRow } from './tradesView';

const spearow: TradeRow['pokemon'] = { name: 'SPEAROW', level: 9, currentHp: 30, maxHp: 30, isFainted: false, shiny: false, heldItemId: null, base: { id: 'spearow', dexId: 21 } };

describe("THE TRADER's screen", () => {
  const trade = IN_GAME_TRADES.find((one) => one.wants === 'spearow')!;
  const gives = getSpeciesById(trade.gives)!;
  const row: TradeRow = { id: 's', pokemon: spearow, deal: { kind: 'swap', trade, gives }, away: false, partner: false };

  it('stands what comes back opposite the one going, and says when the Pokédex has none', () => {
    const html = tradesBody([row], { browse: '', note: '', owned: new Set() });
    expect(html).toContain(`<p class="tr-name">${trade.nickname}</p>`);
    expect(html).toContain('New in the Pokédex');
    expect(html.match(/class="tr-stand"/g)).toHaveLength(2);
  });

  it('says nothing of the Pokédex for a kind already owned', () => {
    const html = tradesBody([row], { browse: '', note: '', owned: new Set([gives.dexId]) });
    expect(html).not.toContain('New in the Pokédex');
  });
});
