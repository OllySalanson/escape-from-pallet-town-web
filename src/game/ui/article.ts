/**
 * The article a name takes in a sentence: "a Good Rod", "an Old Rod", "an
 * EEVEE doll", and "some Leftovers", which is one item with a plural name.
 * Names reach a line in any case (a battle line shouts them), so the rule
 * reads the letters, not their case. An HM is said "aitch-em", so it takes
 * "an" as a vowel does; a TM is said "tee-em" and takes "a".
 */
export function aOrAn(word: string): 'a' | 'an' {
  return /^(?:[aeiou]|hm\d)/i.test(word.trim()) ? 'an' : 'a';
}

const COUNTED = /^(?:two|three|four|five|six|seven|eight|nine|ten)\b/i;
/** Ground that is never one of: "some surf water", never "a surf water". */
const UNCOUNTED = new Set(['water', 'grass', 'sand', 'ground']);

/**
 * The word a name is about: "house" in "House with flowers", "block" in
 * "Block of flats", "bridge" in "Bridge, across", "crates" in "Stacked crates".
 */
function headWord(name: string): string {
  const words = name.trim().split(/,| with | of /i)[0].trim().split(/\s+/);
  return words[words.length - 1] ?? '';
}

/** Whether a name is of more than one thing: "Crates", "Stone steps", "Two crates". */
export function isPluralName(name: string): boolean {
  return COUNTED.test(name.trim()) || /[^s]s$/i.test(headWord(name));
}

/**
 * The name with its article: "a ", "an ", "some " for a plural or uncounted
 * name ("some Leftovers", "some surf water"), and nothing before a name that
 * already counts itself ("two crates").
 */
export function withArticle(name: string): string {
  if (COUNTED.test(name.trim())) {
    return name;
  }
  if (isPluralName(name) || UNCOUNTED.has(headWord(name).toLowerCase())) {
    return `some ${name}`;
  }
  return `${aOrAn(name)} ${name}`;
}
