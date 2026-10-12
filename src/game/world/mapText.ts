/**
 * The writing a player's map may use: English, the accented Latin letters of
 * the languages written with them, and common punctuation (the owner's call on
 * playtest 19, option c). Emoji and right-to-left scripts are left out for now,
 * and so is everything that draws nothing - control and format characters,
 * zero-width spaces, bidi overrides - which is what let a name made only of a
 * zero-width space pass "needs a name" and an unclosed override turn the words
 * after it backwards.
 *
 * The list is what the game's one typeface draws. Orange Kid
 * (`public/assets/battle/orange-kid.woff2`) carries Latin-1 and nearly all of
 * Latin Extended-A, read off its own character map; the handful it lacks
 * (Esperanto's circumflexed consonants, the long s, kra and n-apostrophe) are
 * not offered, because a letter the face does not have is drawn in another
 * face on a menu and as nothing on the canvas. `× ÷` are symbols rather than
 * letters and stay out with the rest of the face's maths.
 *
 * `< > & "` stay out too (`UNSAFE_TEXT`): player-written words are shown on
 * DOM screens unescaped, and a file that cannot carry markup is safe on every
 * one of them. Curly quotes are the way to quote something in a map.
 */

/** Every letter and mark beyond printable ASCII a map's words may hold. */
export const MAP_TEXT_EXTRA =
  'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ' +
  'ĀāĂăĄąĆćĊċČčĎďĐđĒēĔĕĖėĘęĚěĞğĠġĢģĦħĨĩĪīĬĭĮįİıĲĳĶķĹĺĻļĽľĿŀŁłŃńŅņŇňŊŋ' +
  'ŌōŎŏŐőŒœŔŕŖŗŘřŚśŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžȘșȚț' +
  '¡¿«»‘’“”–—…·°£€';

const EXTRA = new Set(MAP_TEXT_EXTRA);

/** Whether one character may be written in a map: `\n` only where a box holds lines. */
export function isMapTextCharacter(character: string, lines = false): boolean {
  if (character === '\n') {
    return lines;
  }
  const code = character.codePointAt(0) ?? 0;
  if (code >= 0x20 && code <= 0x7e) {
    return !'<>&"'.includes(character);
  }
  return EXTRA.has(character);
}

/** Whether a whole name or line is writing a map may hold. */
export function isMapText(text: string): boolean {
  return [...text].every((character) => isMapTextCharacter(character));
}

export interface TypedMapText {
  /** What was typed, less every character a map may not hold. */
  readonly text: string;
  /** What was taken out, each once, in the order it was typed. */
  readonly refused: readonly string[];
}

/**
 * A field as it is typed, with what a map cannot hold taken out - by whole
 * characters, so an emoji goes as one rather than leaving half of itself - and
 * named, so the maker can be told what went and why.
 */
export function typedMapText(value: string, options: { readonly lines?: boolean } = {}): TypedMapText {
  const kept: string[] = [];
  const refused: string[] = [];
  for (const character of value) {
    if (isMapTextCharacter(character, options.lines === true)) {
      kept.push(character);
    } else if (!refused.includes(character)) {
      refused.push(character);
    }
  }
  return { text: kept.join(''), refused };
}

/**
 * What a maker is told when typing took something out of a field. What was
 * taken out is never echoed back: the face has no glyph for an emoji, so it
 * would be a box, and a right-to-left letter turns the words around it
 * backwards (playtest 19 found both in the editor's own lines).
 */
export function refusedTextNote(refused: readonly string[]): string {
  return `${refused.length === 1 ? 'That is' : 'Those are'} not used in maps. Maps use letters (accents too), digits and common punctuation - no emoji or other scripts yet, and no < > & or ".`;
}

/**
 * A name as a slug: lower case, accents taken off their letters - `Café` and
 * `Cafe` are one place - and anything else between words a single dash.
 */
export function foldedSlug(name: string): string {
  return name
    .replace(/[ßẞ]/g, 'ss')
    .replace(/[Ææ]/g, 'ae')
    .replace(/[Œœ]/g, 'oe')
    .replace(/[Øø]/g, 'o')
    .replace(/[Łł]/g, 'l')
    .replace(/[ĐđÐð]/g, 'd')
    .replace(/[Þþ]/g, 'th')
    .replace(/[Ħħ]/g, 'h')
    .replace(/[Ŧŧ]/g, 't')
    .replace(/[Ŋŋ]/g, 'ng')
    .replace(/[Ĳĳ]/g, 'ij')
    .replace(/ı/g, 'i')
    .replace(/[Ŀŀ]/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
