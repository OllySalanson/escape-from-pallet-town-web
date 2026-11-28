import { describe, expect, it } from 'vitest';
import { payLadder, wonLine, wonThings } from './payLadder';
import { JUMP_TICKET_TIERS, NO_GAME_CORNER, payGame, payJump, payoutWords } from './tickets';

const NOON = new Date(2026, 10, 27, 12);

describe("a minigame's pay ladder, on its result card", () => {
  it("is the game's own tiers, the rungs today's best has reached lit", () => {
    const ladder = payLadder({ kind: 'pokemon-jump' }, 2600);
    expect(ladder.rungs.map((rung) => rung.tickets)).toEqual(JUMP_TICKET_TIERS.map((tier) => tier.tickets));
    expect(ladder.rungs.map((rung) => rung.ask)).toEqual(['250', '2,500', '6,000']);
    expect(ladder.rungs.map((rung) => rung.reached)).toEqual([true, true, false]);
    expect(ladder.berryFrom).toBe('5,000');
  });

  it('reads a time round the course as a time, lower being better, and nothing run as nothing reached', () => {
    expect(payLadder({ kind: 'field-course' }, 17_000).rungs.map((rung) => [rung.ask, rung.reached])).toEqual([
      ['0:30.00', true],
      ['0:18.00', true],
      ['0:14.50', false],
    ]);
    expect(payLadder({ kind: 'field-course' }, undefined).rungs.some((rung) => rung.reached)).toBe(false);
  });

  it("names THE DERBY's rungs by place, on the level's own tiers", () => {
    const front = payLadder({ kind: 'derby', level: 1 }, 5);
    expect(front.rungs.map((rung) => rung.ask)).toEqual(['3RD', '2ND', '1ST']);
    expect(front.rungs.map((rung) => rung.reached)).toEqual([true, true, false]);
    const sands = payLadder({ kind: 'derby', level: 2 }, 0);
    expect(sands.rungs[0]?.tickets).toBeGreaterThan(front.rungs[0]?.tickets ?? 0);
  });

  it('says the pay rule once: what nothing reached is shown by the ladder, not said again over it', () => {
    const payout = payJump(NO_GAME_CORNER, 100, NOON);
    // In words, where there is no ladder, the first rung is said...
    expect(payoutWords(payout, [])).toBe('No tickets. A score of 250 pays 10 tickets.');
    // ...and over the ladder it is not.
    expect(wonLine(payout, [])).toBe('No tickets.');
    const paid = payGame(NO_GAME_CORNER, 'dig', 40, NOON);
    expect(wonLine(paid, wonThings(paid.tickets, ['oran-berry', 'oran-berry']))).toMatch(/^A new best! Won 20 tickets, 2 /);
  });
});
