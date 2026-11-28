import { honoursWorn } from '../look/gymHonours';
import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import { compassBearing } from '../world/bearing';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { CHARACTER_FEET_PIXEL_Y, getIdleFrame } from '../playerFrames';
import { lookTexture, lookWalkKey } from '../look/lookTexture';
import { readLook } from '../look/look';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { MenuOverlay } from '../ui/MenuOverlay';
import { pickerBasics, pickerEntries, pickerOrder, wirePickerFind } from '../ui/boxPicker';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { RELEASE_ARMING_MS, RESULT_HOLD_MS } from '../ui/spatialFocus';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow, WINDOW_PAPER, WINDOW_INK } from '../ui/pixelWindow';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { MapLayers, TileLayer } from '../world/tiles';
import { TOWN_PIECES } from '../world/generated/townPieces';
import { TOWN_SHEET_SOURCE } from '../world/tileset/townSheet';
import { FIELD_MOVES, type FieldMoveId } from '../world/fieldMoves';
import { courseTime } from '../minigames/gameCornerTalk';
import { courseTeamMarkup, type CourseCandidate, type CourseTeamState } from '../minigames/gameCornerView';
import { COURSE_SOURCES, courseLayers } from '../minigames/courseMap';
import {
  advanceCourse,
  COURSE_TEAM_SIZE,
  courseMovesOf,
  doerOf,
  facedObstacle,
  fastestRun,
  PROMENADE_COURSE,
  runnerAt,
  startCourse,
  type CourseMove,
  type CourseRun,
  type CourseRunner,
} from '../minigames/fieldCourse';
import { NO_GAME_CORNER, today, type GameCornerRecord } from '../minigames/tickets';
import { courseLineups, playerOf, type Lineup } from '../minigames/whoPlays';
import { READY_MS, readyBeat, readyKey, tickReady, type ReadyBeat } from '../minigames/readyBeat';
import { payLadder, wonLine, wonThings } from '../minigames/payLadder';
import { drawResultCard, ReadyPlate, takeDown } from './minigameCards';
import { hideHarbourUnder } from './coverHarbour';

export interface FieldCourseSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

const TILE = 16;
/** A figure stands its feet on a tile's last row, as the harbour draws one. */
const RUNNER_Y_OFFSET = TILE - CHARACTER_FEET_PIXEL_Y;
/** A wall walked into again inside this long is the same bump, said once. */
const BUMP_QUIET_MS = 700;
/** How long a line said on the course stays up. */
const SAY_MS = 1600;
/** How long the finish is shown before the result. */
const FINISH_PAUSE_MS = 1200;
/** The opening look along the course: held on the finish this long... */
const COURSE_INTRO_HOLD_MS = 900;
/** ...and back at the runner by this long after the course opens. */
const COURSE_INTRO_MS = 2000;
/** The frame the boulder is cut as on the town sheet's texture, as `WorldScene` names it. */
const BOULDER_FRAME = 'strength-boulder';

/** A field move as the keeper says it, in the order the course meets them. */
const MOVE_WORDS: Readonly<Record<FieldMoveId, string>> = { cut: 'CUT', 'rock-smash': 'ROCK SMASH', strength: 'STRENGTH', surf: 'SURF' };
const MOVE_ORDER: readonly FieldMoveId[] = ['cut', 'rock-smash', 'strength', 'surf'];

type Phase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'running' }
  | { readonly kind: 'finished'; readonly elapsed: number }
  | { readonly kind: 'result' }
  | { readonly kind: 'choosing' };

/** One beat of the ghost's walk: where it stands, which way it faces, and the tile it does a field move on, if it does one. */
interface GhostStep {
  readonly at: GridPosition;
  readonly facing: Direction;
  readonly opens: GridPosition | null;
}

/** How long the ghost takes over a tile, or over its field move. */
const GHOST_BEAT_MS = 240;
/** How many beats it stands at the end of its walk before it walks it again. */
const GHOST_REST_BEATS = 3;
/** How far the ghost walks for a team with no field move to show. */
const GHOST_STEPS_WITHOUT_A_MOVE = 8;

/** The tile one step from another. */
function step(at: GridPosition, way: Direction): GridPosition {
  return {
    x: at.x + (way === 'left' ? -1 : way === 'right' ? 1 : 0),
    y: at.y + (way === 'up' ? -1 : way === 'down' ? 1 : 0),
  };
}

