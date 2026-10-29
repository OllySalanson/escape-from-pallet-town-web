import type { Direction, GridPosition } from '../movement/gridMovement';
import type { PartnerSpeciesId } from '../base/partner';
import { lookKey, type DressedLook } from '../look/look';
import { HarbourCrowd, type HarbourFigure } from './harbourCrowd';
import {
  HARBOUR_PATH_MAX,
  HARBOUR_SEND_EVERY_MS,
  type HarbourMove,
  type HarbourNudge,
  type HarbourPlace,
  type HarbourSay,
  type HarbourWave,
} from './harbourProtocol';
import { PhraseBoard, PhrasePace, type HarbourPhraseId } from './harbourPhrases';

/**
 * This browser's place in THE HARBOUR: what it tells the others and what it
 * has heard of them, over whichever wire it is given (`HarbourWire`).
 *
 * A browser that has a named house is *seen*: it says where it is and sends
 * its steps. One that has not yet named itself at THE BOLTHOLE's door only
 * *watches* - the channel will not take a word from it (the database's policy)
 * - so a newcomer sees the harbour busy from the first second and is seen once
 * they have a name. Nothing heard is drawn without the name the database has
 * for its sender: a figure the database does not know is nobody's, and nobody
 * draws it.
 *
 * Steps are gathered and sent every `HARBOUR_SEND_EVERY_MS`, and not at all
 * while nobody else is there to see them, which is most of the time and what
 * keeps the harbour inside a free plan. When somebody new arrives, everybody
 * already there says once where they stand, so the newcomer is not looking at
 * an empty yard until somebody moves.
 *
 * It is driven by the clock it is handed (`tick`), never by its own timers, so
 * it is tested frame by frame; `harbourWire.ts` is the network half.
 */

/** What the link needs from the network. */
export interface HarbourWire<P extends string = HarbourPlace> {
  /**
   * Joins the channel, seen as `as` (a player id) or only watching (null), and
   * says through `heard` everything that arrives. Resolves false if it could
   * not join.
   */
  join(as: string | null, place: P | null, heard: HarbourHeard<P>): Promise<boolean>;
  /** Says where this player is, or (null) that they are not standing anywhere. */
  standIn(place: P | null): void;
  send(move: HarbourMove<P>): void;
  /** Tells one other player's browser to look now (`HarbourNudge`). */
  nudge(nudge: HarbourNudge): void;
  /** Puts this player's hand up for everybody where they stand (`HarbourWave`); a place nobody waves in leaves it out. */
  wave?(wave: HarbourWave<P>): void;
  /** Says one of the game's quick phrases for everybody where this player stands (`HarbourSay`); a place nobody talks in leaves it out. */
  say?(say: HarbourSay<P>): void;
  /**
   * Something else a place shares beyond where people stand - a raid room's
   * hunter, say (`raidRoom/`). The wire carries it as it is and the place
   * reads it; a wire for a place that shares nothing more leaves it out.
   */
  signal?(payload: Record<string, unknown>): void;
  /** The names on the doors of these players, as the database has them. */
  names(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
  leave(): Promise<void>;
}

export interface HarbourHeard<P extends string = HarbourPlace> {
  move(move: HarbourMove<P>): void;
  nudge(nudge: HarbourNudge): void;
  wave?(wave: HarbourWave<P>): void;
  say?(say: HarbourSay<P>): void;
  /** Everybody present now, and where each says they are. */
  present(members: ReadonlyMap<string, P>): void;
  /** A signal another browser sent (`HarbourWire.signal`), unread: whoever handles it reads it. */
  signal?(payload: unknown): void;
}

/** Another player as drawn: where, the name on their door, whether their hand is up, and what they are saying. */
export interface NamedFigure<P extends string = HarbourPlace> extends HarbourFigure<P> {
  readonly name: string;
  readonly waving?: boolean;
  /** The words of the quick phrase in their bubble now (`harbourPhrases.ts`). */
  readonly saying?: string;
}

/** How long a hand stays up over somebody who waved. */
export const WAVE_SHOWN_MS = 1_400;

/** The least time between two waves from this player, so a held key is one wave, not a flicker. */
export const WAVE_EVERY_MS = 1_500;

/** How long the link waits, once its scene has gone, before saying the player is not here. */
export const AWAY_GRACE_MS = 2_000;

/** How long it waits after that before leaving the channel altogether. */
export const LEAVE_AFTER_MS = 60_000;

/** The least time between two "here I am" answers to somebody arriving. */
export const GREET_EVERY_MS = 1_500;

export class HarbourLink<P extends string = HarbourPlace> {
  private readonly crowd = new HarbourCrowd<P>();
  private readonly names = new Map<string, string>();
  private readonly asked = new Set<string>();
  private members: ReadonlyMap<string, P> = new Map();
  private joined: 'no' | 'joining' | 'yes' = 'no';
  /** Who the channel was joined as, which is who the channel will take words from. */
  private joinedAs: string | null = null;
  private me: string | null = null;
  private place: P | null = null;
  private tile: GridPosition = { x: 0, y: 0 };
  private facing: Direction = 'down';
  private partner: PartnerSpeciesId | null = null;
  private look: DressedLook | null = null;
  private pending: GridPosition[] = [];
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private lastGreetAt = Number.NEGATIVE_INFINITY;
  private greetOwed = false;
  private awaySince: number | null = null;
  private now = 0;
  private onNudge: ((from: string, gone?: string) => void) | null = null;
  private onSignal: ((payload: unknown) => void) | null = null;
  private onWavedAt: ((from: string) => void) | null = null;
  /** When each other player last waved, in this link's clock. */
  private readonly wavedAt = new Map<string, number>();
  private lastWaveAt = Number.NEGATIVE_INFINITY;
  /** What everybody else here is saying, paced as they are heard. */
  private readonly phrases = new PhraseBoard();
  /** This player's own pace, so a held key or a script cannot flood the channel. */
  private readonly ownPace = new PhrasePace();
  /** Counts every `leave`, so a join still on its way when the link was left is let go of. */
  private generation = 0;

