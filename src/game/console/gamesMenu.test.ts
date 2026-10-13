import { describe, expect, it } from 'vitest';
import { CONSOLE_GAMES } from './consoleGames';
import { boardRows, gamesMenuMarkup, scoreLine, waitingLine, type GamesMenuState } from './gamesMenu';
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

  it('says what the keys do while a name is typed, not what they do on the menu', () => {
    // On the menu N opens the name box and Escape leaves for the house; in the
    // box N is a letter and Escape puts the box down, so the menu's line lies.
    const html = gamesMenuMarkup(state({ naming: { value: 'AS' } }));
    const defaultHelp = /data-help-default="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(defaultHelp).not.toContain('N your name');
    expect(defaultHelp).not.toContain('back to the house');
    expect(defaultHelp).toContain('ENTER keep this name');
    expect(defaultHelp).toContain('ESC back to the games');
    // The box itself answers for the cursor while it is in it.
    expect(html).toMatch(/<input[^>]*data-help="[^"]*ENTER keep this name[^"]*"/);
  });

  it('promises a game from the name box only when one is waiting on the name', () => {
    const renaming = gamesMenuMarkup(state({ naming: { value: 'AS' } }));
    expect(renaming).not.toContain('Play under this name.');
    expect(renaming).toMatch(/data-help="Keep this name for every board\."[^>]*>OK</);
    const beforePlaying = gamesMenuMarkup(state({ playerName: null, naming: { value: '', then: 'pallet-blocks' } }));
    expect(beforePlaying).toMatch(/data-help="Play PALLET BLOCKS under this name\."[^>]*>OK</);
    expect(/data-help-default="([^"]*)"/.exec(beforePlaying)?.[1]).toContain('ENTER play under this name');
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

describe('a score that did not reach Pallet Town, as the player is told it', () => {
  it('says nothing when it got there, and why it did not when it did not', () => {
    expect(scoreLine('pallet-town', 1200)).toBeUndefined();
    expect(scoreLine('bot-check', 1200)).toMatch(/bot check didn't pass.*1,200 is kept on this console.*next time/);
    expect(scoreLine('device', 1200)).toMatch(/didn't answer.*1,200 is kept on this console/);
    expect(scoreLine('not-postable', 1200)).toMatch(/won't take that score/);
  });

  it('says what became of the scores that were waiting', () => {
    expect(waitingLine({ sent: 0, left: 0 })).toBeUndefined();
    expect(waitingLine({ sent: 1, left: 0 })).toBe('Your waiting score is on the Pallet Town board now.');
    expect(waitingLine({ sent: 2, left: 0 })).toMatch(/2 waiting scores/);
    expect(waitingLine({ sent: 0, left: 1, stopped: 'bot-check' })).toMatch(/One score is still waiting: the bot check/);
    expect(waitingLine({ sent: 0, left: 3, stopped: 'device' })).toMatch(/3 scores are still waiting for Pallet Town to answer/);
  });
});
