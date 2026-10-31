import type { HaulTier } from '../run/extractionReport';
import type { MapRaidRecord } from '../save/SaveManager';
import { scatter, ARENA_CENTRE, WALL_FOOT, ovalPoint } from './arenaHall';
import type { CrowdPose, CrowdSeat } from './arenaStands';

/**
 * What THE RAID ARENA's crowd does, which is answer the player. The room used to
 * be the same whether a raid had brought Charizard home or lost it for good.
 *
 * It answers three things. **The raid just ended**: on its feet for a big haul or
 * a close call, a polite hand for a thin one, a long groan and some of them leaving for a wipe.
 * **Somebody waving at it**: the nearest section waves back. **Somebody running
 * round the ring**: the people they are passing get up as they pass, and a whole
 * lap brings the house up. And how full the house is at all is the record: a new
 * game plays to a third of the seats and a veteran to a packed one.
 *
 * None of it is stored and none of it owns a key: the house is worked out from
 * `raidProgress.raidRecord`, and everything else lasts seconds. Phaser-free, so
 * all of it can be asked of a number; `arenaView.ts` draws it.
 */

export type CrowdMood = 'roar' | 'cheer' | 'clap' | 'groan';

/** What the house makes of how a raid ended. */
export function moodOfRaid(escaped: boolean, haul: HaulTier, closeCall = false): CrowdMood {
  if (!escaped) {
    return 'groan';
  }
  // The house came for nerve as much as for the haul: cutting it fine has them
  // on their feet, whatever came out with it.
  if (closeCall) {
    return 'roar';
  }
  return haul === 'loaded' ? 'roar' : haul === 'solid' ? 'cheer' : 'clap';
}

/** How much of the house a new game plays to, and what a raid out adds to it. */
const HOUSE_AT_FIRST = 1 / 3;
const HOUSE_PER_RAID_OUT = 1 / 18;
/** A wipe takes half as many away as a raid out brings. */
const HOUSE_PER_WIPE = HOUSE_PER_RAID_OUT / 2;

/** How full the stands are, from the record: the only thing a crowd remembers. */
export function crowdShare(record: Readonly<Record<string, MapRaidRecord>> | undefined): number {
  const raids = Object.values(record ?? {});
  const out = raids.reduce((total, each) => total + each.extracted, 0);
  const wiped = raids.reduce((total, each) => total + each.wiped, 0);
  return Math.min(1, Math.max(HOUSE_AT_FIRST, HOUSE_AT_FIRST + out * HOUSE_PER_RAID_OUT - wiped * HOUSE_PER_WIPE));
}

/** Where a point stands round the hall, as `ovalPoint` turns. */
export const angleInHall = (point: { readonly x: number; readonly y: number }): number =>
  Math.atan2((point.y - ARENA_CENTRE.y) / WALL_FOOT.ry, (point.x - ARENA_CENTRE.x) / WALL_FOOT.rx);

/** From `from` to `to` the short way round, in (-PI, PI]. */
export function turnBetween(from: number, to: number): number {
  const turn = (to - from) % (Math.PI * 2);
  return turn > Math.PI ? turn - Math.PI * 2 : turn <= -Math.PI ? turn + Math.PI * 2 : turn;
}

/** Where to look to see the people behind somebody standing here: their nearest seats, a little short of them. */
export function standsBehind(player: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  const seats = ovalPoint({ ...WALL_FOOT, rx: WALL_FOOT.rx + 16, ry: WALL_FOOT.ry + 16 }, angleInHall(player));
  // To the north the seats climb the wall, so they are further up than the oval says.
  const north = seats.y < ARENA_CENTRE.y;
  return { x: seats.x, y: seats.y - (north ? 24 : 0) };
}

export interface PersonPose {
  readonly pose: CrowdPose;
  /** Off the seat by this many whole pixels: a bounce. */
  readonly lift: number;
}

/** Everything each mood does: how many get up, for how long, and what is heard when. */
const MOODS: Readonly<
  Record<CrowdMood, { readonly rising: number; readonly forMs: number; readonly sounds: readonly (readonly [number, CrowdSound])[] }>
