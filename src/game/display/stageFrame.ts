import { feedbackTabEdge, FEEDBACK_TAB_STRIP } from './menuStage';

/**
 * The frame round the game: what fills the window the whole-pixel stage leaves
 * over (the captain, 26 Nov 2026: keep the pixels crisp and "fill the leftover
 * edges with a frame in the game's own style so it looks deliberate rather
 * than stretched").
 *
 * The game is drawn at a whole-number zoom (`stage.ts`), so a window almost
 * never fits it exactly, and what is left used to be flat black. Now it is a
 * bezel, drawn in the game's own pixel - every line and stud is a whole number
 * of game pixels at the zoom the game is drawn at, so it sits on the game's
 * grid:
 *
 * - **the field**: ink, with a faint dot every `LATTICE_PITCH` game pixels,
 *   counted from the game's corner so the dots meet the ring without a cut row;
 * - **the ring**: ink, Poke Ball red, ink, a game pixel each, round the game
 *   *and* the controls bar under it, so the bar is part of the screen;
 * - **the studs**: a gold stud on each of the ring's corners where the window
 *   has room for one all round;
 * - **the belt**: on a margin wide enough, the Poke Ball's own belt through the
 *   field at the game's middle with the ball's button on it - the round-3 look
 *   is "a Poke Ball, opened", and the game is what it opened on.
 *
 * It is drawn once per resize - CSS backgrounds and shadows on two fixed
 * elements, nothing animated - and never over the game or its menus: the
 * field is behind the page, and everything else stands outside the screen.
 */

/** The dot lattice's pitch, in game pixels. */
export const LATTICE_PITCH = 4;
/** The ring's width, in game pixels: ink, red, ink. */
export const RING = 3;
/** A stud's size, in game pixels, ink outline included. */
export const STUD = 5;
/** The belt's button, in game pixels. */
export const BELT_BUTTON = 14;
/** The narrowest side margin, in game pixels, that is given the belt. */
export const BELT_MIN_SIDE = 24;
/** The FULL SCREEN button, in game pixels, when it stands in the frame. */
export const FRAME_BUTTON_MAX = 14;
/** The smallest it is ever drawn, in game pixels: any smaller is a target nobody hits. */
export const FRAME_BUTTON_MIN = 7;
/** The smallest it is ever drawn, in CSS pixels. */
export const FRAME_BUTTON_MIN_CSS = 32;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FrameInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** The game's canvas on the page, in CSS pixels. */
  readonly canvas: Box;
  /** The controls bar under the game, when it stands there; the ring goes round both. */
  readonly bar: Box | null;
  /** The controls bar stood up in the left margin, when it stands there: the belt's left button keeps clear of it. */
  readonly column?: Box | null;
  /** One game pixel in CSS pixels. */
  readonly unit: number;
  /** Whether the frame offers the FULL SCREEN button: the bar has none to offer, and the browser can. */
  readonly fullScreenButton: boolean;
  /**
   * Whether the studs and the belt may be drawn. Not round the touch pad,
   * whose buttons stand in the margins and are the ornament there.
   */
  readonly ornaments?: boolean;
}

export interface FrameLayout {
  /** One game pixel in CSS pixels. */
  readonly unit: number;
  /** What the ring goes round: the game, and the bar under it. */
  readonly screen: Box;
  /** Where the lattice is counted from: the game's corner. */
  readonly origin: { readonly x: number; readonly y: number };
  /** The four studs' top-left corners, or none. */
  readonly studs: readonly { readonly x: number; readonly y: number }[];
  /** The belt through each side margin at the game's middle, or null. */
  readonly belt: {
    readonly y: number;
    readonly height: number;
    readonly left: Box;
    readonly right: Box;
    /** The button on each half. */
    readonly buttons: readonly Box[];
  } | null;
  /** The FULL SCREEN button in the frame, when it has one. */
  readonly button: Box | null;
}

