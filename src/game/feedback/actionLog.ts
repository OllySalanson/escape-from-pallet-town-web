/**
 * The last few things the player did, kept so a feedback message can say how
 * they got to where they are.
 *
 * It is a ring of short lines, never a recording: which screen opened, which
 * button was pressed, which fight started, which place they walked into, and
 * any error the page threw. Nothing typed is ever in it - the panel's own box
 * included - because the only text it copies is the game's own, off a button.
 * It lives in memory only and is gone on reload; a message carries a copy.
 */
export interface LoggedAction {
  /** Seconds since the page loaded, to one decimal. */
  readonly at: number;
  readonly what: string;
}

/** How many lines a message carries. */
export const ACTION_LOG_SIZE = 30;

/** The longest a single line may be, so an error with a stack cannot crowd out the rest. */
export const ACTION_LINE_LENGTH = 120;

export class ActionLog {
  private readonly lines: LoggedAction[] = [];
  private readonly clock: () => number;
  private readonly size: number;

  public constructor(clock: () => number, size = ACTION_LOG_SIZE) {
    this.clock = clock;
    this.size = size;
  }

  public record(what: string): void {
    const line = what.replace(/\s+/g, ' ').trim().slice(0, ACTION_LINE_LENGTH);
    if (!line) {
      return;
    }
    // A key held on a button, or a scene restarted twice, is one thing that
    // happened, not thirty: the ring would otherwise fill with one line.
    const last = this.lines[this.lines.length - 1];
    if (last && last.what === line) {
      return;
    }
    this.lines.push({ at: Math.round(this.clock() / 100) / 10, what: line });
    if (this.lines.length > this.size) {
      this.lines.splice(0, this.lines.length - this.size);
    }
  }

  /** Oldest first. A copy: what a message holds cannot change after it is taken. */
  public recent(): readonly LoggedAction[] {
    return this.lines.map((line) => ({ ...line }));
  }
}

const sinceLoad = (): number => (typeof performance === 'undefined' ? 0 : performance.now());

/** The game's one log. */
export const actionLog = new ActionLog(sinceLoad);

/** Records a line in the game's log. Scenes call this for what only they can see. */
export function recordAction(what: string): void {
  actionLog.record(what);
}

/**
 * What a pressed button says, for the log: its visible words, squeezed onto
 * one line. A button's `data-help` is the longer explanation and is left out.
 */
export function buttonWords(button: { readonly textContent: string | null }): string {
  return (button.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** A thrown error or a rejected promise, as one line. */
export function errorLine(reason: unknown, where?: { file?: string; line?: number }): string {
  const message =
    reason instanceof Error ? `${reason.name}: ${reason.message}` : typeof reason === 'string' ? reason : String(reason);
  const file = where?.file ? ` (${where.file.split('/').pop()}${where.line ? `:${where.line}` : ''})` : '';
  return `ERROR ${message}${file}`;
}