> = {
  roar: {
    rising: 0.96,
    forMs: 5200,
    sounds: [[0, 'crowdRoar'], [520, 'crowdRoar'], [1040, 'crowdRoar'], [1560, 'crowdCheer'], [2200, 'crowdCheer'], [3000, 'crowdClap']],
  },
  cheer: {
    rising: 0.6,
    forMs: 3600,
    sounds: [[0, 'crowdCheer'], [560, 'crowdCheer'], [1200, 'crowdClap'], [1800, 'crowdClap']],
  },
  clap: {
    rising: 0.24,
    forMs: 2600,
    sounds: [[0, 'crowdClap'], [620, 'crowdClap']],
  },
  groan: { rising: 0, forMs: 0, sounds: [[120, 'crowdGroan']] },
};

export type CrowdSound = 'crowdRoar' | 'crowdCheer' | 'crowdClap' | 'crowdGroan';

/** How long it takes the news to get from one side of the house to the other. */
const RIPPLE_MS = 760;
/** How long a person's own arms take to go up and down. */
const BOUNCE_MS = 230;

/** How long the fires burn low after a wipe, and how low. */
const FIRES_LOW_MS = 3600;
const FIRES_LOWEST = 0.45;

/** How many get up to leave after a wipe, as a share of the house, how long they take over it and how fast they shuffle. */
const LEAVING_SHARE = 0.035;
const LEAVER_MS = 2400;
const LEAVER_TURN_PER_MS = 0.00006;

/** How far either way a wave back reaches round the hall, how fast it spreads, how long anybody keeps it up. */
const WAVE_REACH = 0.52;
const WAVE_SPREAD_MS = 900;
const WAVE_HELD_MS = 1300;
const WAVE_RISING = 0.82;

/** The running band: how far ahead they are getting up, and how far behind they are still up. */
const BAND_AHEAD = 0.1;
const BAND_ARMS = 0.34;
const BAND_BEHIND = 0.62;
const BAND_RISING = 0.86;

const poseFor = (seat: CrowdSeat, ms: number): PersonPose => {
  const beat = Math.floor((ms + seat.roll * 1000) / BOUNCE_MS) % 2 === 0;
  return { pose: beat ? 'up' : 'stand', lift: beat ? 1 : 0 };
};

/** What one of the crowd is doing, a mood's own ripple out from where the player is, or null for sat down. */
export function reactionPose(seat: CrowdSeat, mood: CrowdMood, from: number, ms: number): PersonPose | null {
  const { rising, forMs } = MOODS[mood];
  if (seat.roll >= rising) {
    return null;
  }
  const delay = (Math.abs(turnBetween(from, seat.angle)) / Math.PI) * RIPPLE_MS + scatter(seat.x, seat.y) * 280;
  const until = delay + forMs * (0.7 + 0.3 * scatter(seat.y, seat.x));
  return ms >= delay && ms < until ? poseFor(seat, ms) : null;
}

/** What one of the crowd is doing about a wave from `from`, `ms` ago. */
export function wavePose(seat: CrowdSeat, from: number, ms: number): PersonPose | null {
  const apart = Math.abs(turnBetween(from, seat.angle));
  if (apart > WAVE_REACH || seat.roll >= WAVE_RISING) {
    return null;
  }
  const delay = (apart / WAVE_REACH) * WAVE_SPREAD_MS;
  return ms >= delay && ms < delay + WAVE_HELD_MS ? poseFor(seat, ms) : null;
}

/** What one of the crowd is doing as somebody runs past: `way` is +1 or -1, as the angle turns. */
export function bandPose(seat: CrowdSeat, at: number, way: number, ms: number): PersonPose | null {
  if (seat.roll >= BAND_RISING) {
    return null;
  }
  const ahead = turnBetween(at, seat.angle) * way;
  if (ahead > BAND_AHEAD || ahead < -BAND_BEHIND) {
    return null;
  }
  return ahead > 0 || ahead < -BAND_ARMS ? { pose: 'stand', lift: 0 } : poseFor(seat, ms);
}

/** Who gets up and goes after a wipe: the places the raid has just emptied, or as good as. */
export function leaversFrom(seats: readonly CrowdSeat[], share: number): readonly CrowdSeat[] {
  return seats.filter((seat) => seat.fill >= share && seat.fill < share + LEAVING_SHARE);
}

