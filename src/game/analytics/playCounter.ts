import { BUILD_VERSION } from '../feedback/buildInfo';
import { SUBMISSIONS_PUBLISHABLE_KEY, SUBMISSIONS_URL } from '../maker/submitConfig';

/**
 * Counting play, so the owner can see whether anyone plays the game at all.
 *
 * Nothing personal leaves the browser. A browser keeps one random id of its
 * own (never tied to a sign-in, a save or a name) and sends a handful of
 * counted moments - the game opened, a starter chosen, a raid started and how
 * it ended, the minutes it was played for, a map sent in, a Pallet Blocks game,
 * a walk into the harbour - with the build it is running. Every field is a word
 * from a short list or a number; the database refuses anything else
 * (`supabase/migrations/*_play_counts.sql`) and keeps only daily totals.
 *
 * It must never cost the game anything: it is sent signed out with a plain
 * `fetch` (no client library, no sign-in, no bot check), in batches, and a
 * batch that cannot go is dropped without a word. A browser that asks not to
 * be tracked (Do Not Track or Global Privacy Control) sends nothing, and so
 * does every build that is not the published game - a local server, a test
 * mode build, the test suite - so nobody's playtesting is counted.
 */

export type PlayMoment =
  | { readonly kind: 'visit' }
  | { readonly kind: 'harbour' }
  | { readonly kind: 'map-sent' }
  | { readonly kind: 'starter'; readonly detail: string }
  | { readonly kind: 'raid-start'; readonly detail: string }
  | { readonly kind: 'raid-end'; readonly detail: RaidEnding }
  | { readonly kind: 'blocks'; readonly detail: string }
  | { readonly kind: 'played'; readonly amount: number };

/** How a raid ended, in the words the stats page counts them by. */
export type RaidEnding = 'extracted' | 'wiped' | 'clock' | 'abandoned';

/** How a finished raid's report says it ended. */
export function raidEnding(report: { readonly outcome: string; readonly cause?: string }): RaidEnding {
  if (report.outcome === 'ESCAPED') {
    return 'extracted';
  }
  return report.cause === 'timer' ? 'clock' : 'wiped';
}

/** A moment as it is sent: the database's own three fields. */
export interface SentMoment {
  readonly kind: string;
  readonly detail?: string;
  readonly amount?: number;
}

/** The database's limits (`record_play`): fifty moments a batch, an hour of play a moment. */
export const PLAY_BATCH_LIMIT = 50;
export const PLAY_SECONDS_LIMIT = 3600;
/** What a raid's map is called on the wire: a shipped map's id, or `player` for any player's map. */
const MAP_DETAIL = /^[a-z0-9-]{1,40}$/;

/** How long after the last key or click play stops counting as play. */
export const IDLE_AFTER_MS = 5 * 60 * 1000;
/** How often a batch goes, and how soon the first one goes after the game opens. */
export const FLUSH_EVERY_MS = 60 * 1000;
export const FIRST_FLUSH_MS = 15 * 1000;

const VISITOR_KEY = 'escape-from-pallet-town.play-counter.visitor';

/** What a raid's map is counted as. A player's map is never named: its id is a player's words. */
export function mapDetail(mapId: string): string {
  if (mapId.startsWith('player-')) {
    return 'player';
  }
  return MAP_DETAIL.test(mapId) ? mapId : 'other';
}

/** The build, cut to what the database takes. */
export function buildDetail(version: string): string {
  const cleaned = version.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40);
  return cleaned.length > 0 ? cleaned : 'unknown';
}

/** A moment in the database's three fields. */
export function toSent(moment: PlayMoment): SentMoment {
  switch (moment.kind) {
    case 'played':
      return { kind: 'played', amount: moment.amount };
    case 'visit':
    case 'harbour':
    case 'map-sent':
      return { kind: moment.kind };
    default:
      return { kind: moment.kind, detail: moment.detail };
  }
}

/** Seconds of play as moments the database takes: whole seconds, an hour at most each. */
export function playedMoments(seconds: number): PlayMoment[] {
  const moments: PlayMoment[] = [];
  let left = Math.floor(seconds);
  while (left >= 1) {
    const amount = Math.min(left, PLAY_SECONDS_LIMIT);
    moments.push({ kind: 'played', amount });
    left -= amount;
  }
  return moments;
}

/** What the browser and the build say about whether to count anything. */
export interface CountingWorld {
  readonly production: boolean;
  readonly testMode: boolean;
  readonly hostname: string;
  /** `navigator.doNotTrack`, which some browsers spell `window.doNotTrack`. */
  readonly doNotTrack: string | null | undefined;
  /** `navigator.globalPrivacyControl`. */
  readonly globalPrivacyControl: boolean | undefined;
}

/**
 * Whether to count at all: only the published game, and never for a browser
 * that has asked not to be tracked.
 */
export function shouldCount(world: CountingWorld): boolean {
  if (!world.production || world.testMode) {
    return false;
  }
  if (world.hostname === 'localhost' || world.hostname === '127.0.0.1' || world.hostname === '[::1]' || world.hostname === '') {
    return false;
  }
  if (world.doNotTrack === '1' || world.doNotTrack === 'yes' || world.globalPrivacyControl === true) {
    return false;
  }
  return true;
}

/** Where a batch goes. A failure is the caller's to swallow. */
export type SendBatch = (batch: {
  readonly visitor_id: string;
  readonly build: string;
  readonly events: readonly SentMoment[];
}, keepalive: boolean) => Promise<void>;

