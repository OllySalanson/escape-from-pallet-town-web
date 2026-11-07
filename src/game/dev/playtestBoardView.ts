import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelScreen, pixelWindow } from '../ui/pixelUi';
import { PLAYTEST_BOARD_NAME, playtestBoardSections } from './playtestBoard';
import type { PlaytestHour } from './playtestClock';

/**
 * The PLAYTEST BOARD's screen (`playtestBoard.ts` says what it is), as markup:
 * a row a button, under the board's own headings. Phaser-free;
 * `PlaytestBoardOverlay.ts` puts it up.
 */
export function playtestBoardMarkup(hour: PlaytestHour | null): string {
  const sections = playtestBoardSections(hour);
  let first = true;
  const rows = sections
    .map(
      (section) =>
        `<h3 class="px-subheading">${section.heading}</h3>${section.rows
          .map((row) => {
            const start = first ? ' data-cursor-start' : '';
            first = false;
            return `<button class="px-row" data-board-row="${escapeAttribute(row.id)}"${start} data-help="${escapeAttribute(
              row.note,
            )}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${row.label}</strong></span><small>${row.note}</small></span></button>`;
          })
          .join('')}`,
    )
    .join('');
  const now = hour ? hour.toUpperCase() : 'MY CLOCK';
  return pixelScreen({
    title: PLAYTEST_BOARD_NAME,
    place: 'Playtest',
    back: { label: 'Back', attribute: 'data-board-close' },
    body: `<main class="px-body playtest-board-body">${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.brief)}>${rows}</div>`,
      { heading: 'Go, set, play', note: `Hour: ${now}` },
    )}</main>`,
    hints: 'ARROWS choose · ENTER do it · ESC back',
  });
}
