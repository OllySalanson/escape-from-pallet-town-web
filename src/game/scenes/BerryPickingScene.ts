import Phaser from 'phaser';
import { RELEASE_ARMING_MS, RESULT_HOLD_MS } from '../ui/spatialFocus';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { pokemonTextureKey } from '../pokemon/pokemonSprites';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow, WINDOW_PAPER, WINDOW_INK } from '../ui/pixelWindow';
import {
  attractCommand,
  berryRoster,
  openingLineup,
  payTable,
  playersFor,
  pressOnAttract,
  wonLines,
  type AttractPlayer,
  type Lineup,
  type ResultCard,
} from '../minigames/attract';
import { advanceBerryDemo } from '../minigames/demoPlay';
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
import { AttractScreen } from './attractScreen';
import { hideHarbourUnder } from './coverHarbour';

export interface BerryPickingSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** How long the cabinet counts down before the first berry drops. */
const COUNTDOWN_MS = 2400;
/** How long the last berry landing is shown before the result. */
const END_PAUSE_MS = 1100;
/**
 * The stretch of a game the demo shows, round and round: from just before the
 * first berries ripen, through the house's bird taking two and leaving the
 * third to land and grey a square, to a moment after it has.
 */
const DEMO_FROM_MS = 3000;
const DEMO_TO_MS = 6600;
/** The column whose berries the demo leaves to fall. */
const DEMO_LETS_FALL: Column = LEFT;
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
  | { readonly kind: 'attract'; readonly shown: number }
  | { readonly kind: 'countdown'; readonly elapsed: number }
  | { readonly kind: 'playing' }
  | { readonly kind: 'ending'; readonly elapsed: number };

/**
 * THE GAME CORNER's BERRY PICKING cabinet over the paused harbour, as the
 * POKéMON JUMP one is (`GameCornerScene`): its attract screen, the game
 * itself, and what it paid.
 *
 * The rules are `minigames/berryPicking.ts` and nothing here decides
 * anything: the scene hands the game each frame's milliseconds and which way
 * the bird reached, and draws what comes back - FireRed's orchard, the
 * berries a whole drop at a time as FireRed draws them, ten squares across
 * the top that grey as berries land, and the bird from behind, its own back
 * sprite, leaning to the column it reaches for. The cabinet opens on the bird
 * SPACE would play with picking for the house (`minigames/attract.ts`,
 * `demoPlay.ts`); LEFT and RIGHT bring on another. What a game pays is written
 * by `SaveManager.playGame`, one write, and shown on the result's card.
 */