/** Where a leaver has got to along their row, as a turn from their seat, or null once they are gone. */
export function leaverTurn(seat: CrowdSeat, ms: number): number | null {
  const start = seat.roll * 700;
  if (ms < start || ms > start + LEAVER_MS) {
    return null;
  }
  return (ms - start) * LEAVER_TURN_PER_MS * (seat.roll < 0.5 ? -1 : 1);
}

// --- a lap of the ring -------------------------------------------------------

/** How far round somebody has to have gone before the crowd takes them for a runner: no walk to a station gets there. */
const LAP_WAVE_AFTER = Math.PI / 4;
/** Standing about this long, or turning back, and it was not a lap. */
const LAP_GIVEN_UP_MS = 2200;
/** How often the band can be heard as it runs. */
const LAP_CHEER_EVERY = Math.PI / 2;

export interface LapNews {
  /** The crowd has taken this walk for a lap: the band is running. */
  readonly running: boolean;
  /** Which way, as the angle turns. */
  readonly way: number;
  /** A quarter of the way round again, for a cheer. */
  readonly quarter: boolean;
  /** How long the lap took, on the frame it was finished. */
  readonly lapMs: number | null;
}

/** Follows somebody round the ring. */
export class LapWatch {
  private last: number | null = null;
  private travelled = 0;
  private idleMs = 0;
  private lapMs = 0;
  private cheers = 0;
  private laps = 0;

  public note(angle: number, deltaMs: number): LapNews {
    const turn = this.last === null ? 0 : turnBetween(this.last, angle);
    this.last = angle;
    const moving = Math.abs(turn) > 0.0001;
    if (moving && this.travelled !== 0 && Math.sign(turn) !== Math.sign(this.travelled)) {
      this.reset();
    }
    this.idleMs = moving ? 0 : this.idleMs + deltaMs;
    if (this.idleMs >= LAP_GIVEN_UP_MS) {
      this.reset();
    }
    this.travelled += turn;
    if (this.travelled !== 0) {
      this.lapMs += deltaMs;
    }
    const round = Math.abs(this.travelled);
    const way = Math.sign(this.travelled);
    const running = round >= LAP_WAVE_AFTER;
    const cheers = Math.floor(round / LAP_CHEER_EVERY);
    const quarter = cheers > this.cheers;
    this.cheers = cheers;
    let lapMs: number | null = null;
    if (Math.floor(round / (Math.PI * 2)) > this.laps) {
      this.laps += 1;
      lapMs = this.lapMs;
      this.lapMs = 0;
    }
    return { running, way, quarter, lapMs };
  }

  private reset(): void {
    this.travelled = 0;
    this.lapMs = 0;
    this.cheers = 0;
    this.laps = 0;
    this.idleMs = 0;
  }
}

/** A lap's time, as it goes on the board. */
export function lapLine(lapMs: number, honour: boolean, best: boolean): string {
  const seconds = Math.round(lapMs / 100) / 10;
  const time = `${seconds.toFixed(1)}S`;
  return `${honour ? 'A LAP OF HONOUR' : 'A LAP OF THE RING'} ${time}${best ? ' BEST' : ''}`;
}

// --- paper, after a big raid --------------------------------------------------

const PAPER_FLAKES = 54;
const PAPER_FROM_MS = 500;
const PAPER_SPREAD_MS = 2800;
const PAPER_LEAST_SPEED = 0.034;
const PAPER_SPREAD_SPEED = 0.02;
const PAPER_DRIFT = 7;
export const PAPER_MS = PAPER_FROM_MS + PAPER_SPREAD_MS + 8000;
export const PAPER_INKS = [0xf8f0d8, 0xf0c454, 0xc84038] as const;

export interface PaperFlake {
  readonly x: number;
  readonly y: number;
  readonly ink: number;
  /** Which way it is turned just now: flat, or edge on. */
  readonly flat: boolean;
}

