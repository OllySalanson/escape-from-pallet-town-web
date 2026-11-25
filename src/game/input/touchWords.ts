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
  // A key named on the end of a button's own words - "DROP ONE [X]" - is
  // the button itself to a finger, and the tray's key besides.
  return said.replace(/\s*\[[A-Z0-9]\]\s*$/, '');
}

/** One part of a menu's help line that is a key and what it does: "X drop", "TAB shelves or bar". */
const HELP_KEY = /^(TAB|[A-Z])\s+(?!or\b)(\S.*)$/;

/** A help-line key whose job BACK already does: the key that opened the screen, closing it again. */
const BACKS_OUT = /^(?:close|back)\b/;

function helpKey(part: string): { readonly code: string; readonly label: string } | 'back' | null {
  const match = HELP_KEY.exec(part.trim());
  if (!match) {
    return null;
  }
  const words = match[2].trim();
  if (BACKS_OUT.test(words)) {
    return 'back';
  }
  const label = words
    .replace(/^to the /, '')
    .replace(/ or /g, '/')
    .replace(/[.,;:]+$/, '')
    .toUpperCase();
  return { code: match[1] === 'TAB' ? 'Tab' : `Key${match[1]}`, label };
}

/**
 * The letter keys a menu's help line names, as the pad's tray offers them:
 * "ARROWS move · ENTER use · X drop · ESC back" is a DROP key on X. The pad's
 * own buttons (the arrows, ENTER, ESC) are skipped, and so is a key that only
 * closes the screen, which BACK does.
 */
export function helpLineKeys(line: string): TouchShortcut[] {
  const keys: TouchShortcut[] = [];
  for (const part of line.split(' · ')) {
    const key = helpKey(part);
    if (key && key !== 'back') {
      keys.push(key);
    }
  }
  return keys;
}

/** A menu's help line as the pad would say it: each key it names by its tray word, the rest in the pad's words. */
export function touchHelpLine(line: string): string {
  return line
    .split(' · ')
    .flatMap((part) => {
      const key = helpKey(part);
      if (key === 'back') {
        return [];
      }
      return [key ? `[${key.label}]` : touchWording(part)];
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
