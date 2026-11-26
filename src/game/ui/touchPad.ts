import { TRAY_ROWS, type TouchLayout, type Rect } from '../display/touchLayout';
import { sendKey, type KeyTarget } from '../input/syntheticKeys';
import { dimsTouchTray, hasTouchShortcuts, sameShortcuts, withMoment, type TouchShortcut } from '../input/touchShortcuts';
import { helpLineKeys } from '../input/touchWords';
import { screenKeyLines } from './menuWords';
import { arrowRuns, bottomEdgeRuns, crossRuns, discRuns, iconRuns, outlineRuns, runsPath, topEdgeRuns, type PadIcon, type PixelRun } from './touchPadArt';

/**
 * The touch pad: the game played with thumbs, on a phone or a tablet.
 *
 * Everything on it is a key the game already answers, pressed the way a
 * keyboard presses it (`input/syntheticKeys.ts`), so no scene or screen has a
 * touch path of its own and nothing a keyboard can do is out of a finger's
 * reach. The d-pad is the arrows, OK is SPACE - talk, read, choose, press the
 * button the cursor is on - and BACK is ESC; the row above them is the screen's
 * own keys by name (`input/touchShortcuts.ts`): PACK, TEAM, OAK, LOOK on a raid,
 * DECORATE in the house, a phrase while the list is open. SOUND and FEEDBACK
 * are the page's, on every screen.
 *
 * - The whole of the d-pad's square answers, by the angle from its middle, and
 *   a thumb slid round it changes direction without lifting, as a real d-pad
 *   rocks. A held direction repeats as a held key does, so a list walks.
 * - Two thumbs at once are two pointers: walking while pressing OK works.
 * - A press never takes focus from the screen under it, so OK presses the
 *   button the menu's cursor is on rather than the pad's own.
 * - A press buzzes once, briefly, where the phone can.
 *
 * Placement is `display/touchLayout.ts`'s; this only draws into the boxes it
 * is handed, and shows itself only while there are boxes to draw in.
 */

/** Everything the pad needs from the page and the game, so a test can supply its own. */
export interface TouchPadHost {
  readonly document: Document;
  /** The scenes to ask for keys, top of the stack last, as Phaser lists them. */
  scenes(): readonly unknown[];
  openFeedback(): void;
  toggleSound(): boolean;
  soundMuted(): boolean;
  /** Unlocks audio on the page's first touch: a browser keeps it asleep until a press. */
  wakeSound(): void;
}

export interface TouchPad {
  /** Draws the pad into a layout, or takes it away (null). */
  place(layout: TouchLayout | null): void;
  /** The rows of keys the screen up names, for the tray across an upright phone (`computeTouchLayout`'s `trayRows`). */
  trayRows(): number;
  /** Called when that changes, so the window is laid out again round the tray. Returns the unsubscribe. */
  onTrayRowsChange(listener: () => void): () => void;
  destroy(): void;
}

type Direction = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/** How long a held direction waits before repeating, and then how often, as a keyboard's does. */
export const REPEAT_DELAY_MS = 380;
export const REPEAT_EVERY_MS = 85;

/** The middle of the d-pad that is no direction, as a share of its width. */
export const DPAD_DEAD_ZONE = 0.14;

/**
 * Which way a thumb at (`x`, `y`) on a d-pad of `size` points: the axis it is
 * further along, or none within the dead zone in the middle.
 */
export function dpadDirection(x: number, y: number, size: number): Direction | null {
  const dx = x - size / 2;
  const dy = y - size / 2;
  if (Math.hypot(dx, dy) < size * DPAD_DEAD_ZONE) {
    return null;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
  }
  return dy > 0 ? 'ArrowDown' : 'ArrowUp';
}

/**
 * The keys the pad should offer now: the topmost running or paused scene that
 * has any. A scene that dims the tray (a battle) leaves `before` - the keys
 * last offered - where they stood, every one dimmed, so the pad keeps its
 * shape and a thumb finds nothing new under it.
 */
