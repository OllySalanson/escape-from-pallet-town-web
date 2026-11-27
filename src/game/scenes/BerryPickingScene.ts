import Phaser from 'phaser';
import { RESULT_HOLD_MS } from '../ui/spatialFocus';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { pokemonTextureKey } from '../pokemon/pokemonSprites';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow, WINDOW_PAPER, WINDOW_INK } from '../ui/pixelWindow';
import {
  advanceBerryPicking,
  BERRY_PICKING_EAT_FALL,
  BERRY_PICKING_MAX_FALL,
  BERRY_PICKING_STATUS_SQUARES,
  berryScore,
  COLUMNS,
  LEFT,
  MIDDLE,
  reachable,
  RIGHT,
  startBerryPicking,
  type BerryKind,
  type BerryPickingGame,
  type Column,
} from '../minigames/berryPicking';
import { NO_GAME_CORNER, today, type GameCornerRecord } from '../minigames/tickets';
import { berryLineups, type Lineup } from '../minigames/whoPlays';
import { FIRST_PACE, learnt, paceAfter, paceScale, READY_MS, readyBeat, readyKey, tickReady, type Pace, type ReadyBeat } from '../minigames/readyBeat';
import { payLadder, wonLine, wonThings } from '../minigames/payLadder';
import { drawKeyArrow, drawResultCard, ReadyPlate, takeDown } from './minigameCards';

export interface BerryPickingSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** Berries on the ground that bring the first-berry slowing to an end even with none eaten. */
const FIRST_MISSES_TAUGHT = 3;
/** How long the last berry landing is shown before the result. */
const END_PAUSE_MS = 1100;
/** How long a word over the columns stays up: a score, FASTER. */
const CALLOUT_MS = 650;
/** Pixels between the three columns. */
const COLUMN_GAP = 46;
/** Where the berries hang from, and where the beaks are, from the top. */
const BRANCH_Y = 44;
const BEAK_INSET = 72;

/** FireRed's three berries, each a colour, its shadow and its shine. */
const BERRY_INK: Readonly<Record<BerryKind, { readonly c: number; readonly d: number; readonly l: number }>> = {
  blue: { c: 0x3870e0, d: 0x1c3c8c, l: 0x90c0f8 },
  green: { c: 0x38a848, d: 0x1c6828, l: 0xa0e890 },
  gold: { c: 0xe0a818, d: 0x986808, l: 0xf8e880 },
};

type Phase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'playing' }
  | { readonly kind: 'ending'; readonly elapsed: number }
  | { readonly kind: 'result' };

/**
 * THE GAME CORNER's BERRY PICKING cabinet over the paused harbour, as the
 * POKéMON JUMP one is (`GameCornerScene`): the game itself, from the press
 * that opens it, and what it paid.
 *
 * SPACE at the cabinet starts the game. A DODRIO or DODUO of the player's
 * own picks if there is one, the partner first, the house DODUO if not
 * (`minigames/whoPlays.ts`); it stands ready under the tree a moment, a plate
 * over it, and LEFT and RIGHT step to another bird. The first berry is the
 * lesson: the berries fall slowed, and the column a berry can be eaten in
 * lights up with the arrow that reaches it, until one is eaten; then it plays
 * at full speed (`minigames/readyBeat.ts`). What it paid, and the ladder of
 * what it pays, are on the result card after (`minigameCards.ts`).
 *
 * The rules are `minigames/berryPicking.ts` and nothing here decides
 * anything: the scene hands the game each frame's milliseconds and which way
 * the bird reached, and draws what comes back - FireRed's orchard, the
 * berries a whole drop at a time as FireRed draws them, ten squares across
 * the top that grey as berries land, and the bird from behind, its own back
 * sprite, leaning to the column it reaches for. What a game pays is written
 * by `SaveManager.playGame`, one write.
 */
