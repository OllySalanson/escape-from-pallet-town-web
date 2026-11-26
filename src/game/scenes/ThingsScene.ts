import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { flowForGame } from '../base/arenaKit';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import type { DeploymentFlow } from '../hub/deploymentFlow';
import {
  footprintOf,
  getItemById,
  gridCells,
  isFoundOnly,
  isCurrency,
  itemCountTag,
  machineForItem,
  placementOf,
  seatPiece,
  stackSizeOf,
  teachFromMachine,
  useFieldItem,
  type GridArrangement,
  type GridPieceRef,
  type ItemDefinition,
  type ItemId,
  type PackItemId,
} from '../items';
import { evolutionByStone, getSpeciesById, type MoveBase, type Pokemon } from '../pokemon';
import { SaveManager, spareAtBase, type RestoredGame } from '../save/SaveManager';
import { pokemonCargoCells } from '../pokemon/pokemonCargo';
import { findsToKeepRoomFor } from '../hub/findRoom';
import { pokedexOwned } from '../hub/pokedex';
import { awayOnRaid, outOnRaidLine, PACKED_FOR_RAID_LINE } from '../run/raidInFlight';
import { moveChoiceMessage } from '../ui/moveChooser';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { MenuOverlay } from '../ui/MenuOverlay';
import { GridArranging } from '../ui/gridArranging';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { takeDownPixelStatus, pixelScreen } from '../ui/pixelUi';
import type { SidePanelView } from '../ui/sidePanel';
import { canChoosePupil, pupilOutcome, pupilVerdict, teachBody } from '../ui/teachScreen';
import { EVOLVE_MOMENT_ARMING_MS, evolveMomentBody, type EvolveMomentView } from '../ui/evolveMoment';
import { RELEASE_ARMING_MS } from '../ui/spatialFocus';
import {
  ALL_POCKETS,
  findRoomBody,
  handCard,
  homeUseOf,
  memberCard,
  teamDoorCard,
  findDoorCard,
  pocketTabs,
  stashLayout,
  staysHome,
  stoneTargetsBody,
  thingsScreen,
  whereItIsUsed,
  type FindRoomRow,
  type HandPlace,
  type PocketTab,
  type ThingsScreen,
} from '../ui/thingsView';

export interface ThingsSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
  /** The hall's own choices, while the player is in THE RAID ARENA: the pack shown is the one on the rack. */
  readonly flow?: DeploymentFlow;
  /** Asked as the screen closes for YOUR TEAM: P, or a click on the team. */
  readonly openTeam?: () => void;
  /** Where the cursor starts: THE RAID ARENA's locker opens this screen on the locker. */
  readonly start?: 'locker';
  /** The harbour under the screen. YOUR THINGS covers it whole, so it is only told it is uncovered. */
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
 * Where a thing let go over a grid stands: where it was let go, moved in just
 * far enough that the whole of it is on the grid - let go with its top-left on
 * the last square, a rod two squares long would hang off the foot.
 */
export function withinGrid(
  size: { readonly width: number; readonly height: number },
  itemId: string,
  at: { readonly x: number; readonly y: number; readonly rotated: boolean },
): { readonly x: number; readonly y: number } {
  const footprint = footprintOf(itemId);
  const width = at.rotated ? footprint.height : footprint.width;
  const height = at.rotated ? footprint.width : footprint.height;
  return {
    x: Math.max(0, Math.min(at.x, size.width - width)),
    y: Math.max(0, Math.min(at.y, size.height - height)),
  };
}

/** The control a kind of thing in the stash is, by its id. */
export function stashPieceSelector(itemId: string): string {
  return `[data-grid-piece="cargo:${itemId}"]`;
}

/**
 * YOUR THINGS, on B anywhere in the harbour (`ui/thingsView.ts` says what and
 * why): the stash as squares, the next raid's pack beside it and the locker
 * under that, over the dimmed harbour (the captain, 25 Nov 2026: "how you can
 * drag things around, just like Tarkov").
 *
 * A thing moved from the stash into the pack is packed for the next raid, and
 * back out of it is unpacked - the same choices the arena hall's rack makes
 * (`DeploymentFlow`), written as the rack writes them (`SaveManager.choosePack`)
 * the moment they are made. The stash's own layout is the save's
 * `stashArrangement`. A disc is read and a stone used from here, each through
 * `SaveManager.useAtHome`, which loads first. Nothing can be dropped.
 */
