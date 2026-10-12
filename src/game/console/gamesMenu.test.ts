import { describe, expect, it } from 'vitest';
import { CONSOLE_GAMES } from './consoleGames';
import { boardRows, gamesMenuMarkup, type GamesMenuState } from './gamesMenu';
import type { Board } from './leaderboard';

const blocks = CONSOLE_GAMES.find((game) => game.id === 'pallet-blocks')!;

const state = (overrides: Partial<GamesMenuState> = {}): GamesMenuState => ({
  games: CONSOLE_GAMES,
  boards: new Map(),
  playerName: 'ASH',
  naming: null,
  ...overrides,
});

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the GAMES menu', () => {
  it('lists every game the console plays, each one a way in that shows its own board', () => {
    const html = gamesMenuMarkup(state());
    for (const game of CONSOLE_GAMES) {
      expect(html).toContain(`data-play="${game.id}"`);
      expect(html).toContain(`data-shows="${game.id}"`);
      expect(html).toContain(`data-shown-by="${game.id}"`);
      expect(text(html)).toContain(game.name);
    }
    expect(html).toContain('px-screen');
    expect(html).toContain('data-close');
  });

  it('starts the cursor on the first game, not on the way out', () => {
    const html = gamesMenuMarkup(state());
    expect(html).toMatch(/data-play="pallet-blocks" data-shows="pallet-blocks" data-cursor-start/);
  });

  it('says who is playing, or asks', () => {
    expect(text(gamesMenuMarkup(state()))).toContain('Playing as ASH');
    const nameless = text(gamesMenuMarkup(state({ playerName: null })));
    expect(nameless).toContain('Who is playing?');
    expect(nameless).toContain('Type a name');
  });

  it('opens a box for the name, held to ten characters, with the old name in it', () => {
    const html = gamesMenuMarkup(state({ naming: { value: 'ASH' } }));
    expect(html).toContain('data-name-form');
    expect(html).toMatch(/<input[^>]*maxlength="10"[^>]*>/);
    expect(html).toMatch(/<input[^>]*value="ASH"/);
    expect(html).toContain('data-name-cancel');
  });

  it('puts a refusal where the help bar is', () => {
    expect(gamesMenuMarkup(state({ status: 'Not that name.' }))).toContain('<span class="px-status-line" role="status">Not that name.</span>');
  });

  it('types no arrow or tick, which the face does not have', () => {
    expect(gamesMenuMarkup(state())).not.toMatch(/[←-⇿▶✓✔]/);
  });
});

describe('a board in the GAMES menu', () => {
  it('says it is still asking before Pallet Town answers', () => {
    expect(text(boardRows(blocks, undefined))).toContain('Asking Pallet Town');
  });

  it("lists Pallet Town's board in order, numbered, with the player's own marked", () => {
    const board: Board = {
      where: 'pallet-town',
      entries: [
        { name: 'BROCK', score: 12_340, mine: false },
        { name: 'ASH', score: 900, mine: true },
      ],
    };
    const html = boardRows(blocks, board);
    expect(text(html)).toContain('Pallet Town · one score a player');
    expect(text(html)).toMatch(/1 BROCK 12,340 .*2 ASH 900/);
    expect(html).toMatch(/class="px-row has-number is-selected"[^>]*data-help="ASH: 900 - that is you\."/);
    expect(html).not.toMatch(/is-selected[^>]*BROCK/);
  });

  it('says plainly when it is only this console\'s board', () => {
    const html = boardRows(blocks, { where: 'device', entries: [{ name: 'ASH', score: 50, mine: true }] });
    expect(text(html)).toContain('This console only');
    expect(text(html)).toContain('Pallet Town did not answer');
    expect(text(html)).not.toContain('one score a player');
  });

  it('invites the first score onto an empty board', () => {
    expect(text(boardRows(blocks, { where: 'pallet-town', entries: [] }))).toContain('No scores yet');
  });
});
