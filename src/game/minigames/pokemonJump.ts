import {
  POKEMON_JUMP_ARCS,
  POKEMON_JUMP_BONUSES,
  POKEMON_JUMP_MAX_SCORE,
  POKEMON_JUMP_MONS,
  POKEMON_JUMP_PEAK,
  POKEMON_JUMP_PRIZES,
  POKEMON_JUMP_VINE_DELAYS,
  POKEMON_JUMP_VINE_SPEEDS,
  type JumpType,
} from './generated/pokemonJump';

/**
 * POKéMON JUMP, FireRed's own (pret `src/pokemon_jump.c`), as THE GAME
 * CORNER's cabinet plays it: a Venusaur swings a vine round and round, and up
 * to three of the player's Pokémon jump it together on one key.
 *
 * Everything that is FireRed's is read out of pret by
 * `scripts/fetch-frlg-minigames.mjs` (`generated/pokemonJump.ts`) and played
 * here as FireRed plays it, frame by frame at the GBA's sixty a second: who
 * may jump, each kind's arc (FAST, NORMAL or SLOW - how long it hangs in the
 * air), the vine's speeds and how it whips faster on the way down, the four
 * frames a jump takes to leave the ground, the hit (the vine passing under a
 * jumper who is on the ground), ten points a jump and the bonus for jumpers at
 * the tops of their jumps together, and the scores that win berries.
 *
 * What is this game's, because FireRed's is a game for five link players and
 * this is one player with a team:
 *
 * - **One key jumps the whole team, and only those on the ground.** FireRed
 *   gives each player their own key; here a jumper still in the air when the
 *   key is pressed carries on its own arc and misses the jump. That is the
 *   whole difficulty of a mixed team: a SLOW jumper hangs too long for a fast
 *   vine, and a team of one kind lands together and leaves together.
 * - **EXCELLENT is the whole team at the top together** (FireRed's needs all
 *   five link players). It counts in a row, as FireRed's does.
 * - **A hit ends the game** - as it does in FireRed, for everybody.
 *
 * Pure and Phaser-free: a game is a value, stepped by milliseconds and a key,
 * so it is played headless by the tests and the scene alike.
 */

export type { JumpType };

/** FireRed's frame, which every number here is counted in. */
export const FRAME_MS = 1000 / 60;

/** The vine's ten positions round its swing (FireRed's `VINE_*`), highest first. */
export const VINE_HIGHEST = 0;
export const VINE_LOWEST = 5;
/** The one position where the vine is under the jumpers' feet: a jumper on the ground there is hit. */
export const VINE_UPSWING_LOWER = 6;
export const VINE_UPSWING_LOW = 7;
export const VINE_UPSWING_HIGH = 8;
const NUM_VINESTATES = 10;
/** FireRed's `VINE_STATE_TIMER`: a position in the high byte, progress through it in the low. */
const stateTimer = (state: number): number => (state << 8) | 0xff;

/** How many frames a jump spends crouching before it leaves the ground (`UpdateJump`). */
export const JUMP_CROUCH_FRAMES = 4;

/** The most Pokémon that jump at once, here: FireRed takes five link players, a cabinet takes a team of three. */
export const MAX_JUMPERS = 3;

/** Ten points for every swing of the vine cleared (`AddJumpScore(10)`). */
export const POINTS_A_JUMP = 10;

export interface Jumper {
  readonly species: string;
  readonly type: JumpType;
  /** The frame its jump began on, while it is jumping. */
  readonly jumpStart: number | null;
  /** Its height above the ground this frame, in pixels: 0 on the ground, `POKEMON_JUMP_PEAK` at the top. */
  readonly offset: number;
  readonly hit: boolean;
}

