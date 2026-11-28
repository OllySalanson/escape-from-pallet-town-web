import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { StashedPokemon } from '../stash';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { MenuOverlay } from '../ui/MenuOverlay';
import { pickerBasics, pickerEntries, pickerOrder, wirePickerFind, type PickerEntry } from '../ui/boxPicker';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { RELEASE_ARMING_MS, RESULT_HOLD_MS } from '../ui/spatialFocus';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { outdoorPickMarkup, type OutdoorCandidate, type OutdoorCourse, type OutdoorPickState } from '../minigames/outdoorView';
import { NO_GAME_CORNER, today, type DerbySource, type GameCornerRecord, type GamePayout, type TicketSource } from '../minigames/tickets';
import { traitsOf, type PokemonTraits } from '../minigames/traits';
import { outdoorLineups, type Lineup, type Player } from '../minigames/whoPlays';
import { READY_MS, readyBeat, readyKey, tickReady, type ReadyBeat } from '../minigames/readyBeat';
import { payLadder, wonLine, wonThings, type LadderGame } from '../minigames/payLadder';
import { drawResultCard, ReadyPlate, takeDown, type PlateView } from './minigameCards';
import { hideHarbourUnder } from './coverHarbour';

/** The arrows, and W A S D for them, in either case. */
function isArrowKey(key: string): boolean {
  return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(key.length === 1 ? key.toLowerCase() : key);
}

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

/** Where an outdoor game is: standing ready, being played, showing what it came to, or its list of who plays open. */
export type OutdoorPhase = 'ready' | 'playing' | 'result' | 'choosing';

