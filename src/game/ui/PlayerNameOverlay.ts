import type Phaser from 'phaser';
import { checkPlayerName, loadPlayerName, savePlayerName, typedPlayerName } from '../console/playerName';
import { nameClaimLine, nameCountLine, nameProblemLine, nameScreenMarkup, type NameScreenWhere } from '../names/nameScreen';
import type { NameCheck, NameService } from '../names/nameService';
import { MenuOverlay } from './MenuOverlay';
import { NAMING_SCREEN_ARMING_MS } from './NamingScreenOverlay';
import { putUpPixelStatus, takeDownPixelStatus } from './pixelUi';

/** How long typing must pause before the harbour is asked whether the name is free. */
export const NAME_CHECK_AFTER_MS = 350;

/** How a name screen ended: a name that is the player's now, put off till later, or backed out of. */
export type NameScreenEnd = { readonly name: string } | 'later' | 'away';

/**
 * Asks the player's name (`names/nameScreen.ts`) and calls back once with how
 * it ended. A name is the player's only once the harbour has said so
 * (`NameService.claim`); it is kept on this device then and not before. Where
 * there is no harbour to ask - a test that did not ask for one - a name the
 * rules allow is simply kept.
 *
 * As a name is typed, the harbour is asked, a moment after typing stops,
 * whether anybody else has it, and the line under the field says. The overlay
 * holds the keyboard (`ui/overlayKeyboard.ts`), so nothing under it moves while
 * it asks, and it ignores a press that comes too soon after it opens: the key
 * that brought the player here may still be down.
 */
export function openNameScreen(
  scene: Phaser.Scene,
  options: { readonly where: NameScreenWhere; readonly service: NameService | null },
  onDone: (end: NameScreenEnd) => void,
): MenuOverlay {
  const { where, service } = options;
  let settled = false;
  let claiming = false;
  let asking: number | undefined;
  let asked = '';
  const openedAt = performance.now();
  const armed = (): boolean => performance.now() - openedAt >= NAMING_SCREEN_ARMING_MS;

  const settle = (end: NameScreenEnd): void => {
    if (settled || !armed()) {
      return;
    }
    settled = true;
    window.clearTimeout(asking);
    overlay.destroy();
    onDone(end);
  };
  const awayEnd = (): NameScreenEnd => (where === 'continue' ? 'later' : 'away');
  const say = (text: string): void => {
    putUpPixelStatus(overlay.root, text);
    field?.focus();
  };
  const heard = (typed: string, answer: NameCheck | 'asking' | null): void => {
    if (count && field?.value === typed) {
      count.textContent = nameCountLine(typed, answer);
    }
  };
  const askAbout = (typed: string): void => {
    window.clearTimeout(asking);
    const ruled = checkPlayerName(typed);
    if (!service || !ruled.ok) {
      return;
    }
    asking = window.setTimeout(() => {
      asked = ruled.name;
      heard(typed, 'asking');
      service.check(ruled.name).then(
        (answer) => {
          if (!settled && asked === ruled.name) {
            heard(typed, answer);
          }
        },
        () => heard(typed, null),
      );
    }, NAME_CHECK_AFTER_MS);
  };
  const submit = (raw: string): void => {
    if (settled || claiming || !armed()) {
      return;
    }
    const ruled = checkPlayerName(raw);
    if (!ruled.ok) {
      say(nameProblemLine(ruled.problem));
      return;
    }
    if (!service) {
      savePlayerName(ruled.name);
      settle({ name: ruled.name });
      return;
    }
    claiming = true;
    say('Asking Pallet Town...');
    service.claim(ruled.name).then(
      (claim) => {
        claiming = false;
        if (settled) {
          return;
        }
        if (claim === 'claimed') {
          savePlayerName(ruled.name);
          settle({ name: ruled.name });
          return;
        }
        say(nameClaimLine(claim, where));
        heard(ruled.name, claim === 'taken' ? 'taken' : null);
      },
      () => {
        claiming = false;
        say(nameClaimLine('offline', where));
      },
    );
  };

  const overlay: MenuOverlay = new MenuOverlay(scene, 'naming-menu player-name-menu pixel-ui', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      settle(awayEnd());
      return;
    }
    if (overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  });
  overlay.root.setAttribute('aria-label', 'Your name');
  // A NEW GAME asks everybody, and somebody with a name already keeps it with one press.
  const known = loadPlayerName() ?? '';
  overlay.root.innerHTML = nameScreenMarkup({ where, value: known });
  const form = overlay.root.querySelector<HTMLFormElement>('[data-name-form]');
  const field = overlay.root.querySelector<HTMLInputElement>('[data-name-field]');
  const count = overlay.root.querySelector<HTMLElement>('[data-name-count]');
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
      heard(kept, null);
      takeDownPixelStatus(overlay.root);
      askAbout(kept);
    });
    // A field owns its keys (`overlayKeyboard.ts`); key up is how it hands the
    // cursor back, as the nickname line does.
    field.onkeyup = (event) => {
      if (event.key === 'Escape') {
        settle(awayEnd());
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        overlay.moveCursor(event.key);
      }
    };
  }
  overlay.root.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('button');
    if (target?.dataset.nameOk !== undefined) {
      submit(field?.value ?? '');
    } else if (target?.dataset.nameLater !== undefined) {
      settle('later');
    } else if (target?.dataset.nameAway !== undefined) {
      settle(awayEnd());
    }
  });
  overlay.focus('[data-name-field]');
  field?.setSelectionRange(known.length, known.length);
  askAbout(known);
  return overlay;
}
