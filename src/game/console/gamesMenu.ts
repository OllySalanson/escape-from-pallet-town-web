import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelCommitBar, pixelScreen, pixelTag, pixelWindow } from '../ui/pixelUi';
import type { ConsoleGame } from './consoleGames';
import { formatScore, type Board } from './leaderboard';
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
  /** The name being typed, while the name box is open. */
  readonly naming: { readonly value: string } | null;
  /** A line about what just happened, over the help bar. */
  readonly status?: string;
}

export const GAMES_MENU_HINTS = 'ARROWS choose · ENTER play · N your name · ESC back to the house';

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
    hints: GAMES_MENU_HINTS,
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

/** The foot of the screen: who is playing and the way in, or the box a name is typed into. */
function nameBar(state: GamesMenuState): string {
  if (state.naming) {
    return pixelCommitBar({
      title: 'Your name',
      lines: ['<small class="px-wrap">On every board, for everybody who plays. Letters, numbers and . ! ? \' - up to ten.</small>'],
      actions: `<form class="box-form console-name-form" data-name-form><input class="px-window px-field" name="name" value="${escapeAttribute(state.naming.value)}" maxlength="${PLAYER_NAME_MAX_LENGTH}" autocomplete="off" spellcheck="false" aria-label="Your name" placeholder="NAME" /><button type="submit" class="px-window px-button is-primary" data-help="Play under this name.">OK</button><button type="button" class="px-window px-button" data-name-cancel data-help="Keep the name you had.">Cancel</button></form>`,
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
