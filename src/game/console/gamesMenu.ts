import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelCommitBar, pixelScreen, pixelTag, pixelWindow } from '../ui/pixelUi';
import type { ConsoleGame } from './consoleGames';
import { formatScore, type Board, type Posted, type WaitingSent } from './leaderboard';
import { PLAYER_NAME_MAX_LENGTH } from './playerName';

/**
 * The GAMES menu the console in the player's room opens: every game it plays
 * down one side, the Pallet Town board for the one under the cursor beside it,
 * and along the foot who is playing and the way in.
 *
 * Pure markup in the game's own pixel-ui, so what it says is tested without a
 * browser; `scenes/ConsoleScene.ts` draws it and wires the keys.
 */

export interface GamesMenuState {
  readonly games: readonly ConsoleGame[];
  /** Each game's board, or absent while it is being asked for. */
  readonly boards: ReadonlyMap<string, Board>;
  /** The name this device plays under, or null if nobody has typed one. */
  readonly playerName: string | null;
  /**
   * The name being typed, while the name box is open, and the game waiting on
   * it when PLAY asked for a name first.
   */
  readonly naming: { readonly value: string; readonly then?: string } | null;
  /** A line about what just happened, over the help bar. */
  readonly status?: string;
}

export const GAMES_MENU_HINTS = 'ARROWS choose · ENTER play · N your name · ESC back to the house';

/**
 * The keys while the name box is open, where N is a letter and Escape puts the
 * box down rather than leaving for the house (`ConsoleScene.onKey`).
 */
export function namingHints(waitingGame: ConsoleGame | undefined): string {
  return `${waitingGame ? 'ENTER play under this name' : 'ENTER keep this name'} · ESC back to the games`;
}