  private readonly wire: HarbourWire<P>;

  public constructor(wire: HarbourWire<P>) {
    this.wire = wire;
  }

  /** The player is standing here now: a scene has opened on this place. */
  public enter(me: string | null, place: P | null, tile: GridPosition, facing: Direction): void {
    this.awaySince = null;
    this.tile = { ...tile };
    this.facing = facing;
    this.pending = [];
    const moved = place !== this.place;
    this.place = place;
    this.me = me;
    if (this.joined === 'no') {
      this.join();
      return;
    }
    if (this.joined === 'joining') {
      // Whatever changed is settled once the join is answered (`join`).
      return;
    }
    if (me !== this.joinedAs) {
      // Signed in since joining: the channel is joined again as the player.
      this.rejoin();
      return;
    }
    if (this.me) {
      this.wire.standIn(place);
      if (moved && this.anybodyElse()) {
        this.sendNow();
      }
    }
  }

  /**
   * The kind of Pokemon walking at this player's heel, or none. Said with
   * every move from now on, and at once to anybody here if it changed - a
   * partner swapped at the Pokemon Center comes out of the door as itself.
   */
  public carry(partner: PartnerSpeciesId | null): void {
    if (partner === this.partner) {
      return;
    }
    this.partner = partner;
    if (this.seen() && this.anybodyElse()) {
      this.sendNow();
    }
  }

  /**
   * What this player wears (`../look/look`), or the classic look. Said with
   * every move from now on, and at once to anybody here if it changed - a look
   * bought at the boutique walks out of its door as itself.
   */
  public wear(look: DressedLook | null): void {
    if (lookKey(look) === lookKey(this.look)) {
      return;
    }
    this.look = look;
    if (this.seen() && this.anybodyElse()) {
      this.sendNow();
    }
  }

  /** The player took a step onto `tile`. */
  public stepped(tile: GridPosition, facing: Direction): void {
    this.tile = { ...tile };
    this.facing = facing;
    this.pending.push({ ...tile });
    if (this.pending.length > HARBOUR_PATH_MAX) {
      this.pending.shift();
    }
  }

  /** The player's scene has gone - a menu, a raid - and they are not standing anywhere. */
  public away(): void {
    this.awaySince ??= this.now;
  }

