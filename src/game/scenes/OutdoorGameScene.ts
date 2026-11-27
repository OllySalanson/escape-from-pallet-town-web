import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { RELEASE_ARMING_MS, RESULT_HOLD_MS } from '../ui/spatialFocus';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import {
  attractCommand,
  openingLineup,
  outdoorRoster,
  payTable,
  playersFor,
  playerTraits,
  pressOnAttract,
  wonLines,
  type AttractCommand,
  type AttractPlayer,
  type Lineup,
  type ResultCard,
} from '../minigames/attract';
import { NO_GAME_CORNER, type DerbySource, type GameCornerRecord, type GamePayout, type TicketSource } from '../minigames/tickets';
import { traits, type PokemonTraits } from '../minigames/traits';
import { AttractScreen, type AttractLayout } from './attractScreen';
import { hideHarbourUnder } from './coverHarbour';

export interface OutdoorGameSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** The sources the promenade's three outdoor games pay from: the race's, a level each, the dig's and the fishing derby's. */
export type OutdoorSource = Extract<TicketSource, DerbySource | 'dig' | 'fishing-derby'>;

/** Who the demo plays with on a save with nobody at home to play: an ordinary kind, so the game is still seen. */
const NOBODY_HOME = traits('pikachu');

/**
 * What the promenade's three outdoor games share, over the paused harbour as
 * THE GAME CORNER's cabinets are: the attract screen a board opens onto (the
 * game played by the house with the Pokémon SPACE would play with, LEFT and
 * RIGHT for another, `minigames/attract.ts`), the game's own canvas, and what
 * a game paid, written by `SaveManager.playOutdoorGame` in one write and shown
 * on the result card with the game's pay table. A game is a pure rules module
 * (`minigames/derby.ts`, `dig.ts`, `fishingDerby.ts`); a subclass hands it
 * time and keys and draws it, and plays its own demo (`demoPlay.ts`).
 *
 * Nothing a game does touches the Pokémon that played it: no experience, no
 * injury, nothing lost (the harbour arenas plan, section 3.1, rule 5).
 */
export abstract class OutdoorGameScene extends Phaser.Scene implements ProvidesFeedbackContext {
  protected pausedBase = false;
  protected savedGame: RestoredGame | undefined;
  /** Whether a game is being played, rather than the house's demo on the attract screen. */
  protected playing = false;
  protected roster: readonly AttractPlayer[] = [];
  protected lineup: Lineup = { lead: 0, size: 1 };
  private result: ResultCard | null = null;
  private attract: AttractScreen | undefined;
  private openedAt = 0;
  /** When the last game ended, so SPACE plays nothing for a moment after (`endGame`). */
  private endedAt = Number.NEGATIVE_INFINITY;
  protected readonly saveManager = new SaveManager();
  private stageParts: Phaser.GameObjects.GameObject[] = [];

  /** The game's name, as its board and its attract screen say it. */
  protected abstract readonly title: string;

  protected abstract readonly source: OutdoorSource;

  /** Which game it is, for its pay table (`attract.ts`). */
  protected abstract readonly attractGame: 'derby' | 'dig' | 'fishing-derby';

  /** How well a Pokémon fits the game: who is offered first after the partner. */
  protected abstract fitOf(traits: PokemonTraits): number;

  /** Starts a game, or the house's demo of it, with this Pokémon: build the canvas. */
  protected abstract beginGame(player: AttractPlayer | undefined, traits: PokemonTraits, demo: boolean): void;

  /** Where the attract screen's parts stand on this game's canvas. */
  protected abstract attractLayout(): AttractLayout;

  /** The keys line under the attract screen. */
  protected attractKeys(): string {
    return 'SPACE: play · LEFT/RIGHT: who · ESC: back';
  }

  /** A word more on the plate under who plays (THE DERBY's course), if the game has one. */
  protected attractNote(): string | undefined {
    return undefined;
  }

  /** Whether UP and DOWN do something on the attract screen (THE DERBY's courses). */
  protected attractSizes(): boolean {
    return false;
  }

