import type { HouseService, KnockAtTheDoor } from './houseService';

/**
 * The player's own front door, while they are at home: telling the harbour
 * they are in (so a knock can find them) and what the house looks like (so a
 * visitor they let in sees it), and hearing who knocks.
 *
 * Being home is said when the house is walked into and every
 * `HOME_HEARTBEAT_MS` after, and the database counts a house as home for ninety
 * seconds after the last time - so a tab closed in the house is out within a
 * minute and a half, with nothing to tidy. Going upstairs and down is no
 * absence: the house is only said to be empty once the player has been out of
 * it `OUT_AFTER_MS`. Knocks are asked for every `KNOCK_LOOK_EVERY_MS`, and at
 * once when another player's browser says it has knocked - a hint only, which
 * costs one question if it is not true.
 *
 * Driven by the clock it is handed (`tick`), so it is tested frame by frame.
 */

export const HOME_HEARTBEAT_MS = 30_000;
export const KNOCK_LOOK_EVERY_MS = 8_000;
export const OUT_AFTER_MS = 2_000;

export class HouseDoor {
  private readonly service: HouseService;
  private home = false;
  private outSince: number | null = null;
  private lastSaidAt = Number.NEGATIVE_INFINITY;
  private lastLookedAt = Number.NEGATIVE_INFINITY;
  private snapshot: unknown = null;
  private sentSnapshot: string | null = null;
  private looking = false;
  private waiting: KnockAtTheDoor[] = [];
  private answered = new Set<string>();
  private now = 0;

  public constructor(service: HouseService) {
    this.service = service;
  }

  /** The player is in their house, and this is what it looks like. */
  public inside(snapshot: unknown): void {
    this.outSince = null;
    this.snapshot = snapshot;
    const changed = JSON.stringify(snapshot) !== this.sentSnapshot;
    if (!this.home || changed) {
      this.home = true;
      this.say();
    }
  }

  /** The player has gone out of the house (or into a menu). */
  public out(): void {
    this.outSince ??= this.now;
  }

  /** Somebody's browser says it knocked here: look now. */
  public knocked(): void {
    this.lastLookedAt = Number.NEGATIVE_INFINITY;
  }

  public tick(nowMs: number): void {
    this.now = nowMs;
    if (!this.home) {
      return;
    }
    if (this.outSince !== null && nowMs - this.outSince >= OUT_AFTER_MS) {
      this.home = false;
      this.waiting = [];
      void this.service.atHome(false, null).catch(() => undefined);
      return;
    }
    if (this.outSince === null && nowMs - this.lastSaidAt >= HOME_HEARTBEAT_MS) {
      this.say();
    }
    if (this.outSince === null && !this.looking && nowMs - this.lastLookedAt >= KNOCK_LOOK_EVERY_MS) {
      this.look();
    }
  }

  /** The knock to answer next, if anybody is at the door. */
  public get atTheDoor(): KnockAtTheDoor | null {
    return this.waiting.find((knock) => !this.answered.has(knock.knockId)) ?? null;
  }

  /** The player's answer to a knock. Said once, whatever comes back. */
  public answer(knockId: string, letIn: boolean): Promise<void> {
    this.answered.add(knockId);
    this.waiting = this.waiting.filter((knock) => knock.knockId !== knockId);
    return this.service.answer(knockId, letIn).catch(() => undefined);
  }

  private say(): void {
    this.lastSaidAt = this.now;
    const serialised = JSON.stringify(this.snapshot);
    const changed = serialised !== this.sentSnapshot;
    void this.service.atHome(true, changed ? this.snapshot : null).then(
      () => {
        if (changed) {
          this.sentSnapshot = serialised;
        }
      },
      () => undefined,
    );
  }

  private look(): void {
    this.looking = true;
    this.lastLookedAt = this.now;
    void this.service
      .knocksAtMyDoor()
      .then(
        (knocks) => {
          this.waiting = knocks.filter((knock) => !this.answered.has(knock.knockId));
        },
        () => undefined,
      )
      .finally(() => {
        this.looking = false;
      });
  }
}