/** Everything thrown from the stands that is in the air `ms` after the roar, on a screen this big. */
export function paperFlakes(ms: number, width: number, height: number): readonly PaperFlake[] {
  const flakes: PaperFlake[] = [];
  for (let index = 0; index < PAPER_FLAKES; index += 1) {
    const flown = ms - PAPER_FROM_MS - scatter(index, 3) * PAPER_SPREAD_MS;
    if (flown < 0) {
      continue;
    }
    const y = -4 + flown * (PAPER_LEAST_SPEED + scatter(index, 5) * PAPER_SPREAD_SPEED);
    if (y > height) {
      continue;
    }
    const sway = Math.sin(flown / (240 + scatter(index, 7) * 260) + index);
    flakes.push({
      x: Math.round(scatter(index, 11) * width + sway * PAPER_DRIFT),
      y: Math.round(y),
      ink: PAPER_INKS[index % PAPER_INKS.length],
      flat: Math.floor(flown / 190 + index) % 2 === 0,
    });
  }
  return flakes;
}

// --- the motion ---------------------------------------------------------------

/** Everything the crowd is doing at the moment, all of it on the clock it is handed. */
export class CrowdMotion {
  private reaction: { readonly mood: CrowdMood; readonly from: number; ms: number; heard: number } | null = null;
  private waves: { readonly from: number; ms: number }[] = [];
  private band: { at: number; way: number; ms: number } | null = null;
  private paper: { ms: number } | null = null;

  public react(mood: CrowdMood, from: number): void {
    this.reaction = { mood, from, ms: 0, heard: 0 };
    if (mood === 'roar') {
      this.paper = { ms: 0 };
    }
  }

  public throwPaper(): void {
    this.paper = { ms: 0 };
  }

  public waveFrom(from: number): void {
    this.waves.push({ from, ms: 0 });
  }

  public runBand(at: number, way: number): void {
    this.band = { at, way, ms: this.band?.ms ?? 0 };
  }

  public stopBand(): void {
    this.band = null;
  }

  /** Moves everything on, and hands back whatever has come due to be heard. */
  public update(deltaMs: number): readonly CrowdSound[] {
    const sounds: CrowdSound[] = [];
    if (this.reaction) {
      this.reaction.ms += deltaMs;
      const { sounds: due, forMs } = MOODS[this.reaction.mood];
      for (; this.reaction.heard < due.length && due[this.reaction.heard][0] <= this.reaction.ms; this.reaction.heard += 1) {
        sounds.push(due[this.reaction.heard][1]);
      }
      if (this.reaction.ms > Math.max(forMs + RIPPLE_MS + 300, this.reaction.mood === 'groan' ? Math.max(FIRES_LOW_MS, LEAVER_MS + 700) : 0)) {
        this.reaction = null;
      }
    }
    for (const wave of this.waves) {
      wave.ms += deltaMs;
    }
    this.waves = this.waves.filter((wave) => wave.ms < WAVE_SPREAD_MS + WAVE_HELD_MS);
    if (this.band) {
      this.band.ms += deltaMs;
    }
    if (this.paper) {
      this.paper.ms += deltaMs;
      if (this.paper.ms > PAPER_MS) {
        this.paper = null;
      }
    }
    return sounds;
  }

  /** Whether anybody in the stands has anything to do. */
  public get busy(): boolean {
    return this.reaction !== null || this.waves.length > 0 || this.band !== null;
  }

  public get leaving(): boolean {
    return this.reaction?.mood === 'groan';
  }

  public get leavingMs(): number {
    return this.reaction?.ms ?? 0;
  }

  public get paperMs(): number | null {
    return this.paper?.ms ?? null;
  }

  /** How bright the fires burn: they go low after a wipe and come back. */
  public get fireShare(): number {
    if (this.reaction?.mood !== 'groan') {
      return 1;
    }
    const through = Math.min(1, this.reaction.ms / FIRES_LOW_MS);
    return FIRES_LOWEST + (1 - FIRES_LOWEST) * through * through;
  }

  /** What one of the crowd is doing, whichever of those has them on their feet. */
  public pose(seat: CrowdSeat): PersonPose | null {
    if (this.reaction) {
      const pose = reactionPose(seat, this.reaction.mood, this.reaction.from, this.reaction.ms);
      if (pose) {
        return pose;
      }
    }
    for (const wave of this.waves) {
      const pose = wavePose(seat, wave.from, wave.ms);
      if (pose) {
        return pose;
      }
    }
    return this.band ? bandPose(seat, this.band.at, this.band.way, this.band.ms) : null;
  }
}
