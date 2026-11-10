import { describe, expect, it } from 'vitest';
import { LECTERN_COLOURS } from '../base/librarySheet';
import { LIBRARIAN_LINES, LIBRARY_LECTERNS } from '../base/rooms';
import { bookNamed, LIBRARY_BOOKS } from './books';
import { conditionWords, NOTES, SECRETS_BOOK, SECRETS_BOOK_ID, secretPage } from './secretsBook';
import { secretsBookOpens, unlockedInPlay } from './secretsBookLock';
import { SECRETS } from '../world/secrets';
import { bookLeaves, bookLayout, lineWidth, linesOnAPage, SMALLEST_SCREEN, wordsWidth, wrapWords } from './bookLayout';
import { bookTokens, looseMarks, resolveBookText, tokenResolves } from './bookText';
import { LIBRARY_CONTROLS } from './controls';
import { RAID_DURATION_MS } from '../run/raidClock';
import { ENRAGE_GRACE_MS } from '../run/RunManager';
import { HUNTER_FLEE_BASE_PENALTY_MS } from '../run/fleePenalty';
import { packSquares } from '../items/packs';

const everyPage = LIBRARY_BOOKS.flatMap((book) => book.pages.map((page) => ({ book: book.id, ...page })));
const everyWord = [
  ...everyPage.flatMap((page) => [page.heading, page.text]),
  ...LIBRARY_BOOKS.flatMap((book) => [book.title, book.blurb]),
];

