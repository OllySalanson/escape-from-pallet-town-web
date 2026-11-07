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
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { outdoorPickMarkup, type OutdoorCandidate, type OutdoorCourse, type OutdoorPickState } from '../minigames/outdoorView';
import { NO_GAME_CORNER, type GameCornerRecord, type GamePayout, type TicketSource } from '../minigames/tickets';
import { traitsOf, type PokemonTraits } from '../minigames/traits';

export interface OutdoorGameSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** How a game sees a candidate: its traits, whether it suits, and what to say about it. */
export interface OutdoorFit {
  readonly fit: number;
  readonly notes: readonly string[];
}

/** The three sources the promenade's outdoor games pay from. */
export type OutdoorSource = Extract<TicketSource, 'derby' | 'dig' | 'fishing-derby'>;

/**
 * What the promenade's three outdoor games share, over the paused harbour as
 * THE GAME CORNER's cabinets are: the screen that chooses who plays (one
 * Pokémon, from every box, best fits first - `ui/boxPicker.ts`), the game's
 * own canvas, and what a game paid, written by `SaveManager.playOutdoorGame`
 * in one write. A game is a pure rules module (`minigames/derby.ts`, `dig.ts`,
 * `fishingDerby.ts`); a subclass hands it time and keys and draws it.
 *
 * Nothing a game does touches the Pokémon that played it: no experience, no
 * injury, nothing lost (the harbour arenas plan, section 3.1, rule 5).
 */
export abstract class OutdoorGameScene extends Phaser.Scene implements ProvidesFeedbackContext {
  protected overlay: MenuOverlay | undefined;
  protected pausedBase = false;
  protected savedGame: RestoredGame | undefined;
  protected chosen: string | null = null;
  protected status: string | undefined;
  protected last: OutdoorPickState['last'];
  /** Whether a game is being played (the canvas) rather than chosen (the screen). */
  protected playing = false;
  protected readonly saveManager = new SaveManager();
  private find = '';
  private stageParts: Phaser.GameObjects.GameObject[] = [];

  /** The screen's words. */
  protected abstract readonly words: {
    readonly title: string;
    readonly place: string;
    readonly heading: string;
    readonly doing: string;
    readonly rules: string;
    readonly playHelp: string;
  };

  protected abstract readonly source: OutdoorSource;

  /** How well a Pokémon fits the game, and what it would do. */
  protected abstract fitOf(traits: PokemonTraits): OutdoorFit;

  /** Starts a game with the chosen Pokémon: build the canvas. */
  protected abstract beginGame(chosen: StashedPokemon, traits: PokemonTraits): void;

  /** The day's best, as the game words it. */
  protected abstract bestWords(best: number): string;

  /** A line about the day, if the game has one. */
  protected todayLine(): string | undefined {
    return undefined;
  }

  /** The game's levels, if it has them (THE PROMENADE DERBY's courses). */
  protected course(): OutdoorCourse | undefined {
    return undefined;
  }

  /** A level chosen on the screen. Whether it could be: a level not yet open cannot. */
  protected chooseLevel(level: number): boolean {
    return level === 1;
  }

  /** What a game played is written as: its score, paid, and what it turned up sent home. */
  protected writeResult(
    score: number,
    finds: readonly string[],
  ): { readonly game: RestoredGame; readonly payout: GamePayout; readonly kept: readonly string[] } | null {
    return this.saveManager.playOutdoorGame(this.source, score, finds);
  }

  public init(data: OutdoorGameSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.status = undefined;
    this.last = undefined;
    this.playing = false;
    this.stageParts = [];
    this.savedGame = this.saveManager.load() ?? undefined;
    this.chosen = this.candidates().find((candidate) => candidate.suits)?.id ?? this.candidates()[0]?.id ?? null;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.tearDownStage();
    });
    recordAction(`Opened ${this.words.title}`);
  }

  public create(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.playing) this.onGameKey(event);
    });
    this.showMenu();
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: this.words.title },
      { label: 'Phase', value: this.playing ? 'playing' : 'choosing' },
    ];
  }

  /** For a playtest driver: whether a game is being played. */
  public get isPlaying(): boolean {
    return this.playing;
  }

  /** For a playtest driver: choose who plays, by stash id, and play. */
  public playWith(id: string): boolean {
    if (this.playing || !this.candidates().some((candidate) => candidate.id === id)) return false;
    this.chosen = id;
    this.startGame();
    return this.playing;
  }

  protected abstract onGameKey(event: KeyboardEvent): void;

  protected record(): GameCornerRecord {
    return this.savedGame?.raidProgress.gameCorner ?? NO_GAME_CORNER;
  }

  protected traitsFor(entry: { readonly pokemon: StashedPokemon['pokemon'] }): PokemonTraits | undefined {
    return traitsOf(
      entry.pokemon.base.id,
      entry.pokemon.moves.map((move) => move.base.name),
    );
  }

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

  // --- the screen ------------------------------------------------------------------

  protected showMenu(focusOn?: string): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'game-corner-screen pixel-ui', (event) => this.onMenuKey(event));
    }
    const record = this.record();
    const best = record.day?.best[this.source];
    const today = this.todayLine();
    const course = this.course();
    this.overlay.redraw(
      outdoorPickMarkup({
        ...this.words,
        candidates: this.candidates(),
        chosen: this.chosen,
        tickets: record.tickets,
        best: best ? this.bestWords(best) : null,
        ...(today ? { today } : {}),
        ...(this.status ? { status: this.status } : {}),
        ...(this.last ? { last: this.last } : {}),
        ...(course ? { course } : {}),
      }),
    );
    const root = this.overlay.root;
    root.setAttribute('aria-label', this.words.title);
    root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.close();
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
        this.startGame();
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
      this.close();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  private startGame(): void {
    const chosen = this.savedGame?.stash.listPokemon().find((stored) => stored.id === this.chosen);
    const traits = chosen ? this.traitsFor(chosen) : undefined;
    if (!chosen || !traits) return;
    this.overlay?.destroy();
    this.overlay = undefined;
    this.status = undefined;
    audioManager.play('confirm');
    recordAction(`Played ${this.words.title} with ${chosen.pokemon.base.id}`);
    this.playing = true;
    this.beginGame(chosen, traits);
  }

  /**
   * The game is over: its score written and paid in one write, and the
   * choosing screen back up with what it came to.
   */
  protected endGame(score: number, headline: string, finds: readonly string[] = []): void {
    const written = this.writeResult(score, finds);
    if (written) {
      this.savedGame = written.game;
      this.last = { headline, payout: written.payout, kept: written.kept };
      if (written.payout.tickets > 0 || written.kept.length > 0) audioManager.play('itemObtained');
    } else {
      this.last = undefined;
      this.status = 'Nobody could write that down. Nothing was paid.';
    }
    recordAction(`${this.words.title} scored ${score}`);
    this.tearDownStage();
    this.playing = false;
    this.showMenu('[data-play]');
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
