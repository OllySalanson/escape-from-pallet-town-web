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
 * Pure, like `raidHud.ts`, so the wording and the layout are held by tests that
 * never open a canvas; `TitleScene` only draws what it is handed.
 */

export type TitleChoiceId = 'continue' | 'new' | 'keep' | 'erase';

export interface TitleChoice {
  readonly id: TitleChoiceId;
  readonly label: string;
  /** A second, smaller line: what is behind the choice. */
  readonly detail?: string;
  /** A choice that would do nothing is drawn dim and the cursor passes over it. */
  readonly enabled: boolean;
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

/** Whether choosing New Game has to ask first. */
export function needsEraseConfirmation(summary: SaveSummary): boolean {
  return summary.kind !== 'none';
}

/** Moves the cursor one enabled choice up or down, stopping at the ends. */
export function moveTitleChoice(menu: TitleMenu, current: TitleChoiceId, step: -1 | 1): TitleChoiceId {
  const enabled = menu.choices.filter((choice) => choice.enabled);
  const index = enabled.findIndex((choice) => choice.id === current);
  const next = Math.max(0, Math.min(enabled.length - 1, (index < 0 ? 0 : index) + step));
  return enabled[next]?.id ?? current;
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
const QUESTION_HEIGHT = 16;
const HINT_HEIGHT = 12;

/**
 * Seats the choices under the name plate on whole pixels, and the key hint
 * under them. Everything is anchored to the screen's bottom edge first and the
 * plate second, so a stage as small as 320x240 shows the whole menu and a
 * taller one simply has more dusk between.
 */
export function layoutTitleMenu(
  menu: TitleMenu,
  width: number,
  height: number,
  plateBottom: number,
): TitleMenuLayout {
  const heights = menu.choices.map((choice) =>
    choice.detail ? TITLE_ROW_HEIGHT_WITH_DETAIL : TITLE_ROW_HEIGHT,
  );
  const rowsHeight = heights.reduce((total, value) => total + value, 0) + ROW_GAP * (heights.length - 1);
  const questionHeight = menu.question ? QUESTION_HEIGHT : 0;
  const stack = questionHeight + rowsHeight + 8 + HINT_HEIGHT;
  const top = Math.max(plateBottom + 8, Math.min(height - 10 - stack, plateBottom + Math.round((height - plateBottom - stack) / 2)));
  const left = Math.floor((width - Math.min(width - 32, TITLE_ROW_WIDTH)) / 2);
  const rowWidth = Math.min(width - 32, TITLE_ROW_WIDTH);
  let y = top + questionHeight;
  const rows = menu.choices.map((choice, index) => {
    const row = { id: choice.id, x: left, y, width: rowWidth, height: heights[index] };
    y += heights[index] + ROW_GAP;
    return row;
  });
  return {
    ...(menu.question ? { question: { x: Math.floor(width / 2), y: top + Math.round(QUESTION_HEIGHT / 2) } } : {}),
    rows,
    hint: { x: Math.floor(width / 2), y: y - ROW_GAP + 8 + Math.round(HINT_HEIGHT / 2) },
  };
}
