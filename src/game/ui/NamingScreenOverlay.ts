import type Phaser from 'phaser';
import { nicknameCharacters } from '../pokemon';
import { MenuOverlay } from './MenuOverlay';
import { type NamingView, namingCountLine, namingScreenMarkup } from './namingScreen';

/**
 * Presses that reach the naming screen this soon after it opens are ignored. It
 * opens on the key that answered YES, and that key's repeat, landing in the
 * field, would otherwise submit an empty name nobody chose - the same reason
 * the move chooser waits (`MOVE_CHOOSER_ARMING_MS`).
 */
export const NAMING_SCREEN_ARMING_MS = 350;

/**
 * Opens the naming screen over the scene and calls back once with what was
 * typed - untidied, for `Pokemon.giveNickname` to hold to the rules - or null
 * when the player chose no nickname. ENTER in the field and OK both give the
 * name; ESC and NO NICKNAME both leave it the species name.
 *
 * The field is the one control on the screen that owns its keys, so the
 * overlay reads none of a keystroke meant for the text (`overlayKeyboard.ts`):
 * its Escape and arrows are read on key *up*, as the stash's box name is.
 */
export function openNamingScreen(
  scene: Phaser.Scene,
  view: NamingView,
  onDone: (typed: string | null) => void,
): MenuOverlay {
  let settled = false;
  const openedAt = performance.now();
  const armed = (): boolean => performance.now() - openedAt >= NAMING_SCREEN_ARMING_MS;
  const settle = (typed: string | null): void => {
    if (settled || !armed()) {
      return;
    }
    settled = true;
    overlay.destroy();
    onDone(typed);
  };
  const overlay: MenuOverlay = new MenuOverlay(scene, 'naming-menu pixel-ui', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      settle(null);
      return;
    }
    if (overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  });
  overlay.root.setAttribute('aria-label', 'Give a nickname');
  overlay.root.innerHTML = namingScreenMarkup(view);
  const form = overlay.root.querySelector<HTMLFormElement>('[data-naming-form]');
  const field = overlay.root.querySelector<HTMLInputElement>('[data-naming-field]');
  const count = overlay.root.querySelector<HTMLElement>('[data-naming-count]');
  const typed = (): string => field?.value ?? '';
  if (form && field) {
    form.onsubmit = (event) => {
      event.preventDefault();
      settle(typed());
    };
    // Only what a nickname may hold is kept as it is typed, so the line never
    // shows a letter that would be taken out when it is given.
    field.addEventListener('input', () => {
      const kept = nicknameCharacters(field.value);
      if (kept !== field.value) {
        const caret = Math.max(0, (field.selectionStart ?? kept.length) - (field.value.length - kept.length));
        field.value = kept;
        field.setSelectionRange(caret, caret);
      }
      if (count) {
        count.textContent = namingCountLine(kept);
      }
    });
    field.onkeyup = (event) => {
      if (event.key === 'Escape') {
        settle(null);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        overlay.moveCursor(event.key);
      }
    };
  }
  overlay.root.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('button');
    if (target?.dataset.namingOk !== undefined) {
      settle(typed());
    } else if (target?.dataset.namingSkip !== undefined) {
      settle(null);
    }
  });
  overlay.focus('[data-naming-field]');
  return overlay;
}