export interface PokemonJumpGame {
  /** Frames played (FireRed's `vineTimer`). */
  readonly frame: number;
  readonly vineTimer: number;
  readonly vineState: number;
  readonly prevVineState: number;
  readonly vineSpeed: number;
  readonly vineSpeedAccel: number;
  readonly vineSpeedStage: number;
  readonly vineBaseSpeedIdx: number;
  readonly vineSpeedDelay: number;
  readonly nextVineSpeed: number;
  readonly atMaxSpeedStage: boolean;
  readonly rngSeed: number;
  readonly jumpers: readonly Jumper[];
  readonly score: number;
  readonly jumpsInRow: number;
  readonly excellentsInRow: number;
  readonly bestExcellents: number;
  /** How many were at the tops of their jumps together at once, this swing. */
  readonly peakTogether: number;
  /** Whether the vine has gone round once: the first swing scores nothing. */
  readonly scoring: boolean;
  readonly over: boolean;
  /** A key pressed between frames, to be read on the next one. */
  readonly pressed: boolean;
  /** Milliseconds owed to the next frame. */
  readonly carryMs: number;
  /** What happened on the last frame stepped, for the screen to sound and show. */
  readonly events: readonly JumpEvent[];
}

export type JumpEvent =
  | { readonly kind: 'jump'; readonly jumpers: readonly number[] }
  | { readonly kind: 'cleared'; readonly points: number }
  | { readonly kind: 'bonus'; readonly together: number; readonly points: number }
  | { readonly kind: 'excellent'; readonly inRow: number }
  | { readonly kind: 'hit'; readonly jumper: number };

/** Whether FireRed lets this kind play. */
export function canJump(species: string): boolean {
  return Object.hasOwn(POKEMON_JUMP_MONS, species);
}

/** How a kind jumps, or undefined for one that cannot. */
export function jumpTypeOf(species: string): JumpType | undefined {
  return canJump(species) ? POKEMON_JUMP_MONS[species] : undefined;
}

/** FireRed's `ISO_RANDOMIZE1`, the linear congruence its minigames roll on. */
function nextSeed(seed: number): number {
  return (Math.imul(1103515245, seed) + 24691) >>> 0;
}

