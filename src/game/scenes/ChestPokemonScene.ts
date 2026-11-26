import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { flowForGame } from '../base/arenaKit';
import { gardenPokemon, toggleGarden } from '../base/homeGarden';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { DeploymentFlow } from '../hub/deploymentFlow';
import { awayOnRaid, outOnRaidLine } from '../run/raidInFlight';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { pickerEntries } from '../ui/boxPicker';
import { CHEST_POKEMON_KEYS, chestPokemonBody, chestTabs, type ChestPokemonState } from '../ui/chestPokemonView';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { pixelScreen } from '../ui/pixelUi';
import type { SidePanelView } from '../ui/sidePanel';
import { LAST_ONE_STAYS, leadLine, teamRowHelp } from '../ui/teamView';

export interface ChestPokemonSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
  /** The hall's own choices, while the player is in THE RAID ARENA: the team is the bench's. */
  readonly flow?: DeploymentFlow;
  /** The harbour beside the panel, told what the panel covers. */
  readonly view?: SidePanelView;
  /** Opened at THE CHEST rather than from B: the screen is headed with it. */
  readonly chest?: boolean;
  /** Asked as the screen closes for the chest's THINGS tab: B, or a click on the tab. */
  readonly openThings?: () => void;
}

/** How far a pointer must move with a Pokémon held before it is carried rather than clicked. */
const DRAG_START_PX = 6;

/** A Pokémon being carried by the pointer: which, from where, and the picture following it. */
interface Carried {
  readonly id: string;
  /** Where it was picked up: the grid, or one of the two places. */
  readonly from: 'chest' | 'team' | 'garden';
  readonly x: number;
  readonly y: number;
  ghost: HTMLElement | null;
}

/**
 * THE CHEST's POKéMON tab (`ui/chestPokemonView.ts` says what and why): every
 * Pokémon kept, in one grid, with THE NEXT RAID's six and the GARDEN's six
 * beside it, over the paused harbour.
 *
 * It writes two things, each through a `SaveManager` method that reads the
 * save first, so a second tab is never written back over: the next raid's team
 * (`chooseBench`, the list THE RAID ARENA's bench opens on) and who walks about
 * the garden (`chooseGarden`).
 */