describe('THE GREAT LIBRARY’s books', () => {
  it('has a lectern for every book, and every book a colour a lectern is drawn in', () => {
    expect(LIBRARY_BOOKS.filter((book) => book.plinth !== 'golden').length).toBeLessThanOrEqual(LIBRARY_LECTERNS.length);
    // There is one golden plinth.
    expect(LIBRARY_BOOKS.filter((book) => book.plinth === 'golden')).toHaveLength(1);
    for (const book of LIBRARY_BOOKS) {
      expect([book.id, LECTERN_COLOURS.includes(book.colour)]).toEqual([book.id, true]);
    }
  });

  it('gives every book its own id and title, and something to teach', () => {
    expect(new Set(LIBRARY_BOOKS.map((book) => book.id)).size).toBe(LIBRARY_BOOKS.length);
    expect(new Set(LIBRARY_BOOKS.map((book) => book.title)).size).toBe(LIBRARY_BOOKS.length);
    for (const book of LIBRARY_BOOKS) {
      expect([book.id, book.pages.length >= 3]).toEqual([book.id, true]);
    }
  });

  /**
   * The test the books are kept true by: a key is named only through the
   * game's own bindings and a thing only by its id in the catalogue, so a key
   * moved or a thing taken out of the game fails here rather than in a
   * player's hands.
   */
  it('names only keys the game binds and things the game has', () => {
    const unknown = everyWord.flatMap((text) => bookTokens(text).filter((token) => !tokenResolves(token)));
    expect(unknown).toEqual([]);
  });

  it('never writes a key by hand, where the table could not check it', () => {
    const loose = everyWord.filter((text) => looseMarks(text).length > 0);
    expect(loose).toEqual([]);
  });

  it('names a key the way every hint in the game does', () => {
    expect(resolveBookText('{key:pack} and {key:interact}')).toBe(`[${LIBRARY_CONTROLS.pack}] and [SPACE]`);
    expect(resolveBookText('a {item:potion}')).toBe('a Potion');
    expect(resolveBookText('{key:nothing}')).toBe('{key:nothing}');
  });

  it('teaches in the house style: no em dash anywhere', () => {
    expect(everyWord.filter((text) => text.includes('—'))).toEqual([]);
  });

  /**
   * Each page is one page at the smallest screen the game is drawn on, counted
   * generously (`wordsWidth`), so it has room to spare on every screen.
   */
  it('fits every page on one page, at the smallest screen and the usual one', () => {
    for (const screen of [SMALLEST_SCREEN, { width: 400, height: 256 }]) {
      const layout = bookLayout(screen.width, screen.height);
      const room = linesOnAPage(layout);
      const width = lineWidth(layout);
      const size = layout.body.size;
      // A heading that runs to a second line pushes the words down two of theirs.
      const over = everyPage
        .map((page) => ({
          page: `${screen.width}x${screen.height} ${page.book}: ${page.heading}`,
          lines:
            wrapWords(resolveBookText(page.text), width, size).length +
            (wrapWords(page.heading, width, 14).length - 1) * 2,
        }))
        .filter((page) => page.lines > room);
      expect(over).toEqual([]);
    }
  });

  it('sets the words at the dialogue size on the usual screen', () => {
    expect(bookLayout(400, 256).body.size).toBe(14);
  });

  it('fits every title on its title page plate', () => {
    const layout = bookLayout(SMALLEST_SCREEN.width, SMALLEST_SCREEN.height);
    const long = LIBRARY_BOOKS.filter((book) => wordsWidth(book.title, 14) > lineWidth(layout) - 8).map((book) => book.title);
    expect(long).toEqual([]);
  });

  it('puts each label on the plinth in a panel of its own, clear of the FEEDBACK tab (playtest 51, finding 9)', () => {
    for (const [width, height, tab] of [[SMALLEST_SCREEN.width, SMALLEST_SCREEN.height, 0], [400, 256, 0], [400, 256, 24], [640, 360, 24]]) {
      const { plinth, panels } = bookLayout(width, height, tab);
      const { turn, close } = panels;
      for (const panel of [turn, close]) {
        expect(panel.y).toBeGreaterThan(plinth.y);
        expect(panel.y + panel.height).toBeLessThanOrEqual(plinth.y + plinth.height);
        expect(panel.height).toBeGreaterThanOrEqual(12);
      }
      // Side by side, never overlapping, and CLOSE off the tab.
      expect(turn.x + turn.width).toBeLessThan(close.x);
      expect(close.x + close.width).toBeLessThanOrEqual(width - tab);
      // Each holds its words, plate and all.
      expect(wordsWidth(resolveBookText('{key:walk} or click a page to turn'), 12) + 6).toBeLessThanOrEqual(turn.width);
      expect(wordsWidth(resolveBookText('{key:back} CLOSE'), 12) + 6).toBeLessThanOrEqual(close.width);
    }
  });

  it('opens every book on its title page and closes it on a whole spread', () => {
    for (const book of LIBRARY_BOOKS) {
      const leaves = bookLeaves(book);
      expect(leaves[0].kind).toBe('title');
      expect(leaves.length % 2).toBe(0);
      expect(leaves.filter((leaf) => leaf.kind === 'page')).toHaveLength(book.pages.length);
    }
  });

  it('has the librarian name keys through the same table', () => {
    for (const line of LIBRARIAN_LINES) {
      expect(looseMarks(line.replace(/\[[A-Z ]+\]/g, ''))).toEqual([]);
      expect(line).not.toMatch(/\{key:/);
    }
  });

  /**
   * The numbers the books say in words, held to the game: a change to any of
   * them has to change the page that says it (RAIDS, HUNTERS, YOUR PACK).
   */
  it('says the numbers the game has', () => {
    expect(RAID_DURATION_MS).toBe(5 * 60 * 1000);
    expect(ENRAGE_GRACE_MS).toBe(15_000);
    expect(HUNTER_FLEE_BASE_PENALTY_MS).toBe(40_000);
    expect(['satchel', 'raid-pack', 'ranger-pack', 'hauler-frame'].map((id) => packSquares(id))).toEqual([12, 18, 24, 30]);
  });
});

describe('VALE SECRETS, the golden book', () => {
  it('lies on the golden plinth', () => {
    expect(bookNamed(SECRETS_BOOK_ID)?.plinth).toBe('golden');
  });

  it('has a page for every secret in the vale, written from the secret', () => {
    for (const secret of SECRETS) {
      const page = SECRETS_BOOK.pages.find((each) => each.heading === secret.name);
      expect([secret.id, page?.text.includes(`WHERE: ${secret.place.toUpperCase()}`)]).toEqual([secret.id, true]);
      for (const reward of secret.rewards) {
        const named = reward.kind === 'item' ? `{item:${reward.itemId}}` : `{pokemon:${reward.kind === 'meet' ? reward.speciesId : reward.gift.speciesId}}`;
        expect([secret.id, page?.text.includes(named)]).toEqual([secret.id, true]);
      }
    }
  });

  it('says each condition the way the secret holds it', () => {
    const page = (id: string) => secretPage(SECRETS.find((secret) => secret.id === id)!).text;
    expect(page('the-long-shadow')).toContain('WHEN: at dusk');
    expect(page('the-tappers-sunday')).toContain('WHEN: on a Sunday');
    expect(resolveBookText(page('the-red-one'))).toContain('BRING: an Old Rod or a Good Rod packed');
    expect(page('the-navvies-wager')).toContain('BRING: lead with a FIGHTING type');
    expect(conditionWords({ kind: 'field-move', move: 'rock-smash' })).toBe('a Pokémon that knows ROCK SMASH');
    expect(page('the-drowned-bell')).toContain('WHEN: 1:00 to 2:00 into the raid');
    expect(page('the-drowned-bell')).toContain('BRING: the CASCADE BADGE won');
    expect(resolveBookText(page('the-sleeper-in-the-pines'))).toContain('BRING: a Poké Flute');
    expect(page('the-sleeper-in-the-pines')).toContain('It lies there asleep, every raid.');
  });

  it('writes notes only for secrets that exist', () => {
    for (const id of Object.keys(NOTES)) {
      expect([id, SECRETS.some((secret) => secret.id === id)]).toEqual([id, true]);
    }
  });

  /**
   * How the book unlocks in the game proper is not decided yet: until it is,
   * it opens in the explorer run and nowhere else.
   */
  it('opens in the explorer run, and is locked in the game proper', () => {
    expect(secretsBookOpens(undefined, true)).toBe(true);
    expect(secretsBookOpens(undefined, false)).toBe(false);
    expect(unlockedInPlay(undefined)).toBe(false);
  });
});
