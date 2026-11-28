import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { flowForGame } from '../base/arenaKit';
import { gardenPokemon, toggleGarden } from '../base/homeGarden';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { DeploymentFlow } from '../hub/deploymentFlow';
import { getItemById, machineForItem, teachFromMachine, useFieldItem, type ItemDefinition } from '../items';
import type { MoveBase } from '../pokemon';
import { awayOnRaid, outOnRaidLine, PACKED_FOR_RAID_LINE } from '../run/raidInFlight';
import { SaveManager, spareAtBase, type RestoredGame } from '../save/SaveManager';
import { pickerEntries } from '../ui/boxPicker';
import {
  CHEST_POKEMON_KEYS,
  chestAsk,
  chestGifts,
  chestKept,
  chestPokemonBody,
  chestTabs,
  giftAnswer,
  giftKind,
  type ChestPokemonState,
} from '../ui/chestPokemonView';
import { EVOLVE_MOMENT_ARMING_MS, evolveMomentBody, type EvolveMomentView } from '../ui/evolveMoment';
import { moveChoiceMessage } from '../ui/moveChooser';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { pupilVerdict } from '../ui/teachScreen';
import { fromMouse } from '../ui/gridArranging';
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
  /** Asked as the screen closes to swap the only Pokémon for another starter: C, or its card's key. */
  readonly openSwap?: () => void;
}

/** Where a carried thing can be let go: a place, the grid, or TO GIVE. */
type DropPlace = 'chest' | 'team' | 'garden' | 'gifts';

/** How far a pointer must move with a Pokémon held before it is carried rather than clicked. */
const DRAG_START_PX = 6;

/**
 * Something being carried by the pointer, and the picture following it: a
 * Pokémon (by stash id, from the grid or one of the two places), a thing to
 * give (by item id, from TO GIVE), or what a Pokémon holds (by its stash id,
 * off its card).
 */