/** FireRed's `UpdateVineSpeed`, run each time the vine starts back up. */
function updateVineSpeed(game: Mutable<PokemonJumpGame>): void {
  const random = (): number => {
    game.rngSeed = nextSeed(game.rngSeed);
    return game.rngSeed >>> 16;
  };
  game.vineSpeedAccel = 0;
  if (game.vineSpeedDelay) {
    game.vineSpeedDelay -= 1;
    if (game.atMaxSpeedStage) {
      game.vineSpeed = random() % 4 ? game.nextVineSpeed : game.nextVineSpeed > 54 ? 30 : 82;
    }
    return;
  }
  const count = POKEMON_JUMP_VINE_SPEEDS.length;
  if (!(game.vineBaseSpeedIdx & count)) {
    game.nextVineSpeed = POKEMON_JUMP_VINE_SPEEDS[game.vineBaseSpeedIdx] + game.vineSpeedStage * 7;
    game.vineSpeedDelay = POKEMON_JUMP_VINE_DELAYS[random() % POKEMON_JUMP_VINE_DELAYS.length] + 2;
    game.vineBaseSpeedIdx += 1;
  } else {
    if (game.vineBaseSpeedIdx === count) {
      if (game.vineSpeedStage < 3) game.vineSpeedStage += 1;
      else game.atMaxSpeedStage = true;
    }
    game.nextVineSpeed = POKEMON_JUMP_VINE_SPEEDS[15 - game.vineBaseSpeedIdx] + game.vineSpeedStage * 7;
    game.vineBaseSpeedIdx += 1;
    if (game.vineBaseSpeedIdx > 15) {
      if (random() % 4 === 0) game.nextVineSpeed -= 5;
      game.vineBaseSpeedIdx = 0;
    }
  }
  game.vineSpeed = game.nextVineSpeed;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * A new game for these Pokémon (the first `MAX_JUMPERS` that can jump), the
 * vine at FireRed's start: just past the jumpers' feet, so it goes round once
 * before the first jump is wanted.
 */
export function startPokemonJump(species: readonly string[], seed: number): PokemonJumpGame {
  const jumpers = species
    .filter(canJump)
    .slice(0, MAX_JUMPERS)
    .map((kind): Jumper => ({ species: kind, type: POKEMON_JUMP_MONS[kind], jumpStart: null, offset: 0, hit: false }));
  const game: Mutable<PokemonJumpGame> = {
    frame: 0,
    vineTimer: stateTimer(VINE_UPSWING_LOWER),
    vineState: VINE_UPSWING_LOW,
    prevVineState: VINE_UPSWING_LOW,
    vineSpeed: 0,
    vineSpeedAccel: 0,
    vineSpeedStage: 0,
    vineBaseSpeedIdx: 0,
    vineSpeedDelay: 0,
    nextVineSpeed: 0,
    atMaxSpeedStage: false,
    rngSeed: seed >>> 0,
    jumpers,
    score: 0,
    jumpsInRow: 0,
    excellentsInRow: 0,
    bestExcellents: 0,
    peakTogether: 0,
    scoring: false,
    over: jumpers.length === 0,
    pressed: false,
    carryMs: 0,
    events: [],
  };
  updateVineSpeed(game);
  return game;
}

/** A jumper's height `elapsed` frames into its jump: crouching, then FireRed's arc, then down. */
export function jumpOffsetAt(type: JumpType, elapsed: number): number {
  const index = elapsed - JUMP_CROUCH_FRAMES;
  const arc = POKEMON_JUMP_ARCS[type];
  return index < 0 || index >= arc.length ? 0 : arc[index];
}

/** How many frames a jump takes from the key to landing, crouch included. */
export function jumpFrames(type: JumpType): number {
  return JUMP_CROUCH_FRAMES + POKEMON_JUMP_ARCS[type].length;
}

/** Whether a jumper is on the ground and may jump: not mid-jump, not hit. */
export function isGrounded(jumper: Jumper): boolean {
  return jumper.jumpStart === null && !jumper.hit;
}

/** One of FireRed's frames: the vine moves, the key is read, the jumpers move, and the swing is judged. */
export function stepFrame(previous: PokemonJumpGame, press: boolean): PokemonJumpGame {
  if (previous.over) {
    return { ...previous, pressed: false, events: [] };
  }
  const game: Mutable<PokemonJumpGame> = { ...previous, events: [] };
  const events: JumpEvent[] = [];
  // The vine (`UpdateVineState`, `GetVineSpeed`): faster on the way down.
  game.frame += 1;
  let speed = game.vineSpeed;
  if (game.vineTimer <= stateTimer(VINE_LOWEST)) {
    game.vineSpeedAccel += 80;
    speed += Math.floor(game.vineSpeedAccel / 256);
  }
  game.vineTimer += speed;
  if (game.vineTimer >= stateTimer(NUM_VINESTATES - 1)) {
    game.vineTimer -= stateTimer(NUM_VINESTATES - 1);
  }
  game.prevVineState = game.vineState;
  game.vineState = game.vineTimer >> 8;
  if (game.vineState > VINE_UPSWING_LOWER && game.prevVineState < VINE_UPSWING_LOW) {
    updateVineSpeed(game);
  }
  // The key: everyone on the ground jumps.
  let jumpers = game.jumpers;
  if (press || game.pressed) {
    const leaving = jumpers.flatMap((jumper, index) => (isGrounded(jumper) ? [index] : []));
    if (leaving.length > 0) {
      jumpers = jumpers.map((jumper, index) => (leaving.includes(index) ? { ...jumper, jumpStart: game.frame } : jumper));
      events.push({ kind: 'jump', jumpers: leaving });
    }
  }
  game.pressed = false;
  // Every jumper along its arc (`UpdateJump`).
  jumpers = jumpers.map((jumper) => {
    if (jumper.jumpStart === null) return jumper;
    const elapsed = game.frame - jumper.jumpStart;
    return elapsed >= jumpFrames(jumper.type)
      ? { ...jumper, jumpStart: null, offset: 0 }
      : { ...jumper, offset: jumpOffsetAt(jumper.type, elapsed) };
  });
  // The hit (`UpdateVineHitStates`): the vine under somebody standing on the ground.
  if (game.vineState === VINE_UPSWING_LOWER) {
    const struck = jumpers.findIndex((jumper) => jumper.offset === 0);
    if (struck >= 0) {
      jumpers = jumpers.map((jumper, index) => (index === struck ? { ...jumper, hit: true } : jumper));
      game.jumpers = jumpers;
      game.over = true;
      game.excellentsInRow = 0;
      events.push({ kind: 'hit', jumper: struck });
      game.events = events;
      return game;
    }
  }
  game.jumpers = jumpers;
  // The swing judged as the vine comes back up past them (`TryUpdateScore`).
  if (game.vineState === VINE_UPSWING_HIGH && game.prevVineState === VINE_UPSWING_LOW) {
    if (game.scoring) {
      const team = jumpers.length;
      if (team > 1 && game.peakTogether === team) {
        game.excellentsInRow += 1;
        game.bestExcellents = Math.max(game.bestExcellents, game.excellentsInRow);
        events.push({ kind: 'excellent', inRow: game.excellentsInRow });
      } else {
        game.excellentsInRow = 0;
      }
      game.jumpsInRow += 1;
      game.score = Math.min(POKEMON_JUMP_MAX_SCORE, game.score + POINTS_A_JUMP);
      events.push({ kind: 'cleared', points: POINTS_A_JUMP });
      if (game.peakTogether > 1) {
        const bonus = POKEMON_JUMP_BONUSES[Math.min(game.peakTogether, POKEMON_JUMP_BONUSES.length - 1)];
        game.score = Math.min(POKEMON_JUMP_MAX_SCORE, game.score + bonus);
        events.push({ kind: 'bonus', together: game.peakTogether, points: bonus });
      }
    }
    game.scoring = true;
    game.peakTogether = 0;
  }
  const atPeak = jumpers.filter((jumper) => jumper.offset === POKEMON_JUMP_PEAK).length;
  game.peakTogether = Math.max(game.peakTogether, atPeak);
  if (game.score >= POKEMON_JUMP_MAX_SCORE) {
    game.over = true;
  }
  game.events = events;
  return game;
}

/**
 * The game moved on by `ms` of real time, a key pressed at the start of it
 * or not. Time is spent a FireRed frame at a time and what is left over is
 * kept, so a 100 ms frame plays the same six frames sixty 16 ms ones do; a
 * key pressed between two frames is read on the next one, never dropped.
 * The events are every frame's, in order.
 */
export function advancePokemonJump(game: PokemonJumpGame, ms: number, press: boolean): PokemonJumpGame {
  let next: PokemonJumpGame = { ...game, pressed: game.pressed || press, events: [] };
  let carry = game.carryMs + Math.max(0, ms);
  const events: JumpEvent[] = [];
  while (carry >= FRAME_MS && !next.over) {
    carry -= FRAME_MS;
    next = stepFrame(next, false);
    events.push(...next.events);
  }
  return { ...next, carryMs: next.over ? 0 : carry, events };
}

/** Where the vine is round its swing, 0 at its highest to 1 coming round to it again: for drawing it. */
export function vineTurn(game: PokemonJumpGame): number {
  return game.vineTimer / stateTimer(NUM_VINESTATES - 1);
}

/** FireRed's berries for a score: none under the first line, up to five (`sPrizeQuantityData`). */
export function berriesForScore(score: number): number {
  return POKEMON_JUMP_PRIZES.reduce((won, line) => (score >= line.score ? line.quantity : won), 0);
}
