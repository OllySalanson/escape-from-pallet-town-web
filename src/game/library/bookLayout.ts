import type { BookPage, LibraryBook } from './books';

/**
 * Where everything stands when a book is open full screen
 * (`scenes/LibraryBookScene.ts`), worked out for any size of screen: the plinth
 * along the foot, the book lying open on its slanted top, and the two pages
 * with the room on each for words. Phaser-free, so the books can be held to
 * fitting the smallest screen without a browser (`books.test.ts`).
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BookLayout {
  readonly width: number;
  readonly height: number;
  /** The plinth the book lies on, along the foot of the screen. */
  readonly plinth: Box;
  /**
   * The carved panels down the plinth's front, each holding one label: how to
   * turn the pages, and CLOSE, clear of the FEEDBACK tab. Four panels of a
   * fixed width had the labels straddling them, and the first stood empty
   * (playtest 51, finding 9).
   */
  readonly panels: { readonly turn: Box; readonly close: Box };
  /** The covers, as they show round the pages. */
  readonly cover: Box;
  /** The two pages as they lie open. */
  readonly left: Box;
  readonly right: Box;
  /** Where the two pages meet. */
  readonly spineX: number;
  /** The words' room on a page, in the page's own pixels (the same for both: mirrored about the spine). */
  readonly words: { readonly outer: number; readonly inner: number; readonly top: number; readonly bottom: number };
  /**
   * The size a page's words are set in, and the height of a line of them: the
   * dialogue size wherever a page is wide enough for it, because Orange Kid's
   * lower case comes through the 12px stamping unevenly spaced ('ma t') and a
   * page of it reads worse than a caption does; 12px only on the smallest
   * screens, where a page could not hold its words at 14.
   */
  readonly body: { readonly size: 12 | 14; readonly lineHeight: number };
}

/** How far down the plinth its front begins: the slanted top and the brass lip above it. */
export const PLINTH_FRONT = 14;
/** How wide CLOSE's panel is: room for `[ESC] CLOSE` on its plate. */
const CLOSE_PANEL_WIDTH = 76;
/** Between two panels. */
const PANEL_GAP = 6;

/** The narrowest page the words are set at the dialogue size on. */
export const WIDE_PAGE = 170;

/** The smallest screen the game is laid out for (`display/stage.ts`, `BASE_STAGE_*`). */
export const SMALLEST_SCREEN = { width: 320, height: 240 } as const;

/** How much of the pages' edges shows under the book's top page, at the foot and the outer sides. */
export const PAGE_STACK = 3;
/** How much of the covers shows round the pages. */
export const COVER_MARGIN = 4;

/**
 * `edgeClear` is how much of the screen's edge the book must keep off: the
 * FEEDBACK tab stands over the right of the canvas on most windows
 * (`feedback/feedbackTabCover.ts`), and the book keeps the same off its left
 * so it still lies in the middle of the plinth.
 */
