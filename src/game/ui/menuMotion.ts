import { requestedTestMode, type TestMode } from '../dev/testMode';
import { prefersReducedMotion } from './reducedMotion';

/**
 * How a screen arrives and how it leaves.
 *
 * Every screen used to cut: one frame was the harbour and the next was the
 * whole menu, with nothing moving on it or between them (the captain, 25 Nov
 * 2026: "show with animation, not text"; the menu study of 26 Nov, cause 5,
 * `docs/screens/wood-floor/`). A screen now takes a fifth of a second to
 * arrive - the place behind it dims, its title strip drops in, its cards step
 * up one after another and its help strip rises - and a tenth to leave,
 * sinking and clearing over the place. Every
 * move is stepped, as the game's own are: nothing eases. Reduced motion plays
 * none of it, and nor does test mode unless it is asked to (`screensMove`).
 *
 * Played once per screen, on what is there when its first markup lands, and
 * never from the stylesheet: a screen is redrawn by replacing its markup, and a
 * rule that animated a card would play again on every redraw.
 */

/** One part of a screen and when it moves, in milliseconds from the screen opening. */
export interface MotionStep {
  readonly part: 'dim' | 'title' | 'card' | 'help';
  /** Which card, counted from the first; 0 for every other part. */
  readonly index: number;
  readonly delayMs: number;
  readonly durationMs: number;
  /** How many steps the move is drawn in. */
  readonly steps: number;
}

/** How long one part takes to arrive, and the beat between one card and the next. */
const PART_MS = 120;
const CARD_BEAT_MS = 20;
/** No more cards than this wait their turn: a seventh card arrives with the sixth. */
const CARDS_IN_TURN = 6;
/** How long a screen takes to leave. */
export const LEAVE_MS = 100;

/** How far a card rises, a side panel slides in and a leaving screen sinks, in game pixels. */
const CARD_RISE = 8;
const LEAVE_SINK = 4;

/**
 * The moves of a screen arriving: the place dims, the title strip drops in,
 * the cards step up one after another and the help strip rises. A side panel
 * (the pack, the party, Oak on a raid) is the same screen in a column, and
 * arrives the same way; it has no dim of its own to bring in, the map beside
 * it being the point.
 *
 * A screen that follows another directly - a tab, a question over a screen -
 * only steps its cards up: the place is already dim and a strip is already
 * there, and playing those again would flash the world between two screens.
 */
export function arrivalPlan(cards: number, following: boolean): readonly MotionStep[] {
  const cardSteps = Array.from({ length: cards }, (_, index): MotionStep => ({
    part: 'card',
    index,
    delayMs: (following ? 0 : 2 * CARD_BEAT_MS) + Math.min(index, CARDS_IN_TURN - 1) * CARD_BEAT_MS,
    durationMs: PART_MS,
    steps: 3,
  }));
  if (following) {
    return cardSteps;
  }
  return [
    { part: 'dim', index: 0, delayMs: 0, durationMs: 160, steps: 4 },
    { part: 'title', index: 0, delayMs: 0, durationMs: PART_MS, steps: 3 },
    ...cardSteps,
    { part: 'help', index: 0, delayMs: 2 * CARD_BEAT_MS, durationMs: PART_MS, steps: 3 },
  ];
}

/** How long the whole arrival takes: when its last part has landed. */
export function arrivalLength(plan: readonly MotionStep[]): number {
  return plan.reduce((latest, step) => Math.max(latest, step.delayMs + step.durationMs), 0);
}

const unitOf = (root: HTMLElement): number => Number.parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 2;

/** Whether a screen is one these moves are for: THE RAID ARENA's panels move by their own rule, and an older screen does not move. */
function isMoved(root: HTMLElement): boolean {
  return root.classList.contains('pixel-ui') && !root.classList.contains('arena-panel');
}

/** What a test-mode page adds to its address to have screens move as a player's do. */
export const MENU_MOTION_QUERY = 'menumotion';

/**
 * Whether screens move on this page. In test mode they arrive and leave at
 * once unless the address asks for the move: a driver that steps a paused loop
 * measures a screen in the instant it opens, and these moves run on the wall
 * clock, which stepping does not turn - `yourThings.mjs` found a card "spilling
 * out" of its screen a third of the way up. `tools/playtest/menuMotion.mjs` is
 * the driver that asks.
 */
export function screensMove(
  testMode: TestMode = requestedTestMode(),
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): boolean {
  return testMode === 'off' || new URLSearchParams(search).has(MENU_MOTION_QUERY);
}