interface Carried {
  readonly kind: 'mon' | 'gift' | 'held';
  readonly id: string;
  /** Where it was picked up: the grid, or one of the two places. */
  readonly from: 'chest' | 'team' | 'garden' | 'gifts' | 'held';
  readonly x: number;
  readonly y: number;
  /** Picked up by a mouse, which only drags: let go without moving, it is nothing. */
  readonly mouse: boolean;
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
  private toSwap: (() => void) | undefined;
  private carried: Carried | null = null;
  /** The Pokémon whose card is on show. */
  private shown: string | undefined;
  /** A thing chosen to give with a click or ENTER, waiting for a Pokémon to be chosen. */
  private armed: string | null = null;
  /** The question on screen: give this to that Pokémon? Asked of a mouse's drag, the answer leaves the cursor where it was. */
  private asking: { readonly itemId: string; readonly pokemonId: string; readonly byMouse: boolean } | null = null;
  /**
   * The deed being drawn was a mouse's drag, so the redraw leaves the cursor
   * where it was rather than on the Pokémon moved: a drag let go leaves
   * nothing chosen (the captain, 28 Nov 2026).
   */
  private mouseDeed = false;
  /** A stone has just evolved one: the moment is the screen until it has been seen. */
  private moment: (EvolveMomentView & { readonly openedAt: number; readonly pokemonId: string }) | undefined;
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
    this.toSwap = data.openSwap;
    this.status = undefined;
    this.carried = null;
    this.shown = undefined;
    this.armed = null;
    this.asking = null;
    this.mouseDeed = false;
    this.moment = undefined;
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
    this.overlay = new MenuOverlay(this, 'things-menu chest-pokemon-menu pixel-ui wood-floor', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', `${this.title}: Pokémon`);
    this.overlay.root.addEventListener('pointerdown', (event) => this.pointerDown(event));
    this.overlay.root.addEventListener('pointermove', (event) => this.pointerMove(event));
    this.overlay.root.addEventListener('pointerup', (event) => this.pointerUp(event));
    this.overlay.root.addEventListener('pointercancel', () => this.dropCarried());
    // A mouse looks by hovering: the card is the Pokémon it rests on, and the
    // cursor's again once it moves off.
    this.overlay.onPointed = (control) => this.answerPointed(control);
    // The card stays on the last Pokémon looked at while the cursor is elsewhere -
    // on TO GIVE, a key or the question - so its place is never a hole.
    this.overlay.root.addEventListener('focusin', (event) => {
      const shows = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-shows]')?.dataset.shows;
      if (shows) {
        this.shown = shows;
      }
    });
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
    const items = Object.keys(game.stash.listItems()).flatMap((id) => getItemById(id) ?? []);
    const only = game.stash.canSwapStarter() ? game.stash.listPokemon()[0]?.id : undefined;
    return {
      ...(only && this.toSwap ? { swappable: only } : {}),
      gifts: chestGifts(items, (id) => spareAtBase(game, id)),
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
    if (this.moment) {
      overlay.redraw(
        pixelScreen({
          title: this.title,
          body: evolveMomentBody(this.moment, 'Back to the chest.'),
          hints: 'Any key · back to the chest',
        }),
      );
      overlay.root.querySelector<HTMLButtonElement>('[data-moment-done]')?.addEventListener('click', () => this.endMoment());
      overlay.refocus('[data-moment-done]');
      return;
    }
    const status = this.status;
    this.status = undefined;
    const state = this.state();
    overlay.redraw(
      pixelScreen({
        title: this.title,
        tabs: chestTabs('pokemon'),
        ...(state ? { aside: chestKept(state.entries.length) } : {}),
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
      // To a mouse a card's keys are the keys they name: a Pokémon is moved by
      // dragging it, never by a click. C goes to another screen, so it opens.
      button.onclick = (event) => {
        if (fromMouse(event) && button.dataset.key !== 'swap') {
          return;
        }
        this.act(button.dataset.key, button.dataset.monKey!);
      };
    });
    if (this.armed) {
      overlay.root.querySelector(`[data-gift="${CSS.escape(this.armed)}"]`)?.classList.add('is-armed');
    }
    const asking = this.asking;
    const game = this.game_;
    const item = asking ? getItemById(asking.itemId) : undefined;
    const pokemon = asking ? game?.stash.listPokemon().find((stored) => stored.id === asking.pokemonId)?.pokemon : undefined;
    const answer = item && pokemon ? giftAnswer(item, pokemon, false) : undefined;
    if (asking && item && pokemon && answer?.ok) {
      overlay.root.querySelector('.px-body')?.insertAdjacentHTML('beforeend', chestAsk(item, pokemon, answer.question));
      overlay.root.querySelector<HTMLButtonElement>('[data-ask-yes]')!.onclick = () => this.answer(true);
      overlay.root.querySelector<HTMLButtonElement>('[data-ask-no]')!.onclick = () => this.answer(false);
      overlay.focus('[data-ask-yes]');
      this.shown = asking.pokemonId;
      overlay.root.querySelectorAll<HTMLElement>('.chest-card').forEach((card) => {
        card.hidden = card.dataset.shownBy !== asking.pokemonId;
      });
      return;
    }
    this.asking = null;
    // A press names where the cursor goes next (the Pokémon it was done to);
    // a plain redraw, or a mouse's drag, puts it back where it was.
    const byMouse = this.mouseDeed;
    this.mouseDeed = false;
    if (prefer.length > 0 && !byMouse) {
      overlay.focus(...prefer, '.chest-mons [data-cursor-start]', '[data-close]');
    } else {
      overlay.refocus('.chest-mons [data-cursor-start]', '[data-close]');
    }
    // After the cursor is placed, which is the next frame.
    requestAnimationFrame(() => requestAnimationFrame(() => this.keepACardShown()));
  }

  /** The card for the Pokémon the mouse rests on, or for the cursor's once it has moved off. */
  private answerPointed(control: HTMLElement | null): void {
    const root = this.overlay?.root;
    if (!root || this.asking || this.moment || control?.closest('[data-shown-by]')) {
      return;
    }
    const cursor = this.underCursor() ?? (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-shows]')?.dataset.shows;
    const id = control?.closest<HTMLElement>('[data-shows]')?.dataset.shows ?? cursor ?? this.shown;
    if (!id || !root.querySelector(`.chest-card[data-shown-by="${CSS.escape(id)}"]`)) {
      return;
    }
    root.querySelectorAll<HTMLElement>('.chest-card').forEach((card) => {
      card.hidden = card.dataset.shownBy !== id;
    });
  }

  /** Shows the card of the Pokémon last looked at when the cursor's own control shows none. */
  private keepACardShown(): void {
    const root = this.overlay?.root;
    if (!root || root.querySelector('.chest-card:not([hidden])')) {
      return;
    }
    const card =
      (this.shown ? root.querySelector<HTMLElement>(`.chest-card[data-shown-by="${CSS.escape(this.shown)}"]`) : null) ??
      root.querySelector<HTMLElement>('.chest-card');
    if (card) {
      card.hidden = false;
    }
  }

  /** The Pokémon under the keyboard's cursor, if it is on one. */
  private underCursor(): string | undefined {
    return (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-mon]')?.dataset.mon;
  }

  private onKey(event: KeyboardEvent): void {
    // Any key ends the evolution moment once it has been seen.
    if (this.moment) {
      event.preventDefault();
      if (!event.repeat && this.time.now - this.moment.openedAt >= EVOLVE_MOMENT_ARMING_MS) {
        this.endMoment();
      }
      return;
    }
    if (this.asking) {
      const pressed = event.key.toLowerCase();
      if (!event.repeat && (pressed === 'escape' || pressed === 'backspace' || pressed === 'n')) {
        event.preventDefault();
        this.answer(false);
      } else if (!event.repeat && pressed === 'y') {
        event.preventDefault();
        this.answer(true);
      } else if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
        // ENTER is YES, FireRed's lit answer, unless the cursor was moved to NO.
        event.preventDefault();
        this.answer(!(document.activeElement as HTMLElement | null)?.closest('[data-ask-no]'));
      } else if (this.overlay?.moveCursor(event.key)) {
        event.preventDefault();
      }
      return;
    }
    if (this.armed && isOverlayDismissKey(event, 'Backspace')) {
      event.preventDefault();
      this.disarm();
      return;
    }
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
    const gift = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-gift]')?.dataset.gift;
    if (gift && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.arm(gift);
      return;
    }
    const under = this.underCursor();
    if (under && this.armed && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.offer(this.armed, under);
      return;
    }
    if (under && !event.repeat && (event.key === 'Enter' || event.key === ' ' || key === 'g' || key === 'l' || key === 't' || key === 'c')) {
      event.preventDefault();
      // C, not S: W, A, S and D are the arrows on every overlay.
      const jobs: Record<string, string> = { g: 'garden', l: 'lead', t: 'take', c: 'swap' };
      this.act(event.key === 'Enter' || event.key === ' ' ? 'team' : jobs[key], under);
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
    else if (job === 'take') this.takeBack(id);
    else if (job === 'swap') this.goToSwap(id);
  }

