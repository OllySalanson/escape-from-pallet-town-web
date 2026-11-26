import { POKEDEX_KEY, RAID_KEY_LETTERS } from './keyBindings';
import { touchPlay } from './touchPlay';
import type { TouchShortcut } from './touchShortcuts';

/**
 * The game's words for its keys, said for the touch pad while it is played on
 * one (`ui/touchPad.ts`): a hint that taught "[SPACE] TALK" to a thumb taught a
 * key there is no way to press. SPACE and ENTER are OK, ESC is BACK, the
 * arrows are the D-PAD, and a letter key that has a key of its own on the
 * pad's tray is named by that key's word alone - "[B] PACK" is "[PACK]",
 * which is what the tray's button says.
 *
 * It is applied where every word of the game is drawn - Phaser's `Text`
 * (`installTouchWording`) - so no hint, chip, sign or line of dialogue has to
 * know about touch, and each keeps the words it was written with
 * (`sourceText`) for whatever reads a hint for its keys
 * (`input/touchShortcuts.ts`).
 */

/** Whole lines said better whole than word by word. */
const LINES: Readonly<Record<string, string>> = {
  'ARROWS CHOOSE · SPACE SELECT': 'D-PAD CHOOSES · OK SELECTS',
  // The raid's pause plate (`world/windowPause.ts`): any touch plays on.
  'Click or press any key to play on.': 'Tap anywhere to play on.',
};

/**
 * The letters of the keys that open a screen by name - YOUR THINGS on B, YOUR
 * TEAM on P, the favours, THE MAP, the Pokédex - which a sentence names in an
 * aside: "in YOUR THINGS (B at base)", "from
 * YOUR THINGS (B) anywhere at base". To a thumb the aside is a letter there is
 * no key for, and the tray's button is the screen's own name, so it goes.
 */
const SCREEN_LETTERS = [...new Set([RAID_KEY_LETTERS.bag, RAID_KEY_LETTERS.party, RAID_KEY_LETTERS.objectives, RAID_KEY_LETTERS.map, POKEDEX_KEY])].join('');
const SCREEN_KEY_ASIDES: readonly RegExp[] = [
  new RegExp(` \\([${SCREEN_LETTERS}](?: (?:anywhere )?at base)?\\)`, 'g'),
];

/** The key words, bracketed as a hint writes them and bare as a help line does. */
const KEY_WORDS: readonly (readonly [RegExp, string])[] = [
  [/\[(?:SPACE|ENTER)\]/g, '[OK]'],
  [/\[(?:ESC|BACKSPACE)\]/g, '[BACK]'],
  [/\[ARROWS(?:\/WASD)?\]/g, '[D-PAD]'],
  [/\bARROWS(?:\/WASD)?(?=[\s:·,.]|$)/g, 'D-PAD'],
  [/\bArrows(?=\s)/g, 'D-PAD'],
  [/\b(?:SPACE|ENTER)\b/g, 'OK'],
  // "ESC back" is BACK, and so is "O or ESC back": the button says the word.
  [/\b(?:[A-Z] or )?ESC(?: or [A-Z])? back\b/g, 'BACK'],
  [/\bESC\b/g, 'BACK'],
];

/**
 * A pair of keys sharing a word - "[Q][E] BOX", the house's box walked back
 * and forward - is the tray's "< BOX" and "BOX >"; said as one, "[< BOX >]".
 */
