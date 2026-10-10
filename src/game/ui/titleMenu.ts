import type { SaveSummary } from '../save/SaveManager';

/**
 * What the title screen offers, as data.
 *
 * The tutorial's `MainMenuController` is Continue and New Game, with Continue
 * greyed out when there is nothing to continue. This game has one save and no
 * slots (see `docs/screens/title-menu/README.md` for why), so the two choices
 * are exactly those, and the rule that matters lives here rather than in the
 * scene: **a save is never erased by one keypress.** New Game over a save takes
 * a second question whose cursor starts on keeping it, as the trainer prompt's
 * starts on BACK AWAY - the title is where the key that woke the game up is
 * still held.
 *
 * Under the two of them sit the two things the game has that are about maps
 * rather than about a save, side by side on one row: MAKE A MAP, which opens
 * the map maker (`scenes/MapMakerScene.ts`) and nothing else, and PLAYTEST, the
 * explorer run (`dev/playtestMode.ts`) - a whole second game, in its own save,
 * for walking the maps rather than surviving them. PLAYTEST used to be a
 * second question behind MAKE A MAP, because four full-width rows do not fit
 * under the name on a 320x240 screen; the owner asked for the map maker's
 * button to be only the map maker (2026-10-10), and two half-width buttons on
 * one row are what make room for both. Neither carries a detail line: the hint
 * under the menu says what each does while the cursor is on it.
 *
 * Pure, like `raidHud.ts`, so the wording and the layout are held by tests that
 * never open a canvas; `TitleScene` only draws what it is handed.
 */

export type TitleChoiceId =
  | 'continue'
  | 'new'
  | 'keep'
  | 'erase'
  | 'maker'
  | 'playtest'
  | 'resume-playtest'
  | 'fresh-playtest';

export interface TitleChoice {
  readonly id: TitleChoiceId;
  readonly label: string;
  /** A second, smaller line: what is behind the choice. */
  readonly detail?: string;
  /** A choice that would do nothing is drawn dim and the cursor passes over it. */
  readonly enabled: boolean;
  /** Shares the row of the choice before it, each taking half. */
  readonly beside?: boolean;
}

