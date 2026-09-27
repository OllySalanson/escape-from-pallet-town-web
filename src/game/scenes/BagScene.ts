import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import {
  footprintOf,
  gridCells,
  itemCountTag,
  ITEM_CATEGORY_LABELS,
  ItemCategory,
  machineForItem,
  teachFromMachine,
  useFieldItem,
  type Bag,
  type ItemDefinition,
} from '../items';
import type { Pokemon, PokemonParty } from '../pokemon';
import { moveChoiceMessage } from '../ui/moveChooser';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { itemIcon } from '../ui/icons';
import { MenuOverlay } from '../ui/MenuOverlay';
import { GridArranging } from '../ui/gridArranging';
import { bagFocusPreference } from '../ui/menuFocus';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { conditionLine } from '../ui/condition';
import { describeKey, splitDescribeKey } from '../ui/hoverDescribe';
import { canChoosePupil, pupilOutcome, pupilVerdict, teachBody } from '../ui/teachScreen';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelGrid,
  pixelHpBar,
  pixelScreen,
  pixelTag,
  pixelWindow,
} from '../ui/pixelUi';

/**
 * The pockets, in the order they are read, and all of them at once.
 *
 * There used to be a row of tabs above the list and one pocket on screen, which
 * is a layer between the player and the Potion at exactly the moment they have
 * least time for one. The pack holds eighteen squares: everything in it fits on
 * one screen laid out across the width (`ui/columnLayout.ts`), with a band
 * naming each pocket, so finding a thing is looking rather than tabbing.
 *
 * Gear is one of them now. It was in no pocket at all, so a Quick Claw taken
 * off a boss was carried out of the raid without ever appearing in the bag.
 * A spare pack found in the field is another: it is loot like any other and has
 * to be findable in the pocket it lands in, even though which pack you are
 * *wearing* is chosen at base (`items/packs.ts`).
 */
const POCKETS = [
  ItemCategory.Medicine,
  ItemCategory.PokeBall,
  ItemCategory.Held,
  ItemCategory.Pack,
  ItemCategory.Misc,
] as const;

/**
 * What a row's Enter does nothing about. Three kinds of thing in the pocket do
 * nothing to a Pokemon and say where they are spent instead - the money used to
 * offer a live USE ITEM that could only ever refuse itself.
 */
const USELESS_IN_THE_FIELD = new Set(['capture-modifier', 'material', 'currency']);

/**
 * What pressing a row does, in the words of the help bar.
 *
 * A **live** action names the item it would spend - `Use Potion`, never `use
 * item` - because the line is read about whatever the cursor is on and a bare
 * verb is a sentence that can be misread. A refusal does not: the line already
 * leads with the item's own name, and saying it twice in one breath reads as a
 * fault rather than as emphasis.
 */
const useLabel = (item: ItemDefinition): string => {
  switch (item.effect.type) {
    case 'capture-modifier':
      return 'Thrown in a battle, from the BALL command. Nothing to do with it here.';
    case 'material':
      return 'Carry it home: Brock is the only one who takes it.';
    case 'currency':
      return 'Carry it home: Bill is the only one who takes it.';
    case 'machine':
      return `Read ${item.displayName} to a Pokémon. A move learned is learned for good.`;
    default:
      return `Use ${item.displayName} on a Pokémon.`;
  }
};

/** The short word on the end of a row, when a row has one to carry. */
const pocketTag = (item: ItemDefinition): string =>
  item.category === ItemCategory.Held ? pixelTag('Gear', 'plain') : '';

/**
 * What the keys do, said while the cursor is on a block. It is the help bar's
 * line rather than a strip of instructions under the grid, because the pack
 * stands in a column beside the pockets and a sentence there wraps.
 */
const ARRANGE_HELP =
  'ENTER picks this up and puts it down · arrows carry it · R turns it · ESC puts it back.';

interface BagSceneData {
  readonly bag: Bag;
  readonly party: PokemonParty;
  readonly onItemUsed: () => void;
}

