import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { flowForGame } from '../base/arenaKit';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { DeploymentFlow } from '../hub/deploymentFlow';
import {
  getItemById,
  gridCells,
  itemCountTag,
  machineForItem,
  teachFromMachine,
  useFieldItem,
  type ItemDefinition,
  type ItemId,
} from '../items';
import { evolutionByStone, type MoveBase, type Pokemon } from '../pokemon';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { moveChoiceMessage } from '../ui/moveChooser';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { pixelScreen } from '../ui/pixelUi';
import { dockSidePanel, type SidePanelView } from '../ui/sidePanel';
import { canChoosePupil, pupilOutcome, pupilVerdict, teachBody } from '../ui/teachScreen';
import { homeUseOf, pocketJump, stoneTargetsBody, thingsBody, whereItIsUsed } from '../ui/thingsView';

export interface ThingsSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
  /** The hall's own choices, while the player is in THE RAID ARENA: the pack shown is the one on the rack. */
  readonly flow?: DeploymentFlow;
  /** The harbour beside the panel, told what the panel covers. */
  readonly view?: SidePanelView;
}

/** One of the player's Pokémon, as a disc or a stone is offered to it: where it is kept, and its id to write back by. */
interface HomePokemon {
  readonly id: string;
  readonly pokemon: Pokemon;
  readonly box: string;
}

type Using =
  | { readonly kind: 'teach'; readonly itemId: string; readonly chosen: number | null }
  | { readonly kind: 'evolve'; readonly itemId: string };

/**
 * YOUR THINGS, on B anywhere in the harbour (`ui/thingsView.ts` says what and
 * why): a side panel over the paused harbour, the raid pack's shape and parts.
 *
 * It reads the vault and writes it in only two ways, each through
 * `SaveManager.useAtHome`, which loads first: a disc read to one of the
 * player's Pokémon - the raid's own teach screen and move chooser, offered to
 * every box rather than a party - and an evolution stone, with the fanfare and
 * the new cry a stone in the field has. Nothing can be dropped.
 */