/**
 * THE FIELD-MOVE COURSE over the paused harbour, from the press at its gate
 * (or to its keeper) to the finish.
 *
 * The course opens on the run (the harbour audit, 27 Nov 2026, fault 3: a
 * form of who goes round, and the keeper's three lines of rules and pay
 * before it). The team is the keeper's pick - the partner, and whoever adds
 * the field moves it lacks (`minigames/whoPlays.ts`) - and while the view
 * runs back along the course from the finish to the runner it stands ready,
 * a plate saying who goes round, and P there (or on the result card) opens
 * the list where up to three are chosen (`minigames/gameCornerView.ts`). Until the first step a ghost of the runner walks the
 * quickest line ahead to the first thing in the way and does the field move
 * on it, over and over: that is the course's lesson. The time and the ladder
 * of what it pays are on the result card after (`minigameCards.ts`).
 *
 * The rules are `minigames/fieldCourse.ts` and nothing here decides anything:
 * the scene hands the run each frame's milliseconds, the direction held and
 * whether the interact key went down, and draws what comes back - the yard in
 * the map maker's own tiles (`minigames/courseMap.ts`), laid again whenever a
 * tree is cut, a rock broken or the pond surfed shallow; the boulders as
 * figures, because they move; the runner in the player's own look, walking
 * a tile at a time as the harbour does; and the stopwatch. What a run pays is
 * written by `SaveManager.playGame`, one write.
 */
