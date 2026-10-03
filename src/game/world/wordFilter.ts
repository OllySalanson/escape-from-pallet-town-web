/**
 * The words a player map may not say.
 *
 * A player map's names, signs and lines are the only free text anyone but the
 * game's own authors writes, and the people who play it include children. Every
 * map is read by the captain before it is published, so this is the first line
 * and not the last: it catches what a maker types without thinking and the
 * usual spellings round it, and leaves the rest to a person.
 *
 * Matching is by word, never by substring, so a place called Scunthorpe or a
 * Bass Pond is fine; a handful of stems also catch what is built on them.
 */

/** Words refused wherever they stand as a word of their own. */
const WHOLE_WORDS = new Set([
  'arse',
  'arsehole',
  'ass',
  'asshole',
  'bastard',
  'bellend',
  'bollocks',
  'boobs',
  'cock',
  'dick',
  'dickhead',
  'dildo',
  'fag',
  'jizz',
  'knob',
  'nazi',
  'penis',
  'piss',
  'porn',
  'prick',
  'pussy',
  'rape',
  'retard',
  'sex',
  'slut',
  'spastic',
  'tits',
  'twat',
  'vagina',
  'whore',
]);

/** Stems refused at the start of any word, and so in everything made from them. */
const STEMS = ['fuck', 'shit', 'cunt', 'bitch', 'wank', 'nigg', 'fagg', 'motherf'];

/** The spellings people use to get a word past a filter, read back as letters. */
const LOOKALIKES: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

function words(text: string): string[] {
  const read = [...text.toLowerCase()].map((letter) => LOOKALIKES[letter] ?? letter).join('');
  return (
    read
      .split(/[^a-z]+/)
      .filter((word) => word.length > 0)
      // "fuuuck" is read as "fuck": no word the filter holds doubles a letter
      // three times, and every English word that does is safe to squeeze.
      .map((word) => word.replace(/(.)\1{2,}/g, '$1'))
  );
}

/** The words of `text` the filter refuses, as the filter reads them; empty when it is clean. */
export function refusedWords(text: string): readonly string[] {
  return [
    ...new Set(
      words(text).filter(
        (word) => WHOLE_WORDS.has(word) || STEMS.some((stem) => word.startsWith(stem)),
      ),
    ),
  ];
}

export function isClean(text: string): boolean {
  return refusedWords(text).length === 0;
}
