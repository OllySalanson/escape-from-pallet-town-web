import type Phaser from 'phaser';
import { checkPlayerName, savePlayerName, typedPlayerName } from '../console/playerName';
import { houseNameCountLine, houseNameMarkup, houseNameProblemLine } from '../home/houseName';
import { MenuOverlay } from './MenuOverlay';
import { NAMING_SCREEN_ARMING_MS } from './NamingScreenOverlay';
import { putUpPixelStatus, takeDownPixelStatus } from './pixelUi';

/**
 * Asks the player's name over THE BOLTHOLE (`home/houseName.ts`) and calls back
 * once: with the name, already checked and kept on this device, or with null
 * when the player went back outside instead.
 *
 * A name the rules refuse is said over the help bar and the screen stays up,
 * with what was typed still in the line, because the only ways off this screen
 * are a name or the door. The overlay holds the keyboard
 * (`ui/overlayKeyboard.ts`), so the house under it cannot be walked about in
 * while it asks, and it ignores a press that comes too soon after it opens: the
 * key that walked the player in through the door may still be down.
 */
export function openHouseNameScreen(scene: Phaser.Scene, onDone: (name: string | null) => void): MenuOverlay {
  let settled = false;
  const openedAt = performance.now();
  const armed = (): boolean => performance.now() - openedAt >= NAMING_SCREEN_ARMING_MS;
  const settle = (name: string | null): void => {
    if (settled || !armed()) {
      return;
    }
    settled = true;
    overlay.destroy();
    onDone(name);
  };
  const submit = (raw: string): void => {
    if (settled || !armed()) {
      return;
    }
    const check = checkPlayerName(raw);
    if (!check.ok) {
      putUpPixelStatus(overlay.root, houseNameProblemLine(check.problem));
      field?.focus();
      return;
    }
    savePlayerName(check.name);
    settle(check.name);
  };
  const overlay: MenuOverlay = new MenuOverlay(scene, 'naming-menu house-name-menu pixel-ui', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      settle(null);
      return;
    }
    if (overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  });
  overlay.root.setAttribute('aria-label', 'Your name');
  overlay.root.innerHTML = houseNameMarkup({ value: '' });
  const form = overlay.root.querySelector<HTMLFormElement>('[data-house-name-form]');
  const field = overlay.root.querySelector<HTMLInputElement>('[data-house-name-field]');
  const count = overlay.root.querySelector<HTMLElement>('[data-house-name-count]');
  if (form && field) {
    form.onsubmit = (event) => {
      event.preventDefault();
      submit(field.value);
    };
    // Only what a name may hold stands in the line as it is typed, so what is
    // typed is what goes on the door.
    field.addEventListener('input', () => {
      const kept = typedPlayerName(field.value);
      if (kept !== field.value) {
        const caret = Math.max(0, (field.selectionStart ?? kept.length) - (field.value.length - kept.length));
        field.value = kept;
        field.setSelectionRange(caret, caret);
      }
      if (count) {
        count.textContent = houseNameCountLine(kept);
      }
      takeDownPixelStatus(overlay.root);
    });
    // A field owns its keys (`overlayKeyboard.ts`); key up is how it hands the
    // cursor back, as the nickname line does.
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
    if (target?.dataset.houseNameOk !== undefined) {
      submit(field?.value ?? '');
    } else if (target?.dataset.houseNameLeave !== undefined) {
      settle(null);
    }
  });
  overlay.focus('[data-house-name-field]');
  return overlay;
}
