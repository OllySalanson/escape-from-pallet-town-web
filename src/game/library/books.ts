import type { LecternColour } from '../base/librarySheet';
import { SECRETS_BOOK } from './secretsBook';

/**
 * THE GREAT LIBRARY's books, each teaching one part of the game and lying
 * open on a lectern of its own colour in the library's room
 * (`base/rooms.ts`) and read full screen on its plinth (`scenes/LibraryBookScene.ts`).
 *
 * The books are data so that they stay true as the game changes. A page names
 * a key only as `{key:...}` and a thing only as `{item:...}` (`bookText.ts`),
 * which are looked up in the game when the page is drawn and refused by
 * `books.test.ts` when they name nothing; everything else a page says is a
 * claim about the game, so a change that makes one untrue changes it here in
 * the same change, as the README's are.
 *
 * Short plain words, a page at a time: a heading, then a few sentences. Each
 * page has to fit on the page at the smallest window (`bookLayout.ts`), which
 * the test holds too. A book's first page is its title page, drawn from its
 * `title` and `blurb`, so `pages` starts with the first page that teaches.
 *
 * To add a book: write it here, give it a colour, and the room lays another
 * lectern for it (`LIBRARY_LECTERNS`). Two are written so far: THE BOLTHOLE
 * on its lectern, and VALE SECRETS on the golden plinth, its pages written
 * from the secrets themselves (`secretsBook.ts`).
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
  {
    id: 'bolthole',
    title: 'THE BOLTHOLE',
    blurb: 'Your own house, and how to keep it',
    colour: 'gold',
    pages: [
      {
        heading: 'Your own house',
        text: 'THE BOLTHOLE is yours: the house with window boxes at the east end of KEEPERS\' ROW. Nobody hunts you here. Walk onto its door to go in, and step down off the mat to come out.',
      },
      {
        heading: 'Your name',
        text: 'The first time you come home from a raid you are asked YOUR NAME. It goes on your door, and over your head for other players to see. Nobody else may have the same one.',
      },
      {
        heading: 'Downstairs',
        text: 'THE BADGE CASE holds a badge for each boss you beat. THE TELLY says which hunter will be on your trail next raid. THE WINDOW keeps your own clock: day, dusk or night.',
      },
      {
        heading: 'Upstairs',
        text: 'Step on the stair mat to go up. MY PC holds your boxes, as BILL\'S PC does. YOUR WARDROBE changes what you wear, and THE CONSOLE plays games with a leaderboard.',
      },
      {
        heading: 'More upstairs',
        text: 'A PENNANT hangs for each place you have got home from. THE CALENDAR crosses off a day for every raid. YOUR BED gives you a dream, but only NURSE JOY heals.',
      },
      {
        heading: 'Decorating',
        text: 'Press {key:decorate} at home. {key:interact} picks a piece up and puts it down, {key:turnPiece} turns it, {key:boxBack} and {key:boxNext} walk the box, and {key:putAway} puts it away. {key:decorate} again when done.',
      },
      {
        heading: 'With the mouse',
        text: 'While decorating, the cursor follows the mouse. A click picks up or puts down, a right click turns the piece, and the wheel walks the box.',
      },
      {
        heading: 'Where things go',
        text: 'A piece stands on the floor, never on a mat. A rug lies on bare floor; a doll or cushion may sit on a desk or table. Nothing may block the door, the stairs or anything you use.',
      },
      {
        heading: 'Getting furniture',
        text: 'The PRIZE WINDOW on THE PROMENADE sells furniture for TICKETS, like a {item:pika-cushion}. Every kind in your POKéDEX gives you a doll of it. A piece not out is kept in the box.',
      },
      {
        heading: 'The garden',
        text: 'Up to six Pokémon from your boxes walk the lawn by the house. Talk to one to hear who it is and which box it is from, and to put it on your next team.',
      },
      {
        heading: 'Visiting',
        text: 'Read the sign in your front garden to knock on another player\'s door. If they let you in, you may look round their house for ten minutes, but nothing of theirs can be moved.',
      },
    ],
  },
  SECRETS_BOOK,
];

export function bookNamed(id: string): LibraryBook | undefined {
  return LIBRARY_BOOKS.find((book) => book.id === id);
}
