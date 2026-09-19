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
 * Escape answers it the safe way - "later" where that is on offer, otherwise
 * "do not learn" - never a forget. Keyboard ownership is `MenuOverlay`'s.
 */
export function openMoveChooser(
  scene: Phaser.Scene,
  view: MoveChooserView,
  onChoice: (choice: MoveChoice) => void,
): MenuOverlay {
  let settled = false;
  const openedAt = performance.now();
  const settle = (choice: MoveChoice): void => {
    if (settled || performance.now() - openedAt < MOVE_CHOOSER_ARMING_MS) {
      return;
    }
    settled = true;
    overlay.destroy();
    onChoice(choice);
  };
  const overlay: MenuOverlay = new MenuOverlay(scene, 'move-chooser-menu pixel-ui', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      settle(view.canDefer ? { kind: 'later' } : { kind: 'decline' });
      return;
    }
    if (overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  });
  overlay.root.setAttribute('aria-label', 'Learn a move');
  overlay.root.innerHTML = moveChooserMarkup(view);
  overlay.root.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('button');
    if (!target) {
      return;
    }
    if (target.dataset.forget !== undefined) {
      settle({ kind: 'forget', index: Number(target.dataset.forget) });
    } else if (target.dataset.decline !== undefined) {
      settle({ kind: 'decline' });
    } else if (target.dataset.later !== undefined) {
      settle({ kind: 'later' });
    }
  });
  // Start on the first move to forget: the way out is a deliberate reach.
  overlay.focus('[data-forget]', '[data-decline]');
  return overlay;
}