export function bookLayout(width: number, height: number, edgeClear: number = 0): BookLayout {
  const plinthHeight = clamp(Math.round(height * 0.16), 26, 46);
  const plinth: Box = { x: 0, y: height - plinthHeight, width, height: plinthHeight };
  const top = 6;
  // The book lies across the plinth's top, its foot a little way onto it.
  const bottom = plinth.y + 10;
  const coverHeight = bottom - top;
  const pageHeight = coverHeight - COVER_MARGIN * 2 - PAGE_STACK;
  // As wide as the screen allows, but no page wider than it is tall: a page
  // much wider than it is tall reads as a sheet of card, not a book.
  const side = Math.max(6, edgeClear + 2);
  const widest = Math.floor((width - side * 2 - COVER_MARGIN * 2 - PAGE_STACK * 2) / 2);
  const pageWidth = Math.min(widest, Math.floor(pageHeight * 0.95));
  const coverWidth = pageWidth * 2 + COVER_MARGIN * 2 + PAGE_STACK * 2;
  const coverX = Math.floor((width - coverWidth) / 2);
  const cover: Box = { x: coverX, y: top, width: coverWidth, height: coverHeight };
  const spineX = coverX + COVER_MARGIN + PAGE_STACK + pageWidth;
  const pageTop = top + COVER_MARGIN;
  // The panels stand on the plinth's front, under its lip (`bookArt.ts`'s `paintPlinth`).
  const front = plinth.y + PLINTH_FRONT;
  const panelTop = front + 3;
  const panelHeight = plinth.y + plinth.height - panelTop - 3;
  const closeRight = width - side - 3;
  const close: Box = { x: closeRight - CLOSE_PANEL_WIDTH, y: panelTop, width: CLOSE_PANEL_WIDTH, height: panelHeight };
  const turnLeft = plinth.x + side + 3;
  const turn: Box = { x: turnLeft, y: panelTop, width: close.x - PANEL_GAP - turnLeft, height: panelHeight };
  return {
    width,
    height,
    plinth,
    panels: { turn, close },
    cover,
    left: { x: spineX - pageWidth, y: pageTop, width: pageWidth, height: pageHeight },
    right: { x: spineX, y: pageTop, width: pageWidth, height: pageHeight },
    spineX,
    words: { outer: 12, inner: 14, top: 10, bottom: 20 },
    body: pageWidth >= WIDE_PAGE ? { size: 14, lineHeight: 16 } : { size: 12, lineHeight: BODY_LINE_HEIGHT },
  };
}

/** One side of an open book: the title page, a page that teaches, or the blank one after the last. */
export type BookLeaf =
  | { readonly kind: 'title'; readonly book: LibraryBook }
  | { readonly kind: 'page'; readonly page: BookPage; readonly number: number }
  | { readonly kind: 'end'; readonly book: LibraryBook };

/**
 * A book's sides in order, two to a spread: the title page on the left of the
 * first spread, the book's pages after it, and an end page when they leave the
 * last spread one side short.
 */
export function bookLeaves(book: LibraryBook): readonly BookLeaf[] {
  const leaves: BookLeaf[] = [{ kind: 'title', book }, ...book.pages.map((page, index) => ({ kind: 'page' as const, page, number: index + 1 }))];
  if (leaves.length % 2 === 1) leaves.push({ kind: 'end', book });
  return leaves;
}

export function spreadCount(book: LibraryBook): number {
  return bookLeaves(book).length / 2;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

// --- whether a page's words fit -----------------------------------------------

/**
 * A generous width for a line of words in the game's face at the body size:
 * Orange Kid at 12px draws most capitals and lower-case letters in five or six
 * pixels with one between, so every letter is counted at the wider end and the
 * narrow ones at four. Generous on purpose: it is what the books are held to,
 * so a page that passes here has room to spare on the screen.
 */
export function wordsWidth(text: string, size: number = 12): number {
  let width = 0;
  for (const letter of text) {
    width += NARROW.includes(letter) ? 3 : WIDE.includes(letter) ? 8 : 6;
  }
  return (width * size) / 12;
}

const NARROW = "il.,:;'!| ";
const WIDE = 'MWmw@';

/** A page's words broken into lines no wider than `width`, as a word-wrapping text box breaks them. */
export function wrapWords(text: string, width: number, size: number = 12): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && wordsWidth(next, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** The body's line height and the heading's room above it, in pixels (`LibraryBookScene`). */
export const BODY_LINE_HEIGHT = 13;
export const HEADING_ROOM = 22;

/** How many lines of words a page has room for under its heading at this layout. */
export function linesOnAPage(layout: BookLayout): number {
  return Math.floor((layout.left.height - layout.words.top - layout.words.bottom - HEADING_ROOM) / layout.body.lineHeight);
}

/** How wide a line of words may run on a page at this layout. */
export function lineWidth(layout: BookLayout): number {
  return layout.left.width - layout.words.outer - layout.words.inner;
}