export interface TitleMenu {
  /** Said above the choices when the menu is asking rather than offering. */
  readonly question?: string;
  readonly choices: readonly TitleChoice[];
  /** Where the cursor starts. */
  readonly initial: TitleChoiceId;
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** "5 POKEMON · 2 CONTRACTS": enough to know a save is yours. */
export function saveDetail(summary: SaveSummary): string {
  if (summary.kind === 'none') {
    return 'NO SAVED GAME';
  }
  if (summary.kind === 'unreadable') {
    return 'SAVE UNREADABLE';
  }
  return `${summary.pokemon} POKEMON · ${plural(summary.contracts, 'CONTRACT', 'CONTRACTS')}`;
}

export function titleMenu(summary: SaveSummary): TitleMenu {
  const canContinue = summary.kind === 'game';
  return {
    initial: canContinue ? 'continue' : 'new',
    choices: [
      { id: 'continue', label: 'CONTINUE', detail: saveDetail(summary), enabled: canContinue },
      {
        id: 'new',
        label: 'NEW GAME',
        ...(summary.kind === 'none' ? {} : { detail: summary.kind === 'unreadable' ? 'REPLACES THE SAVE' : 'ERASES THE SAVE' }),
        enabled: true,
      },
      { id: 'maker', label: 'MAKE A MAP', enabled: true },
      { id: 'playtest', label: 'PLAYTEST', enabled: true, beside: true },
    ],
  };
}

/** The second question. Only ever asked when there is something to lose. */
export function eraseMenu(): TitleMenu {
  return {
    question: 'ERASE YOUR SAVED GAME?',
    initial: 'keep',
    choices: [
      { id: 'keep', label: 'KEEP MY GAME', enabled: true },
      { id: 'erase', label: 'ERASE AND START OVER', enabled: true },
    ],
  };
}

/**
 * The explorer run's own second question, asked only when there is already one
 * to come back to. Neither answer can touch the ordinary save, so unlike the
 * erase question this one starts on the answer the player most likely wants.
 */
export function playtestMenu(): TitleMenu {
  return {
    question: 'PLAYTEST RUN',
    initial: 'resume-playtest',
    choices: [
      { id: 'resume-playtest', label: 'CARRY ON', enabled: true },
      { id: 'fresh-playtest', label: 'START A FRESH ONE', enabled: true },
    ],
  };
}

/** Whether choosing New Game has to ask first. */
export function needsEraseConfirmation(summary: SaveSummary): boolean {
  return summary.kind !== 'none';
}

/**
 * The line under the menu. It speaks for the choice the cursor is on, because
 * the one thing that has to be said about the explorer run - that it leaves the
 * ordinary game alone - is a sentence, and a sentence does not fit on a row.
 */
export function titleHint(menu: TitleMenu, choice: TitleChoiceId): string {
  if (choice === 'playtest') {
    return 'EXPLORE FREELY · YOUR SAVED GAME IS UNTOUCHED';
  }
  if (choice === 'maker') {
    return 'DRAW YOUR OWN RAID MAP';
  }
  if (menu.question) {
    return menu.choices[0].id === 'keep' ? 'ESC KEEPS IT' : 'ESC GOES BACK';
  }
  return 'ARROWS CHOOSE · SPACE SELECT';
}

/**
 * Moves the cursor one enabled choice up or down, stopping at the ends. It
 * walks the choices in reading order, so Down from MAKE A MAP is PLAYTEST
 * beside it: every choice is reachable with Up and Down alone.
 */
export function moveTitleChoice(menu: TitleMenu, current: TitleChoiceId, step: -1 | 1): TitleChoiceId {
  const enabled = menu.choices.filter((choice) => choice.enabled);
  const index = enabled.findIndex((choice) => choice.id === current);
  const next = Math.max(0, Math.min(enabled.length - 1, (index < 0 ? 0 : index) + step));
  return enabled[next]?.id ?? current;
}

/**
 * Left and Right: to the choice beside this one on its row, and nowhere else.
 */
export function moveTitleChoiceAcross(menu: TitleMenu, current: TitleChoiceId, step: -1 | 1): TitleChoiceId {
  const index = menu.choices.findIndex((choice) => choice.id === current);
  const here = menu.choices[index];
  const next = menu.choices[index + step];
  if (!here || !next || !next.enabled) {
    return current;
  }
  const sameRow = step === 1 ? next.beside === true : here.beside === true;
  return sameRow ? next.id : current;
}

export interface TitleRow {
  readonly id: TitleChoiceId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TitleMenuLayout {
  readonly question?: { readonly x: number; readonly y: number };
  readonly rows: readonly TitleRow[];
  readonly hint: { readonly x: number; readonly y: number };
}

export const TITLE_ROW_WIDTH = 200;
/** A row with a detail line is taller than one without. */
export const TITLE_ROW_HEIGHT = 22;
export const TITLE_ROW_HEIGHT_WITH_DETAIL = 32;
const ROW_GAP = 5;
/** Between two choices that share a row. */
const PAIR_GAP = 6;
const QUESTION_HEIGHT = 16;
const HINT_HEIGHT = 12;

/**
 * Seats the choices under the title on whole pixels, and the key hint under
 * them. Everything is anchored to the screen's bottom edge first and the title
 * second, so a stage as small as 320x240 shows the whole menu and a taller one
 * simply has more town between. A choice that is `beside` the one before it
 * takes the right half of that row.
 */
export function layoutTitleMenu(
  menu: TitleMenu,
  width: number,
  height: number,
  titleBottom: number,
): TitleMenuLayout {
  // One entry per drawn row, holding the indices of the choices on it.
  const lines: number[][] = [];
  menu.choices.forEach((choice, index) => {
    if (choice.beside && lines.length > 0) {
      lines[lines.length - 1].push(index);
    } else {
      lines.push([index]);
    }
  });
  const heights = lines.map((line) =>
    Math.max(...line.map((index) => (menu.choices[index].detail ? TITLE_ROW_HEIGHT_WITH_DETAIL : TITLE_ROW_HEIGHT))),
  );
  const rowsHeight = heights.reduce((total, value) => total + value, 0) + ROW_GAP * (heights.length - 1);
  const questionHeight = menu.question ? QUESTION_HEIGHT : 0;
  const stack = questionHeight + rowsHeight + 8 + HINT_HEIGHT;
  const top = Math.max(titleBottom + 8, Math.min(height - 10 - stack, titleBottom + Math.round((height - titleBottom - stack) / 2)));
  const rowWidth = Math.min(width - 32, TITLE_ROW_WIDTH);
  const left = Math.floor((width - rowWidth) / 2);
  let y = top + questionHeight;
  const rows: TitleRow[] = [];
  lines.forEach((line, lineIndex) => {
    const share = Math.floor((rowWidth - PAIR_GAP * (line.length - 1)) / line.length);
    line.forEach((choiceIndex, place) => {
      // The last of a row takes up any pixel the division left over, so the
      // pair's outer edges line up with the full-width rows above them.
      const x = left + place * (share + PAIR_GAP);
      const rowRight = place === line.length - 1 ? left + rowWidth : x + share;
      rows.push({ id: menu.choices[choiceIndex].id, x, y, width: rowRight - x, height: heights[lineIndex] });
    });
    y += heights[lineIndex] + ROW_GAP;
  });
  return {
    ...(menu.question ? { question: { x: Math.floor(width / 2), y: top + Math.round(QUESTION_HEIGHT / 2) } } : {}),
    rows,
    hint: { x: Math.floor(width / 2), y: y - ROW_GAP + 8 + Math.round(HINT_HEIGHT / 2) },
  };
}