  /** The partner swap, on its own screen: only while this is the one Pokémon at base. */
  private goToSwap(id: string): void {
    const toSwap = this.toSwap;
    if (!toSwap || this.state()?.swappable !== id) {
      return;
    }
    toSwap();
    this.close();
  }

  // --- giving things to a Pokémon ---------------------------------------------

  /** A thing chosen with a click or ENTER: the next Pokémon chosen is asked about. */
  private arm(itemId: string): void {
    const item = getItemById(itemId);
    if (!item) {
      return;
    }
    this.armed = itemId;
    audioManager.play('select');
    // FireRed's own question, as its bag asks it.
    this.status = `${item.displayName.toUpperCase()}: to which POKéMON?`;
    this.render([`[data-gift="${CSS.escape(itemId)}"]`]);
  }

  private disarm(): void {
    const itemId = this.armed;
    this.armed = null;
    audioManager.play('cancel');
    this.render(itemId ? [`[data-gift="${CSS.escape(itemId)}"]`] : []);
  }

  /** A thing let go over a Pokémon, or chosen for one: the question, or why not. */
  private offer(itemId: string, pokemonId: string): void {
    this.armed = null;
    const item = getItemById(itemId);
    const pokemon = this.game_?.stash.listPokemon().find((stored) => stored.id === pokemonId)?.pokemon;
    if (!item || !pokemon) {
      return;
    }
    const answer = giftAnswer(item, pokemon, awayOnRaid(this.game_!).has(pokemonId));
    if (!answer.ok) {
      this.refuse(answer.why, pokemonId);
      return;
    }
    audioManager.play('select');
    this.asking = { itemId, pokemonId, byMouse: this.mouseDeed };
    this.mouseDeed = false;
    this.render();
  }