  /** One frame: everybody else walked on, and anything owed sent. */
  public tick(nowMs: number, deltaMs: number): void {
    this.now = nowMs;
    this.crowd.advance(deltaMs);
    if (this.awaySince !== null) {
      const awayFor = nowMs - this.awaySince;
      if (awayFor >= AWAY_GRACE_MS && this.place !== null) {
        this.place = null;
        if (this.joined === 'yes' && this.me) {
          this.wire.standIn(null);
        }
      }
      if (awayFor >= AWAY_GRACE_MS + LEAVE_AFTER_MS && this.joined === 'yes') {
        this.joined = 'no';
        this.joinedAs = null;
        this.members = new Map();
        this.crowd.clear();
        void this.wire.leave();
      }
      return;
    }
    if (!this.seen() || !this.anybodyElse()) {
      this.pending = [];
      return;
    }
    if (this.greetOwed && nowMs - this.lastGreetAt >= GREET_EVERY_MS) {
      this.greetOwed = false;
      this.lastGreetAt = nowMs;
      this.sendNow();
      return;
    }
    if (this.pending.length > 0 && nowMs - this.lastSentAt >= HARBOUR_SEND_EVERY_MS) {
      this.sendNow();
    }
  }

  /** Everybody else standing in one place, by the names on their doors. */
  public figuresIn(place: P | null): readonly NamedFigure<P>[] {
    if (place === null) {
      return [];
    }
    return this.crowd
      .figuresIn(place)
      .filter((figure) => figure.id !== this.me && this.members.has(figure.id))
      .flatMap((figure) => {
        const name = this.names.get(figure.id);
        if (!name) {
          return [];
        }
        const waved = this.wavedAt.get(figure.id);
        const saying = this.phrases.saying(figure.id, this.now);
        return [
          {
            ...figure,
            name,
            ...(waved !== undefined && this.now - waved < WAVE_SHOWN_MS ? { waving: true } : {}),
            ...(saying ? { saying } : {}),
          },
        ];
      });
  }

  /** What to do when another player's browser says to look now, or that its knock is gone. */
  public whenNudged(handler: ((from: string, gone?: string) => void) | null): void {
    this.onNudge = handler;
  }

  /**
   * Puts this player's hand up for everybody where they stand, at `to` if they
   * are facing somebody. Said only by a player who can be heard, with somebody
   * there to see it, and not again for `WAVE_EVERY_MS`. Returns whether it went.
   */
  public wave(to?: string): boolean {
    if (!this.seen() || !this.anybodyElse() || !this.wire.wave || this.now - this.lastWaveAt < WAVE_EVERY_MS) {
      return false;
    }
    this.lastWaveAt = this.now;
    this.wire.wave(to ? { from: this.me!, place: this.place!, to } : { from: this.me!, place: this.place! });
    return true;
  }

  /**
   * Says one of the game's quick phrases for everybody where this player
   * stands. Said only by a player who can be heard, with somebody there to
   * hear it, and no faster than the harbour's pace (`PhrasePace`). Returns
   * whether it went.
   */
  public say(phrase: HarbourPhraseId): boolean {
    if (!this.seen() || !this.anybodyElse() || !this.wire.say || !this.ownPace.allow(this.me!, this.now)) {
      return false;
    }
    this.wire.say({ from: this.me!, place: this.place!, phrase });
    return true;
  }

  /** What to do when another player in this place waves at this one. */
  public whenWavedAt(handler: ((from: string) => void) | null): void {
    this.onWavedAt = handler;
  }

  /** What to do with a signal another browser sent (`HarbourWire.signal`). */
  public whenSignalled(handler: ((payload: unknown) => void) | null): void {
    this.onSignal = handler;
  }

  /**
   * Sends a signal to everybody else, if this player can be heard and anybody
   * is there to hear it. Returns whether it went.
   */
  public signal(payload: Record<string, unknown>): boolean {
    if (!this.seen() || !this.anybodyElse() || !this.wire.signal) {
      return false;
    }
    this.wire.signal(payload);
    return true;
  }

  /**
   * Tells one other player's browser to look now - or, with `gone`, that the
   * knock of that id has been walked away from. Said only by a player who can be heard.
   */
  public nudge(to: string, gone?: string): void {
    if (this.joined === 'yes' && this.joinedAs && this.joinedAs === this.me) {
      this.wire.nudge(gone ? { from: this.joinedAs, to, gone } : { from: this.joinedAs, to });
    }
  }

  /** How many other players are in the harbour, wherever they stand. */
  public get othersHere(): number {
    return [...this.members.keys()].filter((id) => id !== this.me && this.names.has(id)).length;
  }

  /** Everybody else on the channel the database has a name for, and where each says they are. */
  public othersPresent(): ReadonlyMap<string, { readonly name: string; readonly place: P }> {
    const present = new Map<string, { readonly name: string; readonly place: P }>();
    for (const [id, place] of this.members) {
      const name = this.names.get(id);
      if (id !== this.me && name) {
        present.set(id, { name, place });
      }
    }
    return present;
  }

