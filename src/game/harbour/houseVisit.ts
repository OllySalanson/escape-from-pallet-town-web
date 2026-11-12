import type { HouseService } from './houseService';

/**
 * A visit to somebody else's house, from the visitor's side: it lasts until the
 * visitor walks out or the owner sees them out, never for a set time (the
 * captain, 12 Nov 2026 - a yes used to stand for ten minutes).
 *
 * While the visitor is in the house their browser asks the database how the
 * visit stands every `VISIT_CHECK_EVERY_MS`, which also holds it open there
 * (`still_visiting`: ninety seconds after the last ask, so a tab closed
 * mid-visit lets it go on its own), and asks at once when the owner's browser
 * nudges - a hint only, sent when the owner shows them out. The owner leaving
 * the harbour, or going offline, is the channel's to say: once they have stood
 * nowhere in it for `OWNER_GONE_AFTER_MS` - longer than a look at a menu - the
 * visit is over. A question that gets no answer changes nothing, so a moment's
 * trouble on the line never sends anybody home.
 *
 * Driven by the clock it is handed (`tick`), so it is tested frame by frame.
 */

export const VISIT_CHECK_EVERY_MS = 10_000;
export const OWNER_GONE_AFTER_MS = 45_000;

/** Why a visit came to an end, other than the visitor walking out. */
export type VisitEnding = 'shown-out' | 'owner-gone' | 'over';

export class HouseVisitWatch {
  public readonly ownerId: string;
  private readonly service: HouseService;
  /** Whether the owner stands anywhere in the harbour; null when this page cannot tell. */
  private readonly ownerStanding: () => boolean | null;
  private lastAskedAt = Number.NEGATIVE_INFINITY;
  private asking = false;
  private ownerGoneSince: number | null = null;
  private ending: VisitEnding | null = null;
  private left = false;
  private now = 0;

  public constructor(service: HouseService, ownerId: string, ownerStanding: () => boolean | null) {
    this.service = service;
    this.ownerId = ownerId;
    this.ownerStanding = ownerStanding;
  }

  /** How the visit ended, once it has; null while it stands. */
  public get ended(): VisitEnding | null {
    return this.ending;
  }

  /** The owner's browser says to ask now. */
  public nudged(): void {
    this.lastAskedAt = Number.NEGATIVE_INFINITY;
  }

  public tick(nowMs: number): void {
    this.now = nowMs;
    if (this.ending || this.left) {
      return;
    }
    const standing = this.ownerStanding();
    if (standing === false) {
      this.ownerGoneSince ??= nowMs;
      if (nowMs - this.ownerGoneSince >= OWNER_GONE_AFTER_MS) {
        this.end('owner-gone');
        return;
      }
    } else {
      this.ownerGoneSince = null;
    }
    if (!this.asking && nowMs - this.lastAskedAt >= VISIT_CHECK_EVERY_MS) {
      this.ask();
    }
  }

  /** The visitor walked out (or the visit is otherwise over for them): said once, whatever comes back. */
  public leave(): void {
    if (this.left) {
      return;
    }
    this.left = true;
    void this.service.leaveHouse(this.ownerId).catch(() => undefined);
  }

  private end(ending: VisitEnding): void {
    this.ending = ending;
    this.leave();
  }

  private ask(): void {
    this.asking = true;
    this.lastAskedAt = this.now;
    void this.service
      .stillVisiting(this.ownerId)
      .then(
        (state) => {
          if (state !== 'in' && !this.ending && !this.left) {
            this.end(state);
          }
        },
        () => undefined,
      )
      .finally(() => {
        this.asking = false;
      });
  }
}
