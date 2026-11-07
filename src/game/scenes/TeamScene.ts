import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { flowForGame } from '../base/arenaKit';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { MAX_RUN_PARTY, type DeploymentFlow } from '../hub/deploymentFlow';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { pixelScreen, pixelTag } from '../ui/pixelUi';
import { dockSidePanel, type SidePanelView } from '../ui/sidePanel';
import { pickerEntries, wirePickerFind } from '../ui/boxPicker';
import { teamBody, teamRowHelp } from '../ui/teamView';

export interface TeamSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
  /** The hall's own choices, while the player is in THE RAID ARENA: the team is the bench's. */
  readonly flow?: DeploymentFlow;
  /** The harbour beside the panel, told what the panel covers. */
  readonly view?: SidePanelView;
}

/**
 * YOUR TEAM, on P anywhere in the harbour (`ui/teamView.ts` says what and why):
 * the next raid's team, picked from every box, in a side panel over the paused
 * harbour - YOUR THINGS's shape.
 *
 * It writes one thing, `raidProgress.lastBench`, through
 * `SaveManager.chooseBench`, which is the list the Raid Arena's bench opens on
 * (`base/arenaKit.ts`), so the bench holds who was chosen in the yard. In the
 * hall it changes the bench itself as well, so nothing the hall shows disagrees.
 */
export class TeamScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private hallFlow: DeploymentFlow | undefined;
  private view: SidePanelView | undefined;
  private game_: RestoredGame | undefined;
  private flow: DeploymentFlow | undefined;
  private status: string | undefined;
  /** What the find field held, so a redraw after a press keeps the list narrowed. */
  private find = '';
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('team');
  }

  public init(data: TeamSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.hallFlow = data.flow;
    this.view = data.view;
    this.status = undefined;
    this.find = '';
    this.game_ = this.saveManager.load() ?? this.game_;
    if (this.hallFlow && this.game_) {
      this.hallFlow.rebase(this.game_.stash);
    }
    this.flow = this.hallFlow ?? (this.game_ ? flowForGame(this.game_) : undefined);
    // Nobody on the bench is somebody on it, as the hall has it on the way in
    // (`BaseScene.openTheHall`), so the team shown here is the one the hall would stand.
    this.flow?.packSomebodyIfBenchEmpty();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.view?.covers(0);
    });
    recordAction('Opened your team');
  }

  public create(): void {
    this.overlay = new MenuOverlay(this, 'team-menu side-panel pixel-ui', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', 'Your team');
    dockSidePanel(this, this.overlay, this.view);
    this.render();
  }

  public update(_time: number, deltaMs: number): void {
    this.view?.frame(deltaMs);
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'Your team' },
      { label: 'Team', value: (this.flow?.party ?? []).map((stored) => stored.pokemon.name).join(', ') || 'nobody' },
    ];
  }

  /** For a playtest driver: who is going, by stash id. */
  public get teamIds(): readonly string[] {
    return (this.flow?.party ?? []).map((stored) => stored.id);
  }

  private render(prefer: readonly string[] = []): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    const status = this.status;
    this.status = undefined;
    const game = this.game_;
    const flow = this.flow;
    const going = flow?.party.length ?? 0;
    const body =
      game && flow
        ? teamBody({
            entries: pickerEntries(game.stash),
            team: flow.party.map((stored) => stored.id),
            partnerId: game.stash.partner()?.id,
          })
        : '<main class="px-body"><p class="px-empty">There is no saved game.</p></main>';
    overlay.redraw(
      pixelScreen({
        title: 'Your team',
        back: { label: 'Harbour', attribute: 'data-close' },
        aside: pixelTag(`${going} of ${MAX_RUN_PARTY}`, going > 0 ? 'good' : 'risk'),
        body,
        hints: 'ARROWS move · ENTER take or leave · type in FIND · P close',
        ...(status ? { status } : {}),
      }),
    );
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.close();
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-member]').forEach((button) => {
      button.onclick = () => this.toggle(button.dataset.member!);
    });
    const apply = wirePickerFind(overlay.root, (key) => overlay.moveCursor(key), this.find);
    overlay.root.querySelector<HTMLInputElement>('[data-picker-find]')?.addEventListener('input', (event) => {
      this.find = (event.target as HTMLInputElement).value;
    });
    apply(this.find);
    overlay.refocus(...prefer, '[data-member]:not([hidden])', '[data-close]');
  }

  private onKey(event: KeyboardEvent): void {
    // The P that opened it, still held, repeats: it must not close it again.
    if (event.repeat && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      return;
    }
    if (isOverlayDismissKey(event, 'p', 'Backspace')) {
      event.preventDefault();
      this.close();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /** ENTER on a row: in or out of the team, written as the next raid's bench. */
  private toggle(pokemonId: string): void {
    const game = this.game_;
    const flow = this.flow;
    if (!game || !flow) {
      return;
    }
    const entry = pickerEntries(game.stash).find((one) => one.id === pokemonId);
    if (!entry) {
      return;
    }
    const wasIn = flow.includesPokemon(pokemonId);
    const refusal = flow.togglePokemon(pokemonId);
    if (refusal) {
      audioManager.play('denied');
      this.status = refusal;
      this.render([`[data-member="${pokemonId}"]`]);
      return;
    }
    const team = flow.party.map((stored) => stored.id);
    if (!this.saveManager.chooseBench(team)) {
      // Not written: put the team back as it was, so the panel never shows a team the save does not hold.
      flow.togglePokemon(pokemonId);
      audioManager.play('denied');
      this.status = 'The team could not be saved.';
      this.render([`[data-member="${pokemonId}"]`]);
      return;
    }
    this.game_ = this.saveManager.load() ?? game;
    audioManager.play(wasIn ? 'cancel' : 'select');
    recordAction(`${wasIn ? 'Left out' : 'Took'} ${entry.pokemon.name}`);
    this.status = teamRowHelp(entry, !wasIn, false, team.length);
    this.render([`[data-member="${pokemonId}"]`]);
  }

  private close(): void {
    audioManager.play('menuClose');
    const resumeBase = this.pausedBase && this.scene.isPaused('base');
    this.pausedBase = false;
    this.scene.stop();
    if (resumeBase) {
      this.scene.resume('base');
    }
  }
}
