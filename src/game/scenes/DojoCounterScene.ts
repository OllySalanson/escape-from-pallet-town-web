import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { dojoRefusal } from '../arena/boutRules';
import { dojoRegularsToday } from '../arena/dojoCounter';
import { beltFoe, dojoClass, dojoFoe, headRefusal, regularFoe, type DojoFoe } from '../arena/classes';
import { classOf } from '../arena/dojoRecord';
import { openingTeam, opponentsBody, teamBody } from '../arena/dojoCounterView';
import { runPeriod, type DojoRun, type DojoRunMode } from '../arena/arenaRuns';
import { cupFoe, cupOfTheWeek, cupRefusal, cupSideProblem, cupWeek } from '../arena/cups';
import { liveRentalRun, rentalFoe, rentalTeamProblem, startsNewRun } from '../arena/rentals';
import { cupBody, modesBody, openingCupTeam, rentalBody } from '../arena/runsView';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { Pokemon } from '../pokemon';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { pickerEntries, wirePickerFind, type PickerEntry } from '../ui/boxPicker';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { pixelScreen, pixelTag } from '../ui/pixelUi';
import { dockSidePanel, type SidePanelView } from '../ui/sidePanel';

/** What the counter hands back to the room: who to fight, and the vault's own Pokémon to copy for it. */
export interface DojoChoice {
  readonly opponent: string;
  readonly team: readonly Pokemon[];
  /** The cup or rental run the bout is part of (`arena/arenaRuns.ts`); absent is a class bout. */
  readonly run?: DojoRun;
}

/** Which of the counter's three ways in is open: null is the first page that chooses one. */
type CounterMode = 'class' | DojoRunMode | null;

export interface DojoCounterSceneData {
  /** Only resume the room when this screen paused it. */
  readonly pausedBase: boolean;
  /** Called once, as FIGHT is pressed, before the room is resumed to start the bout. */
  readonly fight: (choice: DojoChoice) => void;
  /** The room beside the panel, told what the panel covers. */
  readonly view?: SidePanelView;
  /** Open straight onto a run's page: the room does, as a run's bout comes back won. */
  readonly mode?: DojoRunMode;
}

/**
 * Who the player brought last time, by stash id, for the page's life: the
 * counter opens on that team again, and nothing about it is ever saved, because
 * a bout keeps nothing but its result.
 */
let lastDojoTeam: readonly string[] = [];

/**
 * THE BATTLE ARENA's counter (`arena/dojoCounterView.ts` says what and why): a
 * side panel over the paused dojo, choosing a regular to fight and then up to
 * three to bring from every box. It writes nothing: FIGHT hands the choice back
 * to the room, which starts the bout on flat-level copies (`arena/boutRules.ts`).
 */
