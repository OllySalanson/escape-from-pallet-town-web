import type { Direction, GridPosition } from '../movement/gridMovement';
import { DIRECTION_DELTAS } from '../movement/gridMovement';
import type { SoundEffectName } from '../audio/soundEffects';

/**
 * An authored sequence of world actions, and the machine that plays one.
 *
 * This is the tutorial's `Cutscene`/`CutsceneAction` pair (a serialized list of
 * actions, each carrying a `waitForCompletion` flag) written for a five-minute
 * extraction raid rather than a story RPG. Three things follow from that, and
 * they are the whole reason this file is not a port:
 *
 * 1. **A cutscene may not cost raid time it did not mean to.** Time the world
 *    spends on itself is free and time the player spends is billed - so every
 *    beat here that runs itself is free, and the one beat that waits on a key
 *    (`say`) is billed exactly as any other dialogue is. See
 *    `CutsceneFrame.waitingForPlayer`, which is what `WorldScene` reads.
 *    A free beat therefore has to be *bounded*, which `CUTSCENE_TIMED_CAP_MS`
 *    holds it to: there is no authored way to stop the clock.
 * 2. **Every beat is skippable or self-advancing**, the rule the defeat
 *    sequence is built on. A timed beat advances itself; a `say` is the
 *    dialogue box, which prompts and is advanced by the player. `checkCutscene`
 *    fails anything else - an unbounded beat with no prompt is a dead end.
 * 3. **Nothing may strand the player.** A cutscene never moves the player,
 *    because the raid's tile is owned by `WorldScene`'s step machinery and is
 *    what extraction, warps, tall grass and the district plate are all read
 *    off; a cutscene that walked the player would have to reconcile every one
 *    of them on the way out. Turning the player is free of all that, and is
 *    all any authored beat has wanted. `checkCutscene` holds the line.
 *
 * The player class is Phaser-free and driven by elapsed milliseconds rather
 * than frames, so a 100ms test-mode frame plays exactly as much of a cutscene
 * as six 16ms ones (see `movement/stepClock.ts`) and the whole thing is
 * testable without a scene.
 */

/** The reserved actor id: the one figure a cutscene may turn but never move. */
export const PLAYER_ACTOR = 'player';

/** The marks a cutscene can raise over an actor's head. */
export type CutsceneEmote = 'spotted';

/**
 * The ceiling on a cutscene's self-running time.
 *
 * Free raid time the player cannot act in is a gift, and a long one is a stall:
 * the longest authored watch walks five tiles and the whole beat is under one
 * and a quarter seconds. Two seconds is the outer edge of "an event, not an
 * interruption", and `checkCutscene` refuses anything past it.
 */
export const CUTSCENE_TIMED_CAP_MS = 2000;

interface ActionCommon {
  /**
   * The tutorial's own flag. `false` starts the beat and moves straight on to
   * the next one, so a sound or a fade can run under a walk. The default is to
   * wait.
   */
  readonly waitForCompletion?: boolean;
}

export type CutsceneAction =
  /** A held breath. The only beat that does nothing but take time. */
  | ({ readonly kind: 'wait'; readonly durationMs: number } & ActionCommon)
  /**
   * Lines in the world's dialogue box. The one beat that waits on the player,
   * and so the one beat the raid clock is charged for.
   */
  | ({
      readonly kind: 'say';
      readonly lines: readonly string[];
      /** Tiles the lines are about, so the box is seated clear of them. */
      readonly about?: readonly GridPosition[];
    } & ActionCommon)
  | ({ readonly kind: 'turn'; readonly actor: string; readonly facing: Direction } & ActionCommon)
  /** A walk, one tile per `stepMs`, facing the way it is going. */
  | ({
      readonly kind: 'move';
      readonly actor: string;
      readonly path: readonly GridPosition[];
      readonly stepMs: number;
    } & ActionCommon)
  | ({
      readonly kind: 'emote';
      readonly actor: string;
      readonly emote: CutsceneEmote;
      readonly durationMs: number;
    } & ActionCommon)
  | ({
      readonly kind: 'teleport';
      readonly actor: string;
      readonly to: GridPosition;
    } & ActionCommon)
  /** The tutorial's enable/disable object, which for us is one figure's sprite. */
  | ({ readonly kind: 'show'; readonly actor: string; readonly visible: boolean } & ActionCommon)
  | ({
      readonly kind: 'fade';
      readonly to: 'black' | 'clear';
      readonly durationMs: number;
    } & ActionCommon)
  | ({ readonly kind: 'sound'; readonly effect: SoundEffectName } & ActionCommon);

