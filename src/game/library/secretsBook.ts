import { getItemById } from '../items/items';
import { formatElapsedClock } from '../run/raidClock';
import { FIELD_MOVES } from '../world/fieldMoves';
import { gymOf } from '../world/valeQuarters';
import { SECRETS, type Secret, type SecretCondition, type SecretNook, type SecretReward } from '../world/secrets';
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
  'x-marks-the-spot': 'Past MISTY.',
  'the-drowned-bell': 'Past MISTY.',
  'the-shadow-in-the-crypt': 'Under THE MOOR CHAPEL.',
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
    `WHERE: ${secret.place.toUpperCase()}`,
    `WHEN: ${when.length > 0 ? when.join(', ') : 'any raid'}`,
    ...(bring.length > 0 ? [`BRING: ${bring.join('; ')}`] : []),
    `HOLDS: ${secret.rewards.map(rewardWords).join(', then ')}`,
    `${secret.shutLines ? 'It waits there, every raid.' : NOOK_WORDS[secret.nook]}${NOTES[secret.id] ? ` ${NOTES[secret.id]}` : ''}`,
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
      text: `${numberWord(SECRETS.length)[0].toUpperCase()}${numberWord(SECRETS.length).slice(1)} nooks lie hidden in GREYSTONE VALE. Each is always there, but holds its prize only when its condition is met as the raid sets out. None of it is luck.`,
    },
    {
      heading: 'Clues and rumours',
      text: 'A sign stands near every nook, naming the place and hinting at the rest. In the harbour, the board, the ANGLER, the S.S. ANNE\'s captain, the SEAGALLOP\'s sailor, BILL and the PRIZE CLERK tell rumours.',
    },
    {
      heading: 'Keeping what you find',
      text: 'A prize lost with the pack was never found: its nook holds it again the next time its condition is met. Once a nook has given all it has, it holds a berry.',
    },
    ...SECRETS.map(secretPage),
  ],
};