/**
 * The raid's pack, in the game's own visual language.
 *
 * The screen a player opens under the clock with the hunter somewhere on the
 * map, so it is the one shape every other screen in the game already is (see
 * the `Pixel UI` block of `src/style.css`) and is read in one look: every
 * pocket at once on the left, filling the width it has, and the squares the
 * pack actually is on the right, with the pointed-at item's own blocks lit.
 *
 * The cursor is the selection, as it is everywhere else here - there is no
 * second highlighted row - so the whole of using a Potion is four presses:
 * open, point, Enter, point, Enter.
 */
export class BagScene extends Phaser.Scene {
  private bag!: Bag;
  private party!: PokemonParty;
  private onItemUsed!: () => void;
  /** The item whose recipient list is open, if one is. */
  private usingItemId?: string;
  /**
   * The party member chosen to read the disc that is open, before TEACH is
   * pressed. Choosing is not teaching: the card is marked and the bar asks.
   */
  private pupilIndex?: number;
  /** Said once, over the help bar, about what just happened. */
  private status?: string;
  private menuOverlay?: MenuOverlay;
  /**
   * The pack is the player's to lay out here too: a coil of rope found in a
   * wood is the one moment the room in the bag is a decision, and the bag is
   * one key away from it. Built on first use rather than as a field, because a
   * Phaser scene is not guaranteed to have been constructed before `init`.
   */
  private arrangingValue: GridArranging | undefined;

  private get arranging(): GridArranging {
    this.arrangingValue ??= new GridArranging({
      packing: () => this.bag.layout(),
      commit: (_name, arrangement) => {
        this.bag.arrange(arrangement);
        this.onItemUsed();
        this.render();
      },
      redraw: () => this.render(),
      say: (message) => {
        this.status = message;
        this.render();
      },
      sound: (kind) =>
        audioManager.play(kind === 'refused' ? 'denied' : kind === 'take' ? 'menuOpen' : 'select'),
    });
    return this.arrangingValue;
  }

  public constructor() {
    super('bag');
  }

  public init(data: BagSceneData): void {
    this.bag = data.bag;
    this.party = data.party;
    this.onItemUsed = data.onItemUsed;
    this.usingItemId = undefined;
    this.pupilIndex = undefined;
    this.status = undefined;
    this.arranging.release();
  }