/**
 * What the promenade's three outdoor games share, over the paused harbour as
 * THE GAME CORNER's cabinets are: SPACE at a game's board starts it (the
 * harbour audit, 27 Nov 2026, fault 3: a form of who plays and the game's
 * rules stood in the way). The partner plays, or whoever the game suits
 * best after it (`minigames/whoPlays.ts`); the game is drawn at once with
 * them in it, standing ready a moment under a plate saying who it is
 * (`minigames/readyBeat.ts`). Then it is played on its own canvas, and what
 * it came to - what it paid, and the ladder of what it pays - is a card over
 * it after, written by `SaveManager.playOutdoorGame` in one write. P, in the
 * ready beat or on the card, opens the game's list of who plays (one
 * Pokémon, from every box, best fits first - `ui/boxPicker.ts`,
 * `minigames/outdoorView.ts`), and PLAY there stands the one chosen ready. A game is a pure rules module
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
  private beat: ReadyBeat = readyBeat();
  private plate: ReadyPlate | undefined;
  private card: Phaser.GameObjects.GameObject[] = [];
  /** When the last game ended, so AGAIN takes no press for a moment after (`endGame`). */
  private endedAt = Number.NEGATIVE_INFINITY;
  protected readonly saveManager = new SaveManager();
  private stageParts: Phaser.GameObjects.GameObject[] = [];
  private lastHeadline: string | undefined;
  /** The list of who plays, while it is open. */
  protected overlay: MenuOverlay | undefined;
  /** Who the list has chosen, by stored id. */
  protected chosen: string | null = null;
  protected status: string | undefined;
  /** What the last game came to, for the list's bar. */
  protected last: OutdoorPickState['last'];
  /** What the list's find field held (`ui/boxPicker.ts`). */
  private find = '';
  /** When the list opened, so the press that opened it cannot also play. */
  private pickerOpenedAt = Number.NEGATIVE_INFINITY;

  /** The game's name, as its result card heads it. */
  protected abstract readonly title: string;

  /** The list of who plays' words (`OutdoorPickState`). */
  protected abstract readonly words: {
    readonly place: string;
    readonly heading: string;
    readonly doing: string;
    readonly rules: string;
    readonly playHelp: string;
  };

  /** The day's best, as the list words it. */
  protected abstract bestWords(best: number): string;

  /** A line about the day, if the game has one, for the list. */
  protected todayLine(): string | undefined {
    return undefined;
  }

  /** What the list's PLAY says after a game, when it is not simply the same game again. */
  protected playLabel(): string | undefined {
    return undefined;
  }

  /** The game's levels, if it has them (THE PROMENADE DERBY's courses), for the list. */
  protected course(): OutdoorCourse | undefined {
    return undefined;
  }

  /** A level chosen on the list. Whether it could be: a level not yet open cannot. */
  protected chooseLevel(level: number): boolean {
    return level === 1;
  }

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
   * press that starts it does what SPACE does in it, and an arrow starts it
   * and does what an arrow does (THE DIG's spade).
   */
  protected readonly spaceActsInReady: boolean = false;

  /** The level standing ready, for a game with several (THE DERBY's courses), as the plate says it. */
  protected plateLevel(): PlateView['level'] | undefined {
    return undefined;
  }

  /** Whether the list of who plays has another choice than the one standing ready: the plate and card name P only then. */
  protected canPick(): boolean {
    return this.lineups.length > 1 || (this.course()?.levels.filter((level) => level.open).length ?? 0) > 1;
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
    this.overlay = undefined;
    this.chosen = null;
    this.status = undefined;
    this.last = undefined;
    this.pickerOpenedAt = Number.NEGATIVE_INFINITY;
    this.savedGame = this.saveManager.load() ?? undefined;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.tearDownStage();
    });
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

  /** For a playtest driver: where the screen is - `ready`, `playing`, `result` or `choosing`. */
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
    this.beat = readyBeat();
    this.beginGame(chosen, traits);
    this.plate = new ReadyPlate(this, this.plateTop());
    const level = this.plateLevel();
    this.plate.show({ lineup: this.lineup(), canPick: this.canPick(), ...(level ? { level } : {}) });
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
    // The list of who plays has its own keys (`onMenuKey`).
    if (event.repeat || this.phase === 'choosing') return;
    const action = readyKey(event.key);
    if (!action) {
      // In a game with no clock on it yet an arrow starts it and does what it
      // does there, as SPACE does: THE DIG's first arrow moves the spade.
      if (this.phase === 'ready' && this.spaceActsInReady && isArrowKey(event.key)) {
        this.play();
        this.onGameKey(event);
      }
      return;
    }
    event.preventDefault();
    if (action.kind === 'leave') {
      this.close();
    } else if (action.kind === 'pick') {
      if (this.canPick()) this.openPicker();
    } else if (this.phase === 'result') {
      if (this.time.now - this.endedAt >= RESULT_HOLD_MS) this.standReady();
    } else {
      if (!this.goesOnSpace) return;
      this.play();
      if (this.spaceActsInReady && (event.key === ' ' || event.key === 'Enter')) this.onGameKey(event);
    }
  }

  // --- the list of who plays ----------------------------------------------------------

  /** Every Pokémon the list shows, best fits first, the ones that cannot play last. */
  protected candidates(): (OutdoorCandidate & { readonly fit: number })[] {
    const stash = this.savedGame?.stash;
    if (!stash) return [];
    const fits = new Map<string, OutdoorFit>();
    const fitOf = (entry: PickerEntry): OutdoorFit => {
      const known = fits.get(entry.id);
      if (known) return known;
      const traits = this.traitsFor(entry);
      const fit = traits ? this.fitOf(traits) : { fit: 0, notes: ['Cannot play'] };
      fits.set(entry.id, fit);
      return fit;
    };
    return pickerOrder(pickerEntries(stash), (entry) => fitOf(entry).fit).map((entry) => {
      const fit = fitOf(entry);
      return { ...pickerBasics(entry), notes: fit.notes, suits: fit.fit >= 2, fit: fit.fit };
    });
  }

  /** P: the game taken down and its list of who plays up, whoever stood ready chosen on it. */
  protected openPicker(): void {
    if (this.phase === 'playing' || this.phase === 'choosing') return;
    this.tearDownStage();
    this.phase = 'choosing';
    this.chosen = this.player()?.id ?? null;
    this.status = undefined;
    this.pickerOpenedAt = this.time.now;
    audioManager.play('menuOpen');
    recordAction(`Opened who plays ${this.title}`);
    this.showMenu();
  }

  protected showMenu(focusOn?: string): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'game-corner-screen pixel-ui wood-floor', (event) => this.onMenuKey(event));
    }
    const record = this.record();
    const best = record.day?.best[this.source];
    const today = this.todayLine();
    const course = this.course();
    const again = this.last ? this.playLabel() : undefined;
    this.overlay.redraw(
      outdoorPickMarkup({
        ...this.words,
        title: this.title,
        candidates: this.candidates(),
        chosen: this.chosen,
        tickets: record.tickets,
        best: best ? this.bestWords(best) : null,
        ...(today ? { today } : {}),
        ...(this.status ? { status: this.status } : {}),
        ...(this.last ? { last: this.last } : {}),
        ...(course ? { course } : {}),
        ...(again ? { again } : {}),
      }),
    );
    const root = this.overlay.root;
    root.setAttribute('aria-label', this.title);
    root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.closePicker();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-player-pick]').forEach((button) => {
      button.onclick = () => {
        this.chosen = button.dataset.playerPick ?? null;
        this.status = undefined;
        audioManager.play('confirm');
        this.showMenu('[data-play]');
      };
    });
    root.querySelectorAll<HTMLButtonElement>('[data-course-level]').forEach((button) => {
      button.onclick = () => {
        const level = Number(button.dataset.courseLevel);
        if (!this.chooseLevel(level)) {
          audioManager.play('denied');
          return;
        }
        audioManager.play('confirm');
        this.status = undefined;
        this.showMenu(`[data-course-level="${level}"]`);
      };
    });
    const play = root.querySelector<HTMLButtonElement>('[data-play]');
    if (play) {
      play.onclick = () => {
        if (play.getAttribute('aria-disabled') === 'true') {
          audioManager.play('denied');
          return;
        }
        if (this.time.now - this.pickerOpenedAt < RELEASE_ARMING_MS) return;
        this.playChosen();
      };
    }
    wirePickerFind(root, (key) => this.overlay?.moveCursor(key), this.find);
    root.querySelector<HTMLInputElement>('[data-picker-find]')?.addEventListener('input', (event) => {
      this.find = (event.target as HTMLInputElement).value;
    });
    this.overlay.refocus(focusOn ?? (this.chosen ? '[data-play]' : '[data-cursor-start]'), '[data-close]');
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

  /** PLAY on the list: the one chosen stands ready in the game. */
  private playChosen(): void {
    const index = this.lineups.findIndex((lineup) => lineup.length === 1 && lineup[0]?.id === this.chosen);
    if (index < 0) {
      audioManager.play('denied');
      return;
    }
    this.lineupAt = index;
    this.closePicker();
  }

  /** The list down, and the game back, standing ready with whoever the list left chosen. */
  protected closePicker(): void {
    if (this.phase !== 'choosing') return;
    this.overlay?.destroy();
    this.overlay = undefined;
    this.status = undefined;
    audioManager.play('menuClose');
    this.standReady();
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
    this.last = written ? { headline: this.lastHeadline, payout: written.payout, kept: written.kept } : undefined;
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
      canPick: this.canPick(),
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