/** The things a counter reads from the page, so it can be tested without one. */
export interface CounterHost {
  readonly now: () => number;
  readonly visible: () => boolean;
  readonly online: () => boolean;
  readonly visitorId: () => string;
  readonly build: string;
  readonly send: SendBatch;
}

/**
 * The counter: a queue of moments and a clock of time played, sent in batches.
 * Time counts only while the page is on screen and somebody has pressed a key
 * or clicked in the last five minutes, so a tab left open overnight is not a
 * night of play.
 */
export class PlayCounter {
  private queue: PlayMoment[] = [];
  private playedMs = 0;
  private lastMark: number;
  private lastInput: number;

  private readonly host: CounterHost;

  public constructor(host: CounterHost) {
    this.host = host;
    this.lastMark = host.now();
    this.lastInput = this.lastMark;
  }

  public count(moment: PlayMoment): void {
    this.queue.push(moment);
    if (this.queue.length >= PLAY_BATCH_LIMIT - 1) {
      this.flush(false);
    }
  }

  /** A key or a click: somebody is here. */
  public touched(): void {
    this.settleTime();
    this.lastInput = this.host.now();
  }

  /** Adds the time since it was last asked, if the page was being played. Call before the page is hidden or shown. */
  public settleTime(): void {
    const now = this.host.now();
    if (this.host.visible()) {
      const until = Math.min(now, this.lastInput + IDLE_AFTER_MS);
      this.playedMs += Math.max(0, until - this.lastMark);
    }
    this.lastMark = now;
  }

  /** What would go now, without sending it. */
  public pending(): readonly PlayMoment[] {
    return [...this.queue, ...playedMoments(this.playedMs / 1000)];
  }

  /**
   * Sends what is waiting. Offline, or if the send fails, it is dropped: a
   * count is worth less than a game that never waits on one.
   */
  public flush(keepalive: boolean): void {
    this.settleTime();
    const seconds = Math.floor(this.playedMs / 1000);
    this.playedMs -= seconds * 1000;
    const moments = [...this.queue, ...playedMoments(seconds)];
    this.queue = [];
    if (moments.length === 0 || !this.host.online()) {
      return;
    }
    for (let start = 0; start < moments.length; start += PLAY_BATCH_LIMIT) {
      const events = moments.slice(start, start + PLAY_BATCH_LIMIT).map(toSent);
      try {
        void this.host
          .send({ visitor_id: this.host.visitorId(), build: this.host.build, events }, keepalive)
          .catch(() => undefined);
      } catch {
        // Dropped, as above.
      }
    }
  }
}

/** This browser's own random id, kept in its storage; a fresh one each page if storage is shut. */
export function storedVisitorId(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, make: () => string): string {
  try {
    const kept = storage?.getItem(VISITOR_KEY);
    if (kept && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(kept)) {
      return kept;
    }
    const made = make();
    storage?.setItem(VISITOR_KEY, made);
    return made;
  } catch {
    return make();
  }
}

/** The batch, posted signed out to the game's own project. */
export const postBatch: SendBatch = async (batch, keepalive) => {
  await fetch(`${SUBMISSIONS_URL}/rest/v1/rpc/record_play`, {
    method: 'POST',
    keepalive,
    headers: {
      apikey: SUBMISSIONS_PUBLISHABLE_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(batch),
  });
};

let counter: PlayCounter | undefined;

/** Counts one moment, if this page counts at all. Safe to call from anywhere, any time. */
export function countPlay(moment: PlayMoment): void {
  try {
    counter?.count(moment);
  } catch {
    // Counting never breaks the game.
  }
}

/**
 * Starts counting for this page, if it should: one visit now, a batch a
 * minute, and whatever is left as the page is hidden or closed. Returns how to
 * stop.
 */
export function installPlayCounter(world: CountingWorld, target: Window = window): () => void {
  if (counter || !shouldCount(world)) {
    return () => undefined;
  }
  let visitor: string | undefined;
  let storage: Storage | undefined;
  try {
    storage = target.localStorage;
  } catch {
    storage = undefined;
  }
  const made = new PlayCounter({
    now: () => Date.now(),
    visible: () => target.document.visibilityState === 'visible',
    online: () => target.navigator.onLine !== false,
    visitorId: () => (visitor ??= storedVisitorId(storage, () => target.crypto.randomUUID())),
    build: buildDetail(BUILD_VERSION),
    send: postBatch,
  });
  counter = made;
  made.count({ kind: 'visit' });
  const touched = (): void => made.touched();
  const onVisibility = (): void => {
    made.settleTime();
    if (target.document.visibilityState === 'hidden') {
      made.flush(true);
    }
  };
  const onHide = (): void => made.flush(true);
  target.addEventListener('keydown', touched, { capture: true, passive: true });
  target.addEventListener('pointerdown', touched, { capture: true, passive: true });
  target.document.addEventListener('visibilitychange', onVisibility);
  target.addEventListener('pagehide', onHide);
  const first = target.setTimeout(() => made.flush(false), FIRST_FLUSH_MS);
  const every = target.setInterval(() => made.flush(false), FLUSH_EVERY_MS);
  return () => {
    target.clearTimeout(first);
    target.clearInterval(every);
    target.removeEventListener('keydown', touched, { capture: true });
    target.removeEventListener('pointerdown', touched, { capture: true });
    target.document.removeEventListener('visibilitychange', onVisibility);
    target.removeEventListener('pagehide', onHide);
    made.flush(true);
    counter = undefined;
  };
}