/** Where an actor stands when the cutscene opens. */
export interface CutscenePlacement {
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
}

export interface Cutscene {
  /** Names the authored beat, for tests and for anything that logs one. */
  readonly id: string;
  /** Every actor the actions name, and where each one begins. */
  readonly actors: Readonly<Record<string, CutscenePlacement>>;
  readonly actions: readonly CutsceneAction[];
}

/** An actor's state this instant. Positions are in (fractional) tiles. */
export interface CutsceneActorFrame {
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
  readonly visible: boolean;
  /** The mark over the actor's head, with how long it has been up. */
  readonly emote: { readonly kind: CutsceneEmote; readonly elapsedMs: number } | null;
}

export interface CutsceneSpeech {
  readonly lines: readonly string[];
  readonly about: readonly GridPosition[];
}

/** What the scene has to put on screen for this tick. */
export interface CutsceneFrame {
  readonly actors: ReadonlyMap<string, CutsceneActorFrame>;
  /** Raised this tick - never repeated on a later one. */
  readonly speech: CutsceneSpeech | null;
  readonly sounds: readonly SoundEffectName[];
  readonly fade: { readonly to: 'black' | 'clear'; readonly durationMs: number } | null;
  /**
   * True while the cutscene is held on a beat the player has to answer. It is
   * the whole of the clock rule: false means the world is spending its own
   * time and the raid clock does not run, true means the player is reading and
   * it does.
   */
  readonly waitingForPlayer: boolean;
  readonly done: boolean;
}

/** How long a beat runs itself, or null when it waits on the player. */
export function actionDurationMs(action: CutsceneAction): number | null {
  switch (action.kind) {
    case 'say':
      return null;
    case 'wait':
    case 'emote':
    case 'fade':
      return action.durationMs;
    case 'move':
      return action.path.length * action.stepMs;
    default:
      return 0;
  }
}

/**
 * The cutscene's own time: what it takes with nobody touching a key, and so
 * exactly what the raid clock is not charged for.
 *
 * Beats started with `waitForCompletion: false` run under the ones that follow,
 * so they add nothing to the total - the walk they run under is what the
 * cutscene actually waits for.
 */
export function cutsceneTimedMs(cutscene: Cutscene): number {
  return cutscene.actions.reduce(
    (total, action) =>
      action.waitForCompletion === false ? total : total + (actionDurationMs(action) ?? 0),
    0,
  );
}

/**
 * Everything wrong with an authored cutscene, in words. Empty is a good one.
 *
 * These are the three constraints at the top of this file made checkable, so a
 * beat that could strand the player or stop the clock fails in a test rather
 * than in a raid.
 */
export function checkCutscene(cutscene: Cutscene): readonly string[] {
  const problems: string[] = [];
  const say = (problem: string) => problems.push(`${cutscene.id}: ${problem}`);
  if (cutscene.actions.length === 0) {
    say('has no actions');
  }
  for (const [index, action] of cutscene.actions.entries()) {
    const at = `action ${index} (${action.kind})`;
    if ('actor' in action) {
      if (!(action.actor in cutscene.actors)) {
        say(`${at} names actor "${action.actor}", which has no starting placement`);
      }
      if (action.actor === PLAYER_ACTOR && action.kind !== 'turn') {
        say(`${at} would ${action.kind} the player, and only a turn is safe`);
      }
    }
    if (action.kind === 'say' && action.waitForCompletion === false) {
      say(`${at} would walk out from under its own dialogue box`);
    }
    if (action.kind === 'say' && action.lines.length === 0) {
      say(`${at} has no lines, so it would wait on a box nobody can see`);
    }
    if (action.kind === 'move' && (action.path.length === 0 || action.stepMs <= 0)) {
      say(`${at} is a walk with no ground to cover`);
    }
    const duration = actionDurationMs(action);
    if (duration !== null && duration < 0) {
      say(`${at} runs for less than no time`);
    }
  }
  const timed = cutsceneTimedMs(cutscene);
  if (timed > CUTSCENE_TIMED_CAP_MS) {
    say(`runs itself for ${timed}ms, past the ${CUTSCENE_TIMED_CAP_MS}ms an event may take`);
  }
  return problems;
}

