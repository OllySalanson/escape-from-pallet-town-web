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
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow, WINDOW_PAPER, WINDOW_INK } from '../ui/pixelWindow';
import { RELEASE_ARMING_MS, RESULT_HOLD_MS } from '../ui/spatialFocus';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { MapLayers, TileLayer } from '../world/tiles';
import { TOWN_PIECES } from '../world/generated/townPieces';
import { TOWN_SHEET_SOURCE } from '../world/tileset/townSheet';
import { FIELD_MOVES, type FieldMoveId } from '../world/fieldMoves';
import {
  attractCommand,
  courseRoster,
  openingLineup,
  payTable,
  playersFor,
  pressOnAttract,
  wonLines,
  type AttractPlayer,
  type Lineup,
  type ResultCard,
} from '../minigames/attract';
import { advanceCourseDemo, type CourseDemo } from '../minigames/demoPlay';
import { courseTime } from '../minigames/gameCornerTalk';
import { COURSE_SOURCES, courseLayers } from '../minigames/courseMap';
import {
  advanceCourse,
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
import { AttractScreen } from './attractScreen';
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
/** How long the house's run goes on the attract screen, from the flag, before it starts again: through the first field move and on. */
const DEMO_MS = 6200;
/** The frame the boulder is cut as on the town sheet's texture, as `WorldScene` names it. */
const BOULDER_FRAME = 'strength-boulder';

/** A field move as the keeper says it, in the order the course meets them. */
const MOVE_WORDS: Readonly<Record<FieldMoveId, string>> = { cut: 'CUT', 'rock-smash': 'ROCK SMASH', strength: 'STRENGTH', surf: 'SURF' };
const MOVE_ORDER: readonly FieldMoveId[] = ['cut', 'rock-smash', 'strength', 'surf'];

type Phase =
  | { readonly kind: 'attract'; readonly shown: number }
  | { readonly kind: 'running' }
  | { readonly kind: 'finished'; readonly elapsed: number };

/**
 * THE FIELD-MOVE COURSE over the paused harbour: its attract screen, then the
 * run itself.
 *
 * The rules are `minigames/fieldCourse.ts` and nothing here decides anything:
 * the scene hands the run each frame's milliseconds, the direction held and
 * whether the interact key went down, and draws what comes back - the yard in
 * the map maker's own tiles (`minigames/courseMap.ts`), laid again whenever a
 * tree is cut, a rock broken or the pond surfed shallow; the boulders as
 * figures, because they move; the runner in the player's own look, walking
 * a tile at a time as the harbour does; and the stopwatch. The gate opens on
 * the house running the course's quickest line for the team SPACE would run
 * with - the keeper's pick round the partner, `minigames/attract.ts` - into
 * its first field move (`demoPlay.ts`), and LEFT and RIGHT put somebody else
 * at the front of it. What a run pays is written by `SaveManager.playGame`,
 * one write, and shown on the result's card with the course's pay table.
 */
export class FieldCourseScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private pausedBase = false;
  private game_: RestoredGame | undefined;
  private roster: readonly AttractPlayer[] = [];
  private lineup: Lineup = { lead: 0, size: 1 };
  private result: ResultCard | null = null;
  private attract: AttractScreen | undefined;
  private openedAt = 0;
  /** When the last run ended: SPACE runs nothing for `RESULT_HOLD_MS` after. */
  private finishedAt = Number.NEGATIVE_INFINITY;
  private phase: Phase = { kind: 'attract', shown: 0 };
  private run: CourseRun | undefined;
  /** The house's run on the attract screen, and the line it is running. */
  private demo: { state: CourseDemo; line: readonly CourseMove[] } | null = null;
  private team: CourseRunner[] = [];
  private pressed = false;
  private held: Direction[] = [];
  private world: Phaser.GameObjects.GameObject[] = [];
  private layers: Phaser.Tilemaps.TilemapLayer[] = [];
  private runner: Phaser.GameObjects.Sprite | undefined;
  private runnerTexture = '';
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
    this.attract = undefined;
    this.pausedBase = data.pausedBase;
    this.result = null;
    this.finishedAt = Number.NEGATIVE_INFINITY;
    this.phase = { kind: 'attract', shown: 0 };
    this.run = undefined;
    this.demo = null;
    this.pressed = false;
    this.held = [];
    this.game_ = this.saveManager.load() ?? undefined;
    this.roster = this.game_ ? courseRoster(this.game_.stash) : [];
    this.lineup = openingLineup('field-course', this.roster);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tearDownStage();
      this.attract?.destroy();
      this.attract = undefined;
    });
    recordAction('Opened THE FIELD-MOVE COURSE');
  }

  public create(): void {
    this.openedAt = this.time.now;
    // The course and its screen cover the whole of the harbour paused under them (`coverHarbour.ts`).
    if (this.pausedBase) hideHarbourUnder(this);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onGameKey(event, true));
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => this.onGameKey(event, false));
    this.input.on('pointerdown', () => {
      if (this.phase.kind === 'attract') this.play();
    });
    this.showAttract();
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'FIELD-MOVE COURSE' },
      { label: 'Phase', value: this.phase.kind },
      { label: 'Team', value: this.chosenTeam().map((player) => player.species).join(', ') },
      ...(this.phase.kind !== 'attract' && this.run?.elapsedMs !== null && this.run ? [{ label: 'Time', value: courseTime(this.run.elapsedMs ?? 0) }] : []),
    ];
  }

  /** For a playtest driver: the run in progress, if there is one (the house's, on the attract screen). */
  public get courseRun(): CourseRun | undefined {
    return this.run;
  }

  /** For a playtest driver: the quickest line round for the team that is running, as a sharp player runs it. */
  public driverLine(): readonly CourseMove[] {
    return this.run ? (fastestRun(PROMENADE_COURSE, this.run.moves)?.line ?? []) : [];
  }

  /** For a playtest driver: where the screen is. */
  public get phaseKind(): Phase['kind'] {
    return this.phase.kind;
  }

  /** For a playtest driver: who SPACE would go round with. */
  public chosenTeam(): readonly AttractPlayer[] {
    return playersFor('field-course', this.roster, this.lineup);
  }

  /** For a playtest driver: put one of the roster at the front of the team, by stash id or the front of one, as LEFT and RIGHT do. */
  public leadWith(id: string): boolean {
    const lead = this.roster.findIndex((player) => player.id === id || player.id.startsWith(id));
    if (lead < 0 || this.phase.kind !== 'attract') return false;
    this.lineup = { lead, size: 1 };
    this.showAttract();
    return true;
  }

  /** For a playtest driver: what the last run came to, as its card says it. */
  public get lastResult(): ResultCard | null {
    return this.result;
  }

  /** For a playtest driver: SPACE on the attract screen. Whether a run started. */
  public pressPlay(): boolean {
    this.play();
    return this.phase.kind === 'running';
  }

  private teamOf(players: readonly AttractPlayer[]): CourseRunner[] {
    return players.map((player) => ({ species: player.species, name: player.name }));
  }

  private teamMoves(team: readonly CourseRunner[]): FieldMoveId[] {
    return MOVE_ORDER.filter((move) => doerOf(team, move) !== undefined);
  }

  // --- the attract screen ------------------------------------------------------------

  /** The house running the course for the team on show, the game's name over it - or the last run's card. */
  private showAttract(): void {
    this.tearDownStage();
    this.team = this.teamOf(this.chosenTeam());
    const moves = this.teamMoves(this.team);
    this.run = startCourse(PROMENADE_COURSE, moves);
    this.demo = { state: { run: this.run, next: 0 }, line: fastestRun(PROMENADE_COURSE, moves)?.line ?? [] };
    this.phase = { kind: 'attract', shown: 0 };
    this.pressed = false;
    this.held = [];
    this.buildStage(true);
    if (!this.attract) {
      const { width, height } = this.scale;
      this.attract = new AttractScreen(this, 'FIELD-MOVE COURSE', 'SPACE: run · LEFT/RIGHT: who · ESC: back', {
        area: { x: 0, y: 0, width, height },
        plate: { x: 4, y: 40, from: 'left' },
        titleAt: 0.4,
      });
    }
    this.attract.setShown(true);
    this.attract.setResult(this.result);
    const team = this.chosenTeam();
    this.attract.setPlate({ lead: team[0], others: team.length - 1, swaps: this.roster.length > 1, sizes: false });
  }

  private play(): void {
    if (this.phase.kind !== 'attract') return;
    // The press that opened the gate, and the one still going as the last run ended, run nothing.
    if (this.time.now - this.openedAt < RELEASE_ARMING_MS || this.time.now - this.finishedAt < RESULT_HOLD_MS) return;
    const outcome = pressOnAttract('field-course', this.roster, this.lineup, 'play');
    if (outcome.kind === 'play') this.startRun(outcome.players);
    else audioManager.play('denied');
  }

  private onAttractKey(event: KeyboardEvent): void {
    const command = attractCommand(event);
    if (command === null || event.repeat) return;
    event.preventDefault();
    if (command === 'play') {
      this.play();
      return;
    }
    const outcome = pressOnAttract('field-course', this.roster, this.lineup, command);
    if (outcome.kind === 'leave') {
      this.close();
    } else if (outcome.kind === 'lineup') {
      audioManager.play('select');
      this.lineup = outcome.lineup;
      this.showAttract();
    } else {
      audioManager.play('denied');
    }
  }

  // --- the run --------------------------------------------------------------------

  private startRun(players: readonly AttractPlayer[]): void {
    this.team = this.teamOf(players);
    if (this.team.length === 0) return;
    this.tearDownStage();
    audioManager.play('confirm');
    recordAction(`Ran THE FIELD-MOVE COURSE with ${this.team.map((runner) => runner.species).join(', ')}`);
    this.attract?.setShown(false);
    this.demo = null;
    this.run = startCourse(PROMENADE_COURSE, this.teamMoves(this.team));
    this.pressed = false;
    this.held = [];
    this.phase = { kind: 'running' };
    this.buildStage(false);
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
    if (this.phase.kind === 'attract') {
      if (down) this.onAttractKey(event);
      return;
    }
    if (this.phase.kind !== 'running') return;
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

  public update(time: number, delta: number): void {
    const phase = this.phase;
    if (!this.run) return;
    if (phase.kind === 'attract') {
      this.attract?.update(time);
      const shown = phase.shown + delta;
      if (shown >= DEMO_MS || this.run.finished || !this.demo) {
        this.showAttract();
        return;
      }
      this.phase = { kind: 'attract', shown };
      const state = advanceCourseDemo(this.demo.state, this.demo.line, delta);
      this.demo = { ...this.demo, state };
      this.run = state.run;
      this.showEvents(false);
      this.drawStage();
      return;
    }
    if (phase.kind === 'finished') {
      this.phase = { kind: 'finished', elapsed: phase.elapsed + delta };
      this.drawStage();
      if (phase.elapsed + delta >= FINISH_PAUSE_MS) this.finish(true);
      return;
    }
    if (this.intro !== undefined) {
      this.intro = this.held.length > 0 || this.pressed ? COURSE_INTRO_MS : this.intro + delta;
      this.lookAlongTheCourse();
    }
    const press = this.pressed;
    this.pressed = false;
    this.run = advanceCourse(this.run, delta, this.held[this.held.length - 1] ?? null, press);
    this.showEvents(true);
    this.drawStage();
  }

  /** What the last frame of the run did, said - and heard, in a run of the player's; the house's demo is a silent one, and says only who used what. */
  private showEvents(aloud: boolean): void {
    const run = this.run;
    if (!run) return;
    for (const event of run.events) {
      if (event.kind === 'opened') {
        const doer = doerOf(this.team, event.move);
        if (aloud) audioManager.play(event.move === 'surf' ? 'confirm' : 'lootPickup');
        this.say(`${doer?.name ?? 'Somebody'} used ${MOVE_WORDS[event.move]}!`);
        this.layTiles();
      }
      if (!aloud) continue;
      if (event.kind === 'pushed') audioManager.play('ledgeHop');
      if (event.kind === 'bump') {
        const key = `${event.at.x},${event.at.y}`;
        const quiet = this.lastBump && this.lastBump.key === key && this.time.now - this.lastBump.at < BUMP_QUIET_MS;
        this.lastBump = { key, at: this.time.now };
        if (quiet) continue;
        audioManager.play('bump');
        if (event.needs && !run.moves.includes(event.needs)) {
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

  /** The run is over: its time written and paid if it was finished, and the attract screen back up with what it came to. */
  private finish(completed: boolean): void {
    const run = this.run;
    if (!run || this.phase.kind === 'attract') return;
    if (completed && run.finished && run.elapsedMs !== null) {
      const ms = Math.max(1, Math.round(run.elapsedMs));
      const headline = courseTime(run.elapsedMs);
      const written = this.saveManager.playGame('field-course', ms);
      if (written) {
        this.game_ = written.game;
        this.result = { headline, won: wonLines(written.payout, []), newBest: written.payout.newBest, table: payTable('field-course', ms) };
        if (written.payout.tickets > 0) audioManager.play('itemObtained');
      } else {
        this.result = { headline, won: ['NOT CHALKED UP: NOTHING PAID'], newBest: false, table: [] };
      }
      recordAction(`THE FIELD-MOVE COURSE in ${courseTime(run.elapsedMs)}`);
    } else {
      this.result = { headline: 'STOPPED', won: ['NO TIME CHALKED UP'], newBest: false, table: [] };
    }
    this.finishedAt = this.time.now;
    this.showAttract();
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
    // Over the attract screen's keys line while the house runs, at the foot of the screen in a run.
    const foot = this.phase.kind === 'attract' ? height - 24 : height - 10;
    const text = this.add
      .text(Math.round(width / 2), foot, words, {
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

  /** The yard, the boulders, the runner and the stopwatch. `demo` follows the runner from the flag, with no look along the course first. */
  private buildStage(demo: boolean): void {
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
    if (demo) {
      this.cameras.main.startFollow(this.runner, true, 1, 1, -TILE / 2, -TILE);
    } else {
      // The course is wider than the screen and starts in its corner, so the
      // view opens on the finish line and runs back along the course to the
      // runner before it follows them (wave 1's and wave 2's playtests: the
      // first view showed neither the runner nor the flag). Any key cuts it short.
      this.intro = 0;
      this.lookAlongTheCourse();
    }
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
