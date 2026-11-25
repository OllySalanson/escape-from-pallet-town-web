import { helpLineKeys, touchHelpLine, touchWording } from '../input/touchWords';

/**
 * The menu screens say their keys the touch pad's way too, while it is up:
 * the DOM twin of `installTouchWording`, which covers every word drawn on the
 * canvas. A screen writes its markup as it always has; this watches the menu
 * layer and rewords each piece of text as it arrives - a help line's "X drop"
 * is "[DROP]", the word on the tray's button (`input/touchWords.ts`), and
 * "ESC back" is "BACK" - so no screen has to know about touch.
 *
 * What each piece of text said before it was reworded is kept, so stopping
 * touch play puts the keyboard's words back. Text being typed is never
 * touched: a field's value is not a text node.
 */

/** Text that is never reworded: code, and anything a player is typing into. */
const UNTOUCHED = 'script, style, textarea, input, [contenteditable="true"]';

/** A screen's letter keys named in a sentence by their tray words: "X drops one Potion." is "[DROP] drops one Potion." */
export function namingTrayKeys(sentence: string, keys: readonly { readonly code: string; readonly label: string }[]): string {
  return sentence.replace(/(^|[\s.(])([A-Z])(?= [a-z])/g, (match, before: string, letter: string) => {
    const key = keys.find((each) => each.code === `Key${letter}`);
    return key ? `${before}[${key.label}]` : match;
  });
}

export interface MenuWords {
  /** Says every piece of text in the layer again, the pad's way or the keyboard's. */
  reword(): void;
  stop(): void;
}

export function watchMenuWords(layer: HTMLElement, playing: () => boolean): MenuWords {
  /** What each text node said before it was reworded, and what it was last set to. */
  const sources = new WeakMap<Text, { readonly source: string; readonly written: string }>();

  const wordsFor = (node: Text, source: string): string => {
    if (!playing()) {
      return source;
    }
    // A help line still saying its screen's own keys, rather than the help for
    // the control the cursor is on, names each key by the tray button's word.
    const parent = node.parentElement;
    const inHelp = parent?.matches('[data-help-text]') === true;
    if (inHelp && parent.dataset.helpDefault === source) {
      return touchHelpLine(source);
    }
    // The help for the control the cursor is on, naming one of the screen's
    // letter keys in a sentence - "X drops one Potion." - names it by its
    // tray word instead.
    const keys = inHelp ? helpLineKeys(parent.dataset.helpDefault ?? '') : [];
    return touchWording(namingTrayKeys(source, keys));
  };

  const rewordNode = (node: Text) => {
    if (node.parentElement?.closest(UNTOUCHED)) {
      return;
    }
    const known = sources.get(node);
    // Text a screen set since it was last reworded is the new source.
    const source = known && known.written === node.data ? known.source : node.data;
    const words = wordsFor(node, source);
    sources.set(node, { source, written: words });
    if (node.data !== words) {
      node.data = words;
    }
  };

  const rewordUnder = (root: Node) => {
    if (root.nodeType === Node.TEXT_NODE) {
      rewordNode(root as Text);
      return;
    }
    const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      rewordNode(node as Text);
    }
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        rewordUnder(mutation.target);
      } else {
        mutation.addedNodes.forEach(rewordUnder);
      }
    }
  });
  observer.observe(layer, { childList: true, subtree: true, characterData: true });

  return {
    reword: () => rewordUnder(layer),
    stop: () => observer.disconnect(),
  };
}
