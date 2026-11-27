import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { StashedPokemon } from '../stash';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { RESULT_HOLD_MS } from '../ui/spatialFocus';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { NO_GAME_CORNER, today, type DerbySource, type GameCornerRecord, type GamePayout, type TicketSource } from '../minigames/tickets';
import { traitsOf, type PokemonTraits } from '../minigames/traits';
import { outdoorLineups, type Lineup, type Player } from '../minigames/whoPlays';
import { READY_MS, readyBeat, readyKey, tickReady, type ReadyBeat } from '../minigames/readyBeat';
import { payLadder, wonLine, wonThings, type LadderGame } from '../minigames/payLadder';
import { drawResultCard, ReadyPlate, takeDown, type PlateView } from './minigameCards';
import { hideHarbourUnder } from './coverHarbour';

export interface OutdoorGameSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** How a game sees a candidate: its traits, whether it suits, and what to say about it. */
export interface OutdoorFit {
  readonly fit: number;
  readonly notes: readonly string[];
}

/** The sources the promenade's three outdoor games pay from: the race's, a level each, the dig's and the fishing derby's. */
export type OutdoorSource = Extract<TicketSource, DerbySource | 'dig' | 'fishing-derby'>;

/** Where an outdoor game is: standing ready, being played, or showing what it came to. */
export type OutdoorPhase = 'ready' | 'playing' | 'result';

/**
 * What the promenade's three outdoor games share, over the paused harbour as
 * THE GAME CORNER's cabinets are: SPACE at a game's board starts it (the
 * harbour audit, 27 Nov 2026, fault 3: a form of who plays and the game's
 * rules stood in the way). The partner plays, or whoever the game suits
 * best after it (`minigames/whoPlays.ts`); the game is drawn at once with
 * them in it, standing ready a moment under a plate saying who it is, and
 * LEFT and RIGHT step to another (`minigames/readyBeat.ts`). Then it is
 * played on its own canvas, and what it came to - what it paid, and the
 * ladder of what it pays - is a card over it after, written by
 * `SaveManager.playOutdoorGame` in one write. A game is a pure rules module
 * (`minigames/derby.ts`, `dig.ts`, `fishingDerby.ts`); a subclass hands it
 * time and keys and draws it, and shows its own first move.
 *
 * Nothing a game does touches the Pokémon that played it: no experience, no
 * injury, nothing lost (the harbour arenas plan, section 3.1, rule 2).
 */
export abstract class OutdoorGameScene extends Phaser.Scene implements ProvidesFeedbackContext {
  protected pausedBase = false;
  protected savedGame: RestoredGame | undefined;
  protected phase: OutdoorPhase = 'ready';
  /** Who may play, best first, and which stands ready. */
  protected lineups: Lineup[] = [];
  protected lineupAt = 0;
  private beat: ReadyBeat = readyBeat(0, 0);
  private plate: ReadyPlate | undefined;
  private card: Phaser.GameObjects.GameObject[] = [];
  /** When the last game ended, so AGAIN takes no press for a moment after (`endGame`). */
  private endedAt = Number.NEGATIVE_INFINITY;
  protected readonly saveManager = new SaveManager();
  private stageParts: Phaser.GameObjects.GameObject[] = [];
  private lastHeadline: string | undefined;

  /** The game's name, as its result card heads it. */
  protected abstract readonly title: string;

  protected abstract readonly source: OutdoorSource;

  /** How well a Pokémon fits the game, and what it would do. */
  protected abstract fitOf(traits: PokemonTraits): OutdoorFit;

  /** A game with the chosen Pokémon, drawn and standing ready: the play starts with `play`. */
  protected abstract beginGame(chosen: StashedPokemon, traits: PokemonTraits): void;

  /** The game's ladder of what it pays, for the result card. */
  protected abstract ladderGame(): LadderGame;

  protected abstract onGameKey(event: KeyboardEvent): void;

  /**
   * Whether SPACE in the ready beat starts play at once. THE DERBY's start is
   * the starter's gun, on its own count, so it says no.
   */
  protected readonly goesOnSpace: boolean = true;

  /**
   * Whether that SPACE is also the game's own first press: in a game with no
   * clock on it yet (THE DIG's first dig, THE FISHING DERBY's first cast) the
   * press that starts it does what SPACE does in it.
   */
  protected readonly spaceActsInReady: boolean = false;