export class BerryPickingScene extends Phaser.Scene implements ProvidesFeedbackContext {
  /** When the last game ended: AGAIN takes no press for `RESULT_HOLD_MS` after. */
  private finishedAt = Number.NEGATIVE_INFINITY;
  private pausedBase = false;
  private game_: RestoredGame | undefined;
  /** Who may pick, best first (`whoPlays.ts`), and which stands ready. */
  private lineups: Lineup[] = [];
  private lineupAt = 0;
  private beat: ReadyBeat = readyBeat(0, 0);
  private pace: Pace = FIRST_PACE;
  private plate: ReadyPlate | undefined;
  private card: Phaser.GameObjects.GameObject[] = [];
  private phase: Phase = { kind: 'ready' };
  private picking: BerryPickingGame | undefined;
  private pressed: Column | null = null;
  private stage: Phaser.GameObjects.Container | undefined;
  private stageOver: Phaser.GameObjects.Container | undefined;
  private berries: Phaser.GameObjects.Graphics | undefined;
  /** The arrow under a column a berry can be eaten in, while the first berry is slowed. */
  private hints: Phaser.GameObjects.Graphics | undefined;
  private bird: Phaser.GameObjects.Image | undefined;
  private squares: Phaser.GameObjects.Graphics | undefined;
  private scoreText: Phaser.GameObjects.Text | undefined;
  private callouts: { text: Phaser.GameObjects.Text; until: number }[] = [];
  private bigText: Phaser.GameObjects.Text | undefined;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('berry-picking');
  }

  public init(data: BerryPickingSceneData): void {
    this.pausedBase = data.pausedBase;
    this.finishedAt = Number.NEGATIVE_INFINITY;
    this.phase = { kind: 'ready' };
    this.picking = undefined;
    this.pressed = null;
    this.callouts = [];
    this.card = [];
    this.plate = undefined;
    this.pace = FIRST_PACE;
    this.game_ = this.saveManager.load() ?? undefined;
    this.lineups = this.game_ ? berryLineups(this.game_.stash) : [];
    this.lineupAt = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tearDownStage());
    recordAction('Opened BERRY PICKING');
  }

  public create(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onGameKey(event));
    if (this.lineups.length > 0) this.standReady();
    else this.time.delayedCall(0, () => this.close());
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'BERRY PICKING' },
      { label: 'Phase', value: this.phase.kind },
      { label: 'Picking', value: this.lineup().map((player) => player.species).join(', ') },
      ...(this.picking ? [{ label: 'Score', value: String(berryScore(this.picking)) }] : []),
    ];
  }

  /** For a playtest driver: the game in progress, if there is one. */
  public get pickingGame(): BerryPickingGame | undefined {
    return this.picking;
  }

  /** For a playtest driver: where the screen is - `ready`, `playing`, `ending` or `result`. */
  public get phaseKind(): Phase['kind'] {
    return this.phase.kind;
  }

  /** For a playtest driver: every lineup on offer, by ids. */
  public get lineupIds(): readonly (readonly string[])[] {
    return this.lineups.map((lineup) => lineup.map((player) => player.id));
  }

  /** For a playtest driver: play now with this bird (a stored id, or `house:doduo`). Whether it is on offer. */
  public playWith(id: string): boolean {
    const index = this.lineups.findIndex((lineup) => lineup[0]?.id === id);
    if (index < 0) return false;
    this.takeDownCard();
    this.lineupAt = index;
    this.standReady();
    this.play();
    return true;
  }

  /** For a playtest driver: reach for a column, as the arrow keys do. */
  public reachFor(column: Column): void {
    if (this.phase.kind === 'playing') this.pressed = column;
  }

  private record(): GameCornerRecord {
    return this.game_?.raidProgress.gameCorner ?? NO_GAME_CORNER;
  }

  private lineup(): Lineup {
    return this.lineups[this.lineupAt] ?? [];
  }

  // --- the game -------------------------------------------------------------------

  /** The bird standing ready under the tree: a game made for it, drawn, the plate over it. */
  private standReady(): void {
    const bird = this.lineup()[0];
    if (!bird) return;
    this.picking = startBerryPicking(bird.species);
    this.pressed = null;
    this.pace = FIRST_PACE;
    this.phase = { kind: 'ready' };
    this.beat = readyBeat(this.lineupAt, this.lineups.length);
    this.buildStage(bird.dexId, bird.shiny);
    this.plate = new ReadyPlate(this, Math.round(this.scale.height * 0.17));
    this.plate.show({ lineup: this.lineup(), choices: this.lineups.length });
  }

  /** Play starts: the plate goes, and the first berries fall, slowed. */
  private play(): void {
    if (this.phase.kind !== 'ready' || !this.picking) return;
    this.plate?.destroy();
    this.plate = undefined;
    this.bigText?.setText('');
    audioManager.play('confirm');
    recordAction(`Played BERRY PICKING with ${this.lineup()[0]?.species ?? 'nobody'}`);
    this.phase = { kind: 'playing' };
  }

  /** The result is read and SPACE is pressed: the same bird stands ready again. */
  private again(): void {
    if (this.phase.kind !== 'result' || this.time.now - this.finishedAt < RESULT_HOLD_MS) return;
    this.takeDownCard();
    this.standReady();
  }

  private takeDownCard(): void {
    takeDown(this.card);
    this.card = [];
  }

  private onGameKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    const phase = this.phase.kind;
    if (phase === 'ready') {
      const action = readyKey(this.beat, event.key);
      if (!action) return;
      event.preventDefault();
      if (action.kind === 'leave') this.close();
      else if (action.kind === 'go') this.play();
      else if (action.kind === 'choose') {
        audioManager.play('select');
        this.lineupAt = action.index;
        this.standReady();
      }
      return;
    }
    if (phase === 'result') {
      if (isOverlayDismissKey(event)) {
        event.preventDefault();
        this.close();
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.again();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (phase === 'playing') this.finish();
      return;
    }
    const column: Column | null = ['ArrowLeft', 'a', 'A'].includes(event.key)
      ? LEFT
      : ['ArrowUp', 'w', 'W', ' ', 'Enter'].includes(event.key)
        ? MIDDLE
        : ['ArrowRight', 'd', 'D'].includes(event.key)
          ? RIGHT
          : null;
    if (column !== null) {
      event.preventDefault();
      if (phase === 'playing') this.pressed = column;
    }
  }

  public update(_time: number, delta: number): void {
    const phase = this.phase;
    if (phase.kind === 'result' || !this.picking) return;
    if (phase.kind === 'ready') {
      const ticked = tickReady(this.beat, delta);
      this.beat = ticked.beat;
      this.bigText?.setText(String(Math.max(1, Math.ceil(this.beat.leftMs / (READY_MS / 3)))));
      this.plate?.tick(this.beat.leftMs / READY_MS, this.time.now);
      this.drawStage();
      if (ticked.go) this.play();
      return;
    }
    if (phase.kind === 'ending') {
      const elapsed = phase.elapsed + delta;
      this.phase = { kind: 'ending', elapsed };
      this.drawStage();
      if (elapsed >= END_PAUSE_MS) this.finish();
      return;
    }
    const press = this.pressed;
    this.pressed = null;
    // Slowed until the first berry is eaten, then up to full speed: the same
    // FireRed frames either way (`readyBeat.ts`). Three on the ground and it
    // is up to speed regardless, so nobody is left playing it slowed.
    this.picking = advanceBerryPicking(this.picking, delta * paceScale(this.pace), press);
    this.pace = paceAfter(this.pace, delta);
    for (const event of this.picking.events) {
      if (event.kind === 'reach') audioManager.play('select');
      if (event.kind === 'turn') audioManager.play('ledgeHop');
      if (event.kind === 'eaten') {
        this.pace = learnt(this.pace);
        audioManager.play(event.berry === 'gold' ? 'confirm' : 'lootPickup');
        this.shout(`+${event.points}`, event.berry === 'gold' ? '#f8e070' : event.berry === 'green' ? '#a0e890' : '#90c0f8', event.column);
      }
      if (event.kind === 'peck') audioManager.play('denied');
      if (event.kind === 'squished') {
        audioManager.play('bump');
        if (this.picking.greySquares >= FIRST_MISSES_TAUGHT) this.pace = learnt(this.pace);
      }
      if (event.kind === 'faster') {
        this.shout('FASTER!', '#f860b0', MIDDLE, -26);
      }
    }
    if (this.picking.over) {
      this.phase = { kind: 'ending', elapsed: 0 };
      this.bigText?.setText('GAME OVER');
    }
    this.drawStage();
  }

  /** The game is over: its score written and paid, and the result card over the orchard. */
  private finish(): void {
    const picking = this.picking;
    if (!picking || (this.phase.kind !== 'playing' && this.phase.kind !== 'ending')) return;
    const score = berryScore(picking);
    const written = this.saveManager.playGame('berry-picking', score);
    recordAction(`BERRY PICKING scored ${score}`);
    this.phase = { kind: 'result' };
    this.finishedAt = this.time.now;
    this.bigText?.setText('');
    this.hints?.clear();
    if (written) this.game_ = written.game;
    const won = written ? wonThings(written.payout.tickets, written.berries) : [];
    if (won.length > 0) audioManager.play('itemObtained');
    const record = written?.payout.record ?? this.record();
    this.card = drawResultCard(this, {
      title: 'BERRY PICKING',
      headline: `SCORE ${score.toLocaleString('en-GB')}`,
      won: written ? wonLine(written.payout, won) : 'The cabinet could not write that down. Nothing was paid.',
      good: won.length > 0,
      ladder: payLadder({ kind: 'berry-picking' }, today(record, new Date()).best['berry-picking']),
      tickets: record.tickets,
    });
  }
  private columnX(column: Column): number {
    return Math.round(this.scale.width / 2 + (column - 1) * COLUMN_GAP);
  }

  private beakY(): number {
    return this.scale.height - BEAK_INSET;
  }

  /** Where on the screen a berry hanging `fall` drops down stands. */
  private berryY(fall: number): number {
    // Hung at the branch on the first drop, and over the beaks on the last it can be eaten on.
    return Math.round(BRANCH_Y + ((fall - 1) / (BERRY_PICKING_EAT_FALL - 1)) * (this.beakY() - BRANCH_Y));
  }

  private shout(words: string, colour: string, column: Column, lift = 0): void {
    const text = this.add
      .text(this.columnX(column), this.beakY() - 46 + lift, words, {
        fontFamily: GAME_FONT,
        fontSize: DIALOG_FONT_SIZE,
        color: colour,
        stroke: '#202030',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20);
    this.callouts.push({ text, until: this.time.now + CALLOUT_MS });
  }

  // --- drawing -------------------------------------------------------------------

  private buildStage(dexId: number, shiny: boolean): void {
    this.tearDownStage();
    const { width, height } = this.scale;
    const back = this.add.graphics().setDepth(0);
    // FireRed's orchard: a sky with its clouds, the wood down both sides, the
    // three columns of the tree the berries fall from, and the grass the bird
    // stands on.
    back.fillStyle(0x88c8f8, 1).fillRect(0, 0, width, height);
    back.fillStyle(0xb8e0f8, 1).fillRect(0, 56, width, 24);
    for (const [cx, cy] of [
      [44, 70],
      [width - 60, 60],
      [width / 2 + 90, 92],
    ] as const) {
      back.fillStyle(0xf8f8f8, 1).fillEllipse(cx, cy, 34, 12).fillEllipse(cx + 12, cy - 4, 22, 12);
    }
    const ground = height - 40;
    back.fillStyle(0x58b058, 1).fillRect(0, ground, width, height - ground);
    back.fillStyle(0x70c870, 1).fillRect(0, ground, width, 2);
    for (let i = 0; i < 30; i += 1) {
      const x = (i * 47) % width;
      const y = ground + 6 + ((i * 29) % Math.max(6, height - ground - 10));
      back.fillStyle(0x48a048, 1).fillRect(x, y, 2, 2);
    }
    // The wood either side, so the columns are a clearing.
    const wood = (from: number, to: number) => {
      for (let x = from; x < to; x += 18) {
        for (let y = 20; y < ground + 12; y += 22) {
          back.fillStyle(0x286828, 1).fillCircle(x, y, 14);
          back.fillStyle(0x40a048, 1).fillCircle(x - 3, y - 3, 10);
          back.fillStyle(0x70c870, 1).fillCircle(x - 5, y - 6, 4);
        }
      }
    };
    const clearing = COLUMN_GAP * 2 + 44;
    wood(-6, Math.round(width / 2 - clearing / 2));
    wood(Math.round(width / 2 + clearing / 2) + 8, width + 18);
    // The berry tree's canopy over the three columns, a branch over each.
    back.fillStyle(0x286828, 1).fillEllipse(width / 2, 22, clearing + 20, 52);
    back.fillStyle(0x40a048, 1).fillEllipse(width / 2 - 6, 18, clearing, 40);
    back.fillStyle(0x70c870, 1).fillEllipse(width / 2 - 14, 12, clearing - 50, 18);
    for (const column of [LEFT, MIDDLE, RIGHT] as const) {
      const x = this.columnX(column);
      back.fillStyle(0x704020, 1).fillRect(x - 1, BRANCH_Y - 10, 3, 8);
      // The reach: the two drops a berry may be eaten on, a band of shade
      // over the bird's heads, as FireRed's beaks reach exactly there.
      const top = this.berryY(BERRY_PICKING_EAT_FALL - 1) - 6;
      const bottom = this.berryY(BERRY_PICKING_EAT_FALL) + 6;
      // Drawn as a frame's four corners over a faint wash, so it reads as a
      // mark on the air rather than an unfinished block (wave 1's playtest).
      back.fillStyle(0xf8f8c0, 0.16).fillRect(x - 14, top, 28, bottom - top);
      back.fillStyle(0xf8f8e0, 0.9);
      for (const [cx, cy, dx, dy] of [
        [x - 14, top, 1, 1],
        [x + 13, top, -1, 1],
        [x - 14, bottom - 1, 1, -1],
        [x + 13, bottom - 1, -1, -1],
      ] as const) {
        back.fillRect(Math.min(cx, cx + dx * 5), cy, 6, 1);
        back.fillRect(cx, Math.min(cy, cy + dy * 5), 1, 6);
      }
    }
    this.berries = this.add.graphics().setDepth(4);
    this.hints = this.add.graphics().setDepth(5);
    this.bird = this.add
      .image(Math.round(width / 2), height - 8, pokemonTextureKey('back', dexId, shiny))
      .setOrigin(0.5, 1)
      .setDepth(3);
    this.squares = this.add.graphics().setDepth(11);
    const panel = this.add.graphics().setDepth(10);
    drawPixelWindow(panel, { x: 4, y: 4, width: 84, height: 32 }, { fill: WINDOW_PAPER });
    // What the ten squares at the top right are: the misses left, a berry on
    // the ground greying one from the end. Labelled BERRIES DROPPED, a full row
    // read as ten dropped and the game lost (playtest wave 3, finding 5).
    const dropped = this.add
      .text(width - 8, 20, 'MISSES LEFT', {
        fontFamily: GAME_FONT,
        fontSize: CHIP_FONT_SIZE,
        color: '#f8f8f8',
        stroke: '#202030',
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setDepth(11);
    this.scoreText = this.add
      .text(9, 6, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: WINDOW_INK, lineSpacing: 0 })
      .setDepth(11);
    this.bigText = this.add
      .text(Math.round(width / 2), Math.round(height * 0.45), '', {
        fontFamily: GAME_FONT,
        fontSize: DIALOG_FONT_SIZE,
        color: '#f8f8f8',
        stroke: '#202030',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20);
    const hint = this.add
      .text(Math.round(width / 2), height - 2, 'LEFT · UP · RIGHT: pick · ESC: stop', {
        fontFamily: GAME_FONT,
        fontSize: CHIP_FONT_SIZE,
        color: '#f8f8f8',
        stroke: '#202030',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(11);
    this.stage = this.add.container(0, 0, [back, panel]).setDepth(0);
    // Over the bird: drawn in the stage, a Dodrio's heads stood on the hint.
    this.stageOver = this.add.container(0, 0, [dropped, hint]).setDepth(11);
    this.drawStage();
  }

  private tearDownStage(): void {
    this.stage?.destroy(true);
    this.stage = undefined;
    this.stageOver?.destroy(true);
    this.stageOver = undefined;
    for (const part of [this.berries, this.hints, this.bird, this.squares, this.scoreText, this.bigText]) part?.destroy();
    this.berries = undefined;
    this.hints = undefined;
    this.bird = undefined;
    this.squares = undefined;
    this.scoreText = undefined;
    this.bigText = undefined;
    for (const callout of this.callouts) callout.text.destroy();
    this.callouts = [];
    this.plate?.destroy();
    this.plate = undefined;
    this.takeDownCard();
  }

  private drawStage(): void {
    const picking = this.picking;
    if (!picking || !this.berries || !this.bird || !this.squares) return;
    const { width } = this.scale;
    const berries = this.berries.clear();
    this.drawHints(picking);
    for (let index = 0; index < COLUMNS; index += 1) {
      const column = index as Column;
      const berry = picking.columns[column];
      const x = this.columnX(column);
      if (berry.state === 'eaten' || berry.fall === 0) continue;
      if (berry.state === 'squished' || berry.fall >= BERRY_PICKING_MAX_FALL) {
        const ink = BERRY_INK[berry.kind];
        const y = Math.min(this.scale.height - 16, this.berryY(BERRY_PICKING_MAX_FALL - 1) + 4);
        berries.fillStyle(ink.d, 1).fillEllipse(x, y, 16, 5);
        berries.fillStyle(ink.c, 1).fillEllipse(x - 1, y - 1, 10, 3);
        continue;
      }
      const y = this.berryY(berry.fall);
      const ink = BERRY_INK[berry.kind];
      berries.fillStyle(0x202030, 1).fillCircle(x, y, 7);
      berries.fillStyle(ink.d, 1).fillCircle(x, y, 6);
      berries.fillStyle(ink.c, 1).fillCircle(x - 1, y - 1, 5);
      berries.fillStyle(ink.l, 1).fillRect(x - 3, y - 4, 2, 2);
      berries.fillStyle(0x286828, 1).fillRect(x - 1, y - 9, 2, 3);
      if (berry.state === 'picked') {
        berries.lineStyle(1, 0xf8f8f8, 1).strokeCircle(x, y, 9);
      }
    }
    // The bird leans to the column it reaches for, and a Doduo shows which way it is turned.
    const reach = picking.reach;
    const lean = reach === null ? 0 : (reach - 1) * 14;
    const up = reach === null ? 0 : -6;
    this.bird.x = Math.round(width / 2 + lean);
    this.bird.y = this.scale.height - 8 + up;
    this.bird.setFlipX(picking.heads === 2 && picking.side === LEFT);
    if (picking.beak === 'bad-miss') this.bird.setTint(0xa0a0b0);
    else this.bird.clearTint();
    if (picking.heads === 2) {
      // A chevron under the side a Doduo's heads reach.
      const reachable_ = reachable(picking);
      for (const column of reachable_) {
        berries.fillStyle(0xf8f8f8, 0.85).fillTriangle(this.columnX(column) - 4, this.beakY() + 22, this.columnX(column) + 4, this.beakY() + 22, this.columnX(column), this.beakY() + 17);
      }
    }
    // Ten squares across the top, greyed one a berry on the ground from the
    // right-hand end, as FireRed's status bar runs down.
    const squares = this.squares.clear();
    const size = 8;
    const left = Math.round(width - 8 - BERRY_PICKING_STATUS_SQUARES * (size + 2));
    for (let index = 0; index < BERRY_PICKING_STATUS_SQUARES; index += 1) {
      const grey = index >= BERRY_PICKING_STATUS_SQUARES - picking.greySquares;
      const warn = !grey && picking.greySquares >= BERRY_PICKING_STATUS_SQUARES - 3;
      squares.fillStyle(0x202030, 1).fillRect(left + index * (size + 2) - 1, 7, size + 2, size + 2);
      squares.fillStyle(grey ? 0x808088 : warn ? 0xf05050 : 0xf8d040, 1).fillRect(left + index * (size + 2), 8, size, size);
    }
    this.scoreText?.setText([
      `SCORE ${berryScore(picking).toLocaleString('en-GB')}`,
      `EATEN ${picking.eaten.blue + picking.eaten.green + picking.eaten.gold}`,
    ]);
    this.callouts = this.callouts.filter((callout) => {
      if (this.time.now <= callout.until) {
        callout.text.y -= 0.4;
        return true;
      }
      callout.text.destroy();
      return false;
    });
  }

  /**
   * The first berry's lesson: while the game is slowed, a column whose berry
   * is in the beaks' reach - the two drops it can be eaten on - is framed in
   * gold and has the arrow that reaches it over it, pulsing. Gone once one is
   * eaten.
   */
  private drawHints(picking: BerryPickingGame): void {
    const hints = this.hints?.clear();
    if (!hints || this.phase.kind !== 'playing' || this.pace.learnt) return;
    const glow = 0.55 + 0.45 * Math.abs(Math.sin(this.time.now / 140));
    const top = this.berryY(BERRY_PICKING_EAT_FALL - 1) - 6;
    const bottom = this.berryY(BERRY_PICKING_EAT_FALL) + 6;
    const ways = ['left', 'up', 'right'] as const;
    for (let index = 0; index < COLUMNS; index += 1) {
      const berry = picking.columns[index];
      if (!berry || berry.state !== 'falling' || berry.fall < BERRY_PICKING_EAT_FALL - 1 || berry.fall > BERRY_PICKING_EAT_FALL) continue;
      const x = this.columnX(index as Column);
      hints.lineStyle(2, 0xf8d040, glow).strokeRect(x - 15, top - 1, 30, bottom - top + 2);
      drawKeyArrow(hints, x, top - 11, ways[index] ?? 'up', 5, glow);
    }
  }

  private close(): void {
    if (!this.scene.isActive('berry-picking')) {
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
