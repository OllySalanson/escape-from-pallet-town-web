import { COLUMN_MEASURES, pixelColumns, pixelScreen, pixelWindow } from '../ui/pixelUi';
import type { PlayDay, PlayStats } from './playStats';

/**
 * The owner's STATS screen, as markup: does anyone play this game? Pure
 * strings, like every pixel-ui screen, so what it says is tested without a
 * browser; `StatsScene` wires it.
 *
 * Plain words and whole numbers, the answer first: players today, this week
 * and ever, then a month of daily players as a bar chart, then what they did -
 * raids and how they ended, starters, Pallet Blocks, maps sent in.
 */

export type StatsState =
  | { readonly step: 'checking' }
  | { readonly step: 'signed-out'; readonly reason?: string }
  | { readonly step: 'not-owner' }
  | { readonly step: 'failed'; readonly reason: string }
  | { readonly step: 'loaded'; readonly stats: PlayStats };

/** How tall the tallest day's bar is, in game pixels. */
export const CHART_HEIGHT = 40;

export const STATS_HINTS = 'ARROWS read · R check again · ESC back to the title';

const number = (value: number): string => value.toLocaleString('en-GB');

const plural = (value: number, one: string, many = `${one}s`): string => `${number(value)} ${value === 1 ? one : many}`;

/** Time played, in the words a person would use. */
export function playedWords(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) {
    return seconds > 0 ? 'under a minute' : 'none yet';
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return plural(minutes, 'minute');
  }
  return rest === 0 ? plural(hours, 'hour') : `${plural(hours, 'hour')} ${plural(rest, 'minute')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-12` as `12 Oct`. */
export function dayWords(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS[(month ?? 1) - 1] ?? ''}`;
}

/** Each day's bar height in game pixels: the busiest day is the full height, any day with a player at least one. */
export function barHeights(days: readonly PlayDay[]): number[] {
  const most = Math.max(1, ...days.map((day) => day.players));
  return days.map((day) => (day.players === 0 ? 0 : Math.max(1, Math.round((day.players / most) * CHART_HEIGHT))));
}

const button = (attribute: string, label: string, help: string, primary = false): string =>
  `<button class="px-window px-button${primary ? ' is-primary' : ''}" ${attribute} data-help="${escapeAttribute(help)}">${label}</button>`;

/** A row that says one number, which the cursor can rest on so a long pane scrolls by keys. */
function line(name: string, value: string, help: string): string {
  return `<button class="px-row stats-line" aria-disabled="true" data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-name px-wrap">${name}</span></span><strong class="stats-value">${value}</strong></button>`;
}

function chart(days: readonly PlayDay[]): string {
  const heights = barHeights(days);
  const most = Math.max(0, ...days.map((day) => day.players));
  const bars = days
    .map(
      (day, index) =>
        `<span class="stats-bar${index === days.length - 1 ? ' is-today' : ''}" style="--bar:${heights[index]}" title="${escapeAttribute(`${dayWords(day.day)}: ${plural(day.players, 'player')}`)}"></span>`,
    )
    .join('');
  const total = days.reduce((sum, day) => sum + day.players, 0);
  const first = days[0];
  const last = days[days.length - 1];
  const summary = `Daily players over the last ${days.length} days: busiest day ${plural(most, 'player')}, ${plural(total, 'player-day')} in all.`;
  return `<button class="px-row stats-chart-row" aria-disabled="true" data-help="${escapeAttribute(
    'One bar a day, today on the right. Hover a bar for its day.',
  )}"><span class="stats-chart" role="img" aria-label="${escapeAttribute(summary)}"><span class="stats-chart-top">${number(most)}</span><span class="stats-bars" style="--days:${days.length}">${bars}</span><span class="stats-chart-foot"><span>${first ? dayWords(first.day) : ''}</span><span>${last ? 'Today' : ''}</span></span></span></button>`;
}

const STARTER_NAMES: readonly (readonly [string, string])[] = [
  ['bulbasaur', 'Bulbasaur'],
  ['charmander', 'Charmander'],
  ['squirtle', 'Squirtle'],
];