/** Lays the frame out round the game for a window. */
export function frameLayout(input: FrameInput): FrameLayout {
  const { viewportWidth, viewportHeight, canvas, bar, unit } = input;
  const width = Math.floor(viewportWidth);
  const height = Math.floor(viewportHeight);
  const bottom = bar ? Math.max(canvas.y + canvas.height, bar.y + bar.height) : canvas.y + canvas.height;
  const screen: Box = { x: canvas.x, y: canvas.y, width: canvas.width, height: bottom - canvas.y };
  const ring = RING * unit;
  // The room outside the ring on each side.
  const room = {
    left: screen.x - ring,
    right: width - (screen.x + screen.width) - ring,
    top: screen.y - ring,
    bottom: height - (screen.y + screen.height) - ring,
  };
  const tabOnRight = feedbackTabEdge(viewportWidth, viewportHeight) === 'right';
  const rightRoom = room.right - (tabOnRight ? FEEDBACK_TAB_STRIP : 0);

  const stud = STUD * unit;
  const ornaments = input.ornaments !== false;
  const studs = ornaments && Math.min(room.left, rightRoom, room.top, room.bottom) >= stud + unit
    ? [
        { x: screen.x - ring - stud + unit, y: screen.y - ring - stud + unit },
        { x: screen.x + screen.width + ring - unit, y: screen.y - ring - stud + unit },
        { x: screen.x - ring - stud + unit, y: screen.y + screen.height + ring - unit },
        { x: screen.x + screen.width + ring - unit, y: screen.y + screen.height + ring - unit },
      ]
    : [];

  // Beside a controls bar stood up on the left, the left half of the belt runs
  // under the bar and its button stands in what the bar leaves of the margin.
  const leftRoom = input.column ? Math.max(0, input.column.x - unit) : room.left;
  const side = Math.min(leftRoom, rightRoom) / unit;
  let belt: FrameLayout['belt'] = null;
  if (ornaments && side >= BELT_MIN_SIDE) {
    const beltHeight = 2 * unit;
    // On the game's own grid: a whole number of game pixels down from its corner.
    const y = canvas.y + Math.round(canvas.height / 2 / unit) * unit - unit;
    const left: Box = { x: 0, y, width: room.left, height: beltHeight };
    const right: Box = { x: screen.x + screen.width + ring, y, width: room.right, height: beltHeight };
    const button = BELT_BUTTON * unit;
    const buttonY = y + unit - button / 2;
    // Centred in what each margin has, in whole game pixels from the ring.
    const leftX = input.column
      ? Math.round((leftRoom - button) / 2 / unit) * unit
      : screen.x - ring - Math.round((room.left + button) / 2 / unit) * unit;
    const rightX = screen.x + screen.width + ring + Math.round((rightRoom - button) / 2 / unit) * unit;
    belt = {
      y,
      height: beltHeight,
      left,
      right,
      buttons: [
        { x: leftX, y: buttonY, width: button, height: button },
        { x: rightX, y: buttonY, width: button, height: button },
      ],
    };
  }

  let button: Box | null = null;
  if (input.fullScreenButton) {
    // Top right, outside the ring, a game pixel clear of it and of the window's edge.
    const across = Math.floor((room.right - 2 * unit) / unit);
    const down = Math.floor((screen.height + 2 * ring) / unit);
    const size = Math.min(FRAME_BUTTON_MAX, across, down);
    if (size >= FRAME_BUTTON_MIN && size * unit >= FRAME_BUTTON_MIN_CSS) {
      const px = size * unit;
      const x = screen.x + screen.width + ring + Math.round((room.right - px) / 2 / unit) * unit;
      button = { x, y: Math.max(screen.y, unit), width: px, height: px };
    }
  }

  return { unit, screen, origin: { x: canvas.x, y: canvas.y }, studs, belt, button };
}

export interface StageFrame {
  /** Draws the frame for a layout, or takes it away (null). */
  draw(layout: FrameLayout | null): void;
  /** Says again whether the page is full screen, on the button. */
  refresh(): void;
  destroy(): void;
}

export interface StageFrameHost {
  readonly document: Document;
  /** Whether the page is full screen now, for the button's glyph. */
  fullScreen(): boolean;
  /** Goes full screen, or comes back. */
  toggleFullScreen(): void;
}

const place = (element: HTMLElement, box: Box): void => {
  element.style.left = `${box.x}px`;
  element.style.top = `${box.y}px`;
  element.style.width = `${box.width}px`;
  element.style.height = `${box.height}px`;
};

/**
 * The frame's two elements: the field behind the page (lattice, ring, studs,
 * belt; it takes no pointer), and the FULL SCREEN button over it, where the
 * frame has one.
 */
export function installStageFrame(host: StageFrameHost): StageFrame {
  const { document } = host;
  const field = document.createElement('div');
  field.className = 'stage-frame';
  field.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('div');
  ring.className = 'stage-frame-ring';
  field.append(ring);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'stage-frame-full';
  button.tabIndex = -1;
  button.hidden = true;
  button.innerHTML = '<span class="cb-glyph"></span>';
  // Never take focus: SPACE and ENTER are the game's.
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => host.toggleFullScreen());
  document.body.prepend(field);
  document.body.append(button);

  let last: FrameLayout | null = null;
  const drawButton = (): void => {
    const box = last?.button ?? null;
    button.hidden = box === null;
    if (!box) {
      return;
    }
    place(button, box);
    const on = host.fullScreen();
    const label = on ? 'Leave full screen (ALT ENTER)' : 'Full screen (ALT ENTER)';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(on));
    button.classList.toggle('is-on', on);
    const glyph = button.firstElementChild;
    glyph?.classList.toggle('cb-shrink', on);
    glyph?.classList.toggle('cb-expand', !on);
  };

  return {
    draw(layout) {
      last = layout;
      field.hidden = layout === null;
      drawButton();
      if (!layout) {
        return;
      }
      const u = layout.unit;
      field.style.setProperty('--fu', `${u}px`);
      field.style.setProperty('--fx', `${layout.origin.x}px`);
      field.style.setProperty('--fy', `${layout.origin.y}px`);
      place(ring, layout.screen);
      // Studs and the belt are few and rebuilt only on a resize.
      for (const old of field.querySelectorAll('.stage-frame-stud, .stage-frame-belt, .stage-frame-knob')) {
        old.remove();
      }
      for (const stud of layout.studs) {
        const element = document.createElement('i');
        element.className = 'stage-frame-stud';
        place(element, { x: stud.x, y: stud.y, width: STUD * u, height: STUD * u });
        field.append(element);
      }
      if (layout.belt) {
        for (const half of [layout.belt.left, layout.belt.right]) {
          const element = document.createElement('i');
          element.className = 'stage-frame-belt';
          place(element, half);
          field.append(element);
        }
        for (const knob of layout.belt.buttons) {
          const element = document.createElement('i');
          element.className = 'stage-frame-knob';
          place(element, knob);
          field.append(element);
        }
      }
    },
    refresh: drawButton,
    destroy() {
      field.remove();
      button.remove();
    },
  };
}
