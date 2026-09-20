import {
  canSeat,
  parsePieceRef,
  pieceAt,
  pieceRefKey,
  placementOf,
  seatPiece,
  shapeOf,
  turnPiece,
  type GridArrangement,
  type GridPacking,
  type GridPieceRef,
} from '../items';

/**
 * Picking a piece up, carrying it and putting it down - for a pointer and for
 * the arrow keys alike.
 *
 * The rules of *where* a piece may go are `items/gridArrange.ts` and are asked
 * here rather than restated; what this owns is the other half, which is a
 * cursor: what is being carried, where it is hovering, and whether the square
 * under it would take it. Both are needed because the answer the player wants -
 * "will this go here" - has to be on screen before they let go, and a refusal
 * they only meet afterwards is the class of thing this whole change exists to
 * stop.
 *
 * Everything is operable with no mouse. A block is a button, so the cursor
 * reaches it the way it reaches every other control; ENTER takes it and puts it
 * down, the arrow keys carry it a square at a time, R turns it and ESC puts it
 * back. The pointer does the same thing by dragging, and a drag and a click are
 * the same gesture with a threshold between them, so click-carry-click works as
 * well as press-drag-release.
 */

/** What the player is carrying, and where over the container they are holding it. */
export interface HeldPiece {
  readonly ref: GridPieceRef;
  readonly x: number;
  readonly y: number;
  readonly rotated: boolean;
  /** Which container it came out of, so two grids on one screen never mix. */
  readonly owner: string;
}

/** What a key means while a container is being arranged. */
export type ArrangeIntent =
  | { readonly kind: 'move'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'turn' }
  | { readonly kind: 'drop' }
  | { readonly kind: 'cancel' };

const STEPS: Readonly<Record<string, { readonly dx: number; readonly dy: number }>> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

/**
 * What one key press means.
 *
 * R turns a piece whether it is being carried or merely pointed at, because
 * turning something where it stands is the commonest single move there is and
 * making it a two-step gesture would be the screen charging for its own
 * cleverness. A key with a modifier belongs to the browser and is never read.
 */
export function arrangeIntentFor(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  holding: boolean,
): ArrangeIntent | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (event.key.toLowerCase() === 'r') {
    return { kind: 'turn' };
  }
  if (!holding) {
    return null;
  }
  const step = STEPS[event.key];
  if (step) {
    return { kind: 'move', ...step };
  }
  if (event.key === 'Enter' || event.key === ' ') {
    return { kind: 'drop' };
  }
  if (event.key === 'Escape') {
    return { kind: 'cancel' };
  }
  return null;
}

/** What the screen has to do for the player to see the answer. */
export interface GridArrangingHost {
  /** The container as it stands. Asked again every time, never cached. */
  packing(name: string): GridPacking | null;
  /** Take this arrangement and draw the container again. */
  commit(name: string, arrangement: GridArrangement): void;
  /** Draw the container again with nothing changed: the ghost has moved. */
  redraw(): void;
  /** Say something on the screen's own status line. */
  say(message: string): void;
  /** A sound for a deed that landed, and one for a deed that did not. */
  sound(name: 'take' | 'place' | 'refused'): void;
}

/** How far a pointer must travel before a press counts as a drag. */
const DRAG_SLOP_PX = 4;

export class GridArranging {
  private readonly host: GridArrangingHost;
  private heldPiece: HeldPiece | undefined;
  /** Which square of the piece the pointer took hold of, so it does not jump. */
  private grabX = 0;
  private grabY = 0;
  private pressedAt: { readonly x: number; readonly y: number } | undefined;
  /** The square the press landed on, so a drag takes the piece that was under it. */
  private pressedCell: { readonly x: number; readonly y: number } | undefined;
  private dragging = false;
  /** Set when a drag put a piece down, so the click that follows is not a second deed. */
  private swallowClick = false;

  public constructor(host: GridArrangingHost) {
    this.host = host;
  }

  public get held(): HeldPiece | undefined {
    return this.heldPiece;
  }

  /** Nothing is being carried: called when a screen changes out from under one. */
  public release(): void {
    this.heldPiece = undefined;
    this.pressedAt = undefined;
    this.dragging = false;
  }

