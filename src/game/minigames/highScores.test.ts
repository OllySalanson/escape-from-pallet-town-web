import { describe, expect, it } from 'vitest';
import {
  BOARD_GAMES,
  boardLine,
  boardResult,
  highScoresFor,
  highScoresLines,
  REGULARS_A_GAME,
  regularResult,
  regularsWhoPlayed,
  YOU,
  yourPlace,
} from './highScores';
import { DERBY_TICKET_TIERS, JUMP_TICKET_TIERS, NO_GAME_CORNER, payGame } from './tickets';

const NOW = new Date(2026, 10, 7, 15, 0);
const TOMORROW = new Date(2026, 10, 8, 9, 0);
const none = { gameCorner: NO_GAME_CORNER };

describe('the HIGH SCORES board', () => {
  it('has the same regulars and the same scores on it all day, on every screen, and new ones tomorrow', () => {
    const morning = new Date(2026, 10, 7, 7, 0);
    for (const game of BOARD_GAMES) {
      expect(highScoresFor(game, none, morning)).toEqual(highScoresFor(game, none, NOW));
      expect(regularsWhoPlayed(game, NOW)).toHaveLength(REGULARS_A_GAME);
    }
    const days = Array.from({ length: 10 }, (_day, index) => new Date(2026, 10, 7 + index, 12, 0));
    const tops = new Set(days.map((day) => highScoresFor('pokemon-jump', none, day)[0].name));
    expect(tops.size).toBeGreaterThan(1);
  });

  it('keeps the regulars between the ticket tiers, so the top tier usually tops the board and not always', () => {
    const days = Array.from({ length: 60 }, (_day, index) => new Date(2026, 0, 1 + index, 12, 0));
    let beaten = 0;
    for (const day of days) {
      for (const bot of regularsWhoPlayed('pokemon-jump', day)) {
        const score = regularResult(bot, 'pokemon-jump', day);
        expect(score).toBeGreaterThanOrEqual(JUMP_TICKET_TIERS[0].score);
        if (score >= JUMP_TICKET_TIERS[2].score) beaten += 1;
      }
      for (const bot of regularsWhoPlayed('derby', day)) {
        expect(regularResult(bot, 'derby', day)).toBeLessThanOrEqual(DERBY_TICKET_TIERS[2].score);
      }
    }
    expect(beaten).toBeGreaterThan(0);
    expect(beaten).toBeLessThan(days.length);
  });

  it('puts the score just made on it as YOU, in its place, and wipes it in the morning', () => {
    const record = payGame(NO_GAME_CORNER, 'pokemon-jump', 9990, NOW).record;
    const lines = highScoresFor('pokemon-jump', { gameCorner: record }, NOW);
    expect(lines[0]).toEqual({ name: YOU, result: 9990, yours: true });
    expect(yourPlace('pokemon-jump', { gameCorner: record }, NOW)).toBe(1);
    expect(boardLine('pokemon-jump', { gameCorner: record }, NOW)).toEqual({ game: 'JUMP', result: '9,990', name: YOU, yours: true });
    expect(yourPlace('pokemon-jump', { gameCorner: record }, TOMORROW)).toBeNull();
    const low = payGame(NO_GAME_CORNER, 'pokemon-jump', 10, NOW).record;
    expect(yourPlace('pokemon-jump', { gameCorner: low }, NOW)).toBe(REGULARS_A_GAME + 1);
  });

  it('ranks a time round the course quickest first', () => {
    const record = payGame(NO_GAME_CORNER, 'field-course', 14_000, NOW).record;
    const lines = highScoresFor('field-course', { gameCorner: record }, NOW);
    expect(lines[0].name).toBe(YOU);
    for (let at = 1; at < lines.length; at += 1) {
      expect(lines[at].result).toBeGreaterThanOrEqual(lines[at - 1].result);
    }
    expect(boardResult('field-course', 14_000)).toBe('0:14.00');
    expect(boardResult('derby', 6)).toBe('1ST');
    expect(boardResult('derby', 4)).toBe('3RD');
  });

  it('reads every game aloud in a line the dialogue box holds', () => {
    for (const day of Array.from({ length: 30 }, (_day, index) => new Date(2026, 10, 1 + index, 12, 0))) {
      const lines = highScoresLines(none, day);
      expect(lines).toHaveLength(BOARD_GAMES.length + 1);
      for (const line of lines) {
        expect([line, line.length <= 68]).toEqual([line, true]);
      }
    }
    expect(highScoresLines(none, NOW).at(-1)).toMatch(/Nothing of yours/);
    const record = payGame(NO_GAME_CORNER, 'pokemon-jump', 9990, NOW).record;
    expect(highScoresLines({ gameCorner: record }, NOW).at(-1)).toMatch(/top the board at JUMP/);
  });
});