  /** The level standing ready, for a game with several (THE DERBY's courses), as the plate says it. */
  protected plateLevel(): PlateView['level'] | undefined {
    return undefined;
  }

  /** UP or DOWN in the ready beat: another level, for a game with several. Whether it moved. */
  protected stepLevel(step: -1 | 1): boolean {
    void step;
    return false;
  }

  /** What SPACE on the result card plays, when it is not simply the same game again: `race THE SANDS`. */
  protected againLabel(): string | undefined {
    return undefined;
  }

  /** What a game played is written as: its score, paid, and what it turned up sent home. */
  protected writeResult(
    score: number,
    finds: readonly string[],
  ): { readonly game: RestoredGame; readonly payout: GamePayout; readonly kept: readonly string[] } | null {
    return this.saveManager.playOutdoorGame(this.source, score, finds);
  }

  /** Where the ready beat's plate stands, from the top: clear of what the game shows first. */
  protected plateTop(): number {
    return Math.round(this.scale.height * 0.3);
  }

  /** The parts of a plate or card just drawn: THE DERBY keeps them off its track's camera. */
  protected overTheGame(parts: readonly Phaser.GameObjects.GameObject[]): void {
    void parts;
  }

  public init(data: OutdoorGameSceneData): void {
    this.pausedBase = data.pausedBase;
    this.phase = 'ready';
    this.stageParts = [];
    this.card = [];
    this.plate = undefined;
    this.endedAt = Number.NEGATIVE_INFINITY;
    this.lineupAt = 0;
    this.savedGame = this.saveManager.load() ?? undefined;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tearDownStage());
    recordAction(`Opened ${this.title}`);
  }

  public create(): void {
    // The game covers the whole of the harbour paused under it; drawn on
    // regardless, it halved the race's frame rate (playtest 51, finding 3).
    if (this.pausedBase) hideHarbourUnder(this);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));
    this.lineups = this.makeLineups();
    if (this.lineups.length === 0) {
      // Nobody to play with at all (a vault is never empty at the harbour,
      // `Stash.ensurePlayable`): back out, on the next frame, once running.
      audioManager.play('denied');
      this.time.delayedCall(0, () => this.close());
      return;
    }
    this.standReady();
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: this.title },
      { label: 'Phase', value: this.phase },
      { label: 'Playing', value: this.lineup()[0]?.species ?? 'nobody' },
    ];
  }

  /** For a playtest driver: whether a game is being played. */
  public get isPlaying(): boolean {
    return this.phase === 'playing';
  }

  /** For a playtest driver: where the screen is - `ready`, `playing` or `result`. */
  public get phaseKind(): OutdoorPhase {
    return this.phase;
  }

  /** For a playtest driver: what the last game came to, as its result card heads it. */
  public get resultHeadline(): string | undefined {
    return this.lastHeadline;
  }

  /** For a playtest driver: who is on offer, by stored id, best first. */
  public get lineupIds(): readonly string[] {
    return this.lineups.map((lineup) => lineup[0]?.id ?? '');
  }

  /** For a playtest driver: play now with this Pokémon, by stored id. Whether it is on offer. */
  public playWith(id: string): boolean {
    const index = this.lineups.findIndex((lineup) => lineup[0]?.id === id);
    if (index < 0) return false;
    this.lineupAt = index;
    this.standReady();
    if (this.goesOnSpace) this.play();
    return true;
  }

  /** Whether a game is being played (rather than standing ready or showing its result). */
  protected get playing(): boolean {
    return this.phase === 'playing';
  }

  protected record(): GameCornerRecord {
    return this.savedGame?.raidProgress.gameCorner ?? NO_GAME_CORNER;
  }

  protected traitsFor(entry: { readonly pokemon: StashedPokemon['pokemon'] }): PokemonTraits | undefined {
    return traitsOf(
      entry.pokemon.base.id,
      entry.pokemon.moves.map((move) => move.base.name),
    );
  }

  /** Every Pokémon the game has something on, the partner first, then best fits. */
  protected makeLineups(): Lineup[] {
    const stash = this.savedGame?.stash;
    if (!stash) return [];
    return outdoorLineups(stash, (entry) => {
      const traits = this.traitsFor(entry);
      return traits ? this.fitOf(traits).fit : undefined;
    });
  }

  protected lineup(): Lineup {
    return this.lineups[this.lineupAt] ?? [];
  }

  /** The one who plays, as the plate has them. */
  protected player(): Player | undefined {
    return this.lineup()[0];
  }

  // --- the ready beat ---------------------------------------------------------------

  /** The game made and drawn for whoever stands ready, the plate over it, the beat running down. */
  protected standReady(): void {
    this.tearDownStage();
    const chosen = this.savedGame?.stash.listPokemon().find((stored) => stored.id === this.player()?.id);
    const traits = chosen ? this.traitsFor(chosen) : undefined;
    if (!chosen || !traits) return;
    this.phase = 'ready';
    this.beat = readyBeat(this.lineupAt, this.lineups.length);
    this.beginGame(chosen, traits);
    this.plate = new ReadyPlate(this, this.plateTop());
    const level = this.plateLevel();
    this.plate.show({ lineup: this.lineup(), choices: this.lineups.length, ...(level ? { level } : {}) });
    this.overTheGame(this.plate.objects);
  }

  /** Play starts: the plate goes. */
  protected play(): void {
    if (this.phase !== 'ready') return;
    this.plate?.destroy();
    this.plate = undefined;
    this.phase = 'playing';
    audioManager.play('confirm');
    recordAction(`Played ${this.title} with ${this.player()?.species ?? 'nobody'}`);
  }

  /**
   * The ready beat's frame, for a subclass's `update` to call first: the bar
   * runs down and play starts when it is out. Whether the game is still
   * standing ready after it.
   */
  protected readyFrame(delta: number): boolean {
    if (this.phase !== 'ready') return false;
    const ticked = tickReady(this.beat, delta);
    this.beat = ticked.beat;
    this.plate?.tick(this.beat.leftMs / READY_MS, this.time.now);
    if (ticked.go) this.play();
    return this.phase === 'ready';
  }

  private onKey(event: KeyboardEvent): void {
    if (this.phase === 'playing') {
      this.onGameKey(event);
      return;
    }
    if (event.repeat) return;
    if (this.phase === 'result') {
      if (isOverlayDismissKey(event)) {
        event.preventDefault();
        this.close();
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (this.time.now - this.endedAt >= RESULT_HOLD_MS) this.standReady();
      }
      return;
    }
    const action = readyKey(this.beat, event.key);
    if (!action) return;
    event.preventDefault();
    if (action.kind === 'leave') {
      this.close();
    } else if (action.kind === 'go') {
      if (!this.goesOnSpace) return;
      this.play();
      if (this.spaceActsInReady && (event.key === ' ' || event.key === 'Enter')) this.onGameKey(event);
    } else if (action.kind === 'choose') {
      audioManager.play('select');
      this.lineupAt = action.index;
      this.standReady();
    } else if (this.stepLevel(action.step)) {
      audioManager.play('select');
      this.standReady();
    }
  }

  /**
   * The game is over: its score written and paid in one write, and the result
   * card over the game it ends, which stays drawn under it until SPACE plays
   * again or ESC leaves.
   */
  protected endGame(score: number, headline: string, finds: readonly string[] = [], news?: string): void {
    if (this.phase !== 'playing') return;
    const written = this.writeResult(score, finds);
    recordAction(`${this.title} scored ${score}`);
    this.lastHeadline = news ? `${headline} · ${news}` : headline;
    if (written) this.savedGame = written.game;
    const won = written ? wonThings(written.payout.tickets, written.kept) : [];
    if (won.length > 0) audioManager.play('itemObtained');
    const record = written?.payout.record ?? this.record();
    this.phase = 'result';
    // AGAIN takes nothing for a moment: SPACE casts in THE FISHING DERBY, and
    // the press still going at the buzzer started a new two-minute derby over
    // the result before it was read (the harbour critic tour, 26 Nov 2026).
    this.endedAt = this.time.now;
    const again = this.againLabel();
    this.card = drawResultCard(this, {
      title: this.title,
      headline,
      ...(news ? { news } : {}),
      won: written ? wonLine(written.payout, won) : 'Nobody could write that down. Nothing was paid.',
      good: won.length > 0,
      ladder: payLadder(this.ladderGame(), today(record, new Date()).best[this.source]),
      tickets: record.tickets,
      ...(again ? { again } : {}),
    });
    this.overTheGame(this.card);
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
    this.plate?.destroy();
    this.plate = undefined;
    takeDown(this.card);
    this.card = [];
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
