/**
 * What resting the pointer on a control does to a pixel-ui screen.
 *
 * Every pixel-ui screen has one cursor, the thing OK will press, and the
 * pointer never moves it. It lights what it is over (CSS `:hover`, drawn
 * fainter than the cursor) and the help bar reads that control's own line
 * while it rests there - pointing is a question, and the answer is free - and
 * a screen whose card follows its cursor answers the pointed thing too
 * (`pointed`). The cursor moves only for a click, which a button takes focus
 * for on its own, or for the arrow keys. When the pointer leaves, the help bar
 * goes back to the control the cursor is on, because that is the one OK would
 * press.
 *
 * It began on the screen where a move is taught: the captain (2026-09-27) put
 * the cursor on one Pokemon, moved the mouse towards the button he meant to
 * press, and the cursor jumped to whichever Pokemon the pointer crossed. Every
 * other screen still let the pointer move the cursor until the navigation
 * audit (25 Nov 2026) found a pointer left resting on JUMP IN deciding what the
 * next Enter did, and Olly ruled that pointing only lights a thing, everywhere.
 *
 * DOM-light rather than Phaser-bound, so the rule is held in
 * `pointerPreview.test.ts` against plain objects rather than eyeballed.
 */

/** What the pointer may rest on: any control, including one that only explains itself. */
export const POINTABLE = 'button:not([disabled])';

/**
 * A run of controls the pointer crosses the gaps of. Crossing the pixel of
 * frame between two rows lands on the list itself, and reading that as "on
 * nothing" would flick the help bar back to the cursor's line and out again on
 * every row the pointer passed over.
 */
export const POINTER_GROUP = '.px-list, [data-describe-group]';

/** The slice of an element this rule asks about - enough to test without a browser. */
export interface PointerTarget {
  closest(selector: string): PointerTarget | null;
}

export interface PointerPreviewHooks<T extends PointerTarget> {
  /** Writes the help bar for this control, or for nothing. */
  readonly help: (control: T | null) => void;
  /**
   * The pointer has come to rest on `control`, or has left it (`null`: the
   * cursor's control answers again). For a screen whose card follows its
   * cursor, to answer the pointed thing the same way.
   */
  readonly pointed?: (control: T | null) => void;
  /** The control the cursor is on now. */
  readonly cursor: () => T | null;
}

export class PointerPreview<T extends PointerTarget> {
  /** The control the pointer is resting on, if it is resting on one. */
  private pointedAt: T | null = null;
  private readonly hooks: PointerPreviewHooks<T>;

  public constructor(hooks: PointerPreviewHooks<T>) {
    this.hooks = hooks;
  }

  public get pointed(): T | null {
    return this.pointedAt;
  }

  /** The pointer came to rest over `target` - a control, a gap, or nothing. */
  public moved(target: T | null): void {
    const control = (target?.closest(POINTABLE) ?? null) as T | null;
    if (control) {
      if (control !== this.pointedAt) {
        this.pointedAt = control;
        this.hooks.help(control);
        this.hooks.pointed?.(control);
      }
      return;
    }
    if (this.pointedAt && target?.closest(POINTER_GROUP)) {
      return;
    }
    this.left();
  }

  /** The pointer left the screen, or went somewhere nothing answers for. */
  public left(): void {
    if (this.pointedAt === null) {
      return;
    }
    this.pointedAt = null;
    this.hooks.help(this.hooks.cursor());
    this.hooks.pointed?.(null);
  }

  /**
   * The cursor moved - an arrow key or a click. The help bar follows it rather
   * than the pointer, because the most recent thing the player did is the one
   * they are reading about; the pointer takes it back the next time it moves
   * onto a control.
   */
  public cursorMoved(): void {
    this.pointedAt = null;
  }
}
