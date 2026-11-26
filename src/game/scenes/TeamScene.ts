import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { flowForGame } from '../base/arenaKit';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { DeploymentFlow } from '../hub/deploymentFlow';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { pixelScreen } from '../ui/pixelUi';
import type { SidePanelView } from '../ui/sidePanel';
import { pickerEntries, wirePickerFind } from '../ui/boxPicker';
import { LAST_ONE_STAYS, leadLine, TEAM_HINTS, TEAM_HINTS_NO_LEAD, teamBody, teamPill, teamRowHelp } from '../ui/teamView';

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
    // The whole screen, over the paused harbour: the team stands on the
    // battle field's grass, big, as it does in a fight (the round-3 look).
    this.overlay = new MenuOverlay(this, 'team-menu pixel-ui', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', 'Your team');
    // The help line names L only where L would put somebody in front.
    this.overlay.root.addEventListener('focusin', () => this.teachLeadWhereItWorks());
    this.render();
  }

  /** `TEAM_HINTS` with L, or without it on the lead already and off any Pokémon (`TEAM_HINTS_NO_LEAD`). */
  private teachLeadWhereItWorks(): void {
    const line = this.overlay?.root.querySelector<HTMLElement>('[data-help-default]');
    if (!line) {
      return;
    }
    const under = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-member]')?.dataset.member;
    const leads = under !== undefined && this.flow?.party[0]?.id !== under;
    line.dataset.helpDefault = leads ? TEAM_HINTS : TEAM_HINTS_NO_LEAD;
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
        ...(game && flow
          ? { aside: teamPill({ entries: pickerEntries(game.stash), team: flow.party.map((stored) => stored.id), partnerId: game.stash.partner()?.id }) }
          : {}),
        close: { attribute: 'data-close' },
        body,
        hints: TEAM_HINTS,
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
    overlay.refocus(...prefer, '[data-cursor-start]:not([hidden])', '[data-member]:not([hidden])', '[data-close]');
  }

  private onKey(event: KeyboardEvent): void {
    // The P that opened it, still held, repeats: it must not close it again.
    if (event.repeat && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      return;
    }
    if (isOverlayDismissKey(event, 'p')) {
      event.preventDefault();
      this.close();
      return;
    }
    // L puts the one under the cursor in front - never while a name is being typed into FIND.
    const typing = event.target instanceof HTMLInputElement;
    const under = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-member]')?.dataset.member;
    if (!typing && !event.repeat && event.key.toLowerCase() === 'l' && under) {
      event.preventDefault();
      this.lead(under);
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /** L on a slot: that one leads, written as the next raid's bench in its new order. */
  private lead(pokemonId: string): void {
    const game = this.game_;
    const flow = this.flow;
    if (!game || !flow) {
      return;
    }
    const before = flow.party.map((stored) => stored.id);
    const entry = pickerEntries(game.stash).find((one) => one.id === pokemonId);
    if (!entry || before[0] === pokemonId) {
      return;
    }
    const refusal = flow.leadWith(pokemonId);
    if (refusal) {
      audioManager.play('denied');
      this.status = refusal;
      this.render([`[data-member="${pokemonId}"]`]);
      return;
    }
    if (!this.saveManager.chooseBench(flow.party.map((stored) => stored.id))) {
      // Not written: the old lead goes back in front, so the panel never shows a lead the save does not hold.
      flow.leadWith(before[0]);
      audioManager.play('denied');
      this.status = 'The team could not be saved.';
      this.render([`[data-member="${pokemonId}"]`]);
      return;
    }
    this.game_ = this.saveManager.load() ?? game;
    audioManager.play('select');
    recordAction(`Put ${entry.pokemon.name} in front`);
    this.status = leadLine(entry.pokemon.name);
    this.render([`[data-member="${pokemonId}"]`]);
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
    const refusal = wasIn && flow.party.length === 1 ? LAST_ONE_STAYS : flow.togglePokemon(pokemonId);
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
