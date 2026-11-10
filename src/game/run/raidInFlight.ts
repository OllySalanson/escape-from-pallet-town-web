import type { BagContents } from '../items/Bag';
import { itemAmountFor, itemNameFor } from '../items/items';
import { isWorldMapId, worldMapName } from '../worldMap';

/**
 * A raid that has been deployed and has not yet ended, as the save records it.
 *
 * The vault in storage is the pre-raid vault until a raid settles (see
 * `SaveManager.recordDefeatedBosses`), so a raid that never reaches an ending -
 * a tab closed, a reload, a crash - used to come back as though it had never
 * left: every Potion drunk refunded, every hurt Pokemon healed, the pack and
 * its contents back in the vault (playtest 11, B1). That made the clock, the
 * hunter and the wipe optional for anybody willing to close a tab.
 *
 * The captain's ruling: **an abandoned raid loses the pack and everything in
 * it, and the team comes home.** It is softer than a wipe, because a real crash
 * is not the player's fault, and it is never free. So this is written at the
 * moment of deployment, cleared by every ending a raid can reach
 * (`RAID_RESOLVED` in `SaveManager.ts`, which every banking and wipe path
 * writes), and anything still standing when the base next opens is settled by
 * `SaveManager.settleAbandonedRaid`.
 *
 * It is the loadout and nothing else, because that is all the pre-raid vault
 * has to be corrected for: what went into the pack, which part of that the
 * secure container held, and the pack it was carried in. Nothing found in the
 * raid was ever banked, so nothing found has to be taken away.
 */
export interface RaidInFlight {
  /** One raid, never two: what the live-elsewhere check matches on. */
  readonly id: string;
  readonly mapId: string;
  /** The pack worn into the raid, which is lost with it. */
  readonly packItemId?: string;
  /** Everything packed at base, the secured part included. */
  readonly items: BagContents;
  /** The part of `items` the secure container held, which comes home. */
  readonly secured: BagContents;
}

/** What an abandoned raid cost, for the base to say. */
export interface AbandonedRaid {
  readonly mapId: string;
  readonly packItemId?: string;
  /** What went with the pack, the pack itself not included. */
  readonly lost: readonly AmountOf[];
  /** What the secure container brought home. */
  readonly kept: readonly AmountOf[];
}

/** A quantity of an item, by id, as a save names one. */
export interface AmountOf {
  readonly itemId: string;
  readonly quantity: number;
}

export function createRaidInFlight(
  mapId: string,
  items: readonly AmountOf[],
  secured: readonly AmountOf[],
  packItemId: string | undefined,
  id: string = newRaidId(),
): RaidInFlight {
  return {
    id,
    mapId,
    ...(packItemId === undefined ? {} : { packItemId }),
    items: contentsOf(items),
    secured: contentsOf(secured),
  };
}

/**
 * Reads a marker back out of a save, or null for none. A marker the loader
 * cannot make sense of is read as none rather than refusing the save, because
 * a save is somebody's whole game and a half-written marker is one field of it.
 */
export function readRaidInFlight(
  value: unknown,
  readContents: (value: unknown) => BagContents,
): RaidInFlight | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0 || typeof record.mapId !== 'string') {
    return null;
  }
  return {
    id: record.id,
    mapId: record.mapId,
    ...(typeof record.packItemId === 'string' ? { packItemId: record.packItemId } : {}),
    items: readContents(record.items),
    secured: readContents(record.secured),
  };
}

/**
 * What the base says when it opens on a raid that was never finished. Plain,
 * in the order it happened: where, who came home, what did not.
 */
export function abandonedRaidLines(raid: AbandonedRaid): readonly string[] {
  const where = isWorldMapId(raid.mapId) ? ` at ${worldMapName(raid.mapId)}` : '';
  const pack =
    raid.packItemId === undefined ? 'your pack' : `your ${itemNameFor(raid.packItemId, 1)}`;
  return [
    `The game closed before your raid${where} was over.`,
    `Your team made it home, but ${pack} was left out there.`,
    ...listedOver('Lost with it: ', 'Also lost: ', raid.lost),
    ...listedOver('The secure container kept ', 'It also kept ', raid.kept),
  ];
}

/**
 * The longest line the base's dialogue box shows whole. It holds two lines of
 * about thirty-eight letters, so a list of everything a pack held is shared
 * out over boxes that each begin with their own words, rather than left to
 * the box to break mid-list.
 */
export const ABANDONED_LINE_LETTERS = 64;