export function shortcutsFrom(scenes: readonly unknown[], before: readonly TouchShortcut[] = []): readonly TouchShortcut[] {
  for (const scene of [...scenes].reverse()) {
    if (dimsTouchTray(scene)) {
      return before.filter((key) => !key.extra).map((key) => ({ ...key, inert: true }));
    }
    if (hasTouchShortcuts(scene)) {
      const list = scene.touchShortcuts();
      if (list.length > 0) {
        return list;
      }
    }
  }
  return [];
}

/** One game pixel of pad art in CSS pixels: a whole number of device pixels near `cssTarget`. */
export function padPixel(cssTarget: number, devicePixelRatio: number): number {
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(1, Math.round(cssTarget * ratio)) / ratio;
}

/**
 * The pad's words in Orange Kid at a size whose stem - a twelfth and a half of
 * the size - is a whole number of device pixels, near 18 CSS pixels: as large
 * as a phone held at arm's length asks, and as crisp as the game's own text.
 */
export function padTextSize(devicePixelRatio: number, stems = 1): number {
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const stem = Math.max(2, Math.round(1.44 * ratio * stems));
  return (12.5 * stem) / ratio;
}

/**
 * The pad's words one stem thinner than `padTextSize`, still on whole device
 * pixels: for a key whose word fits neither one line nor two (a key drawn
 * short on a phone on its side), rather than cut off.
 */
export function padSmallTextSize(devicePixelRatio: number): number {
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const stem = Math.max(1, Math.round((padTextSize(ratio) * ratio) / 12.5) - 1);
  return (12.5 * stem) / ratio;
}

/**
 * A key's word as the parts it may break between onto a second line: at its
 * spaces, and after a slash ("SHELVES/BAR"), where a word joined by one has
 * no space to break at.
 */
export function chipWordParts(label: string): string[] {
  return label.split(/(?<=\/)/);
}

/**
 * How a key's word is fitted into its key: on one line as designed, on two
 * where one line would run past the key's edges (FULL REPORT on a 375-wide
 * phone), and a stem thinner where two lines are taller than the key.
 */
export function chipFit(overflows: (fit: 'line' | 'wrap' | 'small') => boolean): 'line' | 'wrap' | 'small' {
  if (!overflows('line')) {
    return 'line';
  }
  return overflows('wrap') ? 'small' : 'wrap';
}

/** The rows `count` keys take in a tray `columns` wide: never fewer than the tray is laid out for. */
export function rowsFor(count: number, columns: number): number {
  return Math.max(TRAY_ROWS, Math.ceil(count / Math.max(1, columns)));
}

/**
 * How tall a key is drawn in a tray: as designed, or smaller where the keys
 * need more rows than the tray has room for (a short phone, or one on its
 * side, with a screen naming many keys) - smaller rather than spilling under
 * the d-pad, where a key could not be pressed and the d-pad could not either.
 */
export function chipHeightIn(trayHeight: number, count: number, columns: number, designed: number, gap = 8): number {
  const rows = Math.max(1, Math.ceil(count / Math.max(1, columns)));
  return Math.max(1, Math.min(designed, Math.floor((trayHeight - gap * (rows - 1)) / rows)));
}

/**
 * The order a tray draws its keys in, top row first, `null` an empty place.
 * Keys past the two rows a tray is laid out for go in rows *over* them,
 * because the tray grew upward: drawn after them, the first two rows would
 * each have moved up one, and a standing key never moves under a thumb that
 * has learned where it is. A tray given no more rows keeps its keys in order.
 */
export function trayOrder<T>(keys: readonly T[], columns: number, rowsGiven: number): (T | null)[] {
  const held = TRAY_ROWS * columns;
  if (rowsGiven <= TRAY_ROWS || keys.length <= held) {
    return [...keys];
  }
  const over = keys.slice(held);
  const spare = (columns - (over.length % columns)) % columns;
  return [...over, ...Array.from({ length: spare }, () => null), ...keys.slice(0, held)];
}

