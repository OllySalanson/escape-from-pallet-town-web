import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { dojoRefusal } from '../arena/boutRules';
import { dojoRegular, dojoRegularsToday } from '../arena/dojoCounter';
import { openingTeam, opponentsBody, teamBody } from '../arena/dojoCounterView';
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
}

export interface DojoCounterSceneData {
  /** Only resume the room when this screen paused it. */
  readonly pausedBase: boolean;
  /** Called once, as FIGHT is pressed, before the room is resumed to start the bout. */
  readonly fight: (choice: DojoChoice) => void;
  /** The room beside the panel, told what the panel covers. */
  readonly view?: SidePanelView;
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
  public get counterState(): { readonly opponent: string | null; readonly team: readonly string[] } {
    return { opponent: this.opponent, team: [...this.team] };
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
    const regular = this.opponent ? dojoRegular(this.opponent) : undefined;
    const body = !game
      ? '<main class="px-body"><p class="px-empty">There is no saved game.</p></main>'
      : regular
        ? teamBody(this.entries(), this.team, regular)
        : opponentsBody(dojoRegularsToday(this.now), game.raidProgress.dojo, null);
    overlay.redraw(
      pixelScreen({
        title: 'Battle Arena',
        back: { label: regular ? 'Back' : 'Dojo', attribute: 'data-close' },
        aside: regular ? pixelTag(`${this.team.length} of 3`, this.team.length > 0 ? 'good' : 'risk') : undefined,
        body,
        hints: regular
          ? 'ARROWS move · ENTER bring or leave out · type in FIND · ESC back'
          : 'ARROWS move · ENTER choose who to fight · ESC close',
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
    if (regular) {
      const apply = wirePickerFind(overlay.root, (key) => overlay.moveCursor(key), this.find);
      overlay.root.querySelector<HTMLInputElement>('[data-picker-find]')?.addEventListener('input', (event) => {
        this.find = (event.target as HTMLInputElement).value;
      });
      apply(this.find);
    }
    overlay.refocus(...prefer, '[data-cursor-start]:not([hidden])', '[data-opponent]', '[data-member]:not([hidden])', '[data-close]');
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

  private chooseOpponent(id: string): void {
    const regular = dojoRegular(id);
    if (!regular) {
      return;
    }
    audioManager.play('select');
    this.opponent = id;
    this.find = '';
    recordAction(`Chose to fight ${regular.bot.name}`);
    this.status = `${regular.bot.name} brings ${regular.team.length}. Choose up to three of yours.`;
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
    const refusal = dojoRefusal(entry.pokemon, this.chosenTeam());
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

  /** ESC or the back button: from the team back to the regulars, and from them out to the dojo. */
  private back(): void {
    if (this.opponent) {
      audioManager.play('cancel');
      this.opponent = null;
      this.render([`[data-opponent]`]);
      return;
    }
    this.close(true);
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