export class FieldCourseScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private pausedBase = false;
  private game_: RestoredGame | undefined;
  /** Who may go round, the keeper's team first (`whoPlays.ts`), and which stands ready. */
  private lineups: Lineup[] = [];
  private lineupAt = 0;
  private beat: ReadyBeat = readyBeat();
  /** The list of who goes round, while it is open, and who it has chosen. */
  private overlay: MenuOverlay | undefined;
  private chosen: string[] = [];
  private status: string | undefined;
  /** What the list's find field held (`ui/boxPicker.ts`). */
  private find = '';
  /** What the last run came to, for the list's bar. */
  private last: CourseTeamState['last'];
  /** When the list opened, so the press that opened it cannot also play. */
  private pickerOpenedAt = Number.NEGATIVE_INFINITY;
  private plate: ReadyPlate | undefined;
  private card: Phaser.GameObjects.GameObject[] = [];
  /** When the last run ended: AGAIN takes no press for `RESULT_HOLD_MS` after. */
  private finishedAt = Number.NEGATIVE_INFINITY;
  private phase: Phase = { kind: 'ready' };
  private run: CourseRun | undefined;
  private team: CourseRunner[] = [];
  private pressed = false;
  private held: Direction[] = [];
  private world: Phaser.GameObjects.GameObject[] = [];
  private layers: Phaser.Tilemaps.TilemapLayer[] = [];
  private runner: Phaser.GameObjects.Sprite | undefined;
  private runnerTexture = '';
  /** The runner's ghost, walking the quickest line to the first field move until the first step. */
  private ghost: { sprite: Phaser.GameObjects.Sprite; ring: Phaser.GameObjects.Graphics; path: GhostStep[] } | undefined;
  private boulders: Phaser.GameObjects.Image[] = [];
  private clock: Phaser.GameObjects.Text | undefined;
  private saying: { text: Phaser.GameObjects.Text; panel: Phaser.GameObjects.Graphics; until: number } | undefined;
  private lastBump: { key: string; at: number } | undefined;
  /** The opening look along the course, finish to runner, in ms of the scene's own frames; undefined once over. */
  private intro: number | undefined;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('field-course');
  }

  public init(data: FieldCourseSceneData): void {
    this.pausedBase = data.pausedBase;
    this.phase = { kind: 'ready' };
    this.run = undefined;
    this.pressed = false;
    this.held = [];
    this.card = [];
    this.plate = undefined;
    this.finishedAt = Number.NEGATIVE_INFINITY;
    this.game_ = this.saveManager.load() ?? undefined;
    this.lineups = this.game_ ? courseLineups(this.game_.stash) : [];
    this.lineupAt = 0;
    this.overlay = undefined;
    this.chosen = [];
    this.status = undefined;
    this.last = undefined;
    this.pickerOpenedAt = Number.NEGATIVE_INFINITY;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.tearDownStage();
    });
    recordAction('Opened THE FIELD-MOVE COURSE');
  }

  public create(): void {
    // The course covers the whole of the harbour paused under it (`coverHarbour.ts`).
    if (this.pausedBase) hideHarbourUnder(this);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onGameKey(event, true));
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => this.onGameKey(event, false));
    if (this.lineups.length > 0) this.standReady();
    else this.time.delayedCall(0, () => this.close());
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'FIELD-MOVE COURSE' },
      { label: 'Phase', value: this.phase.kind },
      { label: 'Going round', value: this.lineup().map((player) => player.species).join(', ') },
      ...(this.run?.elapsedMs !== null && this.run ? [{ label: 'Time', value: courseTime(this.run.elapsedMs ?? 0) }] : []),
    ];
  }

  /** For a playtest driver: the run in progress, if there is one. */
  public get courseRun(): CourseRun | undefined {
    return this.run;
  }

  /** For a playtest driver: the quickest line round for the team that is running, as a sharp player runs it. */
  public driverLine(): readonly CourseMove[] {
    return this.run ? (fastestRun(PROMENADE_COURSE, this.run.moves)?.line ?? []) : [];
  }

  /** For a playtest driver: where the screen is - `ready`, `running`, `finished` or `result`. */
  public get phaseKind(): Phase['kind'] {
    return this.phase.kind;
  }

  /** For a playtest driver: every lineup on offer, by ids. */
  public get lineupIds(): readonly (readonly string[])[] {
    return this.lineups.map((lineup) => lineup.map((player) => player.id));
  }

  /**
   * For a playtest driver: run now with exactly these stored ids, as a team
   * of the driver's own choosing when it is not one the course offers.
   * Whether they are all in the vault.
   */
  public playWith(ids: readonly string[]): boolean {
    if (!this.takeTeam(ids)) return false;
    this.standReady();
    this.play();
    return true;
  }

  /** Makes exactly these stored ids the team standing ready, a lineup of their own if the course offers none. Whether they are all in the vault. */
  private takeTeam(ids: readonly string[]): boolean {
    let index = this.lineups.findIndex((lineup) => lineup.length === ids.length && lineup.every((player) => ids.includes(player.id)));
    if (index < 0) {
      const stored = this.game_?.stash.listPokemon() ?? [];
      const team = ids.flatMap((id) => {
        const found = stored.find((each) => each.id === id);
        return found ? [playerOf(found)] : [];
      });
      if (team.length === 0 || team.length !== ids.length) return false;
      this.lineups = [...this.lineups, team];
      index = this.lineups.length - 1;
    }
    this.lineupAt = index;
    return true;
  }

  private record(): GameCornerRecord {
    return this.game_?.raidProgress.gameCorner ?? NO_GAME_CORNER;
  }

  private lineup(): Lineup {
    return this.lineups[this.lineupAt] ?? [];
  }

  private teamMoves(team: readonly CourseRunner[]): FieldMoveId[] {
    return MOVE_ORDER.filter((move) => doerOf(team, move) !== undefined);
  }

  // --- the run --------------------------------------------------------------------

  /** The team standing ready at the start: the run made for them and drawn, the view running back from the finish, the plate over it. */
  private standReady(): void {
    this.takeDownCard();
    this.team = this.lineup().map((player) => ({ species: player.species, name: player.name }));
    if (this.team.length === 0) return;
    this.run = startCourse(PROMENADE_COURSE, this.teamMoves(this.team));
    this.pressed = false;
    this.held = [];
    this.phase = { kind: 'ready' };
    this.beat = readyBeat();
    this.buildStage();
    this.plate = new ReadyPlate(this, 40);
    this.plate.show({ lineup: this.lineup(), canPick: this.canPick() });
  }

  /** The run is on: the plate goes, the view is back on the runner, and the clock waits for the first step. */
  private play(): void {
    if (this.phase.kind !== 'ready' || !this.run) return;
    this.plate?.destroy();
    this.plate = undefined;
    if (this.intro !== undefined) {
      this.intro = COURSE_INTRO_MS;
      this.lookAlongTheCourse();
    }
    audioManager.play('confirm');
    recordAction(`Ran THE FIELD-MOVE COURSE with ${this.team.map((runner) => runner.species).join(', ')}`);
    this.phase = { kind: 'running' };
  }

  /** The result is read and SPACE is pressed: the same team stands ready again. */
  private again(): void {
    if (this.phase.kind !== 'result' || this.time.now - this.finishedAt < RESULT_HOLD_MS) return;
    this.standReady();
  }

  private takeDownCard(): void {
    takeDown(this.card);
    this.card = [];
  }

  /** Whether the list has anybody else to send round: one Pokémon alone has nobody. */
  private canPick(): boolean {
    return (this.game_?.stash.listPokemon().length ?? 0) > 1;
  }

  // --- the list of who goes round ----------------------------------------------------

  private candidates(): CourseCandidate[] {
    const stash = this.game_?.stash;
    if (!stash) return [];
    // Every box, the most field moves first (`ui/boxPicker.ts`).
    return pickerOrder(pickerEntries(stash), (entry) => courseMovesOf(entry.pokemon.base.id).length).map((entry) => ({
      ...pickerBasics(entry),
      moves: MOVE_ORDER.filter((move) => courseMovesOf(entry.pokemon.base.id).includes(move)).map((move) => MOVE_WORDS[move]),
    }));
  }

  private teamOf(ids: readonly string[]): CourseRunner[] {
    const stash = this.game_?.stash;
    if (!stash) return [];
    return ids.flatMap((id) => {
      const stored = stash.listPokemon().find((candidate) => candidate.id === id);
      return stored ? [{ species: stored.pokemon.base.id, name: stored.pokemon.name.toUpperCase() }] : [];
    });
  }

  /** P: the yard taken down and the list of who goes round up, the team that stood ready chosen on it. */
  private openPicker(): void {
    if (this.phase.kind !== 'ready' && this.phase.kind !== 'result') return;
    this.takeDownCard();
    this.tearDownStage();
    this.run = undefined;
    this.phase = { kind: 'choosing' };
    this.chosen = this.lineup().map((player) => player.id);
    this.status = undefined;
    this.pickerOpenedAt = this.time.now;
    audioManager.play('menuOpen');
    recordAction('Opened who goes round THE FIELD-MOVE COURSE');
    this.showMenu();
  }

  private showMenu(focusOn?: string): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'game-corner-screen pixel-ui wood-floor', (event) => this.onMenuKey(event));
    }
    const record = this.record();
    const team = this.teamOf(this.chosen);
    const moves = this.teamMoves(team);
    const fastest = team.length > 0 ? fastestRun(PROMENADE_COURSE, moves) : null;
    const best = record.best['field-course'] ?? 0;
    this.overlay.redraw(
      courseTeamMarkup({
        candidates: this.candidates(),
        chosen: this.chosen,
        most: COURSE_TEAM_SIZE,
        teamMoves: moves.map((move) => MOVE_WORDS[move]),
        fastest: fastest ? courseTime(fastest.ms) : null,
        tickets: record.tickets,
        best: best > 0 ? courseTime(best) : null,
        ...(this.status ? { status: this.status } : {}),
        ...(this.last ? { last: this.last } : {}),
      }),
    );
    const root = this.overlay.root;
    root.setAttribute('aria-label', 'FIELD-MOVE COURSE');
    root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.closePicker();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-runner]').forEach((button) => {
      button.onclick = () => this.toggle(button.dataset.runner ?? '', button);
    });
    const play = root.querySelector<HTMLButtonElement>('[data-play]');
    if (play) {
      play.onclick = () => {
        if (play.getAttribute('aria-disabled') === 'true' || !this.takeTeam(this.chosen)) {
          audioManager.play('denied');
          return;
        }
        if (this.time.now - this.pickerOpenedAt < RELEASE_ARMING_MS) return;
        this.closePicker();
      };
    }
    // The find over the list narrows it in place, and is kept over a redraw.
    wirePickerFind(root, (key) => this.overlay?.moveCursor(key), this.find);
    root.querySelector<HTMLInputElement>('[data-picker-find]')?.addEventListener('input', (event) => {
      this.find = (event.target as HTMLInputElement).value;
    });
    this.overlay.refocus(focusOn ?? (this.chosen.length > 0 ? '[data-play]' : '[data-cursor-start]'), '[data-close]');
  }

  private toggle(id: string, button: HTMLButtonElement): void {
    if (this.chosen.includes(id)) {
      this.chosen = this.chosen.filter((other) => other !== id);
      audioManager.play('cancel');
    } else if (this.chosen.length < COURSE_TEAM_SIZE && button.getAttribute('aria-disabled') !== 'true') {
      this.chosen = [...this.chosen, id];
      audioManager.play('confirm');
    } else {
      audioManager.play('denied');
      return;
    }
    this.status = undefined;
    this.showMenu(`[data-runner="${id}"]`);
  }

  private onMenuKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event)) {
      event.preventDefault();
      this.closePicker();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /** The list down, and the yard back, whoever the list left chosen standing ready at the start. */
  private closePicker(): void {
    if (this.phase.kind !== 'choosing') return;
    this.overlay?.destroy();
    this.overlay = undefined;
    this.status = undefined;
    audioManager.play('menuClose');
    this.standReady();
  }

  /** For a playtest driver: hold a direction, as the arrow keys do, or let go of them all. */
  public hold(direction: Direction | null): void {
    this.held = direction ? [direction] : [];
  }

  /** For a playtest driver: press the interact key, as SPACE does. */
  public interact(): void {
    if (this.phase.kind === 'running') this.pressed = true;
  }

  private onGameKey(event: KeyboardEvent, down: boolean): void {
    const phase = this.phase.kind;
    // The list of who goes round has its own keys (`onMenuKey`).
    if (phase === 'choosing') return;
    if (phase === 'ready' || phase === 'result') {
      if (!down || event.repeat) return;
      const action = readyKey(event.key);
      if (!action) return;
      event.preventDefault();
      if (action.kind === 'leave') this.close();
      else if (action.kind === 'pick') {
        if (this.canPick()) this.openPicker();
      } else if (phase === 'ready') this.play();
      else this.again();
      return;
    }
    if (phase !== 'running') return;
    if (down && event.key === 'Escape') {
      this.finish(false);
      return;
    }
    const direction: Direction | null = ['ArrowLeft', 'a', 'A'].includes(event.key)
      ? 'left'
      : ['ArrowRight', 'd', 'D'].includes(event.key)
        ? 'right'
        : ['ArrowUp', 'w', 'W'].includes(event.key)
          ? 'up'
          : ['ArrowDown', 's', 'S'].includes(event.key)
            ? 'down'
            : null;
    if (direction) {
      event.preventDefault();
      this.held = this.held.filter((other) => other !== direction);
      if (down) this.held.push(direction);
      return;
    }
    if (down && !event.repeat && [' ', 'Enter', 'z', 'Z'].includes(event.key)) {
      event.preventDefault();
      this.pressed = true;
    }
  }

  public update(_time: number, delta: number): void {
    const phase = this.phase;
    if (phase.kind === 'result' || phase.kind === 'choosing' || !this.run) return;
    if (phase.kind === 'ready') {
      const ticked = tickReady(this.beat, delta);
      this.beat = ticked.beat;
      this.plate?.tick(this.beat.leftMs / READY_MS, this.time.now);
      if (this.intro !== undefined) {
        this.intro += delta;
        this.lookAlongTheCourse();
      }
      this.drawGhost();
      this.drawStage();
      if (ticked.go) this.play();
      return;
    }
    if (phase.kind === 'finished') {
      this.phase = { kind: 'finished', elapsed: phase.elapsed + delta };
      this.drawStage();
      if (phase.elapsed + delta >= FINISH_PAUSE_MS) this.finish(true);
      return;
    }
    const press = this.pressed;
    this.pressed = false;
    this.run = advanceCourse(this.run, delta, this.held[this.held.length - 1] ?? null, press);
    for (const event of this.run.events) {
      if (event.kind === 'opened') {
        const doer = doerOf(this.team, event.move);
        audioManager.play(event.move === 'surf' ? 'confirm' : 'lootPickup');
        this.say(`${doer?.name ?? 'Somebody'} used ${MOVE_WORDS[event.move]}!`);
        this.layTiles();
      }
      if (event.kind === 'pushed') audioManager.play('ledgeHop');
      if (event.kind === 'bump') {
        const key = `${event.at.x},${event.at.y}`;
        const quiet = this.lastBump && this.lastBump.key === key && this.time.now - this.lastBump.at < BUMP_QUIET_MS;
        this.lastBump = { key, at: this.time.now };
        if (quiet) continue;
        audioManager.play('bump');
        if (event.needs && !this.run.moves.includes(event.needs)) {
          this.say(`Nobody here could learn ${MOVE_WORDS[event.needs]}. The long way round!`);
        } else if (event.needs && event.needs !== 'strength') {
          this.say(`SPACE: ${MOVE_WORDS[event.needs]} it.`);
        }
      }
      if (event.kind === 'read') this.say(event.lines.join(' '), 3200);
      if (event.kind === 'finished') {
        audioManager.play('itemObtained');
        this.say(`FINISH! ${courseTime(event.ms)}`, FINISH_PAUSE_MS);
        this.phase = { kind: 'finished', elapsed: 0 };
      }
    }
    this.drawGhost();
    this.drawStage();
  }

  /**
   * Where the opening look has got to: held on the finish, then eased back to
   * the runner, and following them from then on.
   */
  private lookAlongTheCourse(): void {
    const run = this.run;
    const camera = this.cameras.main;
    if (this.intro === undefined || !run || !this.runner) return;
    const line = run.course.finish;
    const finish = line[Math.floor(line.length / 2)];
    const from = { x: finish.x * TILE + TILE / 2, y: finish.y * TILE + TILE / 2 };
    const start = runnerAt(run);
    const to = { x: start.x * TILE + TILE / 2, y: start.y * TILE + TILE / 2 };
    const t = Math.min(1, Math.max(0, (this.intro - COURSE_INTRO_HOLD_MS) / (COURSE_INTRO_MS - COURSE_INTRO_HOLD_MS)));
    const eased = t * t * (3 - 2 * t);
    camera.centerOn(Math.round(from.x + (to.x - from.x) * eased), Math.round(from.y + (to.y - from.y) * eased));
    if (this.intro >= COURSE_INTRO_MS) {
      this.intro = undefined;
      camera.startFollow(this.runner, true, 1, 1, -TILE / 2, -TILE);
    }
  }

  /** The run is over: its time written and paid if it was finished, and the result card over the yard. */
  private finish(completed: boolean): void {
    const run = this.run;
    if (!run || (this.phase.kind !== 'running' && this.phase.kind !== 'finished')) return;
    this.phase = { kind: 'result' };
    this.finishedAt = this.time.now;
    this.held = [];
    this.ghost?.sprite.setVisible(false);
    this.ghost?.ring.clear();
    const done = completed && run.finished && run.elapsedMs !== null;
    const written = done ? this.saveManager.playGame('field-course', Math.max(1, Math.round(run.elapsedMs ?? 0))) : null;
    if (done) recordAction(`THE FIELD-MOVE COURSE in ${courseTime(run.elapsedMs ?? 0)}`);
    if (written) this.game_ = written.game;
    this.last = written ? { time: courseTime(run.elapsedMs ?? 0), payout: written.payout } : undefined;
    const won = written ? wonThings(written.payout.tickets, []) : [];
    if (won.length > 0) audioManager.play('itemObtained');
    const record = written?.payout.record ?? this.record();
    this.card = drawResultCard(this, {
      title: 'FIELD-MOVE COURSE',
      headline: done ? `Round in ${courseTime(run.elapsedMs ?? 0)}` : 'Stopped before the finish',
      won: written ? wonLine(written.payout, won) : done ? 'The keeper could not chalk that up. Nothing was paid.' : 'No time chalked up.',
      good: won.length > 0,
      ladder: payLadder({ kind: 'field-course' }, today(record, new Date()).best['field-course']),
      tickets: record.tickets,
      canPick: this.canPick(),
    });
  }

  /**
   * The ghost's walk: the quickest line this team has, from the start to the
   * first field move on it and that move done - or, for a team with none, the
   * first stretch of the long way round. Read off `fastestRun`, so the ghost
   * walks only where the runner could.
   */
  private ghostPath(run: CourseRun): GhostStep[] {
    const line = fastestRun(PROMENADE_COURSE, run.moves)?.line ?? [];
    const firstMove = line.findIndex((move) => move.open);
    const moves = line.slice(0, firstMove >= 0 ? firstMove + 1 : GHOST_STEPS_WITHOUT_A_MOVE);
    const path: GhostStep[] = [];
    let at = { ...run.course.start };
    for (const move of moves) {
      const ahead = step(at, move.way);
      if (move.open) {
        path.push({ at, facing: move.way, opens: ahead });
      } else {
        path.push({ at: ahead, facing: move.way, opens: null });
        at = ahead;
      }
    }
    return path;
  }

  /** Where the ghost is on its loop, drawn: walking a tile a beat, and the field move flashed on the tile it faces. */
  private drawGhost(): void {
    const ghost = this.ghost;
    const run = this.run;
    if (!ghost || !run) return;
    const shown = run.elapsedMs === null && (this.phase.kind === 'ready' || this.phase.kind === 'running') && ghost.path.length > 0;
    ghost.ring.clear();
    ghost.sprite.setVisible(shown);
    if (!shown) return;
    const beats = ghost.path.length + GHOST_REST_BEATS;
    const clock = this.time.now / GHOST_BEAT_MS;
    const beat = Math.floor(clock) % beats;
    const within = clock - Math.floor(clock);
    const here = ghost.path[Math.min(beat, ghost.path.length - 1)];
    const before = beat === 0 ? { at: run.course.start } : ghost.path[Math.min(beat - 1, ghost.path.length - 1)];
    if (!here || !before) return;
    const walking = beat < ghost.path.length && !here.opens;
    const t = walking ? within : 1;
    const x = before.at.x + (here.at.x - before.at.x) * t;
    const y = before.at.y + (here.at.y - before.at.y) * t;
    ghost.sprite.setPosition(Math.round(x * TILE), Math.round(y * TILE + RUNNER_Y_OFFSET));
    ghost.sprite.setFrame(getIdleFrame(here.facing));
    ghost.sprite.setAlpha(0.45);
    const last = ghost.path[ghost.path.length - 1];
    if (last?.opens && beat >= ghost.path.length - 1) {
      // The field move, done on what the ghost faces: a ring opening out over it.
      const grow = beat === ghost.path.length - 1 ? within : 1;
      const cx = last.opens.x * TILE + TILE / 2;
      const cy = last.opens.y * TILE + TILE / 2;
      ghost.ring.lineStyle(2, 0xf8f8f8, 0.9 * (1 - grow * 0.5)).strokeCircle(cx, cy, 4 + grow * 7);
      ghost.ring.lineStyle(1, 0xf8e070, 0.8).strokeRect(last.opens.x * TILE, last.opens.y * TILE, TILE, TILE);
    }
  }

  /**
   * Which way the finish is, from where the runner stands: the course is wider
   * than the screen, so at the start the chequered line is out of sight (wave
   * 1's playtest read 'TO THE FLAG' with the only flag in view the start's).
   */
  private toTheFinish(run: CourseRun): string {
    const line = run.course.finish;
    const middle = line[Math.floor(line.length / 2)];
    const bearing = compassBearing(run.at, middle);
    return bearing ? `FINISH: ${bearing}` : 'FINISH';
  }

  private say(words: string, ms = SAY_MS): void {
    this.saying?.text.destroy();
    this.saying?.panel.destroy();
    const { width, height } = this.scale;
    const text = this.add
      .text(Math.round(width / 2), height - 10, words, {
        fontFamily: GAME_FONT,
        fontSize: CHIP_FONT_SIZE,
        color: WINDOW_INK,
        wordWrap: { width: width - 40 },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(31);
    const panel = this.add.graphics().setScrollFactor(0).setDepth(30);
    const bounds = text.getBounds();
    drawPixelWindow(
      panel,
      { x: Math.round(bounds.x - 6), y: Math.round(bounds.y - 3), width: Math.round(bounds.width + 12), height: Math.round(bounds.height + 6) },
      { fill: WINDOW_PAPER },
    );
    this.saying = { text, panel, until: this.time.now + ms };
  }

  // --- drawing -------------------------------------------------------------------

  private buildStage(): void {
    this.tearDownStage();
    const run = this.run;
    if (!run) return;
    const { width: columns, height: rows } = run.course;
    this.cameras.main.setBackgroundColor('#081008');
    this.cameras.main.setBounds(0, 0, Math.max(columns * TILE, this.scale.width), rows * TILE);
    this.layTiles();
    // The start's white flag and the finish's chequered line.
    const marks = this.add.graphics().setDepth(2);
    const start = run.course.start;
    marks.fillStyle(0x404040, 1).fillRect(start.x * TILE + 3, start.y * TILE + 1, 1, 13);
    marks.fillStyle(0xf8f8f8, 1).fillRect(start.x * TILE + 4, start.y * TILE + 1, 7, 5);
    for (const tile of run.course.finish) {
      for (let cell = 0; cell < 16; cell += 1) {
        const cx = cell % 4;
        const cy = Math.floor(cell / 4);
        marks.fillStyle((cx + cy) % 2 === 0 ? 0xf8f8f8 : 0x202028, 1).fillRect(tile.x * TILE + cx * 4, tile.y * TILE + cy * 4, 4, 4);
      }
    }
    this.world.push(marks);
    const texture = this.textures.get(TOWN_SHEET_SOURCE.source.textureKey);
    if (!texture.has(BOULDER_FRAME)) {
      const piece = TOWN_PIECES.strengthBoulder;
      texture.add(BOULDER_FRAME, 0, piece.column * TILE, piece.row * TILE, TILE, TILE);
    }
    this.boulders = run.boulders.map((at) =>
      this.add.image(at.x * TILE + TILE / 2, at.y * TILE + TILE / 2, TOWN_SHEET_SOURCE.source.textureKey, BOULDER_FRAME).setDepth(3),
    );
    this.runnerTexture = lookTexture(
      this,
      readLook(this.game_?.raidProgress.look),
      null,
      this.game_ ? honoursWorn(this.game_.raidProgress) : [],
    );
    this.runner = this.add.sprite(0, 0, this.runnerTexture, getIdleFrame(run.facing)).setOrigin(0, 0).setDepth(4);
    this.ghost = {
      sprite: this.add.sprite(0, 0, this.runnerTexture, getIdleFrame(run.facing)).setOrigin(0, 0).setDepth(4.5).setAlpha(0.45),
      ring: this.add.graphics().setDepth(4.6),
      path: this.ghostPath(run),
    };
    // The course is wider than the screen and starts in its corner, so the
    // view opens on the finish line and runs back along the course to the
    // runner before it follows them (wave 1's and wave 2's playtests: the
    // first view showed neither the runner nor the flag). Any key cuts it short.
    this.intro = 0;
    this.lookAlongTheCourse();
    // The stopwatch and what the team can do, pinned to the screen.
    const panel = this.add.graphics().setScrollFactor(0).setDepth(30);
    drawPixelWindow(panel, { x: 4, y: 4, width: 92, height: 32 }, { fill: WINDOW_PAPER });
    this.clock = this.add
      .text(9, 6, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK, lineSpacing: 0 })
      .setScrollFactor(0)
      .setDepth(31);
    const moves = run.moves.length > 0 ? MOVE_ORDER.filter((move) => run.moves.includes(move)).map((move) => FIELD_MOVES[move].label).join(' · ') : 'NO FIELD MOVES';
    const team = this.add
      .text(this.scale.width - 6, 6, moves, {
        fontFamily: GAME_FONT,
        fontSize: CHIP_FONT_SIZE,
        color: '#f8f8f8',
        stroke: '#202030',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(31);
    this.world.push(panel, team);
    this.drawStage();
  }

  /** The yard's tiles, laid again in whatever state the run has left it. */
  private layTiles(): void {
    const run = this.run;
    if (!run) return;
    for (const layer of this.layers) layer.destroy();
    this.layers = [];
    const layers: MapLayers = courseLayers(run.course.layout, run.opened);
    const map = this.make.tilemap({ width: run.course.width, height: run.course.height, tileWidth: TILE, tileHeight: TILE });
    const sheets = COURSE_SOURCES.map((source) => {
      const sheet = map.addTilesetImage(source.textureKey, source.textureKey, TILE, TILE, 0, 0, source.firstIndex);
      if (!sheet) throw new Error(`Tileset '${source.textureKey}' failed to load.`);
      return sheet;
    });
    const lay = (layer: TileLayer, name: string, depth: number): void => {
      const created = map.createBlankLayer(`course-${name}`, sheets, 0, 0);
      if (!created) throw new Error(`Tilemap layer 'course-${name}' failed to initialize.`);
      created.putTilesAt(layer.tiles.map((row) => [...row]), 0, 0);
      created.setDepth(depth);
      created.forEachTile((tile) => {
        const tint = layer.tints[tile.y]?.[tile.x] ?? -1;
        if (tint >= 0) tile.tint = tint;
        if (layer.flips[tile.y]?.[tile.x]) tile.flipX = true;
      });
      this.layers.push(created);
    };
    lay(layers.ground, 'ground', 0);
    lay(layers.overlay, 'overlay', 0.1);
    lay(layers.detail, 'detail', 0.2);
    lay(layers.canopy, 'canopy', 5);
    lay(layers.brim, 'brim', 5.1);
  }

  private tearDownStage(): void {
    this.plate?.destroy();
    this.plate = undefined;
    this.takeDownCard();
    this.ghost?.sprite.destroy();
    this.ghost?.ring.destroy();
    this.ghost = undefined;
    for (const layer of this.layers) layer.destroy();
    this.layers = [];
    for (const object of this.world) object.destroy();
    this.world = [];
    for (const boulder of this.boulders) boulder.destroy();
    this.boulders = [];
    this.runner?.destroy();
    this.runner = undefined;
    this.clock?.destroy();
    this.clock = undefined;
    this.saying?.text.destroy();
    this.saying?.panel.destroy();
    this.saying = undefined;
    this.intro = undefined;
    this.cameras?.main?.stopFollow();
    this.cameras?.main?.setScroll(0, 0);
  }

  private drawStage(): void {
    const run = this.run;
    if (!run || !this.runner) return;
    const at = runnerAt(run);
    this.runner.setPosition(Math.round(at.x * TILE), Math.round(at.y * TILE + RUNNER_Y_OFFSET));
    if (run.step) {
      this.runner.play(lookWalkKey(this.runnerTexture, run.facing), true);
    } else {
      this.runner.stop();
      this.runner.setFrame(getIdleFrame(run.facing));
    }
    run.boulders.forEach((boulder: GridPosition, index) => {
      this.boulders[index]?.setPosition(boulder.x * TILE + TILE / 2, boulder.y * TILE + TILE / 2);
    });
    const faced = facedObstacle(run);
    const time = run.elapsedMs === null ? 'READY' : courseTime(run.elapsedMs);
    this.clock?.setText([`TIME ${time}`, faced ? (faced.can ? `SPACE: ${MOVE_WORDS[faced.move]}` : `NEEDS ${MOVE_WORDS[faced.move]}`) : run.finished ? 'FINISHED' : this.toTheFinish(run)]);
    if (this.saying && this.time.now > this.saying.until) {
      this.saying.text.destroy();
      this.saying.panel.destroy();
      this.saying = undefined;
    }
  }

  private close(): void {
    if (!this.scene.isActive('field-course')) {
      return;
    }
    const resumeBase = this.pausedBase && this.scene.isPaused('base');
    this.pausedBase = false;
    audioManager.play('menuClose');
    this.scene.stop();
    if (resumeBase) {
      this.scene.resume('base');
    }
  }
}