export class ChestPokemonScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private hallFlow: DeploymentFlow | undefined;
  private view: SidePanelView | undefined;
  private game_: RestoredGame | undefined;
  private flow: DeploymentFlow | undefined;
  private status: string | undefined;
  private title = 'Your things';
  private toThings: (() => void) | undefined;
  private carried: Carried | null = null;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('chest-pokemon');
  }

  public init(data: ChestPokemonSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.hallFlow = data.flow;
    this.view = data.view;
    this.title = data.chest ? 'The chest' : 'Your things';
    this.toThings = data.openThings;
    this.status = undefined;
    this.carried = null;
    this.reload();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dropCarried();
      this.overlay?.destroy();
      this.overlay = undefined;
      this.view?.covers(0);
    });
    recordAction('Opened the chest: Pokémon');
  }

  public create(): void {
    this.overlay = new MenuOverlay(this, 'things-menu chest-pokemon-menu pixel-ui', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', `${this.title}: Pokémon`);
    this.overlay.root.addEventListener('pointerdown', (event) => this.pointerDown(event));
    this.overlay.root.addEventListener('pointermove', (event) => this.pointerMove(event));
    this.overlay.root.addEventListener('pointerup', (event) => this.pointerUp(event));
    this.overlay.root.addEventListener('pointercancel', () => this.dropCarried());
    this.render();
  }

  public update(_time: number, deltaMs: number): void {
    this.view?.frame(deltaMs);
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: `${this.title}: Pokémon` },
      { label: 'Team', value: (this.flow?.party ?? []).map((stored) => stored.pokemon.name).join(', ') || 'nobody' },
    ];
  }

  /** For a playtest driver: who is going, and who is in the garden, by stash id. */
  public get teamIds(): readonly string[] {
    return (this.flow?.party ?? []).map((stored) => stored.id);
  }

  public get gardenIds(): readonly string[] {
    return this.game_ ? gardenPokemon(this.game_).map((stored) => stored.id) : [];
  }

  /** The save read again, and the team the hall or the bench would stand. */
  private reload(): void {
    this.game_ = this.saveManager.load() ?? this.game_;
    if (this.hallFlow && this.game_) {
      this.hallFlow.rebase(this.game_.stash);
    }
    this.flow = this.hallFlow ?? (this.game_ ? flowForGame(this.game_) : undefined);
    // Nobody on the bench is somebody on it, as the hall has it on the way in.
    this.flow?.packSomebodyIfBenchEmpty();
  }

  private state(): ChestPokemonState | undefined {
    const game = this.game_;
    const flow = this.flow;
    if (!game || !flow) {
      return undefined;
    }
    const partnerId = game.stash.partner()?.id;
    return {
      entries: pickerEntries(game.stash),
      team: flow.party.map((stored) => stored.id),
      garden: gardenPokemon(game).map((stored) => stored.id),
      away: awayOnRaid(game),
      ...(partnerId ? { partnerId } : {}),
    };
  }

  private render(prefer: readonly string[] = []): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    const status = this.status;
    this.status = undefined;
    const state = this.state();
    overlay.redraw(
      pixelScreen({
        title: this.title,
        tabs: chestTabs('pokemon'),
        close: { attribute: 'data-close' },
        body: state ? chestPokemonBody(state) : '<main class="px-body"><p class="px-empty">There is no saved game.</p></main>',
        hints: CHEST_POKEMON_KEYS,
        ...(status ? { status } : {}),
      }),
    );
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.close();
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-chest-tab="things"]').forEach((button) => {
      button.onclick = () => this.goToThings();
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-mon-key]').forEach((button) => {
      button.onclick = () => this.act(button.dataset.key, button.dataset.monKey!);
    });
    overlay.refocus(...prefer, '.chest-mons [data-cursor-start]', '[data-close]');
  }

  /** The Pokémon under the keyboard's cursor, if it is on one. */
  private underCursor(): string | undefined {
    return (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-mon]')?.dataset.mon;
  }

  private onKey(event: KeyboardEvent): void {
    if (event.repeat && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      return;
    }
    if (isOverlayDismissKey(event, 'p', 'Backspace')) {
      event.preventDefault();
      if (this.carried) {
        this.dropCarried();
        return;
      }
      this.close();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'b' && !event.repeat) {
      event.preventDefault();
      this.goToThings();
      return;
    }
    const under = this.underCursor();
    if (under && !event.repeat && (event.key === 'Enter' || event.key === ' ' || key === 'g' || key === 'l')) {
      event.preventDefault();
      this.act(event.key === 'Enter' || event.key === ' ' ? 'team' : key === 'g' ? 'garden' : 'lead', under);
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /** One job done to one Pokémon, however it was asked for. */
  private act(job: string | undefined, id: string): void {
    if (job === 'team') this.toggleTeam(id);
    else if (job === 'garden') this.toggleGardenFor(id);
    else if (job === 'lead') this.lead(id);
  }

  /** Where the screen puts the cursor back after a press: on the Pokémon that was pressed, in the grid. */
  private on(id: string): string {
    return `.chest-mons [data-mon="${CSS.escape(id)}"]`;
  }

  private refuse(message: string, id: string): void {
    audioManager.play('denied');
    this.status = message;
    this.render([this.on(id)]);
  }

  private nameOf(id: string): string {
    return this.game_?.stash.listPokemon().find((stored) => stored.id === id)?.pokemon.name ?? 'That Pokémon';
  }

  /** In or out of the next raid's team, written as the bench. */
  private toggleTeam(id: string, want?: boolean): void {
    const game = this.game_;
    const flow = this.flow;
    if (!game || !flow) {
      return;
    }
    if (awayOnRaid(game).has(id)) {
      this.refuse(outOnRaidLine(this.nameOf(id)), id);
      return;
    }
    const entry = pickerEntries(game.stash).find((one) => one.id === id);
    if (!entry) {
      return;
    }
    const wasIn = flow.includesPokemon(id);
    if (want !== undefined && want === wasIn) {
      this.render([this.on(id)]);
      return;
    }
    const refusal = wasIn && flow.party.length === 1 ? LAST_ONE_STAYS : flow.togglePokemon(id);
    if (refusal) {
      this.refuse(refusal, id);
      return;
    }
    const team = flow.party.map((stored) => stored.id);
    if (!this.saveManager.chooseBench(team)) {
      flow.togglePokemon(id);
      this.refuse('The team could not be saved.', id);
      return;
    }
    this.reload();
    audioManager.play(wasIn ? 'cancel' : 'select');
    recordAction(`${wasIn ? 'Left out' : 'Took'} ${entry.pokemon.name}`);
    this.status = teamRowHelp(entry, !wasIn, false, team.length).replace(/ ENTER.*$/, '');
    this.render([this.on(id)]);
  }

  /** Out to the garden or back into the chest, written over the save as it stands. */
  private toggleGardenFor(id: string, want?: boolean): void {
    const game = this.saveManager.load() ?? this.game_;
    if (!game) {
      return;
    }
    const out = gardenPokemon(game).some((stored) => stored.id === id);
    if (want !== undefined && want === out) {
      this.render([this.on(id)]);
      return;
    }
    // Off the team first, when it is sent out from it: a Pokémon is in one place.
    if (!out && (game.raidProgress.lastBench ?? []).includes(id) && this.flow?.includesPokemon(id)) {
      this.toggleTeam(id, false);
      if (this.flow.includesPokemon(id)) {
        return;
      }
    }
    const answer = toggleGarden(this.saveManager.load() ?? game, id);
    if ('refused' in answer) {
      this.refuse(answer.refused, id);
      return;
    }
    if (!this.saveManager.chooseGarden(answer.garden)) {
      this.refuse('The garden could not be saved.', id);
      return;
    }
    this.reload();
    audioManager.play(answer.out ? 'select' : 'cancel');
    const name = this.nameOf(id);
    recordAction(answer.out ? `Put ${name} out in the garden` : `Brought ${name} in`);
    this.status = answer.out ? `${name} is out in the garden.` : `${name} is back in the chest.`;
    this.render([this.on(id)]);
  }

  /** In front of the next raid's team. */
  private lead(id: string): void {
    const flow = this.flow;
    if (!flow || !flow.includesPokemon(id) || flow.party[0]?.id === id) {
      return;
    }
    const before = flow.party.map((stored) => stored.id);
    const refusal = flow.leadWith(id);
    if (refusal) {
      this.refuse(refusal, id);
      return;
    }
    if (!this.saveManager.chooseBench(flow.party.map((stored) => stored.id))) {
      flow.leadWith(before[0]);
      this.refuse('The team could not be saved.', id);
      return;
    }
    this.reload();
    audioManager.play('select');
    this.status = leadLine(this.nameOf(id));
    this.render([this.on(id)]);
  }

  // --- carrying a Pokémon with the pointer ------------------------------------

  private pointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const piece = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-mon]');
    if (!piece || piece.matches('[data-mon-key]')) {
      return;
    }
    const from = (piece.dataset.place as 'team' | 'garden' | undefined) ?? 'chest';
    this.carried = { id: piece.dataset.mon!, from, x: event.clientX, y: event.clientY, ghost: null };
  }

  private pointerMove(event: PointerEvent): void {
    const carried = this.carried;
    if (!carried) {
      return;
    }
    if (!carried.ghost) {
      if (Math.hypot(event.clientX - carried.x, event.clientY - carried.y) < DRAG_START_PX) {
        return;
      }
      const picture = this.overlay?.root.querySelector<HTMLImageElement>(`.chest-mons [data-mon="${CSS.escape(carried.id)}"] img`);
      const ghost = document.createElement('div');
      ghost.className = 'chest-ghost';
      if (picture) {
        ghost.appendChild(picture.cloneNode(true));
      }
      this.overlay?.root.appendChild(ghost);
      carried.ghost = ghost;
      this.overlay?.root.classList.add('is-carrying');
    }
    carried.ghost.style.left = `${event.clientX}px`;
    carried.ghost.style.top = `${event.clientY}px`;
    this.markDrop(this.dropAt(event.clientX, event.clientY));
  }

  private pointerUp(event: PointerEvent): void {
    const carried = this.carried;
    if (!carried) {
      return;
    }
    const dragged = carried.ghost !== null;
    const drop = dragged ? this.dropAt(event.clientX, event.clientY) : undefined;
    this.dropCarried();
    if (!dragged) {
      // A click: the Pokémon is chosen, and its card is shown.
      this.overlay?.refocus(this.on(carried.id));
      return;
    }
    if (!drop || drop === carried.from) {
      return;
    }
    if (drop === 'team') {
      this.toggleTeam(carried.id, true);
    } else if (drop === 'garden') {
      this.toggleGardenFor(carried.id, true);
    } else if (carried.from === 'team') {
      this.toggleTeam(carried.id, false);
    } else if (carried.from === 'garden') {
      this.toggleGardenFor(carried.id, false);
    }
  }

  /** Which place the pointer is over: THE NEXT RAID, the GARDEN, or back in the chest's grid. */
  private dropAt(x: number, y: number): 'chest' | 'team' | 'garden' | undefined {
    const zone = document.elementsFromPoint(x, y).map((node) => (node as HTMLElement).closest?.<HTMLElement>('[data-drop]')).find(Boolean);
    const place = zone?.dataset.drop;
    return place === 'team' || place === 'garden' || place === 'chest' ? place : undefined;
  }

  private markDrop(place: string | undefined): void {
    this.overlay?.root.querySelectorAll<HTMLElement>('[data-drop]').forEach((zone) => {
      zone.classList.toggle('is-drop', zone.dataset.drop === place && place !== this.carried?.from);
    });
  }

  private dropCarried(): void {
    this.carried?.ghost?.remove();
    this.carried = null;
    this.overlay?.root.classList.remove('is-carrying');
    this.markDrop(undefined);
  }

  private goToThings(): void {
    const toThings = this.toThings;
    if (!toThings) {
      return;
    }
    toThings();
    this.close();
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
