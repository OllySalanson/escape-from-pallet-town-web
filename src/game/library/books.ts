import type { LecternColour } from '../base/librarySheet';
import { SECRETS_BOOK } from './secretsBook';

/**
 * THE GREAT LIBRARY's books, each lying open in the library's room
 * (`base/rooms.ts`) and read full screen on its plinth (`scenes/LibraryBookScene.ts`).
 *
 * The library is lore, not a manual: the three books that taught the game's
 * rules (RAIDS, THE HARBOUR and THE BOLTHOLE) were taken out on 27 Nov 2026,
 * because the game shows how it works rather than explaining it in a book
 * every feature then had to rewrite (the harbour loop audit). What is left is
 * VALE SECRETS on the golden plinth, its pages written from the secrets
 * themselves (`secretsBook.ts`), which opens once MISTY is beaten
 * (`secretsBookLock.ts`).
 *
 * A book is data: a page names a key only as `{key:...}` and a thing only as
 * `{item:...}` (`bookText.ts`), which are looked up in the game when the page
 * is drawn and refused by `books.test.ts` when they name nothing. Each page has
 * to fit on the page at the smallest window (`bookLayout.ts`), which the test
 * holds too. A book's first page is its title page, drawn from its `title` and
 * `blurb`, so `pages` starts with the first page that has words.
 *
 * A wooden-lectern book, if one is ever written again, gives itself a colour
 * and the room lays a lectern for it (`LIBRARY_LECTERNS`).
 */

export const GREAT_LIBRARY_NAME = 'GREAT LIBRARY';

export interface BookPage {
  readonly heading: string;
  readonly text: string;
}

export interface LibraryBook {
  readonly id: string;
  /** On the spine, the lectern's caption and the title page. */
  readonly title: string;
  /** Under the title, on the title page and the caption: what the book is about. */
  readonly blurb: string;
  readonly colour: LecternColour;
  /**
   * What it lies on: a wooden lectern in a row with the others, or - for a
   * book that is a prize in itself - the golden plinth in the middle of the
   * room (VALE SECRETS, `secretsBook.ts`), which may be locked
   * (`secretsBookLock.ts`).
   */
  readonly plinth?: 'golden';
  readonly pages: readonly BookPage[];
}

export const LIBRARY_BOOKS: readonly LibraryBook[] = [
  SECRETS_BOOK,
];

export function bookNamed(id: string): LibraryBook | undefined {
  return LIBRARY_BOOKS.find((book) => book.id === id);
}
