/**
 * Undo and redo for the map maker: a list of whole maps.
 *
 * A map file is small - a 128x128 map is 128 strings - and every edit already
 * makes a new one (`draft.ts`), so the history is the files themselves rather
 * than a list of operations that would each need an inverse.
 */
export class EditHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T;
  private readonly limit: number;

  public constructor(initial: T, limit = 200) {
    this.current = initial;
    this.limit = limit;
  }

  public get value(): T {
    return this.current;
  }

  public get canUndo(): boolean {
    return this.past.length > 0;
  }

  public get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Makes `next` the current value. The same value again is not an edit. */
  public push(next: T): void {
    if (next === this.current) {
      return;
    }
    this.past.push(this.current);
    if (this.past.length > this.limit) {
      this.past.shift();
    }
    this.current = next;
    this.future = [];
  }

  /** Replaces the current value without making an undo step: the middle of one stroke. */
  public replace(next: T): void {
    this.current = next;
  }

  public undo(): T {
    const previous = this.past.pop();
    if (previous !== undefined) {
      this.future.push(this.current);
      this.current = previous;
    }
    return this.current;
  }

  public redo(): T {
    const next = this.future.pop();
    if (next !== undefined) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.current;
  }

  /** Starts again from `value` with nothing to undo: another map was opened. */
  public reset(value: T): void {
    this.current = value;
    this.past = [];
    this.future = [];
  }
}