  /** What the container should draw as the ghost, if this is the one being used. */
  public ghostFor(name: string): {
    readonly key: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly valid: boolean;
  } | undefined {
    const held = this.heldPiece;
    if (!held || held.owner !== name) {
      return undefined;
    }
    const packing = this.host.packing(name);
    const shape = packing ? shapeOf(packing, held.ref, held.rotated) : null;
    if (!packing || !shape) {
      return undefined;
    }
    return {
      key: pieceRefKey(held.ref),
      x: held.x,
      y: held.y,
      width: shape.width,
      height: shape.height,
      valid: canSeat(packing, held.ref, held.x, held.y, held.rotated),
    };
  }

  /** Wires every arrangeable container in a freshly rendered screen. */
  public attach(root: ParentNode): void {
    root.querySelectorAll<HTMLElement>('[data-grid]').forEach((grid) => {
      grid.addEventListener('pointerdown', (event) => this.onPointerDown(grid, event));
      grid.addEventListener('pointermove', (event) => this.onPointerMove(grid, event));
      grid.addEventListener('pointerup', () => this.onPointerUp());
      grid.addEventListener('click', (event) => this.onClick(grid, event));
    });
  }

  /** @returns Whether the key was this controller's to read. */
  public handleKey(event: KeyboardEvent, focused: Element | null): boolean {
    const held = this.heldPiece;
    const intent = arrangeIntentFor(event, held !== undefined);
    if (!intent) {
      return false;
    }
    if (intent.kind === 'turn' && !held) {
      return this.turnFocused(focused);
    }
    if (!held) {
      return false;
    }
    if (intent.kind === 'cancel') {
      this.heldPiece = undefined;
      this.host.sound('refused');
      this.host.redraw();
      return true;
    }
    if (intent.kind === 'move') {
      this.moveTo(held.x + intent.dx, held.y + intent.dy);
      return true;
    }
    if (intent.kind === 'turn') {
      this.heldPiece = { ...held, rotated: !held.rotated };
      this.host.redraw();
      return true;
    }
    this.putDown();
    return true;
  }

  /** Turning a piece the cursor is merely resting on, with nothing carried. */
  private turnFocused(focused: Element | null): boolean {
    const button = focused instanceof HTMLElement ? focused.closest<HTMLElement>('[data-grid-piece]') : null;
    const ref = parsePieceRef(button?.dataset.gridPiece);
    const owner = button?.dataset.gridOwner;
    if (!ref || !owner) {
      return false;
    }
    const packing = this.host.packing(owner);
    if (!packing) {
      return false;
    }
    const turned = turnPiece(packing, ref);
    if (!turned) {
      this.host.sound('refused');
      this.host.say('No room to turn it there. Pick it up and move it first.');
      this.host.redraw();
      return true;
    }
    this.host.sound('place');
    this.host.commit(owner, turned.arrangement);
    return true;
  }

  private onPointerDown(grid: HTMLElement, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    // A block's icon is an `<img>`, and pressing on one starts the browser's own
    // image drag, which swallows every mouse event until it ends - the piece
    // was picked up and then never heard of again. Preventing the default stops
    // that; the focus it would also have moved is taken by hand, because the
    // cursor has to end up on the block the player is holding.
    event.preventDefault();
    (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-grid-piece]')?.focus();
    this.pressedAt = { x: event.clientX, y: event.clientY };
    this.dragging = false;
    const held = this.heldPiece;
    if (held) {
      return;
    }
    const cell = cellAt(grid, event.clientX, event.clientY);
    if (!cell) {
      return;
    }
    // The take waits for the pointer to move: a press that does not is a click,
    // and a click is the keyboard's gesture too, so both go through `onClick`.
    this.pressedCell = cell;
  }