  /**
   * Off the channel now rather than after the away grace: the place this link
   * was for is over for this player (a raid room, once its raid has ended).
   * Everybody else sees them go at once.
   */
  public leave(): void {
    this.generation += 1;
    const was = this.joined;
    this.joined = 'no';
    this.joinedAs = null;
    this.place = null;
    this.awaySince = null;
    this.pending = [];
    this.members = new Map();
    this.crowd.clear();
    if (was === 'yes') {
      void this.wire.leave();
    }
  }

  /**
   * This player has a new name. Everybody else asks the database for a
   * player's name once, so the channel is left and joined again: they see
   * the player go and come back (`hearPresent` forgets the name of whoever
   * leaves) and ask for the name afresh.
   */
  public renamed(): void {
    if (this.joined === 'yes' && this.me) {
      this.rejoin();
    }
  }

  private seen(): boolean {
    return this.joined === 'yes' && this.me !== null && this.place !== null;
  }

  private anybodyElse(): boolean {
    return [...this.members.keys()].some((id) => id !== this.me);
  }

  private sendNow(): void {
    if (!this.seen()) {
      return;
    }
    const path = this.pending.length > 0 ? this.pending : [this.tile];
    this.wire.send({
      from: this.me!,
      place: this.place!,
      path: [...path],
      facing: this.facing,
      ...(this.partner ? { partner: this.partner } : {}),
      ...(this.look ? { look: this.look } : {}),
    });
    this.pending = [];
    this.lastSentAt = this.now;
  }

  private join(): void {
    const as = this.me;
    const at = as ? this.place : null;
    const generation = this.generation;
    this.joined = 'joining';
    void this.wire
      .join(as, at, {
        move: (move) => {
          if (generation === this.generation) {
            this.crowd.hear(move);
          }
        },
        nudge: (nudge) => {
          if (generation === this.generation && nudge.to === this.me) {
            this.onNudge?.(nudge.from, nudge.gone);
          }
        },
        present: (members) => {
          if (generation === this.generation) {
            this.hearPresent(members);
          }
        },
        signal: (payload) => {
          if (generation === this.generation) {
            this.onSignal?.(payload);
          }
        },
        say: (say) => {
          if (generation === this.generation && say.from !== this.me && say.place === this.place) {
            this.phrases.hear(say.from, say.phrase, this.now);
          }
        },
        wave: (wave) => {
          if (generation !== this.generation || wave.from === this.me || wave.place !== this.place) {
            return;
          }
          this.wavedAt.set(wave.from, this.now);
          if (wave.to === this.me && this.names.has(wave.from)) {
            this.onWavedAt?.(wave.from);
          }
        },
      })
      .then((ok) => {
        if (generation !== this.generation) {
          // Left while the join was on its way.
          if (ok) {
            void this.wire.leave();
          }
          return;
        }
        if (!ok) {
          // Tried again the next time the player walks through a door.
          this.joined = 'no';
          return;
        }
        this.joined = 'yes';
        this.joinedAs = as;
        if (this.me !== as) {
          // Signed in while the join was on its way.
          this.rejoin();
          return;
        }
        if (as && this.place !== at) {
          this.wire.standIn(this.place);
        }
        if (as && this.place !== null) {
          this.greetOwed = true;
        }
      });
  }

  private rejoin(): void {
    this.joined = 'joining';
    void this.wire.leave().then(() => {
      this.joined = 'no';
      this.join();
    });
  }

  private hearPresent(members: ReadonlyMap<string, P>): void {
    const arrived = [...members.keys()].some((id) => id !== this.me && !this.members.has(id));
    for (const id of this.members.keys()) {
      if (!members.has(id)) {
        this.crowd.forget(id);
        this.phrases.forget(id);
        // Asked again if they come back: they may have come back renamed.
        this.asked.delete(id);
        this.names.delete(id);
      }
    }
    for (const [id, place] of members) {
      this.crowd.at(id, place);
    }
    this.members = members;
    if (arrived) {
      this.greetOwed = true;
    }
    const unknown = [...members.keys()].filter((id) => id !== this.me && !this.asked.has(id));
    if (unknown.length > 0) {
      for (const id of unknown) {
        this.asked.add(id);
      }
      void this.wire.names(unknown).then(
        (found) => {
          for (const [id, name] of found) {
            this.names.set(id, name);
          }
        },
        () => {
          // Asked again the next time they are seen arriving.
          for (const id of unknown) {
            this.asked.delete(id);
          }
        },
      );
    }
  }
}