interface MutableActor {
  x: number;
  y: number;
  facing: Direction;
  visible: boolean;
  emote: { kind: CutsceneEmote; elapsedMs: number } | null;
}

interface RunningAction {
  readonly action: CutsceneAction;
  readonly durationMs: number;
  /** Where a walk started, so it is interpolated from there and not from itself. */
  readonly origin: GridPosition | null;
  elapsedMs: number;
  /**
   * For a beat started mid-tick with `waitForCompletion: false`: how much of
   * that tick was still unspent when it began, so it is credited with the part
   * of the tick it actually ran for and not with the whole of it.
   */
  startedWithMsLeft: number | null;
}

function directionBetween(from: GridPosition, to: GridPosition, fallback: Direction): Direction {
  for (const [direction, delta] of Object.entries(DIRECTION_DELTAS) as [
    Direction,
    GridPosition,
  ][]) {
    if (from.x + delta.x === to.x && from.y + delta.y === to.y) {
      return direction;
    }
  }
  return fallback;
}

/**
 * Plays one authored cutscene, a tick at a time.
 *
 * The scene owns the sprites; this owns the sequence. It is told how much time
 * passed and, when a dialogue beat's box has closed, that the player answered -
 * and it hands back what should be on screen. It refuses to be built from a
 * cutscene `checkCutscene` rejects, so an authoring mistake never reaches a
 * raid as a frozen player.
 */
export class CutscenePlayer {
  private readonly actors = new Map<string, MutableActor>();
  private readonly background: RunningAction[] = [];
  private index = 0;
  private current: RunningAction | null = null;
  private waiting = false;
  private finished = false;
  public readonly cutscene: Cutscene;

  public constructor(cutscene: Cutscene) {
    this.cutscene = cutscene;
    const problems = checkCutscene(cutscene);
    if (problems.length > 0) {
      throw new Error(problems.join('; '));
    }
    for (const [id, placement] of Object.entries(cutscene.actors)) {
      this.actors.set(id, { ...placement, visible: true, emote: null });
    }
  }

  public get done(): boolean {
    return this.finished;
  }

  public get waitingForPlayer(): boolean {
    return this.waiting;
  }

  /** The scene's word that the dialogue beat's box has been read and closed. */
  public dialogueClosed(): void {
    if (!this.waiting) {
      return;
    }
    this.waiting = false;
    this.current = null;
    this.index += 1;
  }

  public advance(deltaMs: number): CutsceneFrame {
    const sounds: SoundEffectName[] = [];
    let speech: CutsceneSpeech | null = null;
    let fade: CutsceneFrame['fade'] = null;

    let remainingMs = deltaMs;
    // Bounded by the action list: every turn of this loop either consumes the
    // whole of the remaining time or steps the cursor on.
    while (!this.finished && !this.waiting) {
      if (this.current === null) {
        const action = this.cutscene.actions[this.index];
        if (!action) {
          this.finished = true;
          break;
        }
        const durationMs = actionDurationMs(action);
        const running: RunningAction = {
          action,
          durationMs: durationMs ?? 0,
          origin: this.originFor(action),
          elapsedMs: 0,
          startedWithMsLeft: null,
        };
        if (action.kind === 'sound') {
          sounds.push(action.effect);
        } else if (action.kind === 'fade') {
          fade = { to: action.to, durationMs: action.durationMs };
        } else if (action.kind === 'say') {
          speech = { lines: action.lines, about: action.about ?? [] };
        }
        this.applyStart(action);
        if (durationMs === null) {
          // A `say`: the box is up, and nothing moves until it is answered.
          this.waiting = true;
          break;
        }
        if (action.waitForCompletion === false) {
          if (durationMs > 0) {
            running.startedWithMsLeft = remainingMs;
            this.background.push(running);
          } else {
            this.applyProgress(running, durationMs);
          }
          this.index += 1;
          continue;
        }
        this.current = running;
      }

      const running = this.current;
      const leftMs = running.durationMs - running.elapsedMs;
      if (remainingMs < leftMs) {
        running.elapsedMs += remainingMs;
        this.applyProgress(running, running.elapsedMs);
        remainingMs = 0;
        break;
      }
      remainingMs -= leftMs;
      this.applyProgress(running, running.durationMs);
      this.current = null;
      this.index += 1;
    }

    // Last, so a beat started part-way through this tick is advanced by the
    // part of the tick it was running for rather than by all of it.
    this.advanceBackground(deltaMs, remainingMs);

    return {
      actors: this.frameActors(),
      speech,
      sounds,
      fade,
      waitingForPlayer: this.waiting,
      done: this.finished,
    };
  }