function loadedBody(stats: PlayStats): string {
  const month = (key: string): number => stats.month[key] ?? 0;
  const ever = (key: string): number => stats.allTime[key] ?? 0;
  const players = pixelWindow(
    `<div class="px-list" ${pixelColumns(COLUMN_MEASURES.brief)}>${[
      line('Today', number(stats.playersToday), 'Different browsers that opened the game today.'),
      line('This week', number(stats.playersWeek), 'Different browsers that opened the game in the last seven days.'),
      line('All time', number(stats.playersAllTime), 'Every browser that has ever opened the game since counting began.'),
      line(
        'Came back',
        `${number(stats.returningWeek)} this week · ${number(stats.returningAllTime)} ever`,
        'Players who opened the game on more than one day.',
      ),
    ].join('')}</div>`,
    { heading: 'Players', note: `today is ${dayWords(stats.today)}` },
  );
  const daily = pixelWindow(`<div class="px-list">${chart(stats.days)}</div>`, {
    heading: 'Players each day',
    note: 'last 30 days',
  });
  const started = month('raid-start');
  const raids = pixelWindow(
    `<div class="px-list" ${pixelColumns(COLUMN_MEASURES.brief)}>${[
      line('Raids started', number(started), 'Raids deployed from Oak\'s Lab.'),
      line('Got out', number(month('raid-end:extracted')), 'Raids that ended by leaving through an exit.'),
      line('Wiped out', number(month('raid-end:wiped')), 'Raids lost in a fight.'),
      line('Clock ran out', number(month('raid-end:clock')), 'Raids that ran out of time.'),
      line('Left mid-raid', number(month('raid-end:abandoned')), 'Raids left by closing the tab or reloading.'),
    ].join('')}</div>`,
    { heading: 'Raids', note: 'last 30 days' },
  );
  const starters = STARTER_NAMES.map(([id, name]) => `${name} ${number(month(`starter:${id}`))}`).join(' · ');
  const builds = Object.entries(stats.month)
    .filter(([key]) => key.startsWith('build:'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, sessions]) => `${key.slice('build:'.length)} (${number(sessions)})`)
    .join(' · ');
  const days = stats.days.length;
  const sessions = stats.days.reduce((sum, day) => sum + day.sessions, 0);
  const seconds = stats.days.reduce((sum, day) => sum + day.seconds, 0);
  const newPlayers = stats.days.reduce((sum, day) => sum + day.newPlayers, 0);
  const more = pixelWindow(
    `<div class="px-list" ${pixelColumns(COLUMN_MEASURES.brief)}>${[
      line('Times opened', number(sessions), `How often the game was opened in the last ${days} days.`),
      line('New players', number(newPlayers), 'Browsers that opened the game for the first time.'),
      line('Time played', playedWords(seconds), 'Time with the game on screen and someone pressing keys.'),
      line('Starters picked', starters, 'New games started, by the starter chosen.'),
      line('Pallet Blocks games', number(month('blocks:pallet-blocks')), 'Games of Pallet Blocks finished on the console.'),
      line('Maps sent in', number(month('map-sent')), 'Maps sent from the map maker for review.'),
      line('Harbour visits', number(month('harbour')), 'Times the game was opened and the player walked into the harbour.'),
      line('Builds played', builds || 'none yet', 'Which version of the game was played, and how often.'),
      line(
        'Ever',
        `${plural(ever('raid-start'), 'raid')} · ${playedWords(ever('played-seconds'))} played`,
        'Everything since counting began.',
      ),
    ].join('')}</div>`,
    { heading: 'What they did', note: 'last 30 days' },
  );
  const actions = `<div class="stats-actions">${button('data-refresh', 'Check again', 'Asks for the counts again.')}${button(
    'data-sign-out',
    'Sign out',
    'Signs this GitHub account out of the game, everywhere.',
  )}</div>`;
  return `<main class="px-body stats-layout"><div class="stats-sheet px-scroll">${players}${daily}${raids}${more}${pixelWindow(
    `<div class="px-list"><p class="px-note px-wrap stats-message">Counted without cookies or accounts: a random id per browser and nothing else about anyone. Browsers that ask not to be tracked are not counted, and nor is anything played on a test copy of the game.</p>${actions}</div>`,
    { heading: 'About these numbers' },
  )}</div></main>`;
}

function messageBody(words: string, actions: string, warning?: string): string {
  return `<main class="px-body stats-layout">${pixelWindow(
    `<div class="px-list">${words ? `<p class="px-wrap stats-message">${words}</p>` : ''}${
      warning ? `<p class="px-warning px-wrap stats-message">${escapeHtml(warning)}</p>` : ''
    }<div class="stats-actions">${actions}</div></div>`,
    { heading: 'Play stats' },
  )}</main>`;
}


/** The whole STATS screen. */
export function statsScreen(state: StatsState, status?: string): string {
  let body: string;
  let aside = '';
  switch (state.step) {
    case 'checking':
      body = messageBody('Checking...', '');
      break;
    case 'signed-out':
      body = messageBody(
        'How many people play, for the game\'s owner. Sign in with the same GitHub account that reviews player maps.',
        button('data-sign-in', 'Sign in with GitHub', 'Signs in through GitHub and comes back here.', true),
        state.reason,
      );
      break;
    case 'not-owner':
      body = messageBody(
        'This account cannot see the play stats.',
        button('data-sign-out', 'Sign out', 'Signs this GitHub account out of the game.'),
      );
      break;
    case 'failed':
      body = messageBody('', button('data-refresh', 'Try again', 'Asks for the counts again.', true), state.reason);
      break;
    case 'loaded':
      body = loadedBody(state.stats);
      aside = `${plural(state.stats.playersToday, 'player')} today`;
      break;
  }
  return pixelScreen({
    title: 'Play stats',
    back: { label: 'Title', attribute: 'data-close' },
    ...(aside ? { aside } : {}),
    body,
    hints: STATS_HINTS,
    ...(status ? { status } : {}),
  });
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