  private onPointerMove(grid: HTMLElement, event: PointerEvent): void {
    const start = this.pressedAt;
    if (start && !this.dragging) {
      const far =
        Math.abs(event.clientX - start.x) > DRAG_SLOP_PX ||
        Math.abs(event.clientY - start.y) > DRAG_SLOP_PX;
      if (!far) {
        return;
      }
      this.dragging = true;
      if (!this.heldPiece && this.pressedCell) {
        this.take(grid, this.pressedCell.x, this.pressedCell.y, grid);
      }
    }
    const held = this.heldPiece;
    if (!held || held.owner !== gridName(grid)) {
      return;
    }
    const cell = cellAt(grid, event.clientX, event.clientY);
    if (!cell) {
      return;
    }
    this.hoverTo(grid, cell.x - this.grabX, cell.y - this.grabY);
  }

  private onPointerUp(): void {
    const dragged = this.dragging;
    this.pressedAt = undefined;
    this.pressedCell = undefined;
    this.dragging = false;
    if (dragged && this.heldPiece) {
      this.swallowClick = true;
      this.putDown();
    }
  }

  private onClick(grid: HTMLElement, event: MouseEvent): void {
    if (this.swallowClick) {
      this.swallowClick = false;
      return;
    }
    const name = gridName(grid);
    if (this.heldPiece) {
      if (this.heldPiece.owner !== name) {
        return;
      }
      this.putDown();
      return;
    }
    // `detail` is zero when the key that activated the button did it, so the
    // piece is the one the cursor was on rather than one under a pointer.
    const button =
      event.detail === 0
        ? (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-grid-piece]')
        : null;
    if (button) {
      const ref = parsePieceRef(button.dataset.gridPiece);
      const packing = ref ? this.host.packing(name) : null;
      const placement = ref && packing ? placementOf(packing, ref) : null;
      if (ref && placement) {
        this.takeRef(name, ref, placement.x, placement.y, placement.rotated, 0, 0);
      }
      return;
    }
    const cell = cellAt(grid, event.clientX, event.clientY);
    if (cell) {
      this.take(grid, cell.x, cell.y);
    }
  }

  private take(grid: HTMLElement, x: number, y: number, live?: HTMLElement): void {
    const name = gridName(grid);
    const packing = this.host.packing(name);
    if (!packing) {
      return;
    }
    const ref = pieceAt(packing, x, y);
    const placement = ref ? placementOf(packing, ref) : null;
    if (!ref || !placement) {
      return;
    }
    this.takeRef(name, ref, placement.x, placement.y, placement.rotated, x - placement.x, y - placement.y, live);
  }

  private takeRef(
    owner: string,
    ref: GridPieceRef,
    x: number,
    y: number,
    rotated: boolean,
    grabX: number,
    grabY: number,
    live?: HTMLElement,
  ): void {
    this.heldPiece = { ref, x, y, rotated, owner };
    this.grabX = grabX;
    this.grabY = grabY;
    this.host.sound('take');
    // A take that begins a drag may not rebuild the screen: the markup it would
    // replace is the element holding the pointer capture, so the rest of the
    // drag would arrive nowhere and the piece would be put down where it was
    // first grabbed. The ghost is therefore drawn into the live grid instead,
    // and the screen is rebuilt when the piece lands.
    if (live) {
      this.drawLiveGhost(live);
      return;
    }
    this.host.redraw();
  }

  /** Puts the carried piece's shadow into a grid that is already on screen. */
  private drawLiveGhost(grid: HTMLElement): void {
    const held = this.heldPiece;
    const packing = held ? this.host.packing(held.owner) : null;
    const shape = held && packing ? shapeOf(packing, held.ref, held.rotated) : null;
    const layer = grid.querySelector<HTMLElement>('.px-grid-blocks, .raid-grid-blocks');
    if (!held || !packing || !shape || !layer) {
      this.host.redraw();
      return;
    }
    const pixel = grid.classList.contains('px-grid');
    grid
      .querySelector(`[data-grid-piece="${cssEscape(pieceRefKey(held.ref))}"]`)
      ?.classList.add('is-carried');
    const ghost = grid.ownerDocument.createElement('span');
    ghost.className = pixel ? 'px-grid-ghost' : 'raid-grid-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.gridColumn = `${held.x + 1}/span ${shape.width}`;
    ghost.style.gridRow = `${held.y + 1}/span ${shape.height}`;
    layer.append(ghost);
  }

