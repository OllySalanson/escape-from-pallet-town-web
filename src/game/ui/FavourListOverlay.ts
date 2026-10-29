import type Phaser from 'phaser';
import { favourListMarkup, type FavourEntry } from '../hub/favourList';
import { MenuOverlay } from './MenuOverlay';
import { isOverlayDismissKey } from './overlayKeyboard';

/**
 * The favours screen (`hub/favourList.ts`), over a harbour that stands still
 * while it is up: opened with O anywhere at base, put away with O, ESC or
 * BACK. It only reads; nothing on it takes a favour on or hands one over -
 * that is done face to face. Calls back once, when it is put away.
 */
export function openFavourList(
  scene: Phaser.Scene,
  entries: readonly FavourEntry[],
  onClose: () => void,
): MenuOverlay {
  let closed = false;
  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    overlay.destroy();
    onClose();
  };
  const overlay: MenuOverlay = new MenuOverlay(scene, 'favour-menu pixel-ui', (event) => {
    // The O that opened it, still held, repeats: it must not close it again.
    if (event.repeat && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      return;
    }
    if (isOverlayDismissKey(event, 'o')) {
      event.preventDefault();
      close();
      return;
    }
    if (overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  });
  overlay.root.setAttribute('aria-label', 'Favours');
  overlay.root.innerHTML = favourListMarkup(entries);
  overlay.root.querySelector<HTMLButtonElement>('[data-favours-close]')!.onclick = close;
  overlay.refocus('[data-cursor-start]', '[data-favours-close]');
  return overlay;
}
