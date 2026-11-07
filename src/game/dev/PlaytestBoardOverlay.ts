import type Phaser from 'phaser';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { dockSidePanel, type SidePanelView } from '../ui/sidePanel';
import { PLAYTEST_BOARD_NAME, playtestBoardRows, type PlaytestBoardAction } from './playtestBoard';
import { playtestBoardMarkup } from './playtestBoardView';
import type { PlaytestHour } from './playtestClock';

/**
 * The PLAYTEST BOARD up as a side panel beside a harbour that stands still
 * while it is up, as the favours list is. One press of a row does it and puts
 * the panel away; ESC or BACK puts it away having done nothing.
 *
 * `onAction` is called once with the row pressed, after the
 * panel is put away; `onClose` once whichever way it was put away.
 */
export function openPlaytestBoard(
  scene: Phaser.Scene,
  hour: PlaytestHour | null,
  onAction: (action: PlaytestBoardAction) => void,
  onClose: () => void,
  view?: SidePanelView,
): MenuOverlay {
  let closed = false;
  const close = (action?: PlaytestBoardAction): void => {
    if (closed) {
      return;
    }
    closed = true;
    overlay.destroy();
    view?.covers(0);
    onClose();
    if (action) {
      onAction(action);
    }
  };
  const overlay: MenuOverlay = new MenuOverlay(scene, 'playtest-board favour-menu side-panel pixel-ui', (event) => {
    if (isOverlayDismissKey(event)) {
      event.preventDefault();
      close();
      return;
    }
    if (overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  });
  overlay.root.setAttribute('aria-label', PLAYTEST_BOARD_NAME);
  dockSidePanel(scene, overlay, view);
  overlay.root.innerHTML = playtestBoardMarkup(hour);
  const rows = playtestBoardRows(hour);
  overlay.root.querySelector<HTMLButtonElement>('[data-board-close]')!.onclick = () => close();
  for (const button of overlay.root.querySelectorAll<HTMLButtonElement>('[data-board-row]')) {
    const row = rows.find((each) => each.id === button.dataset.boardRow);
    if (row) {
      button.onclick = () => close(row.action);
    }
  }
  overlay.refocus('[data-cursor-start]', '[data-board-close]');
  return overlay;
}
