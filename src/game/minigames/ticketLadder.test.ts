import { describe, expect, it } from 'vitest';
import { ticketLadder, tiersOf } from './ticketLadder';
import { COURSE_TICKET_TIERS, JUMP_TICKET_TIERS, NO_GAME_CORNER, payGame, payJump } from './tickets';

const NOON = new Date(2026, 10, 27, 12);

describe("a game's pay table, drawn once on its result", () => {
  it("is the game's own tiers, read from tickets.ts and never restated", () => {
    expect(tiersOf('pokemon-jump')?.map((tier) => tier.tickets)).toEqual(JUMP_TICKET_TIERS.map((tier) => tier.tickets));
    expect(tiersOf('pokemon-jump')?.map((tier) => tier.asks)).toEqual(['250', '2,500', '6,000']);
    expect(tiersOf('field-course')?.map((tier) => tier.tickets)).toEqual(COURSE_TICKET_TIERS.map((tier) => tier.tickets));
    expect(tiersOf('field-course')?.[0]?.asks).toBe('0:30');
    expect(tiersOf('derby-2')?.map((tier) => tier.asks)).toEqual(['3rd', '2nd', '1st']);
    expect(tiersOf('battle-arena')).toBeNull();
  });

  it('fills the bar as far as the result reached, and lights the lamps today has paid', () => {
    const paid = payJump(NO_GAME_CORNER, 3000, NOON).record;
    const ladder = ticketLadder('pokemon-jump', 3000, paid, NOON);
    expect(ladder?.rungs.map((rung) => rung.reached)).toEqual([true, true, false]);
    expect(ladder?.rungs.map((rung) => rung.lit)).toEqual([true, true, false]);
    expect(ladder?.fill).toBeGreaterThan(2 / 3);
    expect(ladder?.fill).toBeLessThan(1);
    // A poorer game later the same day reaches less, and the lamps still say what the day has paid.
    const poorer = ticketLadder('pokemon-jump', 100, paid, NOON);
    expect(poorer?.rungs.map((rung) => rung.reached)).toEqual([false, false, false]);
    expect(poorer?.rungs.map((rung) => rung.lit)).toEqual([true, true, false]);
    expect(poorer?.fill).toBeCloseTo(100 / 250 / 3);
  });

  it('climbs a time downwards, and an unfinished run reaches nothing', () => {
    const quick = payGame(NO_GAME_CORNER, 'field-course', 17_000, NOON).record;
    expect(ticketLadder('field-course', 17_000, quick, NOON)?.rungs.map((rung) => rung.reached)).toEqual([true, true, false]);
    expect(ticketLadder('field-course', 0, NO_GAME_CORNER, NOON)?.fill).toBe(0);
    expect(ticketLadder('field-course', 10_000, NO_GAME_CORNER, NOON)?.fill).toBe(1);
  });
});