const KEY_PAIR = /\[([A-Z0-9])\]\[([A-Z0-9])\]\s+([^[\n]*?)(?=\s{2,}|\s*\[|\s*\n|\s*$)/g;

/** One letter or digit key and the words after it, up to the next key or a gap of two spaces. */
const KEY_AND_WORDS = /(?<!\])\[([A-Z0-9])\]\s+([^[\n]*?)(?=\s{2,}|\s*\[|\s*\n|\s*$)/g;

/** `text` as the touch pad would say it. */
export function touchWording(text: string): string {
  // A line said whole wherever it stands, alone or among others in one text
  // (the pause plate draws its two lines as one).
  let said = text
    .split('\n')
    .map((line) => LINES[line] ?? line)
    .join('\n');
  said = said.replace(KEY_PAIR, (_match, _back: string, _next: string, words: string) => `[< ${words.trim()} >]`);
  said = said.replace(KEY_AND_WORDS, (match, _key: string, words: string) => (words.trim() ? `[${words.trim()}]` : match));
  for (const [pattern, word] of KEY_WORDS) {
    said = said.replace(pattern, word);
  }
  for (const aside of SCREEN_KEY_ASIDES) {
    said = said.replace(aside, '');
  }
  // A button whose name is already what it does is said once: the glass's
  // "[ESC] BACK" is "[BACK]", never "[BACK] BACK".
  said = said.replace(/\[(BACK|OK)\] \1\b/g, '[$1]');
  // A key named on the end of a button's own words - "DROP ONE [X]" - is
  // the button itself to a finger, and the tray's key besides.
  return said.replace(/\s*\[[A-Z0-9]\]\s*$/, '');
}

/** One part of a menu's help line that is a key and what it does: "X drop", "TAB shelves or bar", "BKSP out". */
const HELP_KEY = /^(TAB|BKSP|[A-Z])\s+(?!or\b)(\S.*)$/;

/** Two keys walking one thing back and forward: "Q E tab" is "< TAB" and "TAB >". */
const HELP_KEY_PAIR = /^([A-Z]) ([A-Z])\s+(\S.*)$/;

/** The help line's key names that are not one letter, by the code each presses. */
const HELP_KEY_CODES: Readonly<Record<string, string>> = { TAB: 'Tab', BKSP: 'Backspace' };

/** A help-line key whose job BACK already does: the key that opened the screen, closing it again. */
const BACKS_OUT = /^(?:close|back)\b/;

const helpLabel = (words: string): string =>
  words
    .replace(/^to the /, '')
    .replace(/ or /g, '/')
    .replace(/[.,;:]+$/, '')
    .toUpperCase();

/** The keys one part of a help line names: none, one, a pair walking back and forward, or BACK's own job. */
function helpKeys(part: string): readonly TouchShortcut[] | 'back' {
  const pair = HELP_KEY_PAIR.exec(part.trim());
  if (pair) {
    const label = helpLabel(pair[3].trim());
    return [
      { code: `Key${pair[1]}`, label: `< ${label}` },
      { code: `Key${pair[2]}`, label: `${label} >` },
    ];
  }
  const match = HELP_KEY.exec(part.trim());
  if (!match) {
    return [];
  }
  const words = match[2].trim();
  if (BACKS_OUT.test(words)) {
    return 'back';
  }
  return [{ code: HELP_KEY_CODES[match[1]] ?? `Key${match[1]}`, label: helpLabel(words) }];
}

/**
 * The letter keys a menu's help line names, as the pad's tray offers them:
 * "ARROWS move · ENTER use · X drop · ESC back" is a DROP key on X, "BKSP out"
 * an OUT key on Backspace, and "Q E tab" the pair "< TAB" and "TAB >". The
 * pad's own buttons (the arrows, ENTER, ESC) are skipped, and so is a key
 * that only closes the screen, which BACK does.
 */
export function helpLineKeys(line: string): TouchShortcut[] {
  const keys: TouchShortcut[] = [];
  for (const part of line.split(' · ')) {
    const found = helpKeys(part);
    if (found !== 'back') {
      keys.push(...found);
    }
  }
  return keys;
}

/** A menu's help line as the pad would say it: each key it names by its tray word, the rest in the pad's words. */
export function touchHelpLine(line: string): string {
  return line
    .split(' · ')
    .flatMap((part) => {
      const found = helpKeys(part);
      if (found === 'back') {
        return [];
      }
      if (found.length === 2) {
        return [`[${found[0].label} >]`];
      }
      return [found.length === 1 ? `[${found[0].label}]` : touchWording(part)];
    })
    .join(' · ');
}

/** What a `Text` was given, before the pad's words were put in: what a hint is read from for its keys. */
const SOURCE = Symbol('touchWordingSource');

interface WordedText {
  [SOURCE]?: string;
  readonly text: string;
  setText(value: string | string[]): unknown;
}

export function sourceText(text: { readonly text: string } | null | undefined): string {
  if (!text) {
    return '';
  }
  return (text as Partial<WordedText>)[SOURCE] ?? text.text;
}

interface TextClassLike {
  prototype: {
    setText(value: string | string[]): unknown;
  };
}

/** The classes already patched: a hot reload runs the entry module again against the same Phaser class. */
const patched = new WeakSet<object>();

/**
 * Every `Text` says its keys the pad's way while the game is played by touch.
 * Installed once on Phaser's class, before any scene draws a word.
 */
export function installTouchWording(TextClass: TextClassLike): void {
  if (patched.has(TextClass.prototype)) {
    return;
  }
  patched.add(TextClass.prototype);
  // Taken off the prototype on purpose: it is only ever called back on a Text, below.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setText = TextClass.prototype.setText;
  TextClass.prototype.setText = function wordedSetText(this: WordedText, value: string | string[]): unknown {
    const source = Array.isArray(value) ? value.join('\n') : String(value ?? '');
    this[SOURCE] = source;
    return setText.call(this, touchPlay() ? touchWording(source) : source);
  };
}

/** Anything that holds display objects: a scene's display list, a container. */
interface Holder {
  readonly list?: readonly unknown[];
}

/**
 * Says every `Text` already on screen again, the pad's way or the keyboard's,
 * when touch play starts or stops: walks each scene's display list and every
 * container in it.
 */
export function rewordTexts(scenes: readonly { readonly children?: Holder }[]): void {
  const visit = (object: unknown) => {
    const worded = object as Partial<WordedText> & Holder;
    if (typeof worded[SOURCE] === 'string' && typeof worded.setText === 'function') {
      worded.setText(worded[SOURCE]);
    }
    for (const child of worded.list ?? []) {
      visit(child);
    }
  };
  for (const scene of scenes) {
    visit(scene.children);
  }
}
