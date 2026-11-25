import { codeForHintKey } from './syntheticKeys';

/**
 * The screen's own keys, as the touch pad (`ui/touchPad.ts`) offers them: one
 * button a key, named by what it does rather than by its letter, because a
 * finger has no letters to press.
 *
 * A scene says which keys are its by answering `touchShortcuts()`. The keys a
 * scene always has - the raid's OAK, LOOK, PACK and TEAM - come from the same
 * tables the HUD's hints are written from (`input/keyBindings.ts`), and the
 * keys a moment adds - DECORATE in the house, a coin over the arena's rail, a
 * phrase while the list is open - are read off the hint line that names them
 * (`shortcutsInHint`), so the pad offers a key exactly when the screen says
 * it can be pressed, and the two can never disagree.
 */
export interface TouchShortcut {
  /** `KeyboardEvent.code` of the key it presses: `KeyB`, `Digit1`. */
  readonly code: string;
  /** What it does, as the screen words it: PACK, TOSS A COIN. */
  readonly label: string;
}

/** A scene with keys of its own for the pad. */
export interface TouchShortcutSource {
  touchShortcuts(): readonly TouchShortcut[];
}

export function hasTouchShortcuts(scene: unknown): scene is TouchShortcutSource {
  return typeof (scene as Partial<TouchShortcutSource> | null)?.touchShortcuts === 'function';
}

/**
 * Every letter or digit key a hint line names, with the words it names it by:
 * `[H] DECORATE`, `[R] TURN   [X] PUT AWAY`, `[1] OVER HERE!`. SPACE, ESC and
 * the arrows are the pad's own buttons, so a hint naming them adds nothing.
 */
export function shortcutsInHint(hint: string): TouchShortcut[] {
  const found: TouchShortcut[] = [];
  // A pair sharing a word walks something back and forward: "[Q][E] BOX" is "< BOX" and "BOX >".
  for (const match of hint.matchAll(/\[([A-Z0-9])\]\[([A-Z0-9])\]\s+([^[\n]*?)(?=\s{2,}|\s*\[|\s*\n|\s*$)/g)) {
    const back = codeForHintKey(match[1]);
    const next = codeForHintKey(match[2]);
    const label = match[3].trim();
    if (back && next && label) {
      found.push({ code: back, label: `< ${label}` }, { code: next, label: `${label} >` });
    }
  }
  const pattern = /(?<!\])\[([A-Z0-9])\]\s+([^[\n]*?)(?=\s{2,}|\s*\[|\s*\n|\s*$)/g;
  for (const match of hint.matchAll(pattern)) {
    const code = codeForHintKey(match[1]);
    const label = match[2].trim();
    if (code && label) {
      found.push({ code, label });
    }
  }
  return found;
}

/**
 * The scene's standing keys, then any the moment adds, each key once. A key
 * the moment names that is already standing keeps its place and takes the
 * moment's word, because the moment is what it does now: X is DEX in the
 * house until the house is being decorated, when it is PUT AWAY.
 */
export function withMoment(standing: readonly TouchShortcut[], moment: readonly TouchShortcut[]): TouchShortcut[] {
  const now = new Map(moment.map((shortcut) => [shortcut.code, shortcut] as const));
  const merged = standing.map((shortcut) => now.get(shortcut.code) ?? shortcut);
  const seen = new Set(merged.map((shortcut) => shortcut.code));
  for (const shortcut of moment) {
    if (!seen.has(shortcut.code)) {
      seen.add(shortcut.code);
      merged.push(shortcut);
    }
  }
  return merged;
}

/** One letter key and its word, as the pad offers it. */
export function letterShortcut(letter: string, label: string): TouchShortcut {
  return { code: `Key${letter.toUpperCase()}`, label };
}

/** Two lists the pad would draw the same. */
export function sameShortcuts(a: readonly TouchShortcut[], b: readonly TouchShortcut[]): boolean {
  return a.length === b.length && a.every((each, index) => each.code === b[index].code && each.label === b[index].label);
}