/**
 * The keys shared between the trays, each kept where it stands: the standing
 * keys in their own places - the first half over the left thumb on a phone on
 * its side, the rest over the right - and the keys a moment or a screen adds
 * after them, never between, so a key once learned by where it is stays there.
 */
export function shareKeys<T extends { readonly code: string; readonly extra?: boolean }>(keys: readonly T[], trays: number): T[][] {
  const standing = keys.filter((key) => !key.extra);
  const extra = keys.filter((key) => key.extra);
  if (trays <= 1) {
    return [[...standing, ...extra]];
  }
  const first = Math.ceil(standing.length / 2);
  return [standing.slice(0, first), [...standing.slice(first), ...extra]];
}

const SVG = 'http://www.w3.org/2000/svg';

function svg(document: Document, width: number, height: number): SVGSVGElement {
  const element = document.createElementNS(SVG, 'svg');
  element.setAttribute('viewBox', `0 0 ${width} ${height}`);
  element.setAttribute('shape-rendering', 'crispEdges');
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function path(document: Document, runs: readonly PixelRun[], className: string, dx = 0, dy = 0): SVGPathElement {
  const element = document.createElementNS(SVG, 'path');
  element.setAttribute('d', runsPath(runs, dx, dy));
  element.setAttribute('class', className);
  return element;
}

/** Puts an element on a box, every edge on a whole device pixel so the pixel art lands on the screen's own grid. */
function place(element: HTMLElement, box: Rect, ratio: number): void {
  const snap = (value: number) => Math.round(value * ratio) / ratio;
  const left = snap(box.x);
  const top = snap(box.y);
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.width = `${snap(box.x + box.width) - left}px`;
  element.style.height = `${snap(box.y + box.height) - top}px`;
}

export function installTouchPad(host: TouchPadHost): TouchPad {
  const { document } = host;
  const keys: KeyTarget = document;
  const root = document.createElement('div');
  root.className = 'touch-pad';
  root.hidden = true;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Touch controls');

  const dpad = document.createElement('div');
  dpad.className = 'tp-dpad';
  const buttons = document.createElement('div');
  buttons.className = 'tp-buttons';
  const ok = document.createElement('div');
  ok.className = 'tp-button tp-ok';
  ok.dataset.key = 'Space';
  const back = document.createElement('div');
  back.className = 'tp-button tp-back';
  back.dataset.key = 'Escape';
  buttons.append(back, ok);
  const trays = document.createElement('div');
  trays.className = 'tp-trays';
  const system = document.createElement('div');
  system.className = 'tp-system';
  const sound = document.createElement('div');
  sound.className = 'tp-icon';
  sound.dataset.action = 'sound';
  const feedback = document.createElement('div');
  feedback.className = 'tp-icon';
  feedback.dataset.action = 'feedback';
  feedback.setAttribute('aria-label', 'Feedback');
  system.append(sound, feedback);
  root.append(system, trays, dpad, buttons);
  document.body.append(root);

  let layout: TouchLayout | null = null;
  let unit = 2;
  let shown: readonly TouchShortcut[] = [];
  let woken = false;
  /** The key a finger last pressed on a tray, lit while the screen it opened is up. */
  let openedBy: string | null = null;
  let openedAt = 0;
  let sawScreen = false;
  /** The rows the keys up now want across an upright phone, and who to tell when that changes. */
  let wantedRows = TRAY_ROWS;
  const rowListeners = new Set<() => void>();

  const buzz = () => {
    try {
      (globalThis.navigator as Navigator | undefined)?.vibrate?.(8);
    } catch {
      // A phone that will not buzz is still played.
    }
  };
  const drawIcon = (element: HTMLElement, icon: PadIcon) => {
    const runs = iconRuns(icon);
    const art = svg(document, 11, 9);
    art.append(path(document, runs, 'tp-icon-ink'));
    art.style.width = `${11 * unit}px`;
    art.style.height = `${9 * unit}px`;
    element.replaceChildren(art);
  };
  const showSound = () => {
    const muted = host.soundMuted();
    drawIcon(sound, muted ? 'soundOff' : 'soundOn');
    sound.setAttribute('aria-label', muted ? 'Sound is off' : 'Sound is on');
    sound.classList.toggle('is-off', muted);
  };

  // --- The d-pad -----------------------------------------------------------

  let held: Direction | null = null;
  let dpadPointer: number | null = null;
  let repeatTimer: ReturnType<typeof setTimeout> | undefined;
  const stopRepeat = () => {
    if (repeatTimer !== undefined) {
      clearTimeout(repeatTimer);
      repeatTimer = undefined;
    }
  };
  const hold = (direction: Direction | null) => {
    if (direction === held) {
      return;
    }
    stopRepeat();
    if (held) {
      sendKey(keys, held, 'keyup');
      dpad.classList.remove(`is-${held}`);
    }
    held = direction;
    if (!direction) {
      return;
    }
    dpad.classList.add(`is-${direction}`);
    buzz();
    sendKey(keys, direction, 'keydown');
    const repeat = () => {
      if (held !== direction) {
        return;
      }
      sendKey(keys, direction, 'keydown', true);
      repeatTimer = setTimeout(repeat, REPEAT_EVERY_MS);
    };
    repeatTimer = setTimeout(repeat, REPEAT_DELAY_MS);
  };
  const aim = (event: PointerEvent) => {
    const box = dpad.getBoundingClientRect();
    hold(dpadDirection(event.clientX - box.left, event.clientY - box.top, box.width));
  };
  dpad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (dpadPointer !== null) {
      return;
    }
    dpadPointer = event.pointerId;
    dpad.setPointerCapture?.(event.pointerId);
    aim(event);
  });
  dpad.addEventListener('pointermove', (event) => {
    if (event.pointerId === dpadPointer) {
      aim(event);
    }
  });
  const letGoOfDpad = (event: PointerEvent) => {
    if (event.pointerId !== dpadPointer) {
      return;
    }
    dpadPointer = null;
    hold(null);
  };
  dpad.addEventListener('pointerup', letGoOfDpad);
  dpad.addEventListener('pointercancel', letGoOfDpad);
  dpad.addEventListener('lostpointercapture', letGoOfDpad);

  // --- OK, BACK and the screen's keys --------------------------------------

  /**
   * The button a finger came down on. The touch that turns touch play back on
   * after a keyboard press lays the pad out again in the same moment, before
   * the press reaches here, and the label it landed on is drawn afresh
   * (`drawButton`): the element it hit is no longer in the pad, so the button
   * is found again where the finger is. Asked of the hit element alone, the
   * first OK after a keyboard press was swallowed (the navigation audit, 25 Nov
   * 2026).
   */
  const buttonUnder = (event: PointerEvent): HTMLElement | null => {
    const selector = '[data-key],[data-action]';
    const hit = (event.target as Element | null)?.closest<HTMLElement>(selector);
    if (hit && root.contains(hit)) {
      return hit;
    }
    const here = document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>(selector);
    return here && root.contains(here) ? here : null;
  };

  /** Which key each finger on a button is holding down. */
  const pressed = new Map<number, { readonly code: string; readonly element: HTMLElement }>();
  const press = (event: PointerEvent) => {
    const element = buttonUnder(event);
    if (!element) {
      return;
    }
    event.preventDefault();
    element.setPointerCapture?.(event.pointerId);
    element.classList.add('is-pressed');
    buzz();
    const action = element.dataset.action;
    if (action === 'sound') {
      host.toggleSound();
      showSound();
      pressed.set(event.pointerId, { code: '', element });
      return;
    }
    if (action === 'feedback') {
      pressed.set(event.pointerId, { code: '', element });
      return;
    }
    const code = element.dataset.key ?? '';
    pressed.set(event.pointerId, { code, element });
    // Only a key pressed over the world opens a screen; one pressed on a
    // screen (DROP on the pack) works that screen and lights nothing.
    if (element.classList.contains('tp-chip') && document.querySelector('#screens > .menu-overlay') === null) {
      openedBy = code;
      openedAt = Date.now();
      sawScreen = false;
    }
    sendKey(keys, code, 'keydown');
  };
  const release = (event: PointerEvent) => {
    const press = pressed.get(event.pointerId);
    if (!press) {
      return;
    }
    pressed.delete(event.pointerId);
    press.element.classList.remove('is-pressed');
    if (press.code) {
      sendKey(keys, press.code, 'keyup');
    }
    // FEEDBACK opens on the lift, so the finger that asked is off the glass
    // before a panel appears where it was.
    if (press.element.dataset.action === 'feedback' && event.type === 'pointerup') {
      host.openFeedback();
    }
  };
  for (const zone of [buttons, trays, system]) {
    zone.addEventListener('pointerdown', press);
    zone.addEventListener('pointerup', release);
    zone.addEventListener('pointercancel', release);
    zone.addEventListener('lostpointercapture', release);
  }
  // Audio wakes on a lift, never a press: a browser counts only the end of a
  // touch as the gesture that may start sound.
  const wake = () => {
    if (!woken) {
      woken = true;
      host.wakeSound();
    }
  };
  root.addEventListener('pointerup', wake);
  // A long press is a press, never the browser's menu for the thing pressed.
  root.addEventListener('contextmenu', (event) => event.preventDefault());

  // --- Drawing -------------------------------------------------------------

  const drawDpad = (box: Rect) => {
    const size = Math.max(9, Math.floor(box.width / unit));
    // Nearly the whole square, which is all live to a thumb.
    const cross = Math.round(size * 0.94);
    const arm = Math.round(cross / 3);
    const art = svg(document, size, size + 2);
    const at = Math.floor((size - cross) / 2);
    const shape = crossRuns(cross, arm);
    art.append(
      path(document, outlineRuns(shape), 'tp-shadow', at, at + 2),
      path(document, outlineRuns(shape), 'tp-outline', at, at),
      path(document, shape, 'tp-body', at, at),
      path(document, topEdgeRuns(shape), 'tp-shine', at, at),
      path(document, bottomEdgeRuns(shape), 'tp-shade', at, at),
    );
    // Each arm's pressed shade and arrow, kept apart so one can light alone.
    const start = at + Math.floor((cross - arm) / 2);
    const arrow = Math.max(2, Math.round(arm / 3.5));
    const span = arrow * 2 - 1;
    const middle = start + Math.floor((arm - span) / 2);
    const reach = Math.round((cross - arm) / 2);
    const near = (from: number) => from + Math.round((reach - arrow) / 2);
    const far = (to: number) => to - reach + Math.round((reach - arrow) / 2);
    const arms: readonly [Direction, number, number, number, number, number, number][] = [
      ['ArrowUp', start, at, arm, reach, middle, near(at)],
      ['ArrowDown', start, at + cross - reach, arm, reach, middle, far(at + cross)],
      ['ArrowLeft', at, start, reach, arm, near(at), middle],
      ['ArrowRight', at + cross - reach, start, reach, arm, far(at + cross), middle],
    ];
    for (const [direction, x, y, width, height, arrowX, arrowY] of arms) {
      const group = document.createElementNS(SVG, 'g');
      group.setAttribute('class', `tp-arm tp-arm-${direction}`);
      const shade: PixelRun[] = [];
      for (let row = 0; row < height; row += 1) {
        shade.push({ x: 0, y: row, width });
      }
      const heading = direction.slice('Arrow'.length).toLowerCase() as 'up' | 'down' | 'left' | 'right';
      group.append(
        path(document, shade, 'tp-arm-shade', x, y),
        path(document, arrowRuns(heading, arrow), 'tp-arrow-shadow', arrowX, arrowY + 1),
        path(document, arrowRuns(heading, arrow), 'tp-arrow', arrowX, arrowY),
      );
      art.append(group);
    }
    // The dimple in the middle, where a thumb rests between directions.
    const dimple = Math.max(3, Math.round(arm * 0.5));
    art.append(path(document, discRuns(dimple), 'tp-dimple', at + Math.floor((cross - dimple) / 2), at + Math.floor((cross - dimple) / 2)));
    art.style.width = `${size * unit}px`;
    art.style.height = `${(size + 2) * unit}px`;
    dpad.replaceChildren(art);
  };

  const drawButton = (button: HTMLElement, diameter: number, label: string) => {
    const size = Math.max(5, Math.round(diameter / unit));
    const disc = discRuns(size);
    const art = svg(document, size + 2, size + 4);
    art.append(
      path(document, outlineRuns(disc), 'tp-shadow', 1, 3),
      path(document, outlineRuns(disc), 'tp-outline', 1, 1),
      path(document, disc, 'tp-body', 1, 1),
      // A lit crescent along the top, as a moulded button catches the light.
      path(document, disc.filter((run) => run.y <= Math.max(1, Math.round(size * 0.12))).map((run) => ({ ...run, x: run.x + 1, width: Math.max(0, run.width - 2) })), 'tp-shine', 1, 2),
    );
    art.style.width = `${(size + 2) * unit}px`;
    art.style.height = `${(size + 4) * unit}px`;
    const word = document.createElement('span');
    word.className = 'tp-label';
    word.textContent = label;
    button.replaceChildren(art, word);
    button.style.width = `${(size + 2) * unit}px`;
    button.style.height = `${(size + 4) * unit}px`;
  };

  const drawShortcuts = () => {
    // The key whose screen is up is lit, until that screen is put away.
    const screenUp = document.querySelector('#screens > .menu-overlay') !== null;
    // A screen's own letter keys join the tray while it is up: the pack's
    // DROP, the team's LEAD - read off its keys line, as it teaches them.
    const layer = document.querySelector('#screens');
    const help = screenUp && layer ? screenKeyLines(layer).join(' · ') : '';
    const list = withMoment(shortcutsFrom(host.scenes(), shown), helpLineKeys(help));
    if (screenUp) {
      sawScreen = true;
    } else if (openedBy && (sawScreen || Date.now() - openedAt > 1500)) {
      openedBy = null;
    }
    for (const chip of trays.querySelectorAll<HTMLElement>('.tp-chip')) {
      chip.classList.toggle('is-open', screenUp && chip.dataset.key === openedBy);
    }
    if (!layout || (sameShortcuts(list, shown) && trays.querySelectorAll('.tp-chip:not(.is-spare)').length === list.length)) {
      return;
    }
    shown = list;
    // Upright, a screen naming more keys than two rows hold asks for the room
    // for another row (YOUR THINGS: OUT, LOCK and its pockets); the window is
    // laid out again round it and this drawn again into the new tray.
    const rows = layout.orientation === 'portrait' ? rowsFor(list.length, layout.trayColumns) : TRAY_ROWS;
    if (rows !== wantedRows) {
      wantedRows = rows;
      for (const listener of [...rowListeners]) {
        listener();
      }
      if (shown !== list) {
        return;
      }
    }
    const shared = shareKeys(list, layout.trays.length);
    const designedChip = Math.round(48 * Math.min(1, layout.padScale));
    [...trays.children].forEach((tray, index) => {
      const keys = shared[index] ?? [];
      const box = layout!.trays[index];
      const columns = layout!.trayColumns;
      const gap = 8;
      (tray as HTMLElement).style.setProperty('--tp-chip-width', `${Math.floor((box.width - gap * (columns - 1)) / columns)}px`);
      (tray as HTMLElement).style.setProperty('--tp-chip-height', `${chipHeightIn(box.height, keys.length, columns, designedChip, gap)}px`);
      const rowsGiven = layout!.orientation === 'portrait' ? layout!.trayRows : TRAY_ROWS;
      tray.replaceChildren(
        ...trayOrder(keys, columns, rowsGiven).map((shortcut) => {
          const chip = document.createElement('div');
          if (!shortcut) {
            chip.className = 'tp-chip is-spare';
            chip.setAttribute('aria-hidden', 'true');
            return chip;
          }
          chip.className = ['tp-chip', shortcut.extra ? 'is-extra' : '', shortcut.inert ? 'is-inert' : ''].filter(Boolean).join(' ');
          // A dead key presses nothing: it has no key to press.
          if (!shortcut.inert) {
            chip.dataset.key = shortcut.code;
          }
          chip.classList.toggle('is-open', screenUp && shortcut.code === openedBy);
          // A word joined by a slash breaks after it, which a <wbr> allows
          // and the key's text (what a driver reads) does not show.
          chip.replaceChildren(
            ...chipWordParts(shortcut.label).flatMap((part, index) => (index === 0 ? [part] : [document.createElement('wbr'), part])),
          );
          return chip;
        }),
      );
    });
    fitChipWords();
  };
  /** Every key's word fitted to its key (`chipFit`): measured, because the font's widths are its own. */
  const fitChipWords = () => {
    for (const chip of trays.querySelectorAll<HTMLElement>('.tp-chip:not(.is-spare)')) {
      const fit = chipFit((tried) => {
        chip.classList.toggle('is-wrapped', tried !== 'line');
        chip.classList.toggle('is-small', tried === 'small');
        return chip.scrollWidth > chip.clientWidth || chip.scrollHeight > chip.clientHeight;
      });
      chip.classList.toggle('is-wrapped', fit !== 'line');
      chip.classList.toggle('is-small', fit === 'small');
    }
  };
  const watchShortcuts = setInterval(() => {
    if (layout) {
      drawShortcuts();
    }
  }, 200);

  return {
    trayRows: () => wantedRows,
    onTrayRowsChange(listener) {
      rowListeners.add(listener);
      return () => rowListeners.delete(listener);
    },
    place(next) {
      layout = next;
      if (!next) {
        root.hidden = true;
        hold(null);
        document.body.classList.remove('touch-play');
        return;
      }
      document.body.classList.add('touch-play');
      root.hidden = false;
      root.dataset.orientation = next.orientation;
      const ratio = globalThis.devicePixelRatio || 1;
      // The pad's art is drawn in pixels twice the game's own, as chunky as
      // the art it plays.
      unit = padPixel(2 * next.stage.zoom * next.padScale, ratio);
      root.style.setProperty('--tp-unit', `${unit}px`);
      root.style.setProperty('--tp-text', `${padTextSize(ratio)}px`);
      root.style.setProperty('--tp-text-big', `${padTextSize(ratio, 1.5)}px`);
      root.style.setProperty('--tp-text-small', `${padSmallTextSize(ratio)}px`);
      root.style.setProperty('--tp-chip-height', `${Math.round(48 * Math.min(1, next.padScale))}px`);
      place(dpad, next.dpad, ratio);
      place(buttons, next.buttons, ratio);
      place(system, next.system, ratio);
      place(trays, { x: 0, y: 0, width: 0, height: 0 }, ratio);
      trays.replaceChildren(
        ...next.trays.map((box) => {
          const tray = document.createElement('div');
          tray.className = 'tp-tray';
          place(tray, box, ratio);
          return tray;
        }),
      );
      drawDpad(next.dpad);
      drawButton(ok, next.buttons.height * 0.5, 'OK');
      drawButton(back, next.buttons.height * 0.38, 'BACK');
      showSound();
      drawIcon(feedback, 'feedback');
      shown = [];
      drawShortcuts();
    },
    destroy() {
      clearInterval(watchShortcuts);
      hold(null);
      root.remove();
      document.body.classList.remove('touch-play');
    },
  };
}