  private answer(yes: boolean): void {
    const asking = this.asking;
    this.asking = null;
    if (!asking) {
      return;
    }
    this.mouseDeed = asking.byMouse;
    if (!yes) {
      audioManager.play('cancel');
      this.render([this.on(asking.pokemonId)]);
      return;
    }
    const item = getItemById(asking.itemId);
    if (!item) {
      return;
    }
    const kind = giftKind(item);
    if (kind === 'hold') this.giveToHold(item, asking.pokemonId);
    else if (kind === 'stone') this.useStone(item, asking.pokemonId);
    else if (kind === 'disc') this.teach(item, asking.pokemonId);
  }

  private giveToHold(item: ItemDefinition, id: string): void {
    const name = this.nameOf(id);
    if (!this.saveManager.giveHeldAtHome(id, item.id)) {
      this.refuse(this.heldByRaid(item.id, id) ?? `${name} could not be given the ${item.displayName}.`, id);
      return;
    }
    this.reload();
    audioManager.play('select');
    recordAction(`Gave ${name} the ${item.displayName}`);
    this.status = `${name.toUpperCase()} is holding the ${item.displayName.toUpperCase()}.`;
    this.render([this.on(id)]);
    this.landOn(id);
  }

  private takeBack(id: string): void {
    const held = this.game_?.stash.listPokemon().find((stored) => stored.id === id)?.pokemon.heldItemId;
    const item = held ? getItemById(held) : undefined;
    if (!item) {
      return;
    }
    if (!this.saveManager.takeHeldAtHome(id)) {
      this.refuse(this.heldByRaid(item.id, id) ?? 'There is nothing to take.', id);
      return;
    }
    this.reload();
    audioManager.play('cancel');
    recordAction(`Took the ${item.displayName} back off ${this.nameOf(id)}`);
    this.status = `The ${item.displayName.toUpperCase()} is back in the chest.`;
    this.render([this.on(id)]);
  }

  /** A stone on one of the player's Pokémon: it evolves, with the moment, or nothing is spent. */
  private useStone(item: ItemDefinition, id: string): void {
    let message = '';
    let before: { readonly dexId: number; readonly name: string } | undefined;
    let after: { readonly dexId: number; readonly name: string; readonly shiny: boolean } | undefined;
    const written = this.saveManager.useAtHome(item.id, id, (stored) => {
      before = { dexId: stored.base.dexId, name: stored.base.name };
      const result = useFieldItem(item, stored);
      message = result.message;
      after = { dexId: stored.base.dexId, name: stored.base.name, shiny: stored.shiny };
      return { changed: result.used, spent: result.used };
    });
    if (!written || !before || !after) {
      this.refuse(this.heldByRaid(item.id, id) ?? (message || "It won't have any effect."), id);
      return;
    }
    audioManager.play('evolved');
    const dexId = after.dexId;
    void audioManager.loadCries([dexId]).then(() => audioManager.play('cry', { species: dexId }));
    recordAction(`Used ${item.displayName} at home`);
    this.reload();
    this.moment = {
      fromDexId: before.dexId,
      fromName: before.name,
      toDexId: after.dexId,
      toName: after.name,
      shiny: after.shiny,
      said: message,
      openedAt: this.time.now,
      pokemonId: id,
    };
    this.render();
  }

  private endMoment(): void {
    const moment = this.moment;
    this.moment = undefined;
    if (!moment) {
      return;
    }
    this.status = moment.said;
    this.render([this.on(moment.pokemonId)]);
  }