export class BerryPickingScene extends Phaser.Scene implements ProvidesFeedbackContext {
  /** When the last game ended: SPACE plays nothing for `RESULT_HOLD_MS` after. */
  private finishedAt = Number.NEGATIVE_INFINITY;
  private openedAt = 0;
  private pausedBase = false;
  private game_: RestoredGame | undefined;
  private roster: readonly AttractPlayer[] = [];
  private lineup: Lineup = { lead: 0, size: 1 };
  private result: ResultCard | null = null;
  private attract: AttractScreen | undefined;
  private phase: Phase = { kind: 'attract', shown: 0 };
  private picking: BerryPickingGame | undefined;
  private pressed: Column | null = null;
  private stage: Phaser.GameObjects.Container | undefined;
  private stageOver: Phaser.GameObjects.Container | undefined;
  private berries: Phaser.GameObjects.Graphics | undefined;
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
    this.attract = undefined;
    this.pausedBase = data.pausedBase;
    this.result = null;
    this.finishedAt = Number.NEGATIVE_INFINITY;
    this.phase = { kind: 'attract', shown: 0 };
    this.picking = undefined;
    this.pressed = null;
    this.callouts = [];
    this.game_ = this.saveManager.load() ?? undefined;
    this.roster = this.game_ ? berryRoster(this.game_.stash) : [];
    this.lineup = openingLineup('berry-picking', this.roster);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tearDownStage();
      this.attract?.destroy();
      this.attract = undefined;
    });
    recordAction('Opened BERRY PICKING');
  }

  public create(): void {
    this.openedAt = this.time.now;
    // The cabinet's screen is the whole of it, the harbour paused under it (`coverHarbour.ts`).
    if (this.pausedBase) hideHarbourUnder(this);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onGameKey(event));
    this.input.on('pointerdown', () => {
      if (this.phase.kind === 'attract') this.play();
    });
    this.showAttract();
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'BERRY PICKING' },
      { label: 'Phase', value: this.phase.kind },
      { label: 'Bird', value: this.chosenBird()?.species ?? 'none' },
      ...(this.picking && this.phase.kind !== 'attract' ? [{ label: 'Score', value: String(berryScore(this.picking)) }] : []),
    ];
  }

  /** For a playtest driver: the game in progress, if there is one (the house's demo on the attract screen). */
  public get pickingGame(): BerryPickingGame | undefined {
    return this.picking;
  }

  /** For a playtest driver: where the screen is. */
  public get phaseKind(): Phase['kind'] {
    return this.phase.kind;
  }

  /** For a playtest driver: the bird SPACE would play with. */
  public chosenBird(): AttractPlayer | undefined {
    return playersFor('berry-picking', this.roster, this.lineup)[0];
  }

  /** For a playtest driver: bring one of the roster on, by stash id or the front of one (`rattata`), as LEFT and RIGHT do. */
  public leadWith(id: string): boolean {
    const lead = this.roster.findIndex((player) => player.id === id || player.id.startsWith(id));
    if (lead < 0 || this.phase.kind !== 'attract') return false;
    this.lineup = { lead, size: 1 };
    this.showAttract();
    return true;
  }

  /** For a playtest driver: what the last game came to, as its card says it. */
  public get lastResult(): ResultCard | null {
    return this.result;
  }

  /** For a playtest driver: SPACE on the attract screen. Whether a game started. */
  public pressPlay(): boolean {
    this.play();
    return this.phase.kind === 'countdown';
  }

  /** For a playtest driver: reach for a column, as the arrow keys do. */
  public reachFor(column: Column): void {
    if (this.phase.kind === 'playing' || this.phase.kind === 'countdown') this.pressed = column;
  }

  // --- the attract screen ------------------------------------------------------------

  /** The orchard with the house's bird picking in it, the game's name over it, or the last game's card. */
  private showAttract(): void {
    const bird = this.chosenBird();
    this.picking = advanceBerryDemo(startBerryPicking(bird?.species ?? 'doduo'), DEMO_FROM_MS, DEMO_LETS_FALL);
    this.phase = { kind: 'attract', shown: 0 };
    this.pressed = null;
    this.buildStage(bird?.dexId ?? 84, true);
    if (!this.attract) {
      const { width, height } = this.scale;
      this.attract = new AttractScreen(this, 'BERRY PICKING', 'SPACE: play · LEFT/RIGHT: who · ESC: back', {
        area: { x: 0, y: 0, width, height },
        plate: { x: 4, y: 40, from: 'left' },
        titleAt: 0.36,
      });
    }
    this.attract.setShown(true);
    this.attract.setResult(this.result);
    this.attract.setPlate({ lead: bird, others: 0, swaps: this.roster.length > 1, sizes: false });
  }

  private play(): void {
    if (this.phase.kind !== 'attract') return;
    // The press that opened the cabinet, and the one still going as the last game ended, play nothing.
    if (this.time.now - this.openedAt < RELEASE_ARMING_MS || this.time.now - this.finishedAt < RESULT_HOLD_MS) return;
    const outcome = pressOnAttract('berry-picking', this.roster, this.lineup, 'play');
    const bird = outcome.kind === 'play' ? outcome.players[0] : undefined;
    if (bird) this.startGame(bird);
    else audioManager.play('denied');
  }

  private onAttractKey(event: KeyboardEvent): void {
    const command = attractCommand(event);
    if (command === null) return;
    event.preventDefault();
    if (command === 'play') {
      this.play();
      return;
    }
    const outcome = pressOnAttract('berry-picking', this.roster, this.lineup, command);
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

  // --- the game -------------------------------------------------------------------

  private startGame(bird: AttractPlayer): void {
    audioManager.play('confirm');
    recordAction(`Played BERRY PICKING with ${bird.species}`);
    this.attract?.setShown(false);
    this.picking = startBerryPicking(bird.species);
    this.pressed = null;
    this.phase = { kind: 'countdown', elapsed: 0 };
    this.buildStage(bird.dexId, false);
  }

  private onGameKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (this.phase.kind === 'attract') {
      this.onAttractKey(event);
      return;
    }
    if (event.key === 'Escape') {
      if (this.phase.kind === 'playing' || this.phase.kind === 'countdown') this.finish();
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
      // A reach in the count is lost, as FireRed reads no key before the start.
      if (this.phase.kind === 'playing') this.pressed = column;
    }
  }

  public update(time: number, delta: number): void {
    const phase = this.phase;
    if (!this.picking) return;
    if (phase.kind === 'attract') {
      this.attract?.update(time);
      const shown = phase.shown + delta;
      if (shown >= DEMO_TO_MS - DEMO_FROM_MS) {
        this.showAttract();
        return;
      }
      this.phase = { kind: 'attract', shown };
      this.picking = advanceBerryDemo(this.picking, delta, DEMO_LETS_FALL);
      this.showEvents(false);
      this.drawStage();
      return;
    }
    if (phase.kind === 'countdown') {
      const elapsed = phase.elapsed + delta;
      this.phase = { kind: 'countdown', elapsed };
      const left = Math.ceil((COUNTDOWN_MS - elapsed) / (COUNTDOWN_MS / 3));
      this.bigText?.setText(left > 0 ? String(left) : 'START!');
      if (elapsed >= COUNTDOWN_MS) {
        this.phase = { kind: 'playing' };
        this.bigText?.setText('');
      }
      this.drawStage();
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
    this.picking = advanceBerryPicking(this.picking, delta, press);
    this.showEvents(true);
    if (this.picking.over) {
      this.phase = { kind: 'ending', elapsed: 0 };
      this.bigText?.setText('GAME OVER');
    }
    this.drawStage();
  }

  /** What the last frame did, shown - and heard, in a game played; the house's demo is a silent one. */
  private showEvents(aloud: boolean): void {
    const sound = (key: Parameters<typeof audioManager.play>[0]): void => {
      if (aloud) audioManager.play(key);
    };
    for (const event of this.picking?.events ?? []) {
      if (event.kind === 'reach') sound('select');
      if (event.kind === 'turn') sound('ledgeHop');
      if (event.kind === 'eaten') {
        sound(event.berry === 'gold' ? 'confirm' : 'lootPickup');
        this.shout(`+${event.points}`, event.berry === 'gold' ? '#f8e070' : event.berry === 'green' ? '#a0e890' : '#90c0f8', event.column);
      }
      if (event.kind === 'peck') sound('denied');
      if (event.kind === 'squished') sound('bump');
      if (event.kind === 'faster') this.shout('FASTER!', '#f860b0', MIDDLE, -26);
    }
  }

  /** The game is over: its score written and paid, and the attract screen back up with what it came to. */
  private finish(): void {
    const picking = this.picking;
    if (!picking || this.phase.kind === 'attract') return;
    const score = berryScore(picking);
    const headline = `SCORE ${score.toLocaleString('en-GB')}`;
    const written = this.saveManager.playGame('berry-picking', score);
    if (written) {
      this.game_ = written.game;
      this.result = { headline, won: wonLines(written.payout, written.berries), newBest: written.payout.newBest, table: payTable('berry-picking', score) };
      if (written.payout.tickets > 0 || written.berries.length > 0) audioManager.play('itemObtained');
    } else {
      this.result = { headline, won: ['NOT WRITTEN DOWN: NOTHING PAID'], newBest: false, table: [] };
    }
    recordAction(`BERRY PICKING scored ${score}`);
    this.tearDownStage();
    this.finishedAt = this.time.now;
    this.showAttract();
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

  /** The orchard, the berries and the bird. `demo` leaves the game's keys line off: the attract screen has its own. */
  private buildStage(dexId: number, demo: boolean): void {
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
    this.bird = this.add
      .image(Math.round(width / 2), height - 8, pokemonTextureKey('back', dexId))
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
    const over: Phaser.GameObjects.GameObject[] = [dropped];
    if (!demo) {
      over.push(
        this.add
          .text(Math.round(width / 2), height - 2, 'LEFT · UP · RIGHT: pick · ESC: stop', {
            fontFamily: GAME_FONT,
            fontSize: CHIP_FONT_SIZE,
            color: '#f8f8f8',
            stroke: '#202030',
            strokeThickness: 3,
          })
          .setOrigin(0.5, 1)
          .setDepth(11),
      );
    }
    this.stage = this.add.container(0, 0, [back, panel]).setDepth(0);
    // Over the bird: drawn in the stage, a Dodrio's heads stood on the hint.
    this.stageOver = this.add.container(0, 0, over).setDepth(11);
    this.drawStage();
  }

  private tearDownStage(): void {
    this.stage?.destroy(true);
    this.stage = undefined;
    this.stageOver?.destroy(true);
    this.stageOver = undefined;
    for (const part of [this.berries, this.bird, this.squares, this.scoreText, this.bigText]) part?.destroy();
    this.berries = undefined;
    this.bird = undefined;
    this.squares = undefined;
    this.scoreText = undefined;
    this.bigText = undefined;
    for (const callout of this.callouts) callout.text.destroy();
    this.callouts = [];
  }

  private drawStage(): void {
    const picking = this.picking;
    if (!picking || !this.berries || !this.bird || !this.squares) return;
    const { width } = this.scale;
    const berries = this.berries.clear();
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