export class DojoCounterScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private fight: ((choice: DojoChoice) => void) | undefined;
  private view: SidePanelView | undefined;
  private game_: RestoredGame | undefined;
  private now = new Date();
  private opponent: string | null = null;
  private team: string[] = [];
  private status: string | undefined;
  private find = '';
  private mode: CounterMode = null;
  /** The three on loan, by kind, while the rental page is open. */
  private rentalTeam: string[] = [];
  /** One of the beaten team chosen to swap in, waiting for who of yours goes back. */
  private swapTake: string | null = null;
  /** START AGAIN pressed: the run going is set aside, and today's six are offered. */
  private freshRun = false;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('dojo-counter');
  }

  public init(data: DojoCounterSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.fight = data.fight;
    this.view = data.view;
    this.status = undefined;
    this.find = '';
    this.opponent = null;
    this.now = new Date();
    this.game_ = this.saveManager.load() ?? undefined;
    const entries = this.entries();
    const wanted = lastDojoTeam.length > 0 ? lastDojoTeam : (this.game_?.raidProgress.lastBench ?? []);
    this.team = [...openingTeam(entries, wanted)];
    this.mode = null;
    this.swapTake = null;
    this.freshRun = false;
    this.rentalTeam = [];
    if (data.mode) {
      this.enterMode(data.mode);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.view?.covers(0);
    });
    recordAction('Opened the Battle Arena counter');
  }

  public create(): void {
    this.overlay = new MenuOverlay(this, 'dojo-counter side-panel pixel-ui', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', 'Battle Arena counter');
    dockSidePanel(this, this.overlay, this.view);
    this.render();
  }

  public update(_time: number, deltaMs: number): void {
    this.view?.frame(deltaMs);
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'Battle Arena counter' },
      { label: 'Opponent', value: this.opponent ?? 'not chosen' },
      { label: 'Team', value: this.chosenTeam().map((pokemon) => pokemon.name).join(', ') || 'nobody' },
    ];
  }

  /** For a playtest driver: the stage, who is chosen and who is on the side. */
  public get counterState(): {
    readonly mode: CounterMode;
    readonly opponent: string | null;
    readonly team: readonly string[];
    readonly rentalTeam: readonly string[];
  } {
    return { mode: this.mode, opponent: this.opponent, team: [...this.team], rentalTeam: [...this.rentalTeam] };
  }

  /** Onto one of the three ways in, with its team as it stood. */
  private enterMode(mode: Exclude<CounterMode, null>): void {
    this.mode = mode;
    this.opponent = null;
    this.find = '';
    this.swapTake = null;
    this.freshRun = false;
    if (mode === 'cup') {
      this.team = [...openingCupTeam(this.entries(), this.team.length > 0 ? this.team : lastDojoTeam, cupOfTheWeek(this.now))];
    }
    if (mode === 'rental') {
      this.rentalTeam = [...(liveRentalRun(this.game_?.raidProgress.dojo?.rental, this.now)?.team ?? [])];
    }
  }

  /** The run going, unless START AGAIN has set it aside. */
  private liveRun() {
    return this.freshRun ? undefined : liveRentalRun(this.game_?.raidProgress.dojo?.rental, this.now);
  }

  /** Which bout of the rental run the team as it stands would fight: what the page says, and what FIGHT hands on. */
  private rentalBout(): number {
    const live = this.liveRun();
    return live && !startsNewRun(this.rentalTeam, live) ? live.won + 1 : live && this.rentalTeam.length < 3 ? live.won + 1 : 1;
  }

  /** Who the next rental bout is against, for the team as it stands. */
  private rentalOpponent() {
    return rentalFoe(this.rentalBout(), this.now);
  }

  /** Who the next cup bout is against. */
  private cupOpponent() {
    const cup = cupOfTheWeek(this.now);
    const bout = cupWeek(this.game_?.raidProgress.dojo?.cup, this.now).run + 1;
    return { cup, bout, foe: cupFoe(cup, bout, this.now) };
  }

  private entries(): readonly PickerEntry[] {
    return this.game_ ? pickerEntries(this.game_.stash) : [];
  }

  private chosenTeam(): Pokemon[] {
    const byId = new Map(this.entries().map((entry) => [entry.id, entry.pokemon]));
    return this.team.flatMap((id) => {
      const pokemon = byId.get(id);
      return pokemon ? [pokemon] : [];
    });
  }

  private render(prefer: readonly string[] = []): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    const status = this.status;
    this.status = undefined;
    const game = this.game_;
    const regular = this.opponent ? this.foe(this.opponent) : undefined;
    const record = game?.raidProgress.dojo;
    const classId = classOf(record);
    const recordShown =
      this.freshRun && record ? { ...record, rental: { ...record.rental, run: undefined } } : record;
    const cupNow = this.mode === 'cup' ? this.cupOpponent() : null;
    const body = !game
      ? '<main class="px-body"><p class="px-empty">There is no saved game.</p></main>'
      : this.mode === null
        ? modesBody(record, cupOfTheWeek(this.now), this.now)
        : cupNow
          ? cupBody(this.entries(), this.team, cupNow.cup, cupNow.foe, cupNow.bout)
          : this.mode === 'rental'
            ? rentalBody(recordShown, this.rentalTeam, this.rentalOpponent(), this.now, this.swapTake)
            : regular
              ? teamBody(this.entries(), this.team, regular)
              : opponentsBody(
                  dojoRegularsToday(this.now).map((one) => regularFoe(one, classId)),
                  beltFoe(dojoClass(classId).head),
                  record,
                  null,
                );
    const picking = regular !== undefined || this.mode === 'cup';
    overlay.redraw(
      pixelScreen({
        title: 'Battle Arena',
        back: { label: this.mode === null ? 'Dojo' : 'Back', attribute: 'data-close' },
        aside: picking ? pixelTag(`${this.team.length} of 3`, this.team.length > 0 ? 'good' : 'risk') : undefined,
        body,
        hints: picking
          ? 'ARROWS move · ENTER bring or leave out · type in FIND · ESC back'
          : this.mode === 'rental'
            ? 'ARROWS move · ENTER take or swap · ESC back'
            : this.mode === null
              ? 'ARROWS move · ENTER choose · ESC close'
              : 'ARROWS move · ENTER choose who to fight · ESC back',
        ...(status ? { status } : {}),
      }),
    );
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.back();
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-opponent]').forEach((button) => {
      button.onclick = () => this.chooseOpponent(button.dataset.opponent!);
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-member]').forEach((button) => {
      button.onclick = () => this.toggle(button.dataset.member!);
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-fight]').forEach((button) => {
      button.onclick = () => this.startFight();
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
      button.onclick = () => this.chooseMode(button.dataset.mode as Exclude<CounterMode, null>);
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-rental]').forEach((button) => {
      button.onclick = () => this.toggleRental(button.dataset.rental!);
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-theirs]').forEach((button) => {
      button.onclick = () => this.takeTheirs(button.dataset.theirs!);
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-yours]').forEach((button) => {
      button.onclick = () => this.giveBack(button.dataset.yours!);
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-new-run]').forEach((button) => {
      button.onclick = () => this.startAgain();
    });
    if (picking) {
      const apply = wirePickerFind(overlay.root, (key) => overlay.moveCursor(key), this.find);
      overlay.root.querySelector<HTMLInputElement>('[data-picker-find]')?.addEventListener('input', (event) => {
        this.find = (event.target as HTMLInputElement).value;
      });
      apply(this.find);
    }
    overlay.refocus(
      ...prefer,
      '[data-cursor-start]:not([hidden])',
      '[data-mode]',
      '[data-opponent]',
      '[data-rental]',
      '[data-member]:not([hidden])',
      '[data-close]',
    );
  }

  private onKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event, 'Backspace')) {
      event.preventDefault();
      this.back();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /** Somebody the counter can offer, as they fight a player in this save's class. */
  private foe(id: string): DojoFoe | undefined {
    return dojoFoe(id, classOf(this.game_?.raidProgress.dojo));
  }

  private chooseOpponent(id: string): void {
    const regular = this.foe(id);
    if (!regular) {
      return;
    }
    // The head of the class fights only a run of three (`arena/classes.ts`).
    const refusal = regular.belt ? headRefusal(this.game_?.raidProgress.dojo) : null;
    if (refusal) {
      audioManager.play('denied');
      this.status = refusal;
      this.render([`[data-opponent="${id}"]`]);
      return;
    }
    audioManager.play('select');
    this.opponent = id;
    this.find = '';
    recordAction(`Chose to fight ${regular.name}`);
    this.status = `${regular.name} brings as many as you do, up to ${regular.team.length}. Choose up to three of yours.`;
    this.render(['[data-fight]:not([aria-disabled])']);
  }

  /** ENTER on a row: onto the side, or off it. A row the clauses refuse says why. */
  private toggle(pokemonId: string): void {
    const entry = this.entries().find((one) => one.id === pokemonId);
    if (!entry) {
      return;
    }
    if (this.team.includes(pokemonId)) {
      this.team = this.team.filter((id) => id !== pokemonId);
      audioManager.play('cancel');
      this.render([`[data-member="${pokemonId}"]`]);
      return;
    }
    const refusal =
      this.mode === 'cup' ? cupRefusal(entry.pokemon, this.chosenTeam(), cupOfTheWeek(this.now)) : dojoRefusal(entry.pokemon, this.chosenTeam());
    if (refusal) {
      audioManager.play('denied');
      this.status = refusal;
      this.render([`[data-member="${pokemonId}"]`]);
      return;
    }
    this.team = [...this.team, pokemonId];
    audioManager.play('select');
    this.render([`[data-member="${pokemonId}"]`]);
  }

  private startFight(): void {
    if (this.mode === 'cup' || this.mode === 'rental') {
      this.startRunBout(this.mode);
      return;
    }
    const opponent = this.opponent;
    const team = this.chosenTeam();
    if (!opponent || team.length === 0) {
      audioManager.play('denied');
      this.status = 'Bring at least one first.';
      this.render();
      return;
    }
    lastDojoTeam = [...this.team];
    recordAction(`Started a bout with ${team.map((pokemon) => pokemon.name).join(', ')}`);
    this.fight?.({ opponent, team });
    this.fight = undefined;
    this.close(false);
  }

  /** ESC or the back button: from the team back to the regulars, from a page back to the first, and from there out. */
  private back(): void {
    if (this.swapTake) {
      audioManager.play('cancel');
      this.swapTake = null;
      this.render();
      return;
    }
    if (this.opponent) {
      audioManager.play('cancel');
      this.opponent = null;
      this.render([`[data-opponent]`]);
      return;
    }
    if (this.mode !== null) {
      audioManager.play('cancel');
      const was = this.mode;
      this.mode = null;
      this.render([`[data-mode="${was}"]`]);
      return;
    }
    this.close(true);
  }

  private chooseMode(mode: Exclude<CounterMode, null>): void {
    audioManager.play('select');
    this.enterMode(mode);
    recordAction(`Chose ${mode} at the Battle Arena counter`);
    if (mode === 'cup') {
      const { cup, bout, foe } = this.cupOpponent();
      this.status = `${cup.name}: ${cup.rule} Bout ${bout}: ${foe.name}.`;
    }
    if (mode === 'rental' && !this.liveRun()) {
      this.status = 'Take three of today’s six.';
    }
    this.render();
  }

  /** ENTER on one of today's six: onto the loan, or back on the table. */
  private toggleRental(species: string): void {
    if (this.rentalTeam.includes(species)) {
      this.rentalTeam = this.rentalTeam.filter((one) => one !== species);
      audioManager.play('cancel');
    } else if (this.rentalTeam.length >= 3) {
      audioManager.play('denied');
      this.status = 'Three on loan at most. Send one back first.';
    } else {
      this.rentalTeam = [...this.rentalTeam, species];
      audioManager.play('select');
    }
    this.render([`[data-rental="${species}"]`]);
  }

  /** ENTER on one of the team just beaten: it is the one to swap in. */
  private takeTheirs(species: string): void {
    const live = this.liveRun();
    if (!live || this.rentalTeam.some((one) => !live.team.includes(one))) {
      audioManager.play('denied');
      this.status = 'One swap a win: you have made it.';
      this.render();
      return;
    }
    audioManager.play('select');
    this.swapTake = species;
    this.status = 'Who of yours goes back for it?';
    this.render(['[data-yours]']);
  }

  /** ENTER on one of yours while a swap is waiting: it goes back, and theirs comes in its place. */
  private giveBack(species: string): void {
    if (!this.swapTake) {
      this.status = 'Choose one of theirs first, then who of yours it replaces.';
      this.render([`[data-yours="${species}"]`]);
      return;
    }
    const taking = this.swapTake;
    this.rentalTeam = this.rentalTeam.map((one) => (one === species ? taking : one));
    this.swapTake = null;
    audioManager.play('select');
    this.status = 'Swapped. One swap a win.';
    this.render(['[data-fight]:not([aria-disabled])']);
  }

  /** START AGAIN: the run going is set aside, and today's six are offered again. */
  private startAgain(): void {
    audioManager.play('cancel');
    this.freshRun = true;
    this.rentalTeam = [];
    this.swapTake = null;
    this.status = 'Take three of today’s six. This starts a new run.';
    this.render();
  }

  /**
   * FIGHT on a run's page: the bout, with the run it is part of and which bout
   * of it the page said it was (`arena/arenaRuns.ts`'s `RunStamp`).
   */
  private startRunBout(mode: DojoRunMode): void {
    // A page opened before midnight (or before Monday, for the cup) offers a day
    // that is over: FIGHT used to close it and start nothing, without a word.
    const now = new Date();
    if (runPeriod(mode, now) !== runPeriod(mode, this.now)) {
      audioManager.play('denied');
      this.now = now;
      this.game_ = this.saveManager.load() ?? this.game_;
      this.enterMode(mode);
      this.status = mode === 'cup' ? 'A new week has begun, and with it a new cup. Choose again.' : 'Midnight has passed: these are today’s six. Choose again.';
      this.render();
      return;
    }
    if (mode === 'cup') {
      const { cup, foe, bout } = this.cupOpponent();
      const team = this.chosenTeam();
      const problem = cupSideProblem(team, cup);
      if (problem) {
        audioManager.play('denied');
        this.status = problem;
        this.render();
        return;
      }
      lastDojoTeam = [...this.team];
      recordAction(`Started a ${cup.name} bout with ${team.map((pokemon) => pokemon.name).join(', ')}`);
      this.fight?.({ opponent: foe.id, team, run: { mode: 'cup', bout } });
    } else {
      const problem = rentalTeamProblem(this.rentalTeam, this.liveRun(), this.now);
      if (problem) {
        audioManager.play('denied');
        this.status = problem;
        this.render();
        return;
      }
      const bout = this.rentalBout();
      const foe = rentalFoe(bout, this.now);
      recordAction(`Started rental bout ${bout} with ${this.rentalTeam.join(', ')}`);
      this.fight?.({ opponent: foe.id, team: [], run: { mode: 'rental', team: [...this.rentalTeam], bout } });
    }
    this.fight = undefined;
    this.close(false);
  }

  private close(sound: boolean): void {
    if (sound) {
      audioManager.play('menuClose');
    }
    const resumeBase = this.pausedBase && this.scene.isPaused('base');
    this.pausedBase = false;
    this.scene.stop();
    if (resumeBase) {
      this.scene.resume('base');
    }
  }
}
