/**
 * A nickname: the name one Pokemon goes by, given when it is caught.
 *
 * FireRed's own rules, read off pret/pokefirered (037335f): ten characters
 * (`POKEMON_NAME_LENGTH`, `include/constants/global.h`), and a name left blank
 * keeps the species name (`naming_screen.c`'s `SaveInputText` copies nothing
 * back unless a character other than a space was entered). A nickname spelled
 * the same as the species is no nickname at all, because FireRed renames a
 * Pokemon on evolution exactly when its name still matches the species it was
 * (`evolution_scene.c`) - so a Pidgey named PIDGEY grows into a Pidgeotto.
 *
 * What may be typed is printable ASCII less `< > & "`: the game's one typeface
 * has those glyphs, and leaving out the four characters HTML treats specially
 * is what keeps a name safe on every DOM screen without each one escaping it -
 * the same rule a box name and a map file's words follow (`UNSAFE_TEXT`).
 */

/** FireRed's `POKEMON_NAME_LENGTH`. */
export const NICKNAME_LENGTH = 10;

const withoutUnsafe = (value: string): string => value.replace(/[^\x20-\x7e]|[<>&"]/g, '');

/** A typed name with the characters a nickname cannot hold taken out, as it is typed. */
export function nicknameCharacters(value: string): string {
  return withoutUnsafe(value).slice(0, NICKNAME_LENGTH);
}

/**
 * The nickname a typed name gives a Pokemon of this species, or null for none:
 * blank, or the species' own name in any case.
 */
export function tidyNickname(value: unknown, speciesName: string): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const tidy = withoutUnsafe(value).replace(/\s+/g, ' ').trim().slice(0, NICKNAME_LENGTH).trim();
  if (tidy.length === 0 || tidy.toLowerCase() === speciesName.toLowerCase()) {
    return null;
  }
  return tidy;
}