  /** A key on the attract screen the game has a use of its own for (THE DERBY's courses). Whether it was used. */
  protected attractExtra(command: AttractCommand): boolean {
    // No game but THE DERBY has a use for UP and DOWN, or for any key besides.
    void command;
    return false;
  }

  /** The level a result is paid on, for a game that has levels. */
  protected payLevel(): number {
    return 1;
  }

  /** What a game played is written as: its score, paid, and what it turned up sent home. */
  protected writeResult(
    score: number,
    finds: readonly string[],
  ): { readonly game: RestoredGame; readonly payout: GamePayout; readonly kept: readonly string[] } | null {
    return this.saveManager.playOutdoorGame(this.source, score, finds);
  }

  public init(data: OutdoorGameSceneData): void {
    this.attract = undefined;
    this.pausedBase = data.pausedBase;
    this.result = null;
    this.playing = false;
    this.endedAt = Number.NEGATIVE_INFINITY;
    this.stageParts = [];
    this.savedGame = this.saveManager.load() ?? undefined;
    this.roster = this.savedGame ? outdoorRoster(this.savedGame.stash, (traits) => this.fitOf(traits)) : [];
    this.lineup = openingLineup(this.attractGame, this.roster);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.tearDownStage();
      this.attract?.destroy();
      this.attract = undefined;
    });
    recordAction(`Opened ${this.title}`);
  }

  public create(): void {
    this.openedAt = this.time.now;
    // The game covers the whole of the harbour paused under it; drawn on
    // regardless, it halved the race's frame rate (playtest 51, finding 3).
    if (this.pausedBase) hideHarbourUnder(this);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.playing) this.onGameKey(event);
      else this.onAttractKey(event);
    });
    this.input.on('pointerdown', () => {
      if (!this.playing) this.play();
    });
    this.showAttract();
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: this.title },
      { label: 'Phase', value: this.playing ? 'playing' : 'attract' },
      { label: 'Player', value: this.chosen()?.species ?? 'none' },
    ];
  }

  /** For a playtest driver: whether a game is being played. */
  public get isPlaying(): boolean {
    return this.playing;
  }

  /** For a playtest driver: who SPACE would play with. */
  public chosen(): AttractPlayer | undefined {
    return playersFor(this.attractGame, this.roster, this.lineup)[0];
  }

  /** For a playtest driver: bring on one of the roster by stash id or the front of one, as LEFT and RIGHT do, and play. */
  public playWith(id: string): boolean {
    const lead = this.roster.findIndex((player) => player.id === id || player.id.startsWith(id));
    if (this.playing || lead < 0) return false;
    this.lineup = { lead, size: 1 };
    const player = this.chosen();
    if (player) this.startGame(player);
    return this.playing;
  }

  /** For a playtest driver: what the last game came to, as its card says it. */
  public get lastResult(): ResultCard | null {
    return this.result;
  }

  /** For a playtest driver: SPACE on the attract screen. Whether a game started. */
  public pressPlay(): boolean {
    this.play();
    return this.playing;
  }

  protected abstract onGameKey(event: KeyboardEvent): void;

  protected record(): GameCornerRecord {
    return this.savedGame?.raidProgress.gameCorner ?? NO_GAME_CORNER;
  }

  // --- the attract screen ------------------------------------------------------------

  /** The house's demo with the Pokémon on show, the game's name over it - or the last game's card. */
  protected showAttract(): void {
    this.playing = false;
    if (!this.attract) this.attract = new AttractScreen(this, this.title, this.attractKeys(), this.attractLayout());
    this.restartDemo();
    this.attract.setShown(true);
    this.attract.setResult(this.result);
    const note = this.attractNote();
    this.attract.setPlate({ lead: this.chosen(), others: 0, swaps: this.roster.length > 1, sizes: this.attractSizes(), ...(note ? { note } : {}) });
  }

  /** Who is offered, read again by the game's fit (THE DERBY's changes with the course), the one on show kept on show. */
  protected refreshRoster(): void {
    const shown = this.chosen()?.id;
    this.roster = this.savedGame ? outdoorRoster(this.savedGame.stash, (traits) => this.fitOf(traits)) : [];
    const lead = this.roster.findIndex((player) => player.id === shown);
    this.lineup = lead >= 0 ? { lead, size: 1 } : openingLineup(this.attractGame, this.roster);
  }

  /** The demo from its start again: round and round it goes until SPACE. */
  protected restartDemo(): void {
    this.tearDownStage();
    const player = this.chosen();
    this.beginGame(player, (player && playerTraits(player)) ?? NOBODY_HOME, true);
  }

  /** What the attract screen draws, for a game whose other camera must leave it out. */
  protected attractObjects(): Phaser.GameObjects.GameObject[] {
    return this.attract?.objects() ?? [];
  }

  /** Keeps PRESS SPACE blinking: a subclass's `update` calls it while it plays the demo. */
  protected tickAttract(now: number): void {
    this.attract?.update(now);
  }

  private play(): void {
    if (this.playing) return;
    // The press that opened the game, and the one still going as the last game ended, play nothing.
    if (this.time.now - this.openedAt < RELEASE_ARMING_MS || this.time.now - this.endedAt < RESULT_HOLD_MS) return;
    const outcome = pressOnAttract(this.attractGame, this.roster, this.lineup, 'play');
    const player = outcome.kind === 'play' ? outcome.players[0] : undefined;
    if (player) this.startGame(player);
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
    if (this.attractExtra(command)) {
      audioManager.play('select');
      this.showAttract();
      return;
    }
    const outcome = pressOnAttract(this.attractGame, this.roster, this.lineup, command);
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

  private startGame(player: AttractPlayer): void {
    const traits = playerTraits(player);
    if (!traits) return;
    this.tearDownStage();
    audioManager.play('confirm');
    recordAction(`Played ${this.title} with ${player.species}`);
    this.attract?.setShown(false);
    this.playing = true;
    this.beginGame(player, traits, false);
  }

  /**
   * The game is over: its score written and paid in one write, and the
   * attract screen back up with the result card - what it came to, what it
   * won (and `also`, news of the game's own: a course opened) and the pay
   * table - over the demo.
   */
  protected endGame(score: number, headline: string, finds: readonly string[] = [], also: readonly string[] = []): void {
    const written = this.writeResult(score, finds);
    if (written) {
      this.savedGame = written.game;
      this.result = { headline, won: [...wonLines(written.payout, written.kept), ...also], newBest: written.payout.newBest, table: payTable(this.attractGame, score, this.payLevel()) };
      if (written.payout.tickets > 0 || written.kept.length > 0) audioManager.play('itemObtained');
    } else {
      this.result = { headline, won: ['NOT WRITTEN DOWN: NOTHING PAID'], newBest: false, table: [] };
    }
    recordAction(`${this.title} scored ${score}`);
    // SPACE casts in THE FISHING DERBY, and the press still going at the
    // buzzer started a new two-minute derby over the result before it was
    // read (the harbour critic tour, 26 Nov 2026): SPACE plays nothing for a
    // moment after.
    this.endedAt = this.time.now;
    this.showAttract();
  }

  // --- drawing helpers -------------------------------------------------------------

  /** Keeps a game object to be taken down with the game. */
  protected keep<T extends Phaser.GameObjects.GameObject>(part: T): T {
    this.stageParts.push(part);
    return part;
  }

  protected tearDownStage(): void {
    for (const part of this.stageParts) part.destroy();
    this.stageParts = [];
  }

  /** Words over the game, in the game's own type. */
  protected words_(x: number, y: number, words: string | string[], options: { readonly big?: boolean; readonly colour?: string; readonly origin?: [number, number]; readonly depth?: number } = {}): Phaser.GameObjects.Text {
    return this.keep(
      this.add
        .text(Math.round(x), Math.round(y), words, {
          fontFamily: GAME_FONT,
          fontSize: options.big ? DIALOG_FONT_SIZE : CHIP_FONT_SIZE,
          color: options.colour ?? '#f8f8f8',
          stroke: '#202030',
          strokeThickness: 3,
          lineSpacing: 0,
        })
        .setOrigin(...(options.origin ?? [0, 0]))
        .setDepth(options.depth ?? 20),
    );
  }

  protected close(): void {
    if (!this.scene.isActive(this.scene.key)) {
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
