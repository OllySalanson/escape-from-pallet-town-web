import { getItemById } from '../items/items';
import { formatElapsedClock } from '../run/raidClock';
import { FIELD_MOVES } from '../world/fieldMoves';
import { gymOf } from '../world/valeQuarters';
import { nextReward, SECRETS, type Secret, type SecretCondition, type SecretNook, type SecretReward, type SecretsKnown } from '../world/secrets';
import type { BookPage, LibraryBook } from './books';

/**
 * THE GREAT LIBRARY's golden book: every one of Greystone Vale's secrets
 * (`world/secrets.ts`), a page each - where it is, when, what to bring and
 * what it holds - after three pages on how secrets work.
 *
 * A secret's page is written from the secret itself, never typed beside it, so
 * the book cannot tell a player to come at dusk to a nook that opens at night:
 * a secret added, moved or changed is a page added, moved or changed. Only a
 * few words a secret's data cannot say are written by hand (`NOTES`), and
 * `books.test.ts` holds those to secrets that exist.
 *
 * It lies on a golden plinth of its own, apart from the wooden lecterns, and
 * opens only where `secretsBookLock.ts` says it may.
 */

export const SECRETS_BOOK_ID = 'vale-secrets';

/** What a secret's data cannot say: how its nook is got at, where that is more than walking up. */
export const NOTES: Readonly<Record<string, string>> = {
  'the-lost-fold': 'A STRENGTH boulder on HIGH MOOR shuts the fold.',
  'x-marks-the-spot': 'Behind MISTY\'s gate.',
  // The chapel is shut but on a night raid (`moorChapel.ts`; the re-critic's fifth round).
  'the-shadow-in-the-crypt': 'Under the CHAPEL, by night.',
};

/**
 * The district a secret's place lies in, for a place named the same as the
 * secret itself: "WHERE: THE LOST FOLD" under the heading THE LOST FOLD told
 * a reader nothing (the harbour critic tour, 26 Nov 2026). `books.test.ts`
 * holds every such secret to a row here.
 */
export const DISTRICT_OF: Readonly<Record<string, string>> = {
  'the-lost-fold': 'HIGH MOOR',
  'the-lost-picnic': 'TANGLEWOOD',
};

/**
 * How a `summons` nook is worked, where it is not pulled: the heron answers a
 * player standing still and the doll one who came in dry, and "Pull it" was
 * printed for both (the critic tour).
 */
const SUMMONS_WORDS: Readonly<Record<string, string>> = {
  'the-drowned-bell': 'Pull the rope.',
  'the-heron-that-is-not': 'Stand still, and something answers.',
  'the-lapras-doll': 'Come in dry, and something answers.',
};

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

