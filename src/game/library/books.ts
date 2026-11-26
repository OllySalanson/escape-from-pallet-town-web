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
 * names the lecterns' books (`librarianLines` in `base/rooms.ts`), changes
 * with it. Four are written so far: RAIDS, THE HARBOUR and THE BOLTHOLE on lecterns, and
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
  // The book the room promises, on the first lectern: a GREAT LIBRARY whose
  // one book was a house manual taught none of the game (the harbour
  // re-critic, 26 Nov 2026). Its numbers are held to the game by
  // `books.test.ts` ('says the numbers the game has').
  {
    id: 'raids',
    title: 'RAIDS',
    blurb: 'Down into the vale and home again, with what you can carry',
    colour: 'red',
    pages: [
      {
        heading: 'The jump',
        text: 'Every raid starts at THE RAID ARENA, west across the yard. Choose who comes at THE BENCH and what you carry at THE ARMOURY RACK, then step up to the rail and jump.',
      },
      {
        heading: 'Five minutes',
        text: 'A raid lasts five minutes. Walking and talking spend the clock; a fight stops it. When it reaches zero you have fifteen seconds to get out, and then the raid is lost.',
      },
      {
        heading: 'Getting out',
        text: 'A way out is a ride home. Some are open from the start, and the rest say on their sign what opens them. Step onto an open one and you are home with everything you carry.',
      },
      {
        heading: 'The hunters',
        text: 'Every part of the vale has a hunter. Caught, you fight one of theirs for each of yours that can still fight. Running from one costs forty seconds of your clock, and twenty more each time after.',
      },
      {
        heading: 'Your pack',
        text: 'Everything you find goes in your pack, a square or more each. A Satchel holds 12 squares, a Raid pack 18, a Ranger pack 24 and a Hauler frame 30. {key:pack} opens it.',
      },
      {
        heading: 'Catching',
        text: 'Throw a POKé BALL in a wild fight. A Pokémon you catch rides home in your pack: four squares, six once it has evolved, nine twice. Leave room.',
      },
      {
        heading: 'Losing',
        text: 'Lose a raid and you lose your pack, everything in it and every Pokémon you took, all but your partner and whatever THE LOCKER holds.',
      },
      {
        heading: 'Help on the way',
        text: '{key:oak} calls PROFESSOR OAK on the radio for where to go next. {key:map} shows the ground you have walked, and {key:team} your team.',
      },
    ],
  },
  // Who does what about the harbour, for a player just home who has met
  // nobody yet (the harbour re-critic's second round: two lecterns of ten).
  {
    id: 'harbour',
    title: 'THE HARBOUR',
    blurb: 'Who does what, and where to find them',
    colour: 'blue',
    pages: [
      {
        heading: "OAK'S LAB",
        text: "PROFESSOR OAK pins jobs on the board by his wall, and pays for them once you get home. His PC is your POKéDEX, and he has a gift for every few kinds you own.",
      },
      {
        heading: 'The POKéMON CENTER',
        text: "NURSE JOY heals your team for nothing. Only bringing a Pokémon round from a faint costs time off your next raid, and even that is free once a day. Your boxes are on BILL'S PC there.",
      },
      {
        heading: "BROCK'S WORKSHOP",
        text: 'BROCK builds things that stay built: a bigger LOCKER, healing machines for the Center, a ward, a radio mast and a beacon. He takes materials you bring home from raids.',
      },
      {
        heading: "BILL'S COTTAGE",
        text: 'BILL sells Potions and POKé BALLS to anybody, and swaps his tools for the parts you bring home. Bank jobs and beat bosses, and he trusts you with more.',
      },
      {
        heading: 'Out on the front',
        text: 'Past THE GREEN is THE PROMENADE. Its games pay TICKETS, which the PRIZE WINDOW at PIER SQUARE swaps for berries, discs, furniture and more.',
      },
      {
        heading: 'Practice and play',
        text: 'THE BATTLE ARENA holds practice bouts where nothing is lost. The DAY-CARE MAN, past your house, raises one Pokémon while you raid.',
      },
      {
        heading: 'Anywhere in the harbour',
        text: '{key:pack} opens YOUR THINGS, {key:team} YOUR TEAM and {key:map} THE MAP. {key:oak} lists the favours people have asked of you.',
      },
    ],
  },
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
        text: 'The badge case has a slot for every badge there is to win, and each shines there once it is won. The telly says who hunts where you land next raid. The window keeps your own clock, from dawn to night.',
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
        // Not "find a cushion on a raid": the vale's raids turn up a few rare
        // pieces only, and the cushions come from the PRIZE WINDOW (the
        // harbour re-critic, 26 Nov 2026).
        text: 'Everything in the house can be moved: the table, the plants, and anything you bring home. Win a cushion at the PRIZE WINDOW and it is yours to put anywhere.',
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
        heading: 'Where things go',
        text: 'A piece stands on the floor, never on a mat. A rug lies on bare floor; a doll or cushion may sit on a desk or table. Nothing may block the door, the stairs or anything you use.',
      },
      {
        heading: 'Getting furniture',
        text: 'The PRIZE WINDOW at PIER SQUARE sells furniture for TICKETS, like a {item:pika-cushion}. A few rare pieces turn up on raids, and are gone if the pack is lost. Every kind in your POKéDEX gives you a doll of it.',
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