function listedOver(first: string, next: string, stacks: readonly AmountOf[]): string[] {
  const words = stacks.map(({ itemId, quantity }) => itemAmountFor(itemId, quantity));
  const lines: string[][] = [];
  for (const word of words) {
    const line = lines[lines.length - 1];
    const lead = lines.length <= 1 ? first : next;
    if (line && `${lead}${inWords([...line, word])}.`.length <= ABANDONED_LINE_LETTERS) {
      line.push(word);
    } else {
      lines.push([word]);
    }
  }
  return lines.map((line, index) => `${index === 0 ? first : next}${inWords(line)}.`);
}

function inWords(words: readonly string[]): string {
  return words.length <= 1
    ? (words[0] ?? '')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function contentsOf(stacks: readonly AmountOf[]): BagContents {
  const contents: Record<string, number> = {};
  for (const { itemId, quantity } of stacks) {
    if (Number.isInteger(quantity) && quantity > 0) {
      contents[itemId] = (contents[itemId] ?? 0) + quantity;
    }
  }
  return contents;
}

function newRaidId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000000).toString(36)}`;
}

/** Where a live raid's pulse is kept: beside the save, never inside it. */
export const RAID_PULSE_KEY = 'escape-from-pallet-town.raid-pulse';
/** How often a live raid says so. */
export const RAID_PULSE_EVERY_MS = 5_000;
/**
 * How long a pulse is believed. A hidden tab's timers are throttled to once a
 * minute by Chromium, so anything shorter would settle a raid that is only in a
 * background tab - and a hidden tab's raid is not running anyway, because the
 * game loop stops with the page's animation frames.
 */
export const RAID_PULSE_STALE_MS = 90_000;

export interface RaidPulse {
  readonly raidId: string;
  readonly tab: string;
  readonly at: number;
  /**
   * The page that wrote it holds the raid's Web Lock (`raidLockName`), so
   * whether that page is still there can be asked of the browser rather than
   * read off the pulse's age. A pulse without it - the lock not granted yet,
   * a browser without Web Locks, a page from before there was one - is only
   * ever believed until it goes stale.
   */
  readonly locked?: true;
}

interface PulseStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The part of the browser's Web Locks API (`navigator.locks`) the heartbeat
 * uses. A lock is held for as long as the page that asked for it is alive,
 * and the browser lets go of it the moment the page goes - closed, reloaded or
 * crashed - which is the one question a pulse can only answer by waiting.
 */
export interface RaidLocks {
  request(name: string, callback: (lock: unknown) => Promise<void>): Promise<unknown>;
  query(): Promise<{ readonly held?: readonly { readonly name?: string }[] }>;
}

/** The lock a page playing a raid holds for the length of it. */
export function raidLockName(raidId: string): string {
  return `escape-from-pallet-town.raid.${raidId}`;
}

/**
 * Whether a raid is being played right now in another tab, which is the one
 * thing that must stop the base settling it: two tabs share one save, and a
 * second tab opened on the title must not end the raid the first is in.
 *
 * Only a fresh pulse from a *different* page counts. A reload or a closed tab
 * says so on its way out (`pagehide`), so the raid it left is settled at once,
 * and a crash leaves a pulse that goes stale. A page is named for its own life
 * and never in session storage: a duplicated tab inherits that, and took the
 * raid still being played in the tab it was copied from for its own reload.
 */
export function raidLiveElsewhere(
  pulse: RaidPulse | null,
  raidId: string,
  tab: string,
  now: number,
): boolean {
  return (
    pulse !== null &&
    pulse.raidId === raidId &&
    pulse.tab !== tab &&
    now - pulse.at >= 0 &&
    now - pulse.at < RAID_PULSE_STALE_MS
  );
}

/**
 * This page's side of the pulse: started when it deploys a raid, stopped when
 * the base next opens (every raid ending comes home to the base).
 *
 * The page also holds the raid's Web Lock while it lasts. A crash leaves a
 * pulse that looks live for a minute and a half, and the rim used to refuse to
 * jump all that time with "Finish it there first" when there was no other
 * window (the raids bug hunt of 9 Nov 2026, fault 5); the lock lets
 * `stillLiveElsewhere` ask the browser whether the page is still there.
 */
export class RaidHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;
  private raidId: string | null = null;
  private tabId: string | null = null;
  private listening = false;
  /** Whether this page holds the lock for the raid it is playing. */
  private locked = false;
  /** Lets go of that lock. */
  private releaseLock: (() => void) | null = null;
  /** Which `start` a granted lock belongs to, so one granted after a `stop` is let go at once. */
  private starts = 0;
  private readonly local: () => PulseStorage | null;
  private readonly now: () => number;
  private readonly locks: () => RaidLocks | null;

  public constructor(
    local: () => PulseStorage | null,
    now: () => number = () => Date.now(),
    locks: () => RaidLocks | null = browserLocks,
  ) {
    this.local = local;
    this.now = now;
    this.locks = locks;
  }

  /** This page's name, made once and kept for the life of the page. */
  public tab(): string {
    this.tabId ??= newRaidId();
    return this.tabId;
  }

  public start(raidId: string): void {
    this.stop();
    this.raidId = raidId;
    this.beat();
    this.timer = setInterval(() => this.beat(), RAID_PULSE_EVERY_MS);
    this.holdLock(raidId);
    if (!this.listening && typeof window !== 'undefined') {
      this.listening = true;
      // Leaving the page is not playing the raid: the pulse goes with it, so
      // the tab reopened a second later settles the raid instead of waiting.
      window.addEventListener('pagehide', () => this.forget());
      window.addEventListener('pageshow', () => {
        if (this.raidId !== null) {
          this.beat();
        }
      });
    }
  }

  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.forget();
    this.raidId = null;
    this.starts += 1;
    this.locked = false;
    this.releaseLock?.();
    this.releaseLock = null;
  }

  /** Whether `raidId` is being played in some other tab right now, by its pulse. */
  public liveElsewhere(raidId: string): boolean {
    return raidLiveElsewhere(this.read(), raidId, this.tab(), this.now());
  }

  /**
   * `liveElsewhere`, asked of the browser as well as of the pulse: a pulse
   * whose page held the raid's lock, and nobody holds it now, was left by a
   * page that is gone. That pulse is taken away, so the raid is settled as
   * abandoned at once rather than once it goes stale. Without Web Locks, or
   * for a pulse whose page never held one, the pulse is all there is to go on.
   */
  public async stillLiveElsewhere(raidId: string): Promise<boolean> {
    const pulse = this.read();
    if (pulse === null || !raidLiveElsewhere(pulse, raidId, this.tab(), this.now())) {
      return false;
    }
    const locks = this.locks();
    if (pulse.locked !== true || locks === null) {
      return true;
    }
    try {
      const { held = [] } = await locks.query();
      if (held.some((lock) => lock.name === raidLockName(raidId))) {
        return true;
      }
    } catch {
      return true;
    }
    const still = this.read();
    if (still !== null && still.raidId === pulse.raidId && still.tab === pulse.tab) {
      try {
        this.local()?.removeItem(RAID_PULSE_KEY);
      } catch {
        // Nothing to take away.
      }
    }
    return false;
  }

  /** Asks for the raid's lock, and keeps it until `stop`. */
  private holdLock(raidId: string): void {
    const locks = this.locks();
    if (locks === null) {
      return;
    }
    const start = this.starts;
    const released = new Promise<void>((resolve) => {
      this.releaseLock = resolve;
    });
    locks
      .request(raidLockName(raidId), () => {
        if (start !== this.starts) {
          return Promise.resolve();
        }
        this.locked = true;
        this.beat();
        return released;
      })
      .catch(() => undefined);
  }

  private beat(): void {
    if (this.raidId === null) {
      return;
    }
    const pulse: RaidPulse = {
      raidId: this.raidId,
      tab: this.tab(),
      at: this.now(),
      ...(this.locked ? { locked: true as const } : {}),
    };
    try {
      this.local()?.setItem(RAID_PULSE_KEY, JSON.stringify(pulse));
    } catch {
      // No storage, no second tab to protect against.
    }
  }

  /** Takes this tab's pulse away, and never another tab's. */
  private forget(): void {
    const pulse = this.read();
    if (pulse === null || pulse.tab !== this.tab()) {
      return;
    }
    try {
      this.local()?.removeItem(RAID_PULSE_KEY);
    } catch {
      // Nothing to take away.
    }
  }

  private read(): RaidPulse | null {
    try {
      const raw = this.local()?.getItem(RAID_PULSE_KEY);
      if (!raw) {
        return null;
      }
      const value = JSON.parse(raw) as Partial<RaidPulse>;
      return typeof value.raidId === 'string' && typeof value.tab === 'string' && typeof value.at === 'number'
        ? { raidId: value.raidId, tab: value.tab, at: value.at, ...(value.locked === true ? { locked: true as const } : {}) }
        : null;
    } catch {
      return null;
    }
  }
}

function browserStorage(): PulseStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function browserLocks(): RaidLocks | null {
  try {
    return typeof window === 'undefined' ? null : ((navigator as { locks?: RaidLocks }).locks ?? null);
  } catch {
    return null;
  }
}

/** The one heartbeat a page has. */
export const raidHeartbeat = new RaidHeartbeat(browserStorage);