  /** A disc read to one of the player's Pokémon: learned there, or a move forgotten for it on the move chooser. */
  private teach(item: ItemDefinition, id: string): void {
    const machine = machineForItem(item);
    const pokemon = this.game_?.stash.listPokemon().find((stored) => stored.id === id)?.pokemon;
    if (!machine || !pokemon) {
      return;
    }
    const settle = (learned: boolean, message: string): void => {
      audioManager.play(learned ? 'heal' : 'denied');
      if (learned) {
        recordAction(`Read ${item.displayName} at home`);
      }
      this.reload();
      this.status = message;
      this.render([this.on(id)]);
      if (learned) {
        this.landOn(id);
      }
    };
    if (pupilVerdict(machine, pokemon) !== 'replaces') {
      let message = '';
      const written = this.saveManager.useAtHome(item.id, id, (stored) => {
        const outcome = teachFromMachine(item, stored);
        message = outcome.kind === 'choose' ? '' : outcome.message;
        return { changed: outcome.kind === 'learned', spent: outcome.kind === 'learned' && outcome.machineIsSpent };
      });
      settle(written !== undefined, message || this.heldByRaid(item.id, id) || `${pokemon.name.toUpperCase()} could not learn it.`);
      return;
    }
    // The question is answered: it goes before the chooser comes up beside the
    // chest, or its plate stood on under the chooser's edge, cut through YES and NO.
    this.render([this.on(id)]);
    const move = machine.move;
    openMoveChooser(
      this,
      {
        pokemon,
        incoming: move,
        canDefer: false,
        source: `${machine.number} ${move.name}`,
        spendsSource: !machine.reusable,
        beside: true,
      },
      (choice) => {
        if (choice.kind !== 'forget') {
          settle(false, moveChoiceMessage(pokemon.name, move, null));
          return;
        }
        let forgotten: MoveBase | null = null;
        const written = this.saveManager.useAtHome(item.id, id, (stored) => {
          const outcome = teachFromMachine(item, stored);
          if (outcome.kind !== 'choose') {
            return { changed: false, spent: false };
          }
          forgotten = stored.resolvePendingMove(outcome.move, choice.index)?.forgotten ?? null;
          return { changed: forgotten !== null, spent: forgotten !== null && !machine.reusable };
        });
        settle(written !== undefined, moveChoiceMessage(pokemon.name, move, written ? forgotten : null));
      },
    );
  }

  /** Why a thing cannot be used on a Pokémon a raid in another window holds, or undefined. */
  private heldByRaid(itemId: string, id: string): string | undefined {
    const game = this.saveManager.load() ?? this.game_;
    if (!game) {
      return undefined;
    }
    if (awayOnRaid(game).has(id)) {
      return outOnRaidLine(this.nameOf(id));
    }
    return game.stash.itemCount(itemId) > 0 && spareAtBase(game, itemId) < 1 ? PACKED_FOR_RAID_LINE : undefined;
  }

