import type Phaser from 'phaser';
import { MenuOverlay } from './MenuOverlay';
import { type MoveChoice, type MoveChooserView, moveChooserMarkup } from './moveChooser';

/**
 * Presses that reach the chooser this soon after it opens are ignored. It opens
 * on the key that dismissed the last line of dialogue, and a Space is *released*
 * onto whichever button holds focus by then - which would forget a move nobody
 * chose.
 */
export const MOVE_CHOOSER_ARMING_MS = 350;

/**
 * Opens the move chooser over the scene and calls back once with the choice.
 * Picking a move to forget marks it and asks; only the bar's FORGET button
 * forgets. Escape answers the safe way - un-marks a marked move, otherwise
 * "later" where that is on offer and "do not learn" where it is not - never a
 * forget. Keyboard ownership is `MenuOverlay`'s; the pointer only previews, so
 * a mouse on its way to the button cannot move the mark or the cursor.
 */
export function openMoveChooser(
  scene: Phaser.Scene,
  view: MoveChooserView,
  onChoice: (choice: MoveChoice) => void,
): MenuOverlay {
  let settled = false;
  let chosen: number | null = null;
  const openedAt = performance.now();
  const armed = (): boolean => performance.now() - openedAt >= MOVE_CHOOSER_ARMING_MS;
  const settle = (choice: MoveChoice): void => {
    if (settled || !armed()) {
      return;
    }
    settled = true;
    overlay.destroy();
    onChoice(choice);
  };
  const render = (focus: string): void => {
    overlay.root.innerHTML = moveChooserMarkup(view, chosen);
    overlay.focus(focus, '[data-forget]', '[data-decline]');
  };
  const mark = (index: number | null): void => {
    const was = chosen;
    chosen = index;
    render(index === null ? `[data-forget="${was ?? 0}"]` : '[data-forget-confirm]');
  };
  const overlay: MenuOverlay = new MenuOverlay(scene, 'move-chooser-menu pixel-ui', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (chosen !== null) {
        mark(null);
        return;
      }
      settle(view.canDefer ? { kind: 'later' } : { kind: 'decline' });
      return;
    }
    if (overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  });
  overlay.pointerRule = 'previews';
  overlay.root.setAttribute('aria-label', 'Learn a move');
  overlay.root.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('button');
    if (!target) {
      return;
    }
    if (target.dataset.forget !== undefined) {
      // The same press that opened the chooser must not mark a move either.
      if (armed()) {
        mark(Number(target.dataset.forget));
      }
    } else if (target.dataset.forgetConfirm !== undefined && chosen !== null) {
      settle({ kind: 'forget', index: chosen });
    } else if (target.dataset.decline !== undefined) {
      settle({ kind: 'decline' });
    } else if (target.dataset.later !== undefined) {
      settle({ kind: 'later' });
    }
  });
  // Start on the first move to forget: the way out is a deliberate reach.
  render('[data-forget]');
  return overlay;
}