export class ThingsScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private hallFlow: DeploymentFlow | undefined;
  private view: SidePanelView | undefined;
  private startAt: ThingsSceneData['start'];
  private toTeam: (() => void) | undefined;
  private game_: RestoredGame | undefined;
  private flow: DeploymentFlow | undefined;
  private using: Using | null = null;
  /** Whether ROOM FOR A FIND is showing, over the locker card's button. */
  private keepingRoom = false;
  private status: string | undefined;
  /** Which pocket's things the stash shows lit; the rest stand back. */
  private pocket: PocketTab = ALL_POCKETS;
  private arrangingValue: GridArranging | undefined;
  /**
   * The thing a status line was said about, while it is up: moved off it, the
   * line is taken down rather than left answering the thing the cursor is on
   * now (AI playtest, 22 Nov 2026).
   */
  private statusThing: string | undefined;
  private shownStatusThing: string | undefined;
  /**
   * The moment a stone has just evolved one of the player's Pokémon
   * (`evolveMomentBody`), held until it has been seen and a key ends it. What
   * the screen says afterwards is its `said`.
   */
  private moment: (EvolveMomentView & { readonly itemId: string; readonly openedAt: number }) | undefined;
  /**
   * When the question that spends something for good last appeared: the list
   * of who a stone is for, or TEACH once a pupil is chosen. Each is drawn with
   * the cursor already on an answer, so the second press of the double-tap
   * that opened it must not be what answers it (`RELEASE_ARMING_MS`).
   */
  private askedAt = Number.NEGATIVE_INFINITY;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('things');
  }

  public init(data: ThingsSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.hallFlow = data.flow;
    this.view = data.view;
    this.startAt = data.start;
    this.toTeam = data.openTeam;
    this.using = null;
    this.keepingRoom = false;
    this.status = undefined;
    this.moment = undefined;
    this.pocket = ALL_POCKETS;
    this.arrangingValue = undefined;
    this.askedAt = Number.NEGATIVE_INFINITY;
    this.reload();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.view?.covers(0);
    });
    recordAction('Opened your things');
  }

  public create(): void {
    this.overlay = new MenuOverlay(this, 'things-menu pixel-ui', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', 'Your things');
    // The card under the stash answers for the thing the cursor is on: written
    // into its own card, never a redraw of the screen under the cursor.
    this.overlay.root.addEventListener('focusin', (event) => {
      const piece =
        event.target instanceof Element ? event.target.closest<HTMLElement>('[data-grid-piece], [data-team-member], [data-team-open], [data-find-open]') : null;
      if (!piece) {
        return;
      }
      const thing = this.thingOf(piece);
      if (this.shownStatusThing !== undefined && thing !== this.shownStatusThing && this.overlay) {
        takeDownPixelStatus(this.overlay.root);
        this.shownStatusThing = undefined;
      }
      this.showHand(piece);
    });
    this.render(this.startAt === 'locker' ? ['.things-locker .px-grid-block', '.things-pack .px-grid-block'] : []);
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    return [
      { label: 'Screen', value: 'Your things' },
      ...(this.using ? [{ label: 'Using', value: this.using.itemId }] : []),
    ];
  }

  /**
   * Why a disc or a stone cannot be used here on this Pokémon while a raid is
   * out in another window, or undefined when it can: the Pokémon went on it,
   * or the last of the thing was packed for it. That raid's ending writes its
   * own copy of both back (`SaveManager.raidHoldRefusal`).
   */
  private heldByRaid(itemId: string, pokemonId: string, name: string): string | undefined {
    const game = this.saveManager.load() ?? this.game_;
    if (!game) {
      return undefined;
    }
    if (awayOnRaid(game).has(pokemonId)) {
      return outOnRaidLine(name);
    }
    return game.stash.itemCount(itemId) > 0 && spareAtBase(game, itemId) < 1 ? PACKED_FOR_RAID_LINE : undefined;
  }

  /** The vault as it is stored now, and the next raid's pack worked out from it. */
  private reload(): void {
    this.game_ = this.saveManager.load() ?? this.game_;
    if (this.hallFlow && this.game_) {
      this.hallFlow.rebase(this.game_.stash);
    }
    this.flow = this.hallFlow ?? (this.game_ ? flowForGame(this.game_) : undefined);
    // As YOUR TEAM does: an empty bench stands the partner on it, so the
    // locker shows who it would keep and the pack is the one they would carry.
    if (!this.hallFlow) {
      this.flow?.packSomebodyIfBenchEmpty();
    }
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

  /**
   * What is at base and not in the next raid's pack, by id: what the stash
   * draws. Money is the title's, and the pack being worn is on the player's back.
   */
  private stashContents(): Readonly<Record<string, number>> {
    const game = this.game_;
    const flow = this.flow;
    if (!game || !flow) {
      return {};
    }
    return Object.fromEntries(
      Object.keys(game.stash.listItems())
        .filter((itemId) => !isCurrency(itemId))
        .map((itemId) => {
          const worn = flow.packItemId === itemId ? 1 : 0;
          return [itemId, spareAtBase(game, itemId) - flow.itemQuantity(itemId as ItemId) - worn] as const;
        })
        .filter(([, quantity]) => quantity > 0),
    );
  }

  private get stashArrangement(): GridArrangement {
    return this.game_?.raidProgress.stashArrangement ?? { items: [], cargo: [] };
  }

  /** Picking up, carrying and putting down, in the stash and the pack and across them. */
  private get arranging(): GridArranging {
    this.arrangingValue ??= new GridArranging({
      packing: (name) =>
        name === 'stash'
          ? stashLayout(this.stashContents(), this.stashArrangement)
          : name === 'locker'
            ? (this.flow?.secureLayout() ?? null)
            : (this.flow?.bagLayout() ?? null),
      commit: (name, arrangement) => {
        if (name === 'stash') {
          this.keepStashArrangement(arrangement);
        } else if (name === 'locker') {
          this.flow?.arrangeSecure(arrangement);
          this.keepPack();
        } else {
          this.flow?.arrangeBag(arrangement);
          this.keepPack();
        }
        this.render();
      },
      redraw: () => this.render(),
      remove: (name, ref) => {
        if (name === 'pack' && ref.kind === 'item') {
          this.takeOut(ref);
        } else if (name === 'locker' && ref.kind === 'item') {
          this.lock(ref.itemId, false);
        } else {
          audioManager.play('denied');
        }
        return true;
      },
      transfer: (from, to, ref, x, y, rotated) => this.transfer(from, to, ref, x, y, rotated),
      say: (message) => this.say(message),
      sound: (kind) => audioManager.play(kind === 'refused' ? 'denied' : kind === 'take' ? 'menuOpen' : 'haulDrop'),
    });
    return this.arrangingValue;
  }

  /** The kind of thing a stash or pack piece is. */
  private thingOf(piece: HTMLElement): string | undefined {
    const key = piece.dataset.gridPiece ?? '';
    return key.startsWith('cargo:') ? key.slice('cargo:'.length) : /^item:\d+:(.+)$/.exec(key)?.[1];
  }

  private screenView(): ThingsScreen | undefined {
    const flow = this.flow;
    if (!flow) {
      return undefined;
    }
    const layout = flow.bagLayout();
    const locker = flow.secureLayout();
    const partnerId = flow.partnerOnRaid?.id;
    return {
      stash: this.stashContents(),
      stashArrangement: this.stashArrangement,
      pocket: this.pocket,
      team: flow.party.map((one) => ({
        id: one.id,
        name: one.pokemon.name,
        speciesId: one.pokemon.base.id,
        currentHp: one.pokemon.currentHp,
        maxHp: one.pokemon.maxHp,
        fate: one.id === partnerId ? 'partner' : flow.securesPokemon(one.id) ? 'locked' : 'risk',
      })),
      pack: {
        name: flow.packName,
        itemId: flow.packItemId,
        layout,
        used: layout.cellsUsed,
        total: gridCells(flow.bagGrid),
        locked: flow.securedContents,
      },
      locker: { layout: locker, used: locker.cellsUsed, total: gridCells(flow.secureGrid) },
      findRoom: true,
      ghosts: {
        stash: this.arranging.ghostFor('stash'),
        pack: this.arranging.ghostFor('pack'),
        locker: this.arranging.ghostFor('locker'),
      },
    };
  }

  /** The in-hand card for a piece, written into its own card. */
  private showHand(piece: HTMLElement | null): void {
    const card = this.overlay?.root.querySelector<HTMLElement>('[data-hand-card]');
    if (!card) {
      return;
    }
    card.innerHTML = this.handFor(piece);
    this.markTwins(piece);
  }

  /**
   * A kept thing is drawn twice - lined in the pack, and in the locker that
   * keeps it - so the cursor on either lights the other: one thing, kept.
   */
  private markTwins(piece: HTMLElement | null): void {
    const root = this.overlay?.root;
    if (!root?.querySelectorAll) {
      return;
    }
    root.querySelectorAll('.is-twin').forEach((each) => each.classList.remove('is-twin'));
    const owner = piece?.dataset.gridOwner;
    const thing = piece ? this.thingOf(piece) : undefined;
    if (!thing || !piece?.classList.contains('is-locked') || (owner !== 'pack' && owner !== 'locker')) {
      return;
    }
    // The n-th kept block of a kind in one is the n-th in the other: one pair lit.
    const kept = (grid: string): HTMLElement[] => [
      ...root.querySelectorAll<HTMLElement>(`[data-grid-owner="${grid}"].is-locked[data-grid-piece$=":${thing}"]`),
    ];
    const at = kept(owner).indexOf(piece);
    kept(owner === 'pack' ? 'locker' : 'pack')[at]?.classList.add('is-twin');
  }

  private handFor(piece: HTMLElement | null): string {
    if (piece?.hasAttribute('data-team-open')) {
      return teamDoorCard();
    }
    if (piece?.hasAttribute('data-find-open')) {
      return findDoorCard();
    }
    const memberId = piece?.dataset.teamMember;
    const member = memberId ? this.flow?.party.find((one) => one.id === memberId) : undefined;
    if (member && this.flow) {
      const flow = this.flow;
      const partner = flow.partnerOnRaid?.id === member.id;
      return memberCard(member.pokemon, {
        fate: partner ? 'partner' : flow.securesPokemon(member.id) ? 'locked' : 'risk',
        squares: pokemonCargoCells(member.pokemon.base.id),
        canLock: flow.secureFit(member.id) === 'fits',
        ...(this.swapsOut(member.id) ? { swapsOut: this.swapsOut(member.id) } : {}),
      });
    }
    const held = this.arranging.held;
    if (held) {
      const itemId = held.ref.kind === 'cargo' ? held.ref.cargoId : held.ref.itemId;
      return handCard(getItemById(itemId), 'carrying', { canPack: false });
    }
    const thing = piece ? this.thingOf(piece) : undefined;
    const item = thing ? getItemById(thing) : undefined;
    const owner = piece?.dataset.gridOwner;
    const place: HandPlace = owner === 'pack' || owner === 'locker' ? owner : 'stash';
    return handCard(item, place, {
      canPack: item ? this.canPack(item) : false,
      locked: Boolean(piece?.classList.contains('is-locked')),
      canLock: item ? (this.flow?.secureHasRoomFor(item.id as ItemId) ?? false) : false,
      roomKept: Boolean(item && place === 'stash' && (this.flow?.secureQuantity(item.id as ItemId) ?? 0) > 0),
    });
  }

  /** Who the locker would let go to keep this one: its places are all taken by others. */
  private swapsOut(id: string): string | undefined {
    const flow = this.flow;
    if (!flow || flow.securesPokemon(id) || flow.securedPokemon.length < flow.securePokemonSlots) {
      return undefined;
    }
    return flow.securedPokemon[0]?.pokemon.name.toUpperCase();
  }

  /** Whether a thing in the stash can go in the pack at all, before asking for room. */
  private canPack(item: ItemDefinition): boolean {
    if (item.effect.type === 'pack') {
      return true;
    }
    return (this.flow?.packLimit(item.id as ItemId) ?? 0) > (this.flow?.itemQuantity(item.id as ItemId) ?? 0);
  }

  private render(prefer: readonly string[] = []): void {
    const overlay = this.overlay;
    const game = this.game_;
    if (!overlay) {
      return;
    }
    if (this.moment) {
      overlay.root.innerHTML = pixelScreen({
        title: 'Your things',
        body: evolveMomentBody(this.moment, 'Back to your things.'),
        hints: 'Any key · back to your things',
      });
      overlay.root.querySelector<HTMLButtonElement>('[data-moment-done]')?.addEventListener('click', () => this.endMoment());
      overlay.refocus('[data-moment-done]');
      return;
    }
    const status = this.status;
    this.status = undefined;
    this.shownStatusThing = status === undefined ? undefined : this.statusThing;
    this.statusThing = undefined;
    const item = this.using ? getItemById(this.using.itemId) : undefined;
    const money = itemCountTag('money', game ? spareAtBase(game, 'money') : 0);
    let title = 'Your things';
    let back: { label: string; attribute: string } | undefined;
    let body: string;
    let hints = `ARROWS move · ENTER pack · BKSP out · L lock · Q E tab${this.toTeam ? ' · P team' : ''} · ESC back`;
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
    } else if (this.keepingRoom && this.flow) {
      title = 'Room for a find';
      back = { label: 'Things', attribute: 'data-find-close' };
      const locker = this.flow.secureLayout();
      body = findRoomBody(this.findRows(), { layout: locker, used: locker.cellsUsed, total: gridCells(this.flow.secureGrid) });
      hints = 'ARROWS move · ENTER keep room · BKSP let it go · ESC back';
    } else {
      const view = game ? this.screenView() : undefined;
      body = view ? thingsScreen(view, '') : '<main class="px-body"><p class="px-empty">There is no saved game.</p></main>';
    }
    overlay.root.innerHTML = pixelScreen({ title, back, close: { attribute: 'data-close' }, aside: money, body, hints, status });
    const on = (selector: string, act: (button: HTMLButtonElement) => void): void => {
      overlay.root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.onclick = () => act(button);
      });
    };
    on('[data-close]', () => this.close());
    on('[data-stop]', () => this.stopUsing());
    on('[data-target]', (button) => this.useStoneOn(Number(button.dataset.target)));
    on('[data-pupil]', (button) => this.choosePupil(Number(button.dataset.pupil)));
    on('[data-teach]', () => this.teach());
    on('[data-teach-cancel]', () => {
      audioManager.play('cancel');
      this.unchoosePupil();
    });
    on('[data-pocket-tab]', (button) => this.showPocket(button.dataset.pocketTab as PocketTab));
    on('[data-team-open]', () => this.goToTeam());
    on('[data-find-open]', () => this.openFindRoom());
    on('[data-find-close]', () => this.closeFindRoom());
    on('[data-find]', (button) => this.keepRoomFor(button.dataset.find ?? '', true));
    // The card's buttons act on the thing the cursor is on, and never take the
    // cursor off it: a pressed button would otherwise be what ENTER pressed next.
    const card = overlay.root.querySelector<HTMLElement>('[data-hand-card]');
    card?.addEventListener('mousedown', (event) => event.preventDefault());
    card?.addEventListener('click', (event) => {
      const button = (event.target as Element | null)?.closest<HTMLElement>('[data-hand]');
      if (button && button.getAttribute('aria-disabled') !== 'true') {
        this.handDeed(button.dataset.hand ?? '');
      }
    });
    if (!this.using && !this.keepingRoom) {
      this.arranging.attach(overlay.root);
    }
    overlay.refocus(
      ...prefer,
      '[data-teach]:not([aria-disabled])',
      '[data-pupil]:not([aria-disabled])',
      '[data-target]:not([aria-disabled])',
      '[data-find]:not([aria-disabled])',
      // A full locker leaves every find row shut, and the cursor fell to the X,
      // so the ENTER the keys line said would keep room closed the screen (the
      // harbour critic tour, 26 Nov 2026): it holds a shut row, or the way back.
      '[data-find]',
      '[data-find-close]',
      '.things-stash .px-grid-block:not(.is-dim)',
      '.things-pack .px-grid-block',
      '[data-close]',
    );
    const focused = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);
    this.showHand(focused?.closest<HTMLElement>('[data-grid-piece], [data-team-member], [data-team-open], [data-find-open]') ?? null);
  }

  /** A pocket tab: its things lit and the rest stood back, the cursor on its first. */
  private showPocket(pocket: PocketTab): void {
    this.pocket = pocket;
    audioManager.play('select');
    this.render(['.things-stash .px-grid-block:not(.is-dim)']);
    // The cursor goes to the pocket's first thing, never stays on one it stood back.
    this.overlay?.focus('.things-stash .px-grid-block:not(.is-dim)');
  }

  /** Q and E walk the pocket tabs. */
  private stepPocket(step: 1 | -1): void {
    const tabs = pocketTabs(this.stashContents());
    const at = Math.max(0, tabs.indexOf(this.pocket));
    const next = tabs[Math.min(tabs.length - 1, Math.max(0, at + step))];
    if (next && next !== this.pocket) {
      this.showPocket(next);
    }
  }

  /** What a button on the in-hand card does: the same as its key. */
  private handDeed(deed: string): void {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const piece = focused?.closest<HTMLElement>('[data-grid-piece], [data-team-member]') ?? null;
    const key: Partial<Record<string, string>> = { drop: 'Enter', take: 'Enter', turn: 'r', cancel: 'Escape', out: 'Backspace' };
    if (deed === 'team') {
      this.goToTeam();
    } else if (deed === 'finds') {
      this.openFindRoom();
    } else if (deed === 'lock' && piece) {
      this.toggleLock(piece);
    } else if (deed === 'pack' && piece) {
      this.packOne(this.thingOf(piece));
    } else if (deed === 'use' && piece) {
      const thing = this.thingOf(piece);
      if (thing) {
        this.pressThing(thing);
      }
    } else if (key[deed]) {
      this.onKey(new KeyboardEvent('keydown', { key: key[deed] }));
    }
  }

  private say(message: string): void {
    this.status = message;
    this.render();
  }

  /** The pack as it stands now, written as the rack writes it. */
  private keepPack(): void {
    const flow = this.flow;
    if (!flow) {
      return;
    }
    this.saveManager.choosePack(flow.packedContents, flow.leftOut);
    this.saveManager.recordContainerArrangements(flow.bagArrangement, flow.secureArrangement);
    // What the locker keeps is remembered as its preference, which is what the
    // next screen fills it from (`secureAutofill.ts`).
    this.saveManager.recordSecurePreference(flow.securePreference);
  }

  /** L on a block of the pack: the locker keeps one more of it, or one fewer if this block is kept. */
  private toggleLock(piece: HTMLElement): void {
    const member = piece.closest<HTMLElement>('[data-team-member]')?.dataset.teamMember;
    if (member) {
      this.lockPokemon(member);
      return;
    }
    const thing = this.thingOf(piece);
    const owner = piece.dataset.gridOwner;
    if (thing && owner === 'pack') {
      this.lock(thing, !piece.classList.contains('is-locked'));
    } else if (thing && owner === 'locker') {
      this.lock(thing, false);
    } else if (thing && owner === 'stash' && isFoundOnly(thing) && staysHome(thing)) {
      // Room kept in the locker for a find of this kind: it is not carried out,
      // so the locker keeps its squares free for one carried home.
      this.lock(thing, true, [stashPieceSelector(thing)]);
    } else {
      audioManager.play('denied');
    }
  }

  /** L on one of the team: the locker keeps that Pokémon, or lets it go. The partner has its own place. */
  private lockPokemon(id: string): void {
    const flow = this.flow;
    if (!flow) {
      return;
    }
    const again = [`[data-team-member="${id}"]`];
    if (flow.partnerOnRaid?.id === id) {
      audioManager.play('denied');
      this.render(again);
      return;
    }
    const was = flow.securesPokemon(id);
    const refusal = flow.toggleSecurePokemon(id);
    if (refusal !== undefined || flow.securesPokemon(id) === was) {
      audioManager.play('denied');
      this.status = refusal;
      this.render(again);
      this.overlay?.root.querySelector?.('.things-locker')?.classList.add('is-refusing');
      return;
    }
    audioManager.play(was ? 'cancel' : 'haulDrop');
    recordAction(`${was ? 'Unlocked' : 'Locked'} ${flow.party.find((one) => one.id === id)?.pokemon.name ?? id}`);
    this.keepPack();
    this.render(again);
  }

  /** One more block of a kind in the locker, or one fewer. */
  private lock(itemId: string, more: boolean, prefer?: readonly string[]): boolean {
    const flow = this.flow;
    if (!flow) {
      return false;
    }
    const id = itemId as ItemId;
    const blocks = Math.ceil(flow.secureQuantity(id) / stackSizeOf(id));
    const refusal = flow.setSecureSquares(id, blocks + (more ? 1 : -1));
    const moved = Math.ceil(flow.secureQuantity(id) / stackSizeOf(id)) !== blocks;
    if (!moved) {
      this.refuse(
        refusal ?? 'The locker is full.',
        itemId,
        ...(prefer ?? [`.things-pack [data-grid-piece$=":${itemId}"]${more ? ':not(.is-locked)' : ''}`]),
      );
      this.overlay?.root.querySelector?.('.things-locker')?.classList.add('is-refusing');
      return false;
    }
    audioManager.play(more ? 'haulDrop' : 'cancel');
    recordAction(`${more ? 'Locked' : 'Unlocked'} ${getItemById(itemId)?.displayName ?? itemId}`);
    this.keepPack();
    this.render([
      ...(prefer ?? []),
      more
        ? `.things-pack [data-grid-piece$=":${itemId}"].is-locked`
        : `.things-pack [data-grid-piece$=":${itemId}"]:not(.is-locked)`,
      `.things-locker [data-grid-piece$=":${itemId}"]`,
      '.things-pack .px-grid-block',
    ]);
    return true;
  }

  private keepStashArrangement(arrangement: GridArrangement): void {
    this.saveManager.recordStashArrangement(arrangement);
    this.game_ = this.saveManager.load() ?? this.game_;
    if (this.hallFlow && this.game_) {
      this.hallFlow.rebase(this.game_.stash);
    }
  }

  /**
   * One stack of a thing from the stash into the pack - or, for a pack, the
   * pack itself onto the player's back - seated where it was let go when it
   * was dragged there. Returns whether it went.
   */
  private packOne(itemId: string | undefined, at?: { readonly x: number; readonly y: number; readonly rotated: boolean }): boolean {
    const flow = this.flow;
    const item = itemId ? getItemById(itemId) : undefined;
    if (!flow || !item) {
      return false;
    }
    if (item.effect.type === 'pack') {
      const refusal = flow.choosePack(item.id as PackItemId);
      if (refusal !== undefined) {
        this.refuse(refusal, item.id);
        return false;
      }
      audioManager.play('haulDrop');
      this.keepPack();
      this.render([stashPieceSelector(item.id), '.things-pack .px-grid-block']);
      return true;
    }
    if (staysHome(item.id)) {
      // It never goes on a raid: the house on it and HOME ONLY on its card say so.
      audioManager.play('denied');
      return false;
    }
    const atHome = this.stashContents()[item.id] ?? 0;
    const packed = flow.itemQuantity(item.id as ItemId);
    const refusal = flow.setItemQuantity(item.id as ItemId, packed + Math.min(stackSizeOf(item.id), atHome));
    if (refusal !== undefined || flow.itemQuantity(item.id as ItemId) <= packed) {
      this.refuse(refusal ?? `${item.displayName}: ${whereItIsUsed(item)}`, item.id);
      return false;
    }
    if (at) {
      const layout = flow.bagLayout();
      const blocks = layout.placements.filter((placement) => placement.itemId === item.id).length;
      const seat = withinGrid(layout.size, item.id, at);
      const seated = seatPiece(layout, { kind: 'item', itemId: item.id, index: blocks - 1 }, seat.x, seat.y, at.rotated);
      if (seated) {
        flow.arrangeBag(seated);
      }
    }
    audioManager.play('haulDrop');
    recordAction(`Packed ${item.displayName}`);
    this.keepPack();
    const still = (this.stashContents()[item.id] ?? 0) > 0;
    this.render(still ? [stashPieceSelector(item.id)] : ['.things-pack .px-grid-block']);
    return true;
  }

  /** One of a thing out of the pack and back to the stash: BACKSPACE, or a right-click. */
  private takeOut(ref: Extract<GridPieceRef, { kind: 'item' }>): void {
    const flow = this.flow;
    if (!flow) {
      return;
    }
    const itemId = ref.itemId as ItemId;
    const refusal = flow.setItemQuantity(itemId, flow.itemQuantity(itemId) - 1);
    if (refusal !== undefined) {
      this.refuse(refusal, itemId);
      return;
    }
    audioManager.play('cancel');
    this.keepPack();
    this.render([`[data-grid-piece="item:${ref.index}:${itemId}"]`, `[data-grid-piece^="item:"][data-grid-piece$=":${itemId}"]`, stashPieceSelector(itemId)]);
  }

  /** A piece let go over the other grid: stash into pack packs it, pack into stash unpacks it. */
  private transfer(from: string, to: string, ref: GridPieceRef, x: number, y: number, rotated: boolean): boolean {
    const flow = this.flow;
    if (!flow) {
      return false;
    }
    if (from === 'stash' && to === 'pack' && ref.kind === 'cargo') {
      return this.packOne(ref.cargoId, { x, y, rotated });
    }
    if (from === 'pack' && to === 'locker' && ref.kind === 'item') {
      return this.lock(ref.itemId, true);
    }
    if (from === 'stash' && to === 'locker' && ref.kind === 'cargo' && isFoundOnly(ref.cargoId) && staysHome(ref.cargoId)) {
      return this.lock(ref.cargoId, true, [stashPieceSelector(ref.cargoId)]);
    }
    if (from === 'locker' && to !== 'locker' && ref.kind === 'item') {
      return this.lock(ref.itemId, false);
    }
    if (from === 'pack' && to === 'stash' && ref.kind === 'item') {
      const placement = placementOf(flow.bagLayout(), ref);
      const itemId = ref.itemId as ItemId;
      const wasHome = (this.stashContents()[itemId] ?? 0) > 0;
      const refusal = flow.setItemQuantity(itemId, flow.itemQuantity(itemId) - (placement && 'quantity' in placement ? placement.quantity : 1));
      if (refusal !== undefined) {
        this.refuse(refusal, itemId);
        return false;
      }
      this.keepPack();
      if (!wasHome) {
        const stash = stashLayout(this.stashContents(), this.stashArrangement);
        const seat = withinGrid(stash.size, itemId, { x, y, rotated });
        const seated = seatPiece(stash, { kind: 'cargo', cargoId: itemId }, seat.x, seat.y, rotated);
        if (seated) {
          this.keepStashArrangement(seated);
        }
      }
      audioManager.play('haulDrop');
      this.render([stashPieceSelector(itemId)]);
      return true;
    }
    return false;
  }

  private refuse(message: string, itemId: string, ...prefer: readonly string[]): void {
    audioManager.play('denied');
    this.status = message;
    this.statusThing = itemId;
    this.render([...prefer, stashPieceSelector(itemId)]);
  }

  private onKey(event: KeyboardEvent): void {
    // Any key ends the evolution moment once it has been seen - but not the
    // ENTER that used the stone, still held or repeating, nor the one pressed
    // straight after it, or the moment would never be seen at all.
    if (this.moment) {
      event.preventDefault();
      if (!event.repeat && this.time.now - this.moment.openedAt >= EVOLVE_MOMENT_ARMING_MS) {
        this.endMoment();
      }
      return;
    }
    // The B that opened it, still held, repeats: it must not close it again.
    if (event.repeat && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      return;
    }
    const focused = typeof document === 'undefined' ? null : document.activeElement;
    if (this.keepingRoom) {
      const find = focused instanceof HTMLElement ? focused.dataset.find : undefined;
      if (find && (event.key === 'Enter' || event.key === ' ' || event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault();
        this.keepRoomFor(find, event.key === 'Enter' || event.key === ' ');
        return;
      }
      if (isOverlayDismissKey(event, 'b') || event.key === 'Backspace') {
        event.preventDefault();
        this.closeFindRoom();
        return;
      }
      if (this.overlay?.moveCursor(event.key)) {
        event.preventDefault();
      }
      return;
    }
    if (!this.using && this.overlay) {
      const piece = focused instanceof HTMLElement ? focused.closest<HTMLElement>('[data-grid-piece]') : null;
      // ENTER on a thing in the stash puts one in the pack; carrying, or in
      // the pack, it is the arranging's: pick up and put down.
      if (!this.arranging.held && piece?.dataset.gridOwner === 'stash' && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.packOne(this.thingOf(piece));
        return;
      }
      const member = focused instanceof HTMLElement ? focused.closest<HTMLElement>('[data-team-member]') : null;
      if (!this.arranging.held && (piece ?? member) && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        this.toggleLock((piece ?? member) as HTMLElement);
        return;
      }
      if (!this.arranging.held && piece?.dataset.gridOwner === 'stash' && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        const thing = this.thingOf(piece);
        if (thing) {
          this.pressThing(thing);
        }
        return;
      }
      if (this.arranging.handleKey(event, focused)) {
        event.preventDefault();
        return;
      }
      const door = focused instanceof HTMLElement && focused.hasAttribute('data-team-open');
      if (!this.arranging.held && this.toTeam && (event.key.toLowerCase() === 'p' || (door && (event.key === 'Enter' || event.key === ' ')))) {
        event.preventDefault();
        this.goToTeam();
        return;
      }
      if (!this.arranging.held && (event.key.toLowerCase() === 'q' || event.key.toLowerCase() === 'e')) {
        event.preventDefault();
        this.stepPocket(event.key.toLowerCase() === 'q' ? -1 : 1);
        return;
      }
    }
    if (isOverlayDismissKey(event, 'b')) {
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
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
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
      this.statusThing = item.id;
      this.render([stashPieceSelector(item.id)]);
      return;
    }
    audioManager.play('select');
    this.using = use === 'teach' ? { kind: 'teach', itemId, chosen: null } : { kind: 'evolve', itemId };
    this.askedAt = this.time.now;
    this.render();
  }


  private stopUsing(): void {
    const was = this.using?.itemId;
    this.using = null;
    this.render(was ? [stashPieceSelector(was)] : []);
  }

  private choosePupil(index: number): void {
    const using = this.using;
    const item = using?.kind === 'teach' ? getItemById(using.itemId) : undefined;
    const machine = item ? machineForItem(item) : undefined;
    const pupil = item ? this.pupils(item)[index] : undefined;
    if (!item || !machine || !pupil) {
      return;
    }
    const held = this.heldByRaid(item.id, pupil.id, pupil.pokemon.name);
    if (held !== undefined) {
      audioManager.play('denied');
      this.status = held;
      this.render([`[data-pupil="${index}"]`]);
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
    this.askedAt = this.time.now;
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
    if (this.askedTooRecently()) {
      return;
    }
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
    if (this.askedTooRecently()) {
      return;
    }
    const using = this.using;
    const item = using?.kind === 'evolve' ? getItemById(using.itemId) : undefined;
    const target = item ? this.stoneTargets(item)[index] : undefined;
    if (!item || !target) {
      return;
    }
    const held = this.heldByRaid(item.id, target.id, target.pokemon.name);
    if (held !== undefined) {
      audioManager.play('denied');
      this.status = held;
      this.render([`[data-target="${index}"]`]);
      return;
    }
    let message = '';
    let species: number | undefined;
    let before: { readonly dexId: number; readonly name: string } | undefined;
    let after: { readonly name: string; readonly shiny: boolean } | undefined;
    const written = this.saveManager.useAtHome(item.id, target.id, (stored) => {
      before = { dexId: stored.base.dexId, name: stored.base.name };
      const result = useFieldItem(item, stored);
      message = result.message;
      species = stored.base.dexId;
      after = { name: stored.base.name, shiny: stored.shiny };
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
    if (before && after && species !== undefined) {
      this.moment = {
        fromDexId: before.dexId,
        fromName: before.name,
        toDexId: species,
        toName: after.name,
        shiny: after.shiny,
        said: message,
        itemId: item.id,
        openedAt: this.time.now,
      };
      this.render();
      return;
    }
    this.status = message;
    this.render([stashPieceSelector(item.id)]);
  }

  /** Whether a press is the second half of the double-tap that asked the question it would answer. */
  private askedTooRecently(): boolean {
    return this.time.now - this.askedAt < RELEASE_ARMING_MS;
  }

  /** Back to the list from the evolution moment, with its line said there. */
  private endMoment(): void {
    const moment = this.moment;
    if (!moment) {
      return;
    }
    this.moment = undefined;
    this.status = moment.said;
    this.render([stashPieceSelector(moment.itemId)]);
  }

  private settle(item: ItemDefinition, learned: boolean, message: string): void {
    audioManager.play(learned ? 'heal' : 'denied');
    if (learned) {
      recordAction(`Read ${item.displayName} at home`);
    }
    this.reload();
    this.using = null;
    this.status = message;
    this.render([stashPieceSelector(item.id)]);
  }

  /** Every find the locker can keep room for, with how much it keeps now. */
  private findRows(): readonly FindRoomRow[] {
    const flow = this.flow;
    const game = this.game_;
    if (!flow || !game) {
      return [];
    }
    const ids = findsToKeepRoomFor({
      progress: game.raidProgress,
      held: (itemId) => game.stash.itemCount(itemId) + (game.raidProgress.fossil?.itemId === itemId ? 1 : 0),
      owns: (speciesId) => {
        const dexId = getSpeciesById(speciesId)?.dexId;
        return dexId !== undefined && pokedexOwned(game.raidProgress.pokedexOwned, game.stash).includes(dexId);
      },
    });
    return ids.flatMap((itemId) => {
      const item = getItemById(itemId);
      if (!item) {
        return [];
      }
      const { width, height } = footprintOf(itemId);
      return [
        {
          itemId,
          name: item.displayName,
          squares: width * height,
          kept: Math.ceil(flow.secureQuantity(itemId) / stackSizeOf(itemId)),
          canKeep: flow.secureHasRoomFor(itemId),
        },
      ];
    });
  }

  private openFindRoom(): void {
    audioManager.play('select');
    this.keepingRoom = true;
    this.render(['[data-find]:not([aria-disabled])']);
  }

  private closeFindRoom(): void {
    audioManager.play('cancel');
    this.keepingRoom = false;
    this.render(['[data-find-open]']);
  }

  /** ENTER on a find keeps room for one more of it; BACKSPACE lets one go. */
  private keepRoomFor(itemId: string, more: boolean): void {
    if (!itemId) {
      return;
    }
    this.lock(itemId, more, [`[data-find="${itemId}"]`]);
  }

  /** On to YOUR TEAM, where who goes is chosen: this screen closes and the harbour opens that one. */
  private goToTeam(): void {
    const toTeam = this.toTeam;
    if (!toTeam) {
      return;
    }
    toTeam();
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