  private originFor(action: CutsceneAction): GridPosition | null {
    if (action.kind !== 'move') {
      return null;
    }
    const actor = this.actors.get(action.actor);
    return actor ? { x: actor.x, y: actor.y } : null;
  }

  private advanceBackground(deltaMs: number, remainingMs: number): void {
    for (let index = this.background.length - 1; index >= 0; index -= 1) {
      const running = this.background[index];
      const ranForMs =
        running.startedWithMsLeft === null ? deltaMs : running.startedWithMsLeft - remainingMs;
      running.startedWithMsLeft = null;
      running.elapsedMs = Math.min(running.durationMs, running.elapsedMs + Math.max(0, ranForMs));
      this.applyProgress(running, running.elapsedMs);
      if (running.elapsedMs >= running.durationMs) {
        this.background.splice(index, 1);
      }
    }
  }

  /** What a beat does the instant it begins. */
  private applyStart(action: CutsceneAction): void {
    if (!('actor' in action)) {
      return;
    }
    const actor = this.actors.get(action.actor);
    if (!actor) {
      return;
    }
    switch (action.kind) {
      case 'turn':
        actor.facing = action.facing;
        break;
      case 'teleport':
        actor.x = action.to.x;
        actor.y = action.to.y;
        break;
      case 'show':
        actor.visible = action.visible;
        break;
      case 'emote':
        actor.emote = { kind: action.emote, elapsedMs: 0 };
        break;
      default:
        break;
    }
  }

  /** Where a beat has got to, `elapsedMs` into its own run. */
  private applyProgress(running: RunningAction, elapsedMs: number): void {
    const { action, durationMs } = running;
    if (action.kind === 'emote') {
      const actor = this.actors.get(action.actor);
      if (actor) {
        actor.emote = elapsedMs >= durationMs ? null : { kind: action.emote, elapsedMs };
      }
      return;
    }
    if (action.kind !== 'move') {
      return;
    }
    const actor = this.actors.get(action.actor);
    const origin = running.origin;
    if (!actor || !origin) {
      return;
    }
    // Read off the path from where the walk began rather than accumulated from
    // the actor's own position, so it covers the same ground however the frames
    // fall - the stepClock.ts argument, for a figure nobody is steering.
    const walked = Math.min(elapsedMs, durationMs) / action.stepMs;
    const index = Math.min(Math.floor(walked), action.path.length - 1);
    const from = index === 0 ? origin : action.path[index - 1];
    const to = action.path[index];
    actor.facing = directionBetween(from, to, actor.facing);
    if (elapsedMs >= durationMs) {
      actor.x = to.x;
      actor.y = to.y;
      return;
    }
    const within = Math.min(1, walked - index);
    actor.x = from.x + (to.x - from.x) * within;
    actor.y = from.y + (to.y - from.y) * within;
  }

  private frameActors(): ReadonlyMap<string, CutsceneActorFrame> {
    const frame = new Map<string, CutsceneActorFrame>();
    for (const [id, actor] of this.actors) {
      frame.set(id, {
        x: actor.x,
        y: actor.y,
        facing: actor.facing,
        visible: actor.visible,
        emote: actor.emote === null ? null : { ...actor.emote },
      });
    }
    return frame;
  }
}
