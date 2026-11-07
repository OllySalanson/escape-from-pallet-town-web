import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { CHARACTER_FEET_PIXEL_Y, getIdleFrame } from '../playerFrames';
import { lookTexture, lookWalkKey } from '../look/lookTexture';
import { readLook } from '../look/look';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow, WINDOW_CREAM, WINDOW_INK } from '../ui/pixelWindow';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { MapLayers, TileLayer } from '../world/tiles';
import { TOWN_PIECES } from '../world/generated/townPieces';
import { TOWN_SHEET_SOURCE } from '../world/tileset/townSheet';
import { FIELD_MOVES, type FieldMoveId } from '../world/fieldMoves';
import { courseTeamMarkup, type CourseCandidate, type CourseTeamState } from '../minigames/gameCornerView';
import { courseTime } from '../minigames/gameCornerTalk';
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
import { NO_GAME_CORNER, type GameCornerRecord } from '../minigames/tickets';

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
/** The frame the boulder is cut as on the town sheet's texture, as `WorldScene` names it. */
const BOULDER_FRAME = 'strength-boulder';

/** A field move as the keeper says it, in the order the course meets them. */
const MOVE_WORDS: Readonly<Record<FieldMoveId, string>> = { cut: 'CUT', 'rock-smash': 'ROCK SMASH', strength: 'STRENGTH', surf: 'SURF' };
const MOVE_ORDER: readonly FieldMoveId[] = ['cut', 'rock-smash', 'strength', 'surf'];

type Phase = { readonly kind: 'menu' } | { readonly kind: 'running' } | { readonly kind: 'finished'; readonly elapsed: number };