  /** Moves the carried piece by a whole square, keeping it over the container. */
  private moveTo(x: number, y: number): void {
    const held = this.heldPiece;
    const packing = held ? this.host.packing(held.owner) : null;
    const shape = held && packing ? shapeOf(packing, held.ref, held.rotated) : null;
    if (!held || !packing || !shape) {
      return;
    }
    const clampedX = clamp(x, 0, packing.size.width - shape.width);
    const clampedY = clamp(y, 0, packing.size.height - shape.height);
    if (clampedX === held.x && clampedY === held.y) {
      return;
    }
    this.heldPiece = { ...held, x: clampedX, y: clampedY };
    this.host.redraw();
  }

  /** The same, from a pointer: the ghost follows without a screen rebuild. */
  private hoverTo(grid: HTMLElement, x: number, y: number): void {
    const held = this.heldPiece;
    const packing = held ? this.host.packing(held.owner) : null;
    const shape = held && packing ? shapeOf(packing, held.ref, held.rotated) : null;
    if (!held || !packing || !shape) {
      return;
    }
    const clampedX = clamp(x, 0, packing.size.width - shape.width);
    const clampedY = clamp(y, 0, packing.size.height - shape.height);
    if (clampedX === held.x && clampedY === held.y) {
      return;
    }
    this.heldPiece = { ...held, x: clampedX, y: clampedY };
    // A pointer move is a frame's worth of work, not a screen's: rebuilding the
    // markup under a held pointer would drop the drag and cost a re-layout of
    // the whole lobby for a square of movement.
    const ghost = grid.querySelector<HTMLElement>('.px-grid-ghost, .raid-grid-ghost');
    if (!ghost) {
      this.host.redraw();
      return;
    }
    ghost.style.gridColumn = `${clampedX + 1}/span ${shape.width}`;
    ghost.style.gridRow = `${clampedY + 1}/span ${shape.height}`;
    ghost.classList.toggle('is-bad', !canSeat(packing, held.ref, clampedX, clampedY, held.rotated));
  }

  private putDown(): void {
    const held = this.heldPiece;
    const packing = held ? this.host.packing(held.owner) : null;
    if (!held || !packing) {
      return;
    }
    const arrangement = seatPiece(packing, held.ref, held.x, held.y, held.rotated);
    if (!arrangement) {
      this.host.sound('refused');
      this.host.say('Nothing else will fit there - something is already standing on it.');
      this.host.redraw();
      return;
    }
    const was = placementOf(packing, held.ref);
    const moved = !was || was.x !== held.x || was.y !== held.y || was.rotated !== held.rotated;
    this.heldPiece = undefined;
    this.host.sound(moved ? 'place' : 'take');
    this.host.commit(held.owner, arrangement);
  }
}

function gridName(grid: HTMLElement): string {
  return grid.dataset.grid ?? '';
}

/** A piece key inside an attribute selector. Written out rather than relying on
 * `CSS.escape`, which the suite's DOM does not have. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Which square of a container a point in the window is over.
 *
 * Measured off two of the drawn squares rather than computed from the stylesheet
 * so that a gap, a zoom step or a half-pixel of rounding cannot put the answer
 * one column out - the grid is drawn on whole game pixels and the browser is
 * the only thing that knows how big one is right now.
 */
export function cellAt(
  grid: HTMLElement,
  clientX: number,
  clientY: number,
): { readonly x: number; readonly y: number } | null {
  const cols = Number(grid.dataset.gridCols);
  const rows = Number(grid.dataset.gridRows);
  const squares = grid.querySelectorAll<HTMLElement>('.px-grid-cells > i, .raid-grid-cells > i');
  if (!cols || !rows || squares.length < cols * rows) {
    return null;
  }
  const first = squares[0].getBoundingClientRect();
  const pitchX = cols > 1 ? squares[1].getBoundingClientRect().left - first.left : first.width;
  const pitchY = rows > 1 ? squares[cols].getBoundingClientRect().top - first.top : first.height;
  if (pitchX <= 0 || pitchY <= 0) {
    return null;
  }
  return {
    x: clamp(Math.floor((clientX - first.left) / pitchX), 0, cols - 1),
    y: clamp(Math.floor((clientY - first.top) / pitchY), 0, rows - 1),
  };
}