  public create(): void {
    this.menuOverlay = new MenuOverlay(this, 'bag-menu pixel-ui', (event) => this.handleKey(event));
    this.menuOverlay.root.setAttribute('aria-label', 'Raid pack');
    // Every Enter on this screen gives something to somebody, so the pointer
    // only previews: resting it on a Pokemon must never make that Pokemon the
    // one the Potion or the disc is about to go to (`ui/pointerPreview.ts`).
    this.menuOverlay.pointerRule = 'previews';
    // Lighting the pointed-at item's squares is a class on a block, not a
    // render: the cursor moves on every arrow key and a rebuilt screen would
    // cost the player a beat each time.
    // Both listeners sit on the overlay root and die with it: `MenuOverlay`
    // removes itself from the page on the scene's own shutdown, so there is
    // nothing here for a `close()` to take down by hand.
    this.menuOverlay.root.addEventListener('focusin', (event) => {
      const control = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-item]') : null;
      this.markPack(control?.dataset.item);
    });
    // A square in the pack and the row above it are the same thing asked about
    // two ways (`ui/hoverDescribe.ts`), so pointing at one answers for the
    // other: an item's square moves the cursor to its row, and a Pokemon being
    // carried home - which has no row, because it is not a supply - says what
    // it is on the help line and lights its own blocks.
    this.menuOverlay.root.addEventListener('mouseover', (event) => this.pointAtPack(event));
    this.render();
  }

  private handleKey(event: KeyboardEvent): void {
    // A piece in the player's hand owns the arrow keys, R, ENTER and ESC: ESC
    // puts it back where it came from rather than shutting the bag on it.
    if (this.arranging.handleKey(event, document.activeElement)) {
      event.preventDefault();
      return;
    }
    // B is what opened this, so B is what the player will press to leave it.
    if (isOverlayDismissKey(event, 'b', 'Backspace')) {
      event.preventDefault();
      if (this.pupilIndex !== undefined) {
        audioManager.play('cancel');
        this.unchoosePupil();
      } else if (this.usingItemId) {
        audioManager.play('cancel');
        this.stopUsing();
      } else {
        this.close();
      }
      return;
    }
    if (this.menuOverlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /**
   * `prefer` is where the cursor should land when the control it was on has
   * gone - the last Potion used up, the recipient list closing again. The
   * cursor is otherwise put straight back where it was.
   */
  private render(prefer: readonly string[] = []): void {
    const root = this.menuOverlay!.root;
    const using = this.usingItem;
    // A message is about the press that caused this render and is spent on it:
    // the next press is answered by the help bar again, as everywhere else.
    const status = this.status;
    this.status = undefined;
    const machine = using ? machineForItem(using) : undefined;
    root.innerHTML = pixelScreen(
      using && machine
        ? {
            title: 'Teach a move',
            back: { label: 'Pack', attribute: 'data-teach-back' },
            body: teachBody({
              item: using,
              machine,
              party: this.party.pokemon,
              carried: this.bag.count(using.id),
              chosen: this.pupilIndex ?? null,
            }),
            hints:
              this.pupilIndex === undefined
                ? 'ARROWS move · ENTER choose who learns it · ESC back to the pack'
                : 'ENTER teach · ESC choose someone else',
            status,
          }
        : {
            title: 'Pack',
            back: { label: 'Raid', attribute: 'data-close' },
            // No aside: the one number this screen turns on is the squares, and the
            // container itself carries it on the lid over the picture of them.
            body: using ? this.recipientBody(using) : this.pocketBody(),
            hints: using
              ? 'ARROWS move · ENTER give it · ESC back to the pack'
              : 'ARROWS move · ENTER use · ESC back to the raid',
            status,
          },
    );
    const on = (selector: string, handler: (button: HTMLButtonElement) => void): void => {
      root.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        button.onclick = () => handler(button);
      });
    };
    this.arranging.attach(root);
    on('[data-close]', () => this.close());
    on('[data-tidy]', () => {
      this.bag.tidy();
      this.arranging.release();
      this.onItemUsed();
      audioManager.play('select');
      this.render();
    });
    on('[data-item]', (button) => this.pressItem(button.dataset.item!));
    on('[data-drop]', (button) => this.dropOne(button.dataset.drop!));
    on('[data-target]', (button) => this.giveTo(Number(button.dataset.target)));
    on('[data-pupil]', (button) => this.choosePupil(Number(button.dataset.pupil)));
    on('[data-teach]', () => this.teachPupil());
    on('[data-teach-cancel]', () => {
      audioManager.play('cancel');
      this.unchoosePupil();
    });
    on('[data-teach-back]', () => {
      audioManager.play('cancel');
      this.stopUsing();
    });
    this.menuOverlay!.refocus(...prefer, ...bagFocusPreference({ choosingPokemon: Boolean(using), teaching: Boolean(machine) }));
  }

  /** Every pocket at once, and the squares they are packed into beside them. */
  private pocketBody(): string {
    const rows = POCKETS.flatMap((pocket) => {
      const items = this.bag.itemsInCategory(pocket);
      return items.length === 0
        ? []
        : [
            `<h3 class="px-subheading">${ITEM_CATEGORY_LABELS[pocket]}</h3>`,
            ...items.map((item) => this.itemRow(item)),
          ];
    }).join('');
    const details = POCKETS.flatMap((pocket) => this.bag.itemsInCategory(pocket))
      .map((item, index) => this.itemDetail(item, index === 0))
      .join('');
    const carried = pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.supply)}>${
        rows || '<p class="px-empty">The pack is empty. Whatever is on the ground out there is all you have.</p>'
      }</div>${details}`,
      { className: 'raid-pockets', heading: 'Carried', note: `${this.kinds} kinds` },
    );
    return `<main class="px-body raid-bag-layout">${carried}<div class="raid-bag-side">${this.packWindow()}</div></main>`;
  }

  private itemRow(item: ItemDefinition): string {
    const help = `${item.displayName}: ${item.description} ${useLabel(item)}`;
    return `<button class="px-row has-icon" data-item="${item.id}" data-shows="${item.id}" data-describes="${describeKey('item', item.id)}" data-help="${escapeAttribute(help)}">${itemIcon(item.id, item.displayName)}<span class="px-row-main"><strong class="px-name">${item.displayName}</strong></span>${pocketTag(item)}<span class="px-tag">${itemCountTag(item.id, this.bag.count(item.id))}</span></button>`;
  }

  /**
   * What the pointed-at thing is, under the list: the sentence on the item and
   * the room it is taking, which is the pack's own currency, plus the one deed
   * that is not the row's own Enter.
   */
  private itemDetail(item: ItemDefinition, first: boolean): string {
    const shows = `data-shows="${item.id}"`;
    const squares = this.squares(item.id);
    const freed = squares === 1 ? '1 square' : `${squares} squares`;
    const drop = `<button class="px-window px-chip" data-drop="${item.id}" ${shows} data-help="${escapeAttribute(
      `Put one ${item.displayName} on the ground for good. It frees ${freed}.`,
    )}">Drop one</button>`;
    return `<div class="px-detail" data-shown-by="${item.id}"${first ? '' : ' hidden'}><span class="px-wrap">${item.description}</span><div class="care-options"><small class="px-label">${this.bag.count(item.id)} carried · ${freed} each</small>${drop}</div></div>`;
  }

  /**
   * Who is getting a Potion. The pocket list gives way to the party rather than
   * standing beside it, because at this point there is exactly one question on
   * the screen and the pack is still drawn alongside to answer the other one.
   * A disc is not given this way: it has a screen of its own (`teachBody`),
   * because what it does depends on who reads it.
   */
  private recipientBody(item: ItemDefinition): string {
    const rows = this.party.pokemon
      .map((pokemon, index) => {
        const note = this.targetNote(pokemon);
        return `<button class="px-row" data-target="${index}" data-item="${item.id}" data-help="${escapeAttribute(
          `Use ${item.displayName} on ${pokemon.base.name}. ${note}`,
        )}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${pokemon.base.name}</strong>${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}</span><small>${conditionLine(pokemon)}</small></span><span class="px-tag">${note}</span></button>`;
      })
      .join('');
    const list = pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${
        rows || '<p class="px-empty">Nobody is deployed.</p>'
      }</div>`,
      {
        className: 'raid-pockets',
        heading: `Use ${item.displayName} on`,
        note: `${this.bag.count(item.id)} carried`,
      },
    );
    return `<main class="px-body raid-bag-layout">${list}<div class="raid-bag-side">${this.packWindow()}</div></main>`;
  }

  /**
   * The pack, drawn as the squares it is. It stands beside the list rather than
   * over it because the question it answers - how much room is left - is the
   * one the screen is opened with when there is a crate on the ground outside.
   */
  private packWindow(): string {
    const grid = pixelGrid(this.bag.layout(), (itemId) => itemIcon(itemId), {
      label: 'The raid pack',
      arrange: { name: 'pack', ghost: this.arranging.ghostFor('pack'), help: ARRANGE_HELP },
    });
    // TIDY is the automatic pack made into a deed rather than the only
    // behaviour there is, and it says what it will do because it throws away an
    // arrangement somebody made.
    const tidy = `<div class="px-grid-bar"><button class="px-window px-chip" data-tidy data-help="${escapeAttribute(
      'Pack the bag again from scratch, turning pieces on their side where that is what makes the mix fit. It replaces how you have laid it out.',
    )}">Tidy</button></div>`;
    return pixelWindow(`${grid}${tidy}`, {
      className: 'pack-window',
      heading: 'Pack',
      note: this.packLabel(),
    });
  }

  /** Lights the blocks one thing is standing on, without rebuilding the screen. */
  private markPack(itemId: string | undefined, kind = 'item'): void {
    const key = itemId === undefined ? null : describeKey(kind, itemId);
    this.menuOverlay?.root.querySelectorAll<HTMLElement>('.px-grid-block').forEach((block) => {
      block.classList.toggle('is-marked', key !== null && block.dataset.describes === key);
    });
  }

  /**
   * The pointer resting on the pocket list or the pack. A row and the squares
   * it takes up are the same thing asked about two ways (`ui/hoverDescribe.ts`),
   * so pointing at either lights the squares and reads the row's own line on
   * the help bar - and moves no cursor, because this screen's pointer only
   * previews (`ui/pointerPreview.ts`). A piece of cargo has no row, so it
   * answers on the help line itself. Pointing at nothing puts the squares back
   * on whatever the cursor is on.
   */
  private pointAtPack(event: Event): void {
    const root = this.menuOverlay?.root;
    // A piece in the hand owns the grid: lighting another while one is being
    // carried would say the wrong thing about where it is going.
    if (!root || this.arranging.held) {
      return;
    }
    const pointed = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-describes]') : null;
    if (!pointed?.dataset.describes) {
      this.markPack(this.cursorItem());
      return;
    }
    const { kind, id } = splitDescribeKey(pointed.dataset.describes);
    const line = root.querySelector<HTMLElement>('[data-help-text]');
    if (kind === 'item') {
      this.markPack(id);
      const row = root.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`);
      if (line && row?.dataset.help && pointed.classList.contains('px-grid-block')) {
        line.textContent = row.dataset.help;
      }
      return;
    }
    const piece = this.bag.layout().cargo.find((placement) => placement.cargoId === id);
    if (!piece) {
      return;
    }
    this.markPack(id, 'cargo');
    if (line) {
      const squares = piece.width * piece.height;
      line.textContent = `${piece.name} is riding home in your pack, and is only yours once the raid banks. ${squares} squares.`;
    }
  }

  /** The item whose row the cursor is on, if it is on one. */
  private cursorItem(): string | undefined {
    const active = document.activeElement;
    return active instanceof HTMLElement && this.menuOverlay?.root.contains(active)
      ? active.closest<HTMLElement>('[data-item]')?.dataset.item
      : undefined;
  }

  /** What the row on the recipient list says on its end: the HP a Potion is for. */
  private targetNote(pokemon: Pokemon): string {
    return `${pokemon.currentHp}/${pokemon.maxHp} HP`;
  }

  /** The row's own press: open the recipient list, or say why there is nobody to open it for. */
  private pressItem(itemId: string): void {
    const item = this.itemById(itemId);
    if (!item) {
      return;
    }
    if (USELESS_IN_THE_FIELD.has(item.effect.type)) {
      audioManager.play('denied');
      this.status = `${item.displayName}: ${useLabel(item)}`;
      this.render();
      return;
    }
    if (item.category === ItemCategory.Held) {
      audioManager.play('denied');
      this.status = `Gear is given on the PARTY screen, where the Pokémon that would carry it is.`;
      this.render();
      return;
    }
    this.usingItemId = itemId;
    this.status = undefined;
    this.render();
  }

  /**
   * ENTER or a click on a party member's card: marks them as the one to learn
   * the disc and asks, rather than reading it. A card that cannot read it says
   * why and chooses nothing.
   */
  private choosePupil(index: number): void {
    const item = this.usingItem;
    const machine = item ? machineForItem(item) : undefined;
    const pokemon = this.party.pokemon[index];
    if (!machine || !pokemon) {
      return;
    }
    if (!canChoosePupil(pupilVerdict(machine, pokemon))) {
      audioManager.play('denied');
      this.status = `${pokemon.base.name.toUpperCase()}: ${pupilOutcome(machine, pokemon)}`;
      this.render();
      return;
    }
    audioManager.play('select');
    this.pupilIndex = index;
    this.render();
    // The next thing to press is TEACH, so the cursor goes there; the card
    // stays marked and in view, and the bar says who and what.
    this.menuOverlay?.focus('[data-teach]');
    requestAnimationFrame(() =>
      this.menuOverlay?.root.querySelector('.teach-pupil.is-selected')?.scrollIntoView({ block: 'nearest' }),
    );
  }

  /** Cancel: nobody is chosen, and the cursor goes back to the card that was. */
  private unchoosePupil(): void {
    const was = this.pupilIndex;
    this.pupilIndex = undefined;
    this.status = undefined;
    this.render();
    if (was !== undefined) {
      this.menuOverlay?.focus(`[data-pupil="${was}"]`);
    }
  }

  /** TEACH: the one press that reads the disc. */
  private teachPupil(): void {
    const item = this.usingItem;
    const target = this.pupilIndex === undefined ? undefined : this.party.pokemon[this.pupilIndex];
    if (!item || !target) {
      audioManager.play('denied');
      return;
    }
    this.readMachine(item, target);
  }

  private stopUsing(): void {
    const wasUsing = this.usingItemId;
    this.usingItemId = undefined;
    this.pupilIndex = undefined;
    this.status = undefined;
    this.render(wasUsing ? [`[data-item="${wasUsing}"]`] : []);
  }

  private giveTo(index: number): void {
    const target = this.party.pokemon[index];
    const item = this.usingItem;
    if (!target || !item) {
      return;
    }
    const result = useFieldItem(item, target);
    audioManager.play(result.used ? 'heal' : 'denied');
    if (result.used) {
      this.spend(item);
    }
    this.usingItemId = undefined;
    this.status = result.message;
    this.render([`[data-item="${item.id}"]`]);
  }

  /**
   * Reads a disc to one Pokemon.
   *
   * The rule is `teachFromMachine`; all this adds is the screen the third
   * answer needs. A full moveset opens the move chooser from PR #118 - the same
   * one a level-up opens, because it was written against a Pokemon and a move
   * for exactly this - with no "decide later" on offer: the disc is in your hand
   * now, and a queued move riding home with nothing spent would be a TM used up
   * by a decision the player never made. Nothing is spent unless a move is
   * actually learned, so backing out of the chooser leaves the disc in the pack.
   */
  private readMachine(item: ItemDefinition, target: Pokemon): void {
    const outcome = teachFromMachine(item, target);
    if (outcome.kind !== 'choose') {
      this.settleTeaching(item, outcome.kind === 'learned', outcome.machineIsSpent, outcome.message);
      return;
    }
    const source = `${outcome.machine.number} ${outcome.move.name}`;
    openMoveChooser(this, { pokemon: target, incoming: outcome.move, canDefer: false, source, spendsSource: !outcome.machine.reusable }, (choice) => {
      const result = target.resolvePendingMove(
        outcome.move,
        choice.kind === 'forget' ? choice.index : null,
      );
      const forgotten = result?.forgotten ?? null;
      this.settleTeaching(
        item,
        forgotten !== null,
        forgotten !== null && !outcome.machine.reusable,
        moveChoiceMessage(target.base.name, outcome.move, forgotten),
      );
    });
  }

  /**
   * The end of a reading, whichever way it went. The disc leaves the pack only
   * when a move was learned *and* the machine is used up by it, so an HM and a
   * refusal both leave the pack as it was.
   */
  private settleTeaching(item: ItemDefinition, learned: boolean, spend: boolean, message: string): void {
    audioManager.play(learned ? 'heal' : 'denied');
    if (spend) {
      this.spend(item);
    } else if (learned) {
      this.onItemUsed();
    }
    this.usingItemId = undefined;
    this.pupilIndex = undefined;
    this.status = message;
    this.render([`[data-item="${item.id}"]`]);
  }

  /** Takes one of an item out of the pack. */
  private spend(item: ItemDefinition): void {
    this.bag.remove(item.id);
    this.onItemUsed();
  }

  /** Puts one of the chosen item on the ground, and says the room it bought. */
  private dropOne(itemId: string): void {
    const item = this.itemById(itemId);
    if (!item || !this.bag.remove(item.id)) {
      return;
    }
    audioManager.play('menuClose');
    this.onItemUsed();
    this.status = `Dropped ${item.displayName}. ${this.packLabel()}.`;
    this.render([`[data-item="${item.id}"]`]);
  }

  private close(): void {
    audioManager.play('menuClose');
    this.scene.stop();
    this.scene.resume('world');
  }

  private get carried(): readonly ItemDefinition[] {
    return POCKETS.flatMap((pocket) => this.bag.itemsInCategory(pocket));
  }

  private get kinds(): number {
    return this.carried.length;
  }

  private itemById(itemId: string): ItemDefinition | undefined {
    return this.carried.find((item) => item.id === itemId);
  }

  private get usingItem(): ItemDefinition | undefined {
    return this.usingItemId === undefined ? undefined : this.itemById(this.usingItemId);
  }

  private packLabel(): string {
    const layout = this.bag.layout();
    const total = this.bag.capacity === null ? layout.cellsTotal : gridCells(this.bag.capacity);
    return `${layout.cellsUsed}/${total} squares`;
  }

  private squares(itemId: string): number {
    const footprint = footprintOf(itemId);
    return footprint.width * footprint.height;
  }
}