export function gamesMenuMarkup(state: GamesMenuState): string {
  const rows = state.games
    .map(
      (game, index) =>
        `<button class="px-row px-tall" data-play="${game.id}" data-shows="${game.id}"${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(game.help)}"><span class="px-row-main"><strong class="px-name">${game.name}</strong><small class="px-wrap">${game.blurb}</small></span>${pixelTag('Play', 'good')}</button>`,
    )
    .join('');
  const boards = state.games
    .map(
      (game, index) =>
        `<div class="px-list px-scroll console-board" data-shown-by="${game.id}"${index === 0 ? '' : ' hidden'}>${boardRows(game, state.boards.get(game.id))}</div>`,
    )
    .join('');
  const count = state.games.length;
  const body = `<main class="px-body console-layout"><div class="console-panes">${pixelWindow(
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.brief)}>${rows}</div>`,
    { heading: 'Games', note: `${count} game${count === 1 ? '' : 's'}` },
  )}${pixelWindow(boards, { heading: 'Leaderboard', note: 'best scores' })}</div>${nameBar(state)}</main>`;
  return pixelScreen({
    title: 'Games',
    place: 'The console',
    back: { label: 'House', attribute: 'data-close' },
    aside: state.playerName ? `Playing as ${state.playerName}` : 'No name yet',
    body,
    hints: state.naming ? namingHints(waitingGame(state)) : GAMES_MENU_HINTS,
    ...(state.status ? { status: state.status } : {}),
  });
}

/**
 * A game's board: whose it is - Pallet Town's, or this console's own when
 * Pallet Town did not answer - and every place on it, the player's own marked.
 */
export function boardRows(game: ConsoleGame, board: Board | undefined): string {
  if (!board) {
    return `<p class="px-empty px-wrap">Asking Pallet Town for the ${game.name} board...</p>`;
  }
  const whose =
    board.where === 'pallet-town'
      ? '<h3 class="px-subheading">Pallet Town · one score a player</h3>'
      : `<h3 class="px-subheading">This console only</h3><button class="px-row" aria-disabled="true" data-shows="${game.id}" data-help="Pallet Town did not answer, so these are the scores played on this console. Yours still count here."><span class="px-row-main"><span class="px-wrap px-warning">Pallet Town did not answer, so these are the scores played here.</span></span></button>`;
  if (board.entries.length === 0) {
    return `${whose}<p class="px-empty px-wrap">No scores yet. Play a game and be the first name on it.</p>`;
  }
  const places = board.entries
    .map(
      (entry, index) =>
        `<button class="px-row has-number${entry.mine ? ' is-selected' : ''}" aria-disabled="true" data-shows="${game.id}" data-help="${escapeAttribute(`${entry.name}: ${formatScore(entry.score)}${entry.mine ? ' - that is you.' : '.'}`)}"><span class="px-number">${index + 1}</span><span class="px-row-main console-place"><strong class="px-name">${entry.name}</strong>${pixelTag(formatScore(entry.score), entry.mine ? 'good' : 'plain')}</span></button>`,
    )
    .join('');
  return `${whose}${places}`;
}

/** The game PLAY was pressed on before there was a name to play under, if any. */
function waitingGame(state: GamesMenuState): ConsoleGame | undefined {
  const then = state.naming?.then;
  return then === undefined ? undefined : state.games.find((game) => game.id === then);
}

/** The foot of the screen: who is playing and the way in, or the box a name is typed into. */
function nameBar(state: GamesMenuState): string {
  if (state.naming) {
    const waiting = waitingGame(state);
    const okHelp = waiting ? `Play ${waiting.name} under this name.` : 'Keep this name for every board.';
    return pixelCommitBar({
      title: 'Your name',
      lines: ['<small class="px-wrap">On every board, for everybody who plays. Letters, numbers and . ! ? \' - up to ten.</small>'],
      actions: `<form class="box-form console-name-form" data-name-form><input class="px-window px-field" name="name" value="${escapeAttribute(state.naming.value)}" maxlength="${PLAYER_NAME_MAX_LENGTH}" autocomplete="off" spellcheck="false" aria-label="Your name" placeholder="NAME" data-help="${escapeAttribute(namingHints(waiting))}" /><button type="submit" class="px-window px-button is-primary" data-help="${escapeAttribute(okHelp)}">OK</button><button type="button" class="px-window px-button" data-name-cancel data-help="Keep the name you had.">Cancel</button></form>`,
    });
  }
  const named = state.playerName !== null;
  return pixelCommitBar({
    title: named ? `Playing as ${state.playerName}` : 'Who is playing?',
    lines: [
      `<small class="px-wrap">${named ? 'Every game you finish goes on the Pallet Town board under this name.' : 'Type a name before you play: it goes on the boards beside your scores.'}</small>`,
    ],
    actions: `<button class="px-window px-button" data-name data-help="Type the name your scores go under.">${named ? 'Change name' : 'Type a name'}</button>`,
  });
}

/**
 * What a player is told when a finished game's score did not reach the Pallet
 * Town board, over the game they have just finished and again on the menu.
 * Undefined when it got there and there is nothing to say.
 */
export function scoreLine(posted: Posted, score: number): string | undefined {
  const points = formatScore(score);
  switch (posted) {
    case 'pallet-town':
      return undefined;
    case 'bot-check':
      return `The bot check didn't pass, so your ${points} is kept on this console. It goes up to Pallet Town next time you sit down here.`;
    case 'device':
      return `Pallet Town didn't answer, so your ${points} is kept on this console. It goes up next time you sit down here.`;
    case 'not-postable':
      return `Pallet Town won't take that score, so your ${points} is on this console's board only.`;
  }
}

/** What the menu says after it has tried the scores waiting on this console. */
export function waitingLine(result: WaitingSent): string | undefined {
  if (result.left === 0) {
    return result.sent === 0
      ? undefined
      : result.sent === 1
        ? 'Your waiting score is on the Pallet Town board now.'
        : `Your ${result.sent} waiting scores are on the Pallet Town board now.`;
  }
  const one = result.left === 1;
  const scores = one ? 'One score is' : `${result.left} scores are`;
  const goes = one ? 'It goes' : 'They go';
  return result.stopped === 'bot-check'
    ? `${scores} still waiting: the bot check didn't pass. ${goes} next time you sit down here.`
    : `${scores} still waiting for Pallet Town to answer. ${goes} next time you sit down here.`;
}