function numberWord(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = { day: 'by day', dusk: 'at dusk', night: 'at night' } as const;

/** Whether a condition is about the clock rather than the party. */
function isTime(condition: SecretCondition): boolean {
  return condition.kind === 'hour' || condition.kind === 'weekday' || condition.kind === 'raid-clock';
}

/** One condition in words, with its keys and things as tokens. */
export function conditionWords(condition: SecretCondition): string {
  switch (condition.kind) {
    case 'hour':
      return HOURS[condition.hour];
    case 'weekday':
      return `on a ${DAYS[condition.day]}`;
    case 'lead-type':
      return `lead with a ${condition.type.toUpperCase()} type`;
    case 'field-move':
      return `a Pokémon that knows ${FIELD_MOVES[condition.move].label}`;
    case 'carried':
      // Every berry there is reads as that, not as a list of seven.
      if (condition.items.every((item) => item.endsWith('-berry')) && condition.items.length > 2) {
        return 'any berry packed';
      }
      return `${condition.items.map((item) => `${article(getItemById(item)?.displayName ?? item)} {item:${item}}`).join(' or ')} packed`;
    case 'whole-chart':
      return 'the whole treasure map pinned up';
    case 'badge':
      return `the ${gymOf(condition.bossId)?.badge ?? condition.bossId} won`;
    case 'alone':
      return 'one Pokémon in the party, and no more';
    case 'lead-shiny':
      return 'a shiny Pokémon leading';
    case 'dry-boots':
      return 'dry boots: not a step in tall grass all raid';
    case 'stood-still':
      return `standing still for ${Math.round(condition.forMs / 1_000)} seconds, no step and no turn`;
    case 'raid-clock':
      return `${formatElapsedClock(condition.fromMs)} to ${formatElapsedClock(condition.untilMs)} into the raid`;
    case 'either':
      return condition.of.map(conditionWords).join(', or ');
  }
}

/** 'a' or 'an', by how the name it comes before is said. */
function article(name: string): string {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

function rewardWords(reward: SecretReward): string {
  switch (reward.kind) {
    case 'item':
      return `${article(getItemById(reward.itemId)?.displayName ?? reward.itemId)} {item:${reward.itemId}}`;
    case 'meet':
      return `a wild {pokemon:${reward.speciesId}}, Lv ${reward.level}${reward.shiny ? ', shiny' : ''}`;
    case 'gift':
      return `a {pokemon:${reward.gift.speciesId}} to carry home`;
  }
}

const NOOK_WORDS: Readonly<Record<SecretNook, string>> = {
  spot: 'Hidden: step on it, or face it and press {key:interact}.',
  figure: 'It stands there, waiting.',
  giver: 'Somebody there hands it over.',
  line: 'Cast a line into the water.',
  summons: 'Pull it, and something answers.',
};

/** A secret's page. */
export function secretPage(secret: Secret): BookPage {
  const when = secret.when.filter(isTime).map(conditionWords);
  const bring = secret.when.filter((condition) => !isTime(condition)).map(conditionWords);
  const lines = [
    `WHERE: ${secret.place.toUpperCase()}${DISTRICT_OF[secret.id] ? `, on ${DISTRICT_OF[secret.id]}` : ''}`,
    // A time only when it waits for one, and NEEDS, not BRING: a badge,
    // standing still and dry boots are not carried (the re-critic's fifth round).
    ...(when.length > 0 ? [`WHEN: ${when.join(', ')}`] : []),
    ...(bring.length > 0 ? [`NEEDS: ${bring.join('; ')}`] : []),
    `HOLDS: ${secret.rewards.map(rewardWords).join(', then ')}`,
    `${secret.shutLines ? 'It waits there.' : (SUMMONS_WORDS[secret.id] ?? NOOK_WORDS[secret.nook])}${NOTES[secret.id] ? ` ${NOTES[secret.id]}` : ''}`,
  ];
  return { heading: secret.name, text: lines.join('\n') };
}

export const SECRETS_BOOK: LibraryBook = {
  id: SECRETS_BOOK_ID,
  title: 'VALE SECRETS',
  blurb: `The ${numberWord(SECRETS.length)} hidden nooks of GREYSTONE VALE`,
  colour: 'purple',
  plinth: 'golden',
  pages: [
    {
      heading: 'Hidden nooks',
      text: `${numberWord(SECRETS.length)[0].toUpperCase()}${numberWord(SECRETS.length).slice(1)} nooks lie hidden in GREYSTONE VALE. Each is always there. Most hold their prize only when a condition is met as the raid sets out; a few ask what you do on the way.`,
    },
    {
      heading: 'Clues and rumours',
      // Shorter: its last line ran off the paper at 400x256 (the re-critic's fourth round).
      text: 'A sign near every nook names the place and hints at the rest. Half the harbour trades rumours - the board, the ANGLER, BILL and more - and THE RUMOUR MILL sells them.',
    },
    {
      heading: 'Keeping what you find',
      text: 'A prize lost with the pack was never found: its nook holds it again the next time its condition is met. A hidden spot that has given all it has holds a berry.',
    },
    ...SECRETS.map(secretPage),
  ],
};

/**
 * A nook's page before it has been found: where it is, and no more. Printed
 * whole for every nook, the book was the answer key to the vale's signs, its
 * rumours and THE RUMOUR MILL the moment it opened (the harbour re-critic,
 * 26 Nov 2026); it fills in a page at a time as the POKéDEX does.
 */
export function unfoundSecretPage(secret: Secret): BookPage {
  // Where and when, and the rest left to the sign out there: a page of only
  // "not found yet" twenty times over was a prize with nothing in it (the
  // harbour re-critic's second round).
  // Only a time it waits for is said: "WHEN: any raid" stood over nooks that
  // wait for a chart, a lead or a flute (the re-critic's third round). The
  // nook's own kind closes the page, so twenty pages are not one sentence;
  // that a page fills in once found is said once, on the first page.
  // What it asks, said whole, and only what it holds kept back: "It waits
  // there, every raid." stood over nooks that need a GHOST lead or a POKé
  // FLUTE (the re-critic's fourth round).
  const page = secretPage(secret);
  return {
    heading: secret.name,
    text: page.text.replace(/^HOLDS: .*$/m, 'HOLDS: not found yet.'),
  };
}

/** Whether anything a secret holds has been found: its page is written out. */
function secretFound(secret: Secret, known: SecretsKnown): boolean {
  return nextReward(secret, known) !== secret.rewards[0];
}

/**
 * VALE SECRETS as this save reads it: every nook found written out, every
 * other one its place and a promise. The explorer run reads the whole book
 * (`SECRETS_BOOK`), so every page can still be checked.
 */
export function secretsBookFor(known: SecretsKnown, explorerRun: boolean): LibraryBook {
  if (explorerRun) return SECRETS_BOOK;
  const rules = SECRETS_BOOK.pages.slice(0, SECRETS_BOOK.pages.length - SECRETS.length);
  const found = SECRETS.filter((secret) => secretFound(secret, known)).length;
  return {
    ...SECRETS_BOOK,
    // How far along, on the title page (the re-critic's fourth round).
    blurb: `${SECRETS_BOOK.blurb}: ${found === 0 ? 'none found yet' : `${numberWord(found)} found`}`,
    pages: [...rules, ...SECRETS.map((secret) => (secretFound(secret, known) ? secretPage(secret) : unfoundSecretPage(secret)))],
  };
}