export class ThingsScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private hallFlow: DeploymentFlow | undefined;
  private view: SidePanelView | undefined;
  private game_: RestoredGame | undefined;
  private flow: DeploymentFlow | undefined;
  private using: Using | null = null;
  private status: string | undefined;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('things');
  }

  public init(data: ThingsSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.hallFlow = data.flow;
    this.view = data.view;
    this.using = null;
    this.status = undefined;
    this.reload();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.view?.covers(0);
    });
    recordAction('Opened your things');
  }

  public create(): void {
    this.overlay = new MenuOverlay(this, 'things-menu side-panel pixel-ui', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', 'Your things');
    // Every ENTER here gives something to somebody, so resting the pointer on a
    // Pokémon never makes it the one the stone is about to go to.
    this.overlay.pointerRule = 'previews';
    dockSidePanel(this, this.overlay, this.view);
    this.render();
  }

  public update(_time: number, deltaMs: number): void {
    this.view?.frame(deltaMs);
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'Your things' },
      ...(this.using ? [{ label: 'Using', value: this.using.itemId }] : []),
    ];
  }

  /** The vault as it is stored now, and the next raid's pack worked out from it. */
  private reload(): void {
    this.game_ = this.saveManager.load() ?? this.game_;
    if (this.hallFlow && this.game_) {
      this.hallFlow.rebase(this.game_.stash);
    }
    this.flow = this.hallFlow ?? (this.game_ ? flowForGame(this.game_) : undefined);
  }

  private get homePokemon(): readonly HomePokemon[] {
    const stash = this.game_?.stash;
    if (!stash) {
      return [];
    }
    const byId = new Map(stash.listPokemon().map((entry) => [entry.id, entry.pokemon]));
    return stash.listBoxes().flatMap((box) =>
      box.pokemonIds.flatMap((id) => {
        const pokemon = byId.get(id);
        return pokemon ? [{ id, pokemon, box: box.name }] : [];
      }),
    );
  }

  /** Who a stone is offered to: those it would evolve first, then everybody else, each in box order. */
  private stoneTargets(item: ItemDefinition): readonly HomePokemon[] {
    const all = this.homePokemon;
    const able = (one: HomePokemon): boolean => evolutionByStone(one.pokemon.base.id, item.id) !== undefined;
    return [...all.filter(able), ...all.filter((one) => !able(one))];
  }

  /** Who a disc is offered to: those who can learn it first, as the stone's list is. */
  private pupils(item: ItemDefinition): readonly HomePokemon[] {
    const machine = machineForItem(item);
    const all = this.homePokemon;
    if (!machine) {
      return all;
    }
    const able = (one: HomePokemon): boolean => canChoosePupil(pupilVerdict(machine, one.pokemon));
    return [...all.filter(able), ...all.filter((one) => !able(one))];
  }

  private render(prefer: readonly string[] = []): void {
    const overlay = this.overlay;
    const game = this.game_;
    if (!overlay) {
      return;
    }
    const status = this.status;
    this.status = undefined;
    const item = this.using ? getItemById(this.using.itemId) : undefined;
    const money = itemCountTag('money', game?.stash.itemCount('money') ?? 0);
    let title = 'Your things';
    let back = { label: 'Close', attribute: 'data-close' };
    let body: string;
    let hints = 'ARROWS move · PAGE UP/DOWN a pocket · ENTER use a disc or stone · B close';
    const machine = item ? machineForItem(item) : undefined;
    if (item && this.using?.kind === 'teach' && machine) {
      title = 'Teach a move';
      back = { label: 'Things', attribute: 'data-stop' };
      body = teachBody({
        item,
        machine,
        party: this.pupils(item).map((one) => one.pokemon),
        carried: game?.stash.itemCount(item.id) ?? 0,
        chosen: this.using.chosen,
        home: true,
      });
      hints =
        this.using.chosen === null
          ? 'ARROWS move · ENTER choose who learns it · ESC back'
          : 'ENTER teach · ESC choose someone else';
    } else if (item && this.using?.kind === 'evolve') {
      title = 'Use a stone';
      back = { label: 'Things', attribute: 'data-stop' };
      body = stoneTargetsBody(
        item,
        this.stoneTargets(item).map(({ pokemon, box }) => ({ pokemon, box })),
      );
      hints = 'ARROWS move · ENTER use it · ESC back';
    } else {
      body = this.flow && game ? this.listBody(game, this.flow) : '<main class="px-body"><p class="px-empty">There is no saved game.</p></main>';
    }
    overlay.root.innerHTML = pixelScreen({ title, back, aside: money, body, hints, status });
    const on = (selector: string, act: (button: HTMLButtonElement) => void): void => {
      overlay.root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.onclick = () => act(button);
      });
    };
    on('[data-close]', () => this.close());
    on('[data-stop]', () => this.stopUsing());
    on('[data-thing]', (button) => this.pressThing(button.dataset.thing!));
    on('[data-target]', (button) => this.useStoneOn(Number(button.dataset.target)));
    on('[data-pupil]', (button) => this.choosePupil(Number(button.dataset.pupil)));
    on('[data-teach]', () => this.teach());
    on('[data-teach-cancel]', () => {
      audioManager.play('cancel');
      this.unchoosePupil();
    });
    overlay.refocus(...prefer, '[data-teach]:not([aria-disabled])', '[data-pupil]:not([aria-disabled])', '[data-target]:not([aria-disabled])', '[data-thing]', '[data-close]');
  }

  private listBody(game: RestoredGame, flow: DeploymentFlow): string {
    const layout = flow.bagLayout();
    return thingsBody({
      contents: game.stash.listItems(),
      pokemon: this.homePokemon.map((one) => one.pokemon),
      packed: (itemId) => flow.itemQuantity(itemId as ItemId),
      pack: { name: flow.packName, layout, used: layout.cellsUsed, total: gridCells(flow.bagGrid) },
    });
  }

  private onKey(event: KeyboardEvent): void {
    // The B that opened it, still held, repeats: it must not close it again.
    if (event.repeat && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      return;
    }
    if (isOverlayDismissKey(event, 'b', 'Backspace')) {
      event.preventDefault();
      if (this.using?.kind === 'teach' && this.using.chosen !== null) {
        audioManager.play('cancel');
        this.unchoosePupil();
      } else if (this.using) {
        audioManager.play('cancel');
        this.stopUsing();
      } else {
        this.close();
      }
      return;
    }
    if (this.jumpPocket(event.key)) {
      event.preventDefault();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /**
   * Page Up and Page Down (and Left and Right, in the side column, where the
   * list is one column wide and they would go nowhere) move a whole pocket;
   * Home and End go to the first and last pocket (`pocketJump`).
   */
  private jumpPocket(key: string): boolean {
    const overlay = this.overlay;
    if (!overlay || this.using) {
      return false;
    }
    const side = overlay.root.dataset.layout === 'side';
    const step =
      key === 'PageDown' || (side && key === 'ArrowRight')
        ? 1
        : key === 'PageUp' || (side && key === 'ArrowLeft')
          ? -1
          : key === 'Home'
            ? 'first'
            : key === 'End'
              ? 'last'
              : null;
    if (step === null) {
      return false;
    }
    const rows = [...overlay.root.querySelectorAll<HTMLButtonElement>('[data-thing][data-pocket]')];
    if (rows.length === 0) {
      return false;
    }
    const current = Math.max(0, rows.indexOf(document.activeElement as HTMLButtonElement));
    const to = rows[pocketJump(rows.map((row) => row.dataset.pocket ?? ''), current, step)];
    if (to && to !== document.activeElement) {
      // The pocket's own heading at the top of the pane, not cut off above
      // the row: a jump lands on a pocket, so the pocket says which it is.
      to.focus({ preventScroll: true });
      const pane = to.closest<HTMLElement>('.px-scroll');
      const heading = to.previousElementSibling;
      if (pane && heading?.matches('.px-subheading')) {
        // Exactly at the top: any higher and the pane counts the heading as a
        // row cut through its waist and masks it (`MenuOverlay.markTopCut`).
        pane.scrollTop += heading.getBoundingClientRect().top - pane.getBoundingClientRect().top;
      }
      // The MORE strips and the top cut are measured again for where it is now.
      overlay.remeasure();
    }
    return true;
  }

  private pressThing(itemId: string): void {
    const item = getItemById(itemId);
    if (!item) {
      return;
    }
    const use = homeUseOf(item);
    if (!use) {
      audioManager.play('denied');
      this.status = `${item.displayName}: ${whereItIsUsed(item)}`;
      this.render([`[data-thing="${item.id}"]`]);
      return;
    }
    audioManager.play('select');
    this.using = use === 'teach' ? { kind: 'teach', itemId, chosen: null } : { kind: 'evolve', itemId };
    this.render();
  }

  private stopUsing(): void {
    const was = this.using?.itemId;
    this.using = null;
    this.render(was ? [`[data-thing="${was}"]`] : []);
  }

  private choosePupil(index: number): void {
    const using = this.using;
    const item = using?.kind === 'teach' ? getItemById(using.itemId) : undefined;
    const machine = item ? machineForItem(item) : undefined;
    const pupil = item ? this.pupils(item)[index] : undefined;
    if (!item || !machine || !pupil) {
      return;
    }
    if (!canChoosePupil(pupilVerdict(machine, pupil.pokemon))) {
      audioManager.play('denied');
      this.status = `${pupil.pokemon.name.toUpperCase()}: ${pupilOutcome(machine, pupil.pokemon)}`;
      this.render([`[data-pupil="${index}"]`]);
      return;
    }
    audioManager.play('select');
    this.using = { kind: 'teach', itemId: item.id, chosen: index };
    this.render(['[data-teach]']);
    requestAnimationFrame(() => this.overlay?.root.querySelector('.teach-pupil.is-selected')?.scrollIntoView({ block: 'nearest' }));
  }

  private unchoosePupil(): void {
    const using = this.using;
    if (using?.kind !== 'teach') {
      return;
    }
    this.using = { ...using, chosen: null };
    this.render(using.chosen === null ? [] : [`[data-pupil="${using.chosen}"]`]);
  }

  /**
   * TEACH: the one press that reads the disc. A free slot learns it there and
   * then; a full moveset asks which move goes, on the move chooser a level-up
   * opens, and only a move actually forgotten writes anything.
   */
  private teach(): void {
    const using = this.using;
    const item = using?.kind === 'teach' ? getItemById(using.itemId) : undefined;
    const machine = item ? machineForItem(item) : undefined;
    const pupil = item && using?.kind === 'teach' && using.chosen !== null ? this.pupils(item)[using.chosen] : undefined;
    if (!item || !machine || !pupil) {
      audioManager.play('denied');
      return;
    }
    if (pupilVerdict(machine, pupil.pokemon) !== 'replaces') {
      let message = '';
      const written = this.saveManager.useAtHome(item.id, pupil.id, (stored) => {
        const outcome = teachFromMachine(item, stored);
        message = outcome.kind === 'choose' ? '' : outcome.message;
        return { changed: outcome.kind === 'learned', spent: outcome.kind === 'learned' && outcome.machineIsSpent };
      });
      this.settle(item, written !== undefined, message || `${pupil.pokemon.name.toUpperCase()} could not learn it.`);
      return;
    }
    const move = machine.move;
    openMoveChooser(
      this,
      {
        pokemon: pupil.pokemon,
        incoming: move,
        canDefer: false,
        source: `${machine.number} ${move.name}`,
        spendsSource: !machine.reusable,
        beside: true,
      },
      (choice) => {
        if (choice.kind !== 'forget') {
          this.settle(item, false, moveChoiceMessage(pupil.pokemon.name, move, null));
          return;
        }
        let forgotten: MoveBase | null = null;
        const written = this.saveManager.useAtHome(item.id, pupil.id, (stored) => {
          const outcome = teachFromMachine(item, stored);
          if (outcome.kind !== 'choose') {
            return { changed: false, spent: false };
          }
          forgotten = stored.resolvePendingMove(outcome.move, choice.index)?.forgotten ?? null;
          return { changed: forgotten !== null, spent: forgotten !== null && !machine.reusable };
        });
        this.settle(item, written !== undefined, moveChoiceMessage(pupil.pokemon.name, move, written ? forgotten : null));
      },
    );
  }

  /** A stone on one of the player's Pokémon: it evolves, with the fanfare and the new cry, or nothing is spent. */
  private useStoneOn(index: number): void {
    const using = this.using;
    const item = using?.kind === 'evolve' ? getItemById(using.itemId) : undefined;
    const target = item ? this.stoneTargets(item)[index] : undefined;
    if (!item || !target) {
      return;
    }
    let message = '';
    let species: number | undefined;
    const written = this.saveManager.useAtHome(item.id, target.id, (stored) => {
      const result = useFieldItem(item, stored);
      message = result.message;
      species = stored.base.dexId;
      return { changed: result.used, spent: result.used };
    });
    if (!written) {
      audioManager.play('denied');
      this.status = message || `${target.pokemon.name}: it won't have any effect.`;
      this.render([`[data-target="${index}"]`]);
      return;
    }
    audioManager.play('evolved');
    if (species !== undefined) {
      const dexId = species;
      void audioManager.loadCries([dexId]).then(() => audioManager.play('cry', { species: dexId }));
    }
    recordAction(`Used ${item.displayName} at home`);
    this.reload();
    this.using = null;
    this.status = message;
    this.render([`[data-thing="${item.id}"]`]);
  }

  private settle(item: ItemDefinition, learned: boolean, message: string): void {
    audioManager.play(learned ? 'heal' : 'denied');
    if (learned) {
      recordAction(`Read ${item.displayName} at home`);
    }
    this.reload();
    this.using = null;
    this.status = message;
    this.render([`[data-thing="${item.id}"]`]);
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
