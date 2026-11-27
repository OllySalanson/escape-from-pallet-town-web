import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { StashedPokemon } from '../stash';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { GAME_FONT } from '../ui/gameFont';
import { pickerEntries, pickerOrder } from '../ui/boxPicker';
import { RESULT_HOLD_MS } from '../ui/spatialFocus';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { NO_GAME_CORNER, type DerbySource, type GameCornerRecord, type GamePayout, type TicketSource } from '../minigames/tickets';
import { ticketLadder } from '../minigames/ticketLadder';
import { contenderOf, lineup, stepAlong, type Contender } from '../minigames/whoPlays';
import { traitsOf, type PokemonTraits } from '../minigames/traits';
import { capOf, KeyStrip, ReadySetGo, ResultCard, type Cap, type ReadyDemo, type ReadyLevel, type ReadyOptions } from './readySetGo';
import { hideHarbourUnder } from './coverHarbour';
import { isFigureSpecies, pokemonIconFrames, POKEMON_ICON_TEXTURE } from '../world/pokemonFigures';

export interface OutdoorGameSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** The sources the promenade's three outdoor games pay from: the race's, a level each, the dig's and the fishing derby's. */
export type OutdoorSource = Extract<TicketSource, DerbySource | 'dig' | 'fishing-derby'>;

/** Where a game is: on its start line, being played, or showing what it came to. */
type Phase = 'ready' | 'playing' | 'result';

/** How long an outdoor game with no count of its own counts in: three beats. */
const OUTDOOR_COUNT_MS = 1800;

/**
 * What the promenade's three outdoor games share, over the paused harbour as
 * THE GAME CORNER's cabinets are: the game opens straight onto its own start
 * line (`readySetGo.ts`) with the partner playing - or, if the partner cannot,
 * the best fit - and LEFT and RIGHT through the count offer the next who can
 * (`minigames/whoPlays.ts`); then the game's own canvas; then what it came to,
 * paid, with its pay table once, written by `SaveManager.playOutdoorGame` in
 * one write. SPACE plays again, ESC goes. A game is a pure rules module
 * (`minigames/derby.ts`, `dig.ts`, `fishingDerby.ts`); a subclass hands it
 * time and keys and draws it.
 *
 * Nothing a game does touches the Pokémon that played it: no experience, no
 * injury, nothing lost (the harbour arenas plan, section 3.1, rule 5).
 */
export abstract class OutdoorGameScene extends Phaser.Scene implements ProvidesFeedbackContext {
  protected pausedBase = false;
  protected savedGame: RestoredGame | undefined;
  /** Whether a game is being played - past its count - rather than on its start line or its result. */
  protected playing = false;
  protected readonly saveManager = new SaveManager();
  private phase: Phase = 'ready';
  private contenders: Contender[] = [];
  private at = 0;
  private ready: ReadySetGo | undefined;
  private strip: KeyStrip | undefined;
  private card: ResultCard | undefined;
  /** When the result went up: SPACE takes no press for `RESULT_HOLD_MS` after. */
  private resultAt = Number.NEGATIVE_INFINITY;
  private clock = 0;
  private stageParts: Phaser.GameObjects.GameObject[] = [];

  /** The game's name, for the log and the feedback form. */
  protected abstract readonly title: string;

  protected abstract readonly source: OutdoorSource;

  /** The loop its start line shows. */
  protected abstract readonly demo: ReadyDemo;

  /** The keys it is played with, as the strip along the foot draws them. */
  protected abstract readonly keys: readonly Cap[];

  /** How well a Pokémon fits the game: above zero can play, the best fits are offered first after the partner. */
  protected abstract fitOf(traits: PokemonTraits): number;

  /** Starts a game with the chosen Pokémon: a fresh game, and its canvas built. */
  protected abstract beginGame(chosen: StashedPokemon, traits: PokemonTraits): void;

  /** The game moved on by `delta` ms of play. */
  protected abstract step(delta: number): void;

  protected abstract onGameKey(event: KeyboardEvent): void;

  /** How long the count lasts: a game with a count of its own hands in its own. */
  protected countMs(): number {
    return OUTDOOR_COUNT_MS;
  }

  /** Whether the game's own clock runs through the count (THE DERBY's race counts itself in), so the count is played. */
  protected readonly countsItself: boolean = false;

