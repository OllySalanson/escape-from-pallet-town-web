/**
 * Full screen: the whole display for the game, with the browser's own bars
 * gone (the captain, 26 Nov 2026: "keep the pixels crisp, add a proper
 * full-screen button with the bottom buttons").
 *
 * Nothing about the game changes in full screen. The page is the same page in
 * a bigger window, so `stageScaler.ts` refits the canvas in whole pixels on the
 * resize as it does for any window, and what is left over round it is the
 * frame's (`stageFrame.ts`).
 *
 * The browser's Fullscreen API, on the whole page (`documentElement`) rather
 * than the canvas, so the menus, the controls bar and the frame come with it.
 * Safari before 16.4 has it only as `webkit`-prefixed names, which are asked
 * too; an iPhone has neither, so there it is not offered at all - the bar has
 * no FULL SCREEN tile and SETTINGS no row - and a home-screen copy of the game
 * opens without the browser's bars anyway (`manifest.webmanifest`).
 *
 * The browser owns the way out: ESC leaves full screen in every browser, and
 * the tile and ALT ENTER toggle it either way.
 */

/** The parts of a document full screen needs, standard and Safari's prefixed. */
export interface FullScreenDocument {
  readonly fullscreenEnabled?: boolean;
  readonly fullscreenElement?: Element | null;
  readonly webkitFullscreenEnabled?: boolean;
  readonly webkitFullscreenElement?: Element | null;
  readonly documentElement: FullScreenElement;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface FullScreenElement {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  webkitRequestFullscreen?: () => void;
}

const CHANGE_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'] as const;

/** Whether this browser lets the page go full screen: false on an iPhone, and in a frame that may not. */
export function fullScreenOffered(document: FullScreenDocument): boolean {
  const element = document.documentElement;
  if (typeof element.requestFullscreen === 'function') {
    return document.fullscreenEnabled !== false;
  }
  if (typeof element.webkitRequestFullscreen === 'function') {
    return document.webkitFullscreenEnabled !== false;
  }
  return false;
}

/** Whether the page is full screen now. */
export function isFullScreen(document: FullScreenDocument): boolean {
  return Boolean(document.fullscreenElement ?? document.webkitFullscreenElement);
}

/**
 * Goes full screen, or comes back to the window. Resolves either way: a
 * browser that refuses (no click behind the call, or a frame that may not)
 * leaves the game where it was, which is all a player would see.
 */
export async function toggleFullScreen(document: FullScreenDocument): Promise<void> {
  try {
    if (isFullScreen(document)) {
      if (typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
      } else {
        document.webkitExitFullscreen?.();
      }
      return;
    }
    const element = document.documentElement;
    if (typeof element.requestFullscreen === 'function') {
      // The phone's own navigation bar goes too, where the browser has one.
      await element.requestFullscreen({ navigationUI: 'hide' });
    } else {
      element.webkitRequestFullscreen?.();
    }
  } catch {
    // Refused: the game stays in its window.
  }
}

/** Calls `listener` whenever the page goes into or out of full screen; returns the unsubscribe. */
export function onFullScreenChange(document: FullScreenDocument, listener: () => void): () => void {
  for (const type of CHANGE_EVENTS) {
    document.addEventListener(type, listener);
  }
  return () => {
    for (const type of CHANGE_EVENTS) {
      document.removeEventListener(type, listener);
    }
  };
}

/**
 * The key that toggles it: ALT ENTER, as on a PC game. Not F11, which the
 * browsers keep for their own full screen - some hand it to the page first and
 * some do not, so the same key would do two different things - and whose mode
 * is left only by F11 again and cannot be told apart from a big window.
 */
export const FULL_SCREEN_KEYS = 'ALT ENTER';

/** Whether a key press is the full-screen key: ALT and ENTER, nothing else held. */
export function isFullScreenKey(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'repeat'>): boolean {
  return event.key === 'Enter' && event.altKey && !event.repeat && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

/**
 * ALT ENTER toggles full screen on every screen. Listened for in the capture
 * phase on the window, before any menu or scene, so ENTER held with ALT is
 * never also the game's ENTER. Where full screen is not offered it is left
 * alone.
 */
export function watchFullScreenKey(window: Window, document: FullScreenDocument): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isFullScreenKey(event) || !fullScreenOffered(document)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    void toggleFullScreen(document);
  };
  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