  /** The Pokémon that was just given something bounces where it stands. */
  private landOn(id: string): void {
    const tile = this.overlay?.root.querySelector<HTMLElement>(this.on(id));
    tile?.classList.remove('is-given');
    void tile?.offsetWidth;
    tile?.classList.add('is-given');
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
    if (this.asking || this.moment) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const mouse = fromMouse(event);
    // A mouse's press takes neither the cursor nor the browser's own picture
    // drag: only moving it carries anything.
    if (mouse && target?.closest('[data-gift], [data-held], [data-mon]')) {
      event.preventDefault();
    }
    const at = { x: event.clientX, y: event.clientY, mouse, ghost: null };
    const gift = target?.closest<HTMLElement>('[data-gift]');
    if (gift) {
      this.carried = { kind: 'gift', id: gift.dataset.gift!, from: 'gifts', ...at };
      return;
    }
    const held = target?.closest<HTMLElement>('[data-held]');
    if (held) {
      this.carried = { kind: 'held', id: held.dataset.held!, from: 'held', ...at };
      return;
    }
    const piece = target?.closest<HTMLElement>('[data-mon]');
    if (!piece || piece.matches('[data-mon-key]')) {
      return;
    }
    const from = (piece.dataset.place as 'team' | 'garden' | undefined) ?? 'chest';
    this.carried = { kind: 'mon', id: piece.dataset.mon!, from, ...at };
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
      const picture =
        carried.kind === 'gift'
          ? this.overlay?.root.querySelector<HTMLImageElement>(`[data-gift="${CSS.escape(carried.id)}"] img`)
          : carried.kind === 'held'
            ? this.overlay?.root.querySelector<HTMLImageElement>(`[data-held="${CSS.escape(carried.id)}"] img`)
            : this.overlay?.root.querySelector<HTMLImageElement>(`.chest-mons [data-mon="${CSS.escape(carried.id)}"] img`);
      const ghost = document.createElement('div');
      ghost.className = carried.kind === 'mon' ? 'chest-ghost' : 'chest-ghost is-thing';
      if (picture) {
        ghost.appendChild(picture.cloneNode(true));
      }
      this.overlay?.root.appendChild(ghost);
      carried.ghost = ghost;
      this.overlay?.root.classList.add('is-carrying');
    }
    carried.ghost.style.left = `${event.clientX}px`;
    carried.ghost.style.top = `${event.clientY}px`;
    if (carried.kind === 'gift') {
      this.markGiftOver(this.monAt(event.clientX, event.clientY));
      return;
    }
    this.markDrop(this.dropAt(event.clientX, event.clientY));
  }

  /** The Pokémon under the pointer: a grid tile, a place's slot, or the card on show. */
  private monAt(x: number, y: number): string | undefined {
    for (const node of document.elementsFromPoint(x, y) as HTMLElement[]) {
      const tile = node.closest?.<HTMLElement>('[data-mon]:not([data-mon-key])');
      if (tile) return tile.dataset.mon;
      const card = node.closest?.<HTMLElement>('[data-shown-by]:not([hidden])');
      if (card) return card.dataset.shownBy;
    }
    return undefined;
  }

  /** Over a Pokémon with a thing: green where it would go, red where it would not. */
  private markGiftOver(id: string | undefined): void {
    const root = this.overlay?.root;
    root?.querySelectorAll('.is-gift-yes, .is-gift-no').forEach((node) => node.classList.remove('is-gift-yes', 'is-gift-no'));
    const item = this.carried?.kind === 'gift' ? getItemById(this.carried.id) : undefined;
    const pokemon = id ? this.game_?.stash.listPokemon().find((stored) => stored.id === id)?.pokemon : undefined;
    if (!root || !item || !pokemon || !id) {
      return;
    }
    const ok = giftAnswer(item, pokemon, awayOnRaid(this.game_!).has(id)).ok;
    root.querySelectorAll(`[data-mon="${CSS.escape(id)}"]:not([data-mon-key]), [data-shown-by="${CSS.escape(id)}"]`).forEach((node) =>
      node.classList.add(ok ? 'is-gift-yes' : 'is-gift-no'),
    );
  }

  private pointerUp(event: PointerEvent): void {
    const carried = this.carried;
    if (!carried) {
      return;
    }
    const dragged = carried.ghost !== null;
    const over = dragged ? this.monAt(event.clientX, event.clientY) : undefined;
    const drop = dragged ? this.dropAt(event.clientX, event.clientY) : undefined;
    this.dropCarried();
    if (carried.mouse) {
      // A mouse click is nothing here (hovering is the look); a drag is the deed.
      if (!dragged) {
        return;
      }
      this.mouseDeed = true;
    }
    this.letGo(carried, dragged, over, drop);
    // Spent by the deed's own redraw, if it drew one; never left for a key's.
    this.mouseDeed = false;
  }

  /** What letting go of a carried thing does, where it was let go. */
  private letGo(carried: Carried, dragged: boolean, over: string | undefined, drop: DropPlace | undefined): void {
    if (carried.kind === 'gift') {
      if (!dragged) {
        this.arm(carried.id);
      } else if (over) {
        this.offer(carried.id, over);
      }
      return;
    }
    if (carried.kind === 'held') {
      if (dragged && drop === 'gifts') {
        this.takeBack(carried.id);
      }
      return;
    }
    if (!dragged) {
      // A tap (touch or a pen; a mouse's click is nothing): with a thing chosen
      // to give, the question; otherwise the Pokémon is chosen and its card shown.
      if (this.armed) {
        this.offer(this.armed, carried.id);
        return;
      }
      this.overlay?.refocus(this.on(carried.id));
      return;
    }
    if (!drop || drop === carried.from || drop === 'gifts') {
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
  private dropAt(x: number, y: number): DropPlace | undefined {
    const zone = document.elementsFromPoint(x, y).map((node) => (node as HTMLElement).closest?.<HTMLElement>('[data-drop]')).find(Boolean);
    const place = zone?.dataset.drop;
    return place === 'team' || place === 'garden' || place === 'chest' || place === 'gifts' ? place : undefined;
  }

  private markDrop(place: string | undefined): void {
    // A Pokémon goes to a place or back to the grid; what one holds goes back to TO GIVE.
    const fits = this.carried?.kind === 'held' ? ['gifts'] : ['team', 'garden', 'chest'];
    this.overlay?.root.querySelectorAll<HTMLElement>('[data-drop]').forEach((zone) => {
      zone.classList.toggle('is-drop', zone.dataset.drop === place && place !== this.carried?.from && fits.includes(place ?? ''));
    });
  }

  private dropCarried(): void {
    this.carried?.ghost?.remove();
    this.carried = null;
    this.overlay?.root.classList.remove('is-carrying');
    this.markDrop(undefined);
    this.markGiftOver(undefined);
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