const canAnimate = (root: HTMLElement): boolean => typeof root.animate === 'function' && screensMove() && !prefersReducedMotion();

/** Plays a screen's arrival on what it holds now. */
export function playArrival(root: HTMLElement, following: boolean): void {
  const screen = root.querySelector<HTMLElement>('.px-screen');
  if (!isMoved(root) || !screen || !canAnimate(root)) {
    return;
  }
  const unit = unitOf(root);
  const cards = [...root.querySelectorAll<HTMLElement>('.px-screen > .px-body > *')];
  const title = screen.querySelector<HTMLElement>(':scope > .px-title');
  const help = screen.querySelector<HTMLElement>(':scope > .px-help');
  for (const step of arrivalPlan(cards.length, following)) {
    const timing: KeyframeAnimationOptions = {
      duration: step.durationMs,
      delay: step.delayMs,
      easing: `steps(${step.steps}, end)`,
      // Until its turn comes a part is where it starts from, never where it ends.
      fill: 'backwards',
    };
    if (step.part === 'dim') {
      root.animate([{ backgroundColor: 'transparent', offset: 0 }], timing);
    } else if (step.part === 'title') {
      title?.animate([{ transform: `translateY(${-title.offsetHeight}px)`, offset: 0 }], timing);
    } else if (step.part === 'help') {
      help?.animate([{ transform: `translateY(${help.offsetHeight}px)`, offset: 0 }], timing);
    } else {
      // Clear as it starts, except behind another screen: there a clear card
      // would show the place for a step between two screens that both cover it.
      const from = { transform: `translateY(${CARD_RISE * unit}px)`, ...(following ? {} : { opacity: 0 }) };
      cards[step.index]?.animate([{ ...from, offset: 0 }], timing);
    }
  }
}

/** The class of the layer a leaving screen is moved to, under the menu layer. */
export const LEAVING_LAYER_CLASS = 'screens-leaving';

/** The layer a screen is leaving in, while one is. */
let leavingLayer: HTMLElement | null = null;

/** Whether a screen by this class list moves at all: one in the game's own look. */
export function movesAsScreen(className: string): boolean {
  return className.split(/\s+/).includes('pixel-ui');
}

/**
 * Whether the screen about to open comes straight after another: one still
 * leaving, which is taken down now, or one still up in the layer under it.
 */
export function followsAnother(layer: HTMLElement): boolean {
  const leaving = clearLeaving();
  return leaving || [...layer.children].some((child) => child.classList.contains('menu-overlay'));
}

/**
 * Lets a screen leave: it is taken out of the menu layer at once - nothing
 * that asks whether a screen is up may still find it - and stands for a tenth
 * of a second in a layer of its own under it, sinking and clearing, with
 * nothing on it able to be pressed. Returns false where it was simply removed:
 * no screen to move, reduced motion, or another screen already up over it.
 */
export function playLeaving(root: HTMLElement, layer: HTMLElement): boolean {
  const screen = root.querySelector<HTMLElement>('.px-screen');
  const covered = [...layer.children].some((child) => child !== root && child.classList.contains('menu-overlay'));
  if (!isMoved(root) || !screen || covered || !canAnimate(root) || !root.isConnected) {
    root.remove();
    return false;
  }
  clearLeaving();
  const unit = unitOf(root);
  const ghost = layer.ownerDocument.createElement('div');
  ghost.className = LEAVING_LAYER_CLASS;
  // The menu layer's own box and game pixel, which it is given inline (`applyMenuStage`).
  ghost.style.cssText = layer.style.cssText;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  root.dataset.leaving = '';
  layer.before(ghost);
  ghost.append(root);
  leavingLayer = ghost;
  const timing: KeyframeAnimationOptions = { duration: LEAVE_MS, easing: 'steps(3, end)', fill: 'forwards' };
  root.animate([{ backgroundColor: 'transparent', offset: 1 }], timing);
  const leaving = screen.animate([{ transform: `translateY(${LEAVE_SINK * unit}px)`, opacity: 0, offset: 1 }], timing);
  const gone = (): void => {
    ghost.remove();
    if (leavingLayer === ghost) {
      leavingLayer = null;
    }
  };
  leaving.addEventListener('finish', gone);
  leaving.addEventListener('cancel', gone);
  // A tab in the background runs no animation frames: the layer goes all the same.
  setTimeout(gone, LEAVE_MS * 3);
  return true;
}

/** Takes down a screen still leaving: the next one is here. Returns whether there was one. */
export function clearLeaving(): boolean {
  const ghost = leavingLayer;
  leavingLayer = null;
  ghost?.remove();
  return ghost !== null;
}
