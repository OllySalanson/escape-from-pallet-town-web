import type { LecternColour } from '../base/librarySheet';
import { CONSOLE_GAMES } from '../console/consoleGames';
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
 * lectern for it (`LIBRARY_LECTERNS`) - and the librarian's welcome, which
 * talks of the one book on the lectern (`librarianLines` in `base/rooms.ts`),
 * changes with it. Two are written so far: THE BOLTHOLE on its lectern, and
 * VALE SECRETS on the golden plinth, its pages written from the secrets
 * themselves (`secretsBook.ts`), which opens once MISTY is beaten
 * (`secretsBookLock.ts`).
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
    blurb: 'Your own house, and how to make it yours',
    colour: 'gold',
    pages: [
      {
        heading: 'Your own house',
        text: 'THE BOLTHOLE is the house with window boxes at the east end of KEEPERS\' ROW, and it is yours from the first day. Nobody hunts you here. Walk onto its door to go in, and step off the mat to come out.',
      },
      {
        heading: 'Your name on the door',
        text: 'Once you have a name, it goes over your door, and over your head for other players to see. You are asked for it when your first raid comes home, and at CONTINUE until you pick one.',
      },
      {
        heading: 'Downstairs',
        text: 'The badge case has a slot for every badge there is to win, and beating its keeper fills it. The telly says who hunts where you land next raid. The window keeps your own clock, from dawn to night.',
      },
      {
        heading: 'MY PC',
        text: 'Step on the stair mat to go up. MY PC holds your boxes of Pokémon and YOUR THINGS, and counts your POKéDEX. The PC at the POKéMON CENTER is the same storage.',
      },
      {
        heading: 'The rest of upstairs',
        text: `YOUR WARDROBE changes what you wear. THE CONSOLE plays ${CONSOLE_GAMES.map((game) => game.name).join(' and ')}, with a Pallet Town leaderboard. Your bed gives you a dream, but only NURSE JOY heals.`,
      },
      {
        heading: 'The pennants and the calendar',
        text: 'A pennant hangs for every place you have come home from. The calendar crosses off a day for every raid, and ticks the ones you came home from.',
      },
      {
        heading: 'Make it yours',
        text: 'Everything in the house can be moved: the table, the plants, and anything you bring home. Find a cushion on a raid, carry it back, and it is yours to put anywhere.',
      },
      {
        heading: 'Decorating',
        text: 'Press {key:decorate} at home to start, and again to stop. {key:interact} picks a piece up and puts it down, and {key:turnPiece} turns it. {key:back} puts what you hold back where it was.',
      },
      {
        heading: 'Your furniture box',
        text: 'Pieces you have not put out wait in your furniture box. {key:boxBack} and {key:boxNext} take them out one by one, and {key:putAway} puts a piece back in.',
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
        text: 'Most furniture is found on raids, and a piece lost with the pack is gone. The PRIZE WINDOW at PIER SQUARE sells some for TICKETS, like a {item:pika-cushion}. Every kind in your POKéDEX gives you a doll of it.',
      },
      {
        heading: 'The garden',
        text: 'Up to six Pokémon from your boxes walk the lawn east of the house: the ones you pick on a PC, or else your six highest level. Talk to one to put it on your next team.',
      },
      {
        heading: 'Visiting',
        text: 'Once you have a name, read the sign by your door to knock on another player\'s. If they let you in, stay as long as you like, but nothing of theirs can be moved. Face a visitor in your own house to see them out.',
      },
    ],
  },
  SECRETS_BOOK,
];

export function bookNamed(id: string): LibraryBook | undefined {
  return LIBRARY_BOOKS.find((book) => book.id === id);
}
