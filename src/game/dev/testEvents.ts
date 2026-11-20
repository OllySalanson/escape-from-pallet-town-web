import type { RunProgress } from './runProgress';
import type { SceneDescription } from './testDescribe';

/**
 * The story so far, for a program playing the game in test mode: an
 * append-only log of the things a playtest report quotes - where the player
 * went, what was said, what was chosen, every fight and how it ended, every
 * raid and how it ended, every milestone and every page error.
 *
 * It is not told anything by the game. `watchForEvents` reads the same
 * per-scene descriptions `describe()` does, once a frame, and writes down what
 * changed - so no scene grows a second job, and a line said and dismissed
 * inside one `stepFrames` call is still in the log.
 */

export type TestEventKind =
  | 'scene'
  | 'moved'
  | 'talked'
  | 'chose'
  | 'battle-start'
  | 'battle-end'
  | 'extracted'
  | 'wiped'
  | 'milestone'
  | 'error';

export interface TestEvent {
  /** Counts from 1 and never repeats: `eventLog(since)` asks for everything after one. */
  readonly n: number;
  readonly kind: TestEventKind;
  /** Wall clock, ms since the epoch. */
  readonly at: number;
  /** Game frames stepped or run since the log began. */
  readonly frame: number;
  readonly [detail: string]: unknown;
}

/** How many events are kept. The oldest go first; `n` keeps counting. */
export const TEST_EVENT_LIMIT = 2000;

export class TestEventLog {
  private readonly kept: TestEvent[] = [];
  private next = 1;
  public frame = 0;
  private readonly limit: number;
  private readonly now: () => number;

  public constructor(limit = TEST_EVENT_LIMIT, now: () => number = Date.now) {
    this.limit = limit;
    this.now = now;
  }

  public record(kind: TestEventKind, detail: Readonly<Record<string, unknown>> = {}): TestEvent {
    const event: TestEvent = { ...detail, n: this.next, kind, at: this.now(), frame: this.frame };
    this.next += 1;
    this.kept.push(event);
    if (this.kept.length > this.limit) {
      this.kept.splice(0, this.kept.length - this.limit);
    }
    return event;
  }

  /** Every kept event numbered after `since`, oldest first. */
  public since(since = 0): readonly TestEvent[] {
    return this.kept.filter((event) => event.n > since);
  }

  /** The newest event's number, 0 before any. */
  public get last(): number {
    return this.next - 1;
  }
}

/** What the watcher reads each frame: the running scenes' own descriptions, and the stored save. */
export interface EventProbe {
  /** Running scene keys, bottom first. */
  readonly scenes: readonly string[];
  readonly describe: (key: string) => SceneDescription | undefined;
}

interface Dialogue {
  readonly text?: string;
  readonly speaker?: string | null;
  readonly complete?: boolean;
}

interface Choice {
  readonly question?: string;
  readonly options?: readonly string[];
  readonly selected?: number;
}

const placeOf = (key: string, scene: SceneDescription | undefined): string | null => {
  if (!scene) {
    return null;
  }
  const part = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
  return [key, part(scene.map), part(scene.place), part(scene.room)].filter(Boolean).join(' / ');
};

/**
 * Compares one frame with the last and records what changed. Pure apart from
 * the log it writes to, so the rules are tested without a game.
 */
export class EventWatcher {
  private scenes: readonly string[] = [];
  private places = new Map<string, string | null>();
  private said = new Map<string, string>();
  private choices = new Map<string, Choice>();
  private battle: SceneDescription | undefined;
  private result: string | null = null;
  private milestones: ReadonlySet<string> | null = null;
  private readonly log: TestEventLog;

  public constructor(log: TestEventLog) {
    this.log = log;
  }

  public observe(probe: EventProbe): void {
    const { log } = this;
    const before = new Set(this.scenes);
    const now = new Set(probe.scenes);
    for (const key of probe.scenes) {
      if (!before.has(key)) {
        log.record('scene', { scene: key, change: 'started' });
      }
    }
    for (const key of this.scenes) {
      if (!now.has(key)) {
        log.record('scene', { scene: key, change: 'stopped' });
      }
    }

    for (const key of probe.scenes) {
      const scene = probe.describe(key);
      this.place(key, scene);
      this.dialogue(key, scene);
      this.choice(key, scene);
    }
    for (const key of [...this.choices.keys()]) {
      if (!now.has(key)) {
        this.choices.delete(key);
      }
    }

    const battle = now.has('battle') ? probe.describe('battle') : undefined;
    if (battle && !this.battle) {
      log.record('battle-start', {
        foe: (battle.foe as { name?: string } | undefined)?.name ?? null,
        trainer: battle.trainer ?? null,
      });
    }
    if (!battle && this.battle) {
      log.record('battle-end', { outcome: this.battle.outcome ?? null, trainer: this.battle.trainer ?? null });
    }
    this.battle = battle;

    const extraction = now.has('extraction') ? probe.describe('extraction') : undefined;
    const outcome = typeof extraction?.outcome === 'string' ? extraction.outcome : null;
    if (outcome && outcome !== this.result) {
      log.record(outcome === 'WIPED' ? 'wiped' : 'extracted', {
        outcome,
        exit: extraction?.exit ?? null,
        contract: extraction?.contract ?? null,
      });
    }
    this.result = outcome;
    this.scenes = probe.scenes;
  }

  /** Records any milestone the save has reached since it was last read. */
  public progress(progress: RunProgress | null): void {
    if (!progress) {
      return;
    }
    const reached = new Set(progress.milestones.filter((each) => each.done).map((each) => each.id));
    if (this.milestones) {
      for (const milestone of progress.milestones) {
        if (milestone.done && !this.milestones.has(milestone.id)) {
          this.log.record('milestone', { milestone: milestone.id, label: milestone.label, finished: progress.finished });
        }
      }
    }
    this.milestones = reached;
  }

  /** A DOM control pressed, by pointer or by key. */
  public pressed(label: string, screen: string | null): void {
    this.log.record('chose', { label, screen, by: 'menu' });
  }

  private place(key: string, scene: SceneDescription | undefined): void {
    const place = placeOf(key, scene);
    if (key === 'world' || key === 'base') {
      if (place && this.places.get(key) !== place) {
        this.log.record('moved', { scene: key, place, tile: scene?.tile ?? null });
      }
      this.places.set(key, place);
    }
  }

  private dialogue(key: string, scene: SceneDescription | undefined): void {
    const dialogue = scene?.dialogue as Dialogue | null | undefined;
    const text = dialogue?.complete && dialogue.text ? dialogue.text : '';
    if (text && this.said.get(key) !== text) {
      this.log.record('talked', { scene: key, text, ...(dialogue?.speaker ? { speaker: dialogue.speaker } : {}) });
    }
    this.said.set(key, text);
  }

  private choice(key: string, scene: SceneDescription | undefined): void {
    const choice = scene?.choice as Choice | null | undefined;
    const last = this.choices.get(key);
    if (!choice?.options && last?.options) {
      const label = last.options[last.selected ?? 0];
      this.log.record('chose', { scene: key, label: label ?? null, options: last.options, by: 'prompt' });
    }
    if (choice?.options && !last?.options) {
      this.log.record('talked', { scene: key, text: choice.question ?? '', asks: choice.options });
    }
    if (choice?.options) {
      this.choices.set(key, choice);
    } else {
      this.choices.delete(key);
    }
  }
}
