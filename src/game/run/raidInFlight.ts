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
/** Where this tab's own name is kept. Session storage survives a reload, which is the point. */
export const TAB_ID_KEY = 'escape-from-pallet-town.tab';
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
}

interface PulseStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Whether a raid is being played right now in another tab, which is the one
 * thing that must stop the base settling it: two tabs share one save, and a
 * second tab opened on the title must not end the raid the first is in.
 *
 * Only a fresh pulse from a *different* tab counts. A reload keeps its tab's
 * name (session storage outlives a reload), so the raid it reloaded out of is
 * always settled at once; a tab closed says so on its way out (`pagehide`);
 * and a crash leaves a pulse that goes stale.
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
 */
export class RaidHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;
  private raidId: string | null = null;
  private tabId: string | null = null;
  private listening = false;
  private readonly local: () => PulseStorage | null;
  private readonly session: () => PulseStorage | null;
  private readonly now: () => number;

  public constructor(
    local: () => PulseStorage | null,
    session: () => PulseStorage | null,
    now: () => number = () => Date.now(),
  ) {
    this.local = local;
    this.session = session;
    this.now = now;
  }

  /** This tab's name, made once and kept for the life of the tab. */
  public tab(): string {
    if (this.tabId !== null) {
      return this.tabId;
    }
    let id: string | null;
    try {
      id = this.session()?.getItem(TAB_ID_KEY) ?? null;
    } catch {
      id = null;
    }
    if (!id) {
      id = newRaidId();
      try {
        this.session()?.setItem(TAB_ID_KEY, id);
      } catch {
        // A tab that cannot remember its name is a new tab on every load,
        // which only ever makes a reload look like another tab for the
        // stale window - never makes a live raid look abandoned.
      }
    }
    this.tabId = id;
    return id;
  }

  public start(raidId: string): void {
    this.stop();
    this.raidId = raidId;
    this.beat();
    this.timer = setInterval(() => this.beat(), RAID_PULSE_EVERY_MS);
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
  }

  /** Whether `raidId` is being played in some other tab right now. */
  public liveElsewhere(raidId: string): boolean {
    return raidLiveElsewhere(this.read(), raidId, this.tab(), this.now());
  }

  private beat(): void {
    if (this.raidId === null) {
      return;
    }
    const pulse: RaidPulse = { raidId: this.raidId, tab: this.tab(), at: this.now() };
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
        ? { raidId: value.raidId, tab: value.tab, at: value.at }
        : null;
    } catch {
      return null;
    }
  }
}

function browserStorage(kind: 'localStorage' | 'sessionStorage'): PulseStorage | null {
  try {
    return typeof window === 'undefined' ? null : window[kind];
  } catch {
    return null;
  }
}

/** The one heartbeat a page has. */
export const raidHeartbeat = new RaidHeartbeat(
  () => browserStorage('localStorage'),
  () => browserStorage('sessionStorage'),
);