/**
 * THE FIELD-MOVE COURSE over the paused harbour: the keeper's screen (who
 * goes round, what they can do between them and the fastest that team could
 * possibly go), then the run itself.
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
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private game_: RestoredGame | undefined;
  private chosen: string[] = [];
  private status: string | undefined;
  private last: CourseTeamState['last'];
  private phase: Phase = { kind: 'menu' };
  private run: CourseRun | undefined;
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
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('field-course');
  }

  public init(data: FieldCourseSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.status = undefined;
    this.last = undefined;
    this.phase = { kind: 'menu' };
    this.run = undefined;
    this.pressed = false;
    this.held = [];
    this.game_ = this.saveManager.load() ?? undefined;
    this.chosen = this.defaultTeam();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.tearDownStage();
    });
    recordAction('Opened THE FIELD-MOVE COURSE');
  }

  public create(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onGameKey(event, true));
    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => this.onGameKey(event, false));
    this.showMenu();
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'FIELD-MOVE COURSE' },
      { label: 'Phase', value: this.phase.kind },
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

  /** For a playtest driver: where the screen is. */
  public get phaseKind(): Phase['kind'] {
    return this.phase.kind;
  }

  private record(): GameCornerRecord {
    return this.game_?.raidProgress.gameCorner ?? NO_GAME_CORNER;
  }

  private candidates(): CourseCandidate[] {
    const stash = this.game_?.stash;
    if (!stash) return [];
    return stash.listPokemon().map((stored) => ({
      id: stored.id,
      name: stored.pokemon.name,
      dexId: stored.pokemon.base.dexId,
      shiny: stored.pokemon.shiny,
      level: stored.pokemon.level,
      moves: MOVE_ORDER.filter((move) => courseMovesOf(stored.pokemon.base.id).includes(move)).map((move) => MOVE_WORDS[move]),
    }));
  }

  /** The team the keeper would pick: whoever adds the most field moves, until three are chosen or nothing more is added. */
  private defaultTeam(): string[] {
    const stash = this.game_?.stash;
    if (!stash) return [];
    const pool = stash.listPokemon();
    const team: string[] = [];
    const covered = new Set<FieldMoveId>();
    while (team.length < COURSE_TEAM_SIZE) {
      let pick: { id: string; adds: number } | null = null;
      for (const stored of pool) {
        if (team.includes(stored.id)) continue;
        const adds = courseMovesOf(stored.pokemon.base.id).filter((move) => !covered.has(move)).length;
        if (adds > 0 && (!pick || adds > pick.adds)) pick = { id: stored.id, adds };
      }
      if (!pick) break;
      team.push(pick.id);
      for (const move of courseMovesOf(pool.find((stored) => stored.id === pick.id)!.pokemon.base.id)) covered.add(move);
    }
    return team.length > 0 ? team : pool.slice(0, 1).map((stored) => stored.id);
  }

  private teamOf(ids: readonly string[]): CourseRunner[] {
    const stash = this.game_?.stash;
    if (!stash) return [];
    return ids.flatMap((id) => {
      const stored = stash.listPokemon().find((candidate) => candidate.id === id);
      return stored ? [{ species: stored.pokemon.base.id, name: stored.pokemon.name.toUpperCase() }] : [];
    });
  }

  private teamMoves(team: readonly CourseRunner[]): FieldMoveId[] {
    return MOVE_ORDER.filter((move) => doerOf(team, move) !== undefined);
  }

  // --- the screen ------------------------------------------------------------------

  private showMenu(focusOn?: string): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'game-corner-screen pixel-ui', (event) => this.onMenuKey(event));
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
      button.onclick = () => this.close();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-runner]').forEach((button) => {
      button.onclick = () => this.toggle(button.dataset.runner ?? '', button);
    });
    const play = root.querySelector<HTMLButtonElement>('[data-play]');
    if (play) {
      play.onclick = () => {
        if (play.getAttribute('aria-disabled') === 'true') {
          audioManager.play('denied');
          return;
        }
        this.startRun();
      };
    }
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
      this.close();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  // --- the run --------------------------------------------------------------------

  private startRun(): void {
    this.team = this.teamOf(this.chosen);
    if (this.team.length === 0) return;
    this.overlay?.destroy();
    this.overlay = undefined;
    this.status = undefined;
    audioManager.play('confirm');
    recordAction(`Ran THE FIELD-MOVE COURSE with ${this.team.map((runner) => runner.species).join(', ')}`);
    this.run = startCourse(PROMENADE_COURSE, this.teamMoves(this.team));
    this.pressed = false;
    this.held = [];
    this.phase = { kind: 'running' };
    this.buildStage();
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

  public update(_time: number, delta: number): void {
    const phase = this.phase;
    if (phase.kind === 'menu' || !this.run) return;
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
    this.drawStage();
  }

  /** The run is over: its time written and paid if it was finished, and the keeper's screen back up. */
  private finish(completed: boolean): void {
    const run = this.run;
    if (!run) return;
    if (completed && run.finished && run.elapsedMs !== null) {
      const written = this.saveManager.playGame('field-course', Math.max(1, Math.round(run.elapsedMs)));
      if (written) {
        this.game_ = written.game;
        this.last = { time: courseTime(run.elapsedMs), payout: written.payout };
        if (written.payout.tickets > 0) audioManager.play('itemObtained');
      } else {
        this.last = undefined;
        this.status = 'The keeper could not chalk that up. Nothing was paid.';
      }
      recordAction(`THE FIELD-MOVE COURSE in ${courseTime(run.elapsedMs)}`);
    } else {
      this.status = 'Stopped before the finish: no time chalked up.';
    }
    this.tearDownStage();
    this.run = undefined;
    this.phase = { kind: 'menu' };
    this.showMenu('[data-play]');
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
      { fill: WINDOW_CREAM },
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
    this.runnerTexture = lookTexture(this, readLook(this.game_?.raidProgress.look));
    this.runner = this.add.sprite(0, 0, this.runnerTexture, getIdleFrame(run.facing)).setOrigin(0, 0).setDepth(4);
    this.cameras.main.startFollow(this.runner, true, 1, 1, -TILE / 2, -TILE);
    // The stopwatch and what the team can do, pinned to the screen.
    const panel = this.add.graphics().setScrollFactor(0).setDepth(30);
    drawPixelWindow(panel, { x: 4, y: 4, width: 92, height: 32 }, { fill: WINDOW_CREAM });
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
    this.say('ARROWS walk · SPACE uses a field move · the clock starts on your first step', 2600);
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
    this.clock?.setText([`TIME ${time}`, faced ? (faced.can ? `SPACE: ${MOVE_WORDS[faced.move]}` : `NEEDS ${MOVE_WORDS[faced.move]}`) : run.finished ? 'FINISHED' : 'TO THE FLAG']);
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
