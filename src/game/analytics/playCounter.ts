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
 * does every build that is not the published game at its published address -
 * a local server, a test mode build, the test suite, a copy anywhere else -
 * so nobody's playtesting is counted.
 *
 * Nor is a machine's. The first night of counting was six "players", every one
 * a link scanner: page loads from cloud addresses in made-up browsers, and a
 * headless Chrome, each staying the fifteen seconds before the first batch and
 * never touching anything. So an automated browser (`navigator.webdriver`, a
 * headless or crawler user agent) sends nothing, and no page sends anything at
 * all - not even that it was opened - until a person has pressed a key or
 * clicked.
 *
 * And a tester is counted apart: a browser marked as the owner's, or as a
 * friend's helping test (`?tester` once on the address, or the switch on the
 * STATS page), says so with every batch, and the STATS page's headline numbers
 * are real players only. The mark is one word in this browser's own storage,
 * never a cookie.
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
const TESTER_KEY = 'escape-from-pallet-town.play-counter.tester';

/** Where the game is published: the one address whose play is counted. */
export const PUBLISHED_HOST = 'ollysalanson.github.io';
export const PUBLISHED_PATH = '/escape-from-pallet-town-web/';
/** The link that marks a browser as a tester's, to open once on it or send to a friend helping test. */
export const TESTER_LINK = `https://${PUBLISHED_HOST}${PUBLISHED_PATH}?tester`;

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
  readonly pathname: string;
  /** Whether the browser is driven by a program (`isAutomatedBrowser`). */
  readonly automated: boolean;
  /** `navigator.doNotTrack`, which some browsers spell `window.doNotTrack`. */
  readonly doNotTrack: string | null | undefined;
  /** `navigator.globalPrivacyControl`. */
  readonly globalPrivacyControl: boolean | undefined;
}

/**
 * What a program driving a browser gives away: WebDriver sets
 * `navigator.webdriver` (Playwright, Puppeteer and Selenium all do), a
 * headless Chrome names itself, and crawlers, previewers and page checkers
 * say what they are. A scanner that hides all of it is still caught by the
 * counter waiting for a person's key or click.
 */
const AUTOMATED_AGENT =
  /headless|(?<!cu)bot(?:\b|\/)|crawl|spider|slurp|preview|lighthouse|pagespeed|phantomjs|puppeteer|playwright|selenium|webdriver|electron|python|curl|wget|java\/|go-http|node-fetch|axios/i;

export function isAutomatedBrowser(browser: { readonly webdriver?: boolean; readonly userAgent?: string }): boolean {
  if (browser.webdriver === true) {
    return true;
  }
  const agent = browser.userAgent ?? '';
  return !agent.startsWith('Mozilla/') || AUTOMATED_AGENT.test(agent);
}

/**
 * Whether to count at all: only the published game at its published address,
 * never a browser a program is driving, and never one that has asked not to be
 * tracked.
 */
export function shouldCount(world: CountingWorld): boolean {
  if (!world.production || world.testMode || world.automated) {
    return false;
  }
  if (world.hostname !== PUBLISHED_HOST || !world.pathname.startsWith(PUBLISHED_PATH)) {
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
  readonly tester: boolean;
}, keepalive: boolean) => Promise<void>;

/** The things a counter reads from the page, so it can be tested without one. */
export interface CounterHost {
  readonly now: () => number;
  readonly visible: () => boolean;
  readonly online: () => boolean;
  readonly visitorId: () => string;
  /** Whether this browser is marked as a tester's, asked as each batch goes so a mark counts at once. */
  readonly tester: () => boolean;
  readonly build: string;
  readonly send: SendBatch;
}

/**
 * The counter: a queue of moments and a clock of time played, sent in batches.
 * Time counts only while the page is on screen and somebody has pressed a key
 * or clicked in the last five minutes, so a tab left open overnight is not a
 * night of play. Nothing goes at all until the first key or click: a page
 * nobody touched was opened by a machine, or by nobody who played.
 */
export class PlayCounter {
  private queue: PlayMoment[] = [];
  private playedMs = 0;
  private lastMark: number;
  private lastInput = Number.NEGATIVE_INFINITY;

  private readonly host: CounterHost;

  public constructor(host: CounterHost) {
    this.host = host;
    this.lastMark = host.now();
  }

  /** Whether a person has pressed a key or clicked on this page yet. */
  public heardFrom(): boolean {
    return this.lastInput > Number.NEGATIVE_INFINITY;
  }

  public count(moment: PlayMoment): void {
    if (!this.heardFrom() && this.queue.length >= PLAY_BATCH_LIMIT) {
      return;
    }
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
   * count is worth less than a game that never waits on one. Until somebody
   * has touched the page it is kept, and sent with the first batch after.
   */
  public flush(keepalive: boolean): void {
    this.settleTime();
    if (!this.heardFrom()) {
      return;
    }
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
          .send({ visitor_id: this.host.visitorId(), build: this.host.build, events, tester: this.host.tester() }, keepalive)
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

type MarkStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Whether this browser is marked as a tester's. */
export function isTesterBrowser(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return storage?.getItem(TESTER_KEY) === 'yes';
  } catch {
    return false;
  }
}

/** Whether this browser has ever been marked either way, so the owner's first look at STATS can mark it. */
export function testerMarkChosen(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    const kept = storage?.getItem(TESTER_KEY);
    return kept === 'yes' || kept === 'no';
  } catch {
    return false;
  }
}

/** Marks this browser as a tester's, or as a real player's. Returns whether the mark was kept. */
export function markTesterBrowser(storage: MarkStorage | undefined, tester: boolean): boolean {
  try {
    if (!storage) {
      return false;
    }
    storage.setItem(TESTER_KEY, tester ? 'yes' : 'no');
    return isTesterBrowser(storage) === tester;
  } catch {
    return false;
  }
}

/**
 * What `?tester` on the address asks: `?tester` marks this browser as a
 * tester's, `?tester=off` (or `no`, `0`, `false`) unmarks it, and anything
 * else leaves it be.
 */
export function testerLinkAsks(search: string): boolean | undefined {
  const params = new URLSearchParams(search);
  if (!params.has('tester')) {
    return undefined;
  }
  return !['off', 'no', '0', 'false'].includes((params.get('tester') ?? '').toLowerCase());
}

/**
 * Follows a `?tester` link: marks the browser and takes the word off the
 * address, so a bookmark or a shared link of the page afterwards does not
 * carry it. Returns what was asked, if anything.
 */
export function followTesterLink(target: Window = window): boolean | undefined {
  const asks = testerLinkAsks(target.location.search);
  if (asks === undefined) {
    return undefined;
  }
  let storage: Storage | undefined;
  try {
    storage = target.localStorage;
  } catch {
    storage = undefined;
  }
  markTesterBrowser(storage, asks);
  try {
    const url = new URL(target.location.href);
    url.searchParams.delete('tester');
    target.history.replaceState(target.history.state, '', url.toString());
  } catch {
    // The address keeps the word; the mark is made either way.
  }
  return asks;
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
    tester: () => isTesterBrowser(storage),
    build: buildDetail(BUILD_VERSION),
    send: postBatch,
  });
  counter = made;
  made.count({ kind: 'visit' });
  // Only a person's own key or click: never one a script made up.
  const touched = (event: Event): void => {
    if (event.isTrusted) {
      made.touched();
    }
  };
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