  /** The level the start line shows, for a game that has them. */
  protected readyLevel(): ReadyLevel | undefined {
    return undefined;
  }

  /** UP or DOWN on the start line, for a game with levels: whether it changed one, so the line starts again. */
  protected readyArrow?(arrow: 'up' | 'down'): boolean;

  /** What a game played is written as: its score, paid, and what it turned up sent home. */
  protected writeResult(
    score: number,
    finds: readonly string[],
  ): { readonly game: RestoredGame; readonly payout: GamePayout; readonly kept: readonly string[] } | null {
    return this.saveManager.playOutdoorGame(this.source, score, finds);
  }

  /** Something drawn over the game, pinned to the screen: a game with a camera of its own for its words (THE DERBY) keeps it off the track. */
  protected pinToScreen?(container: Phaser.GameObjects.Container): void;

  public init(data: OutdoorGameSceneData): void {
    this.pausedBase = data.pausedBase;
    this.phase = 'ready';
    this.playing = false;
    this.contenders = [];
    this.at = 0;
    this.ready = undefined;
    this.strip = undefined;
    this.card = undefined;
    this.resultAt = Number.NEGATIVE_INFINITY;
    this.clock = 0;
    this.stageParts = [];
    this.savedGame = this.saveManager.load() ?? undefined;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tearDownStage());
    recordAction(`Opened ${this.title}`);
  }

  public create(): void {
    // The game covers the whole of the harbour paused under it; drawn on
    // regardless, it halved the race's frame rate (playtest 51, finding 3).
    if (this.pausedBase) hideHarbourUnder(this);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));
    // Who plays is decided now, once the game has set up what it judges a fit by.
    this.contenders = this.lineup();
    this.startLine();
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: this.title },
      { label: 'Phase', value: this.phase },
      ...(this.contenders[this.at] ? [{ label: 'Playing', value: this.contenders[this.at].species }] : []),
    ];
  }

  /** For a playtest driver: whether a game is being played, past its count. */
  public get isPlaying(): boolean {
    return this.phase === 'playing';
  }

  /** For a playtest driver: where the game is - its start line, play, or its result. */
  public get phaseKind(): Phase {
    return this.phase;
  }

  /** For a playtest driver and the tests: who is on the start line, and who would follow. */
  public get lineupIds(): readonly string[] {
    return this.contenders.map((contender) => contender.id);
  }

  /** For a playtest driver and the tests: who plays this game. */
  public get playerId(): string | undefined {
    return this.contenders[this.at]?.id;
  }

  /** For a playtest driver: put somebody on the start line, by stash id, as LEFT and RIGHT would. */
  public playWith(id: string): boolean {
    const index = this.contenders.findIndex((contender) => contender.id === id);
    if (index < 0) return false;
    this.at = index;
    this.startLine();
    return true;
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

  /** Who can play, in the order they are offered: the partner first, then the best fits. */
  private lineup(): Contender[] {
    const stash = this.savedGame?.stash;
    if (!stash) return [];
    const fits = new Map<string, number>();
    const fit = (entry: { readonly id: string; readonly pokemon: StashedPokemon['pokemon'] }): number => {
      const known = fits.get(entry.id);
      if (known !== undefined) return known;
      const traits = this.traitsFor(entry);
      const value = traits ? this.fitOf(traits) : 0;
      fits.set(entry.id, value);
      return value;
    };
    const able = pickerOrder(pickerEntries(stash), fit)
      .filter((entry) => fit(entry) > 0)
      .map(contenderOf);
    return lineup(able, stash.partnerId());
  }

  private chosenPokemon(): StashedPokemon | undefined {
    const id = this.contenders[this.at]?.id;
    return this.savedGame?.stash.listPokemon().find((stored) => stored.id === id);
  }

  // --- the start line, play and the result ---------------------------------------------

  /** The game set up fresh with whoever is on the line, and the count started. */
  private startLine(): void {
    const chosen = this.chosenPokemon();
    const traits = chosen ? this.traitsFor(chosen) : undefined;
    this.ready?.destroy();
    this.ready = undefined;
    this.strip?.destroy();
    this.strip = undefined;
    this.card?.destroy();
    this.card = undefined;
    this.tearDownStage();
    this.playing = false;
    this.phase = 'ready';
    if (!chosen || !traits) {
      // Nobody at all to play: the harbour, rather than a game nobody can start.
      this.close();
      return;
    }
    recordAction(`Played ${this.title} with ${chosen.pokemon.base.id}`);
    this.beginGame(chosen, traits);
    const contender = this.contenders[this.at];
    const species = chosen.pokemon.base.id;
    const options: ReadyOptions = {
      demo: this.demo,
      countMs: this.countMs(),
      // The loop played by the Pokémon itself, as its party icon, where the game shows it moving.
      ...(this.loopShowsPlayer && isFigureSpecies(species) ? { figure: { texture: POKEMON_ICON_TEXTURE, frames: pokemonIconFrames(species) } } : {}),
    };
    this.ready = new ReadySetGo(
      this,
      options,
      { dexId: contender.dexId, shiny: contender.shiny, name: contender.name },
      this.contenders.length > 1,
      this.readyLevel(),
    );
    this.pinToScreen?.(this.ready.root);
  }

  /** The start line again, with whatever has changed: a level chosen by a driver. */
  protected restartLine(): void {
    this.startLine();
  }

  /** Whether the start line's loop is played by the Pokémon itself (a racer) rather than a spade or a rod. */
  protected readonly loopShowsPlayer: boolean = false;

  private onKey(event: KeyboardEvent): void {
    if (this.phase === 'playing') {
      this.strip?.press(event.key);
      this.onGameKey(event);
      return;
    }
    const cap = capOf(event.key);
    if (cap === 'esc') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.repeat) return;
    if (this.phase === 'ready') {
      if (cap === 'left' || cap === 'right') {
        event.preventDefault();
        if (this.contenders.length < 2) return;
        audioManager.play('select');
        this.at = stepAlong(this.contenders.length, this.at, cap === 'left' ? -1 : 1);
        this.startLine();
      } else if ((cap === 'up' || cap === 'down') && this.readyArrow?.(cap)) {
        event.preventDefault();
        audioManager.play('select');
        this.startLine();
      }
      return;
    }
    // The result: SPACE again, once it has been seen - SPACE plays most of these
    // games, and the press still going at the end must not start the next over it.
    this.card?.press(event.key);
    if (cap === 'space' && this.clock - this.resultAt >= RESULT_HOLD_MS) {
      event.preventDefault();
      audioManager.play('confirm');
      this.startLine();
    }
  }

  public update(_time: number, delta: number): void {
    this.clock += delta;
    if (this.phase === 'result') {
      this.card?.tick(delta);
      return;
    }
    const split = this.ready?.tick(delta);
    if (this.phase === 'ready') {
      if (split && split.count > 0 && this.countsItself) this.step(split.count);
      if (!this.ready?.done) return;
      this.phase = 'playing';
      this.playing = true;
      this.strip = new KeyStrip(this, this.keys);
      this.pinToScreen?.(this.strip.root);
      if (split && split.play > 0) this.step(split.play);
      return;
    }
    this.strip?.tick(delta);
    this.step(delta);
  }

  /**
   * The game is over: its score written and paid in one write, and what it
   * came to shown over its own field, with its pay table.
   */
  protected endGame(score: number, headline: string, finds: readonly string[] = [], note?: string): void {
    if (this.phase !== 'playing') return;
    // The source the game was played at, before the write moves anything on (a podium opens the next level).
    const source = this.source;
    const written = this.writeResult(score, finds);
    const played = this.chosenPokemon();
    if (written) {
      this.savedGame = written.game;
      if (written.payout.tickets > 0 || written.kept.length > 0) audioManager.play('itemObtained');
    }
    recordAction(`${this.title} scored ${score}`);
    this.strip?.destroy();
    this.strip = undefined;
    this.ready?.destroy();
    this.ready = undefined;
    this.playing = false;
    this.phase = 'result';
    this.resultAt = this.clock;
    const record = written?.game.raidProgress.gameCorner ?? NO_GAME_CORNER;
    this.card = new ResultCard(this, {
      ...(played ? { face: { dexId: played.pokemon.base.dexId, shiny: played.pokemon.shiny } } : {}),
      headline,
      ...(written ? (note ? { note } : {}) : { note: 'Nothing could be written down.' }),
      newBest: written?.payout.newBest ?? false,
      earned: written?.payout.tickets ?? 0,
      finds: written?.kept ?? [],
      ladder: written ? ticketLadder(source, score, record, new Date()) : null,
    });
    this.pinToScreen?.(this.card.root);
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
