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

/** The name with its article: "a ", "an " or, for a plural name, "some ". */
export function withArticle(name: string): string {
  if (/s$/i.test(name.trim())) {
    return `some ${name}`;
  }
  return `${aOrAn(name)} ${name}`;
}

