import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import {
  canBeTaught,
  footprintOf,
  gridCells,
  ITEM_CATEGORY_LABELS,
  ItemCategory,
  machineForItem,
  teachFromMachine,
  useFieldItem,
  type Bag,
  type GridPacking,
  type ItemDefinition,
} from '../items';
import type { Pokemon, PokemonParty } from '../pokemon';
import { moveChoiceMessage } from '../ui/moveChooser';
import { openMoveChooser } from '../ui/MoveChooserOverlay';
import { itemIcon } from '../ui/icons';
import { MenuOverlay, hpBar, pokemonAvatar } from '../ui/MenuOverlay';
import { bagFocusPreference } from '../ui/menuFocus';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { GAME_FONT } from '../ui/gameFont';

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 240;
const CATEGORIES = [ItemCategory.Medicine, ItemCategory.PokeBall, ItemCategory.Misc] as const;

interface BagSceneData {
  readonly bag: Bag;
  readonly party: PokemonParty;
  readonly onItemUsed: () => void;
}

export class BagScene extends Phaser.Scene {
  private bag!: Bag;
  private party!: PokemonParty;
  private onItemUsed!: () => void;
  private categoryIndex = 0;
  private selectedItemIndex = 0;
  private selectedPokemonIndex = 0;
  private choosingPokemon = false;
  private itemText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private partyText!: Phaser.GameObjects.Text;
  private footerText!: Phaser.GameObjects.Text;
  private menuOverlay?: MenuOverlay;

  public constructor() {
    super('bag');
  }

  public init(data: BagSceneData): void {
    this.bag = data.bag;
    this.party = data.party;
    this.onItemUsed = data.onItemUsed;
    this.categoryIndex = 0;
    this.selectedItemIndex = 0;
    this.selectedPokemonIndex = 0;
    this.choosingPokemon = false;
  }

  public create(): void {
    this.createModernMenu();
    return;
    this.drawBackground();
    this.itemText = this.add.text(14, 46, '', this.textStyle());
    this.detailText = this.add.text(166, 47, '', this.textStyle('9px'));
    this.partyText = this.add.text(166, 125, '', this.textStyle('9px'));
    this.footerText = this.add.text(SCREEN_WIDTH / 2, 228, '', {
      ...this.textStyle('8px'),
      align: 'center',
    }).setOrigin(0.5);
    this.bindInput();
    this.refresh();
  }

  private createModernMenu(): void {
    this.menuOverlay = new MenuOverlay(this, 'bag-menu', (event) => {
      // B is what opened this, so B is what the player will press to leave it.
      if (isOverlayDismissKey(event, 'b', 'Backspace')) {
        event.preventDefault();
        if (this.choosingPokemon) { this.choosingPokemon = false; this.renderModernMenu(); } else this.close();
        return;
      }
      const buttons = [...this.menuOverlay!.root.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && buttons.length) {
        event.preventDefault();
        buttons[(current + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    });
    this.renderModernMenu();
  }

  private renderModernMenu(message?: string, itemJustChosen = false): void {
    const item = this.selectedItem;
    // Dropping is the other half of a pack with a size: a crate on the ground
    // is only a decision if something in here can come out to make room for it.
    const drop = item
      ? `<button class="button" data-drop>Drop one</button>`
      : '';
    const detail = item ? `<section class="bag-detail"><p class="eyebrow">${ITEM_CATEGORY_LABELS[item.category]}</p><h2>${item.displayName}</h2><p>${item.description}</p><div class="item-count">${this.bag.count(item.id)} carried · ${this.squareLabel(item.id)} each</div>${this.choosingPokemon ? `<h3>Choose a Pokémon</h3><div class="entity-list">${this.party.pokemon.map((pokemon, index) => `<button class="entity-row selectable" data-target="${index}">${pokemonAvatar(pokemon.base.dexId, pokemon.base.name)}<div><strong>${pokemon.base.name}</strong><small>${this.targetNote(item, pokemon)}</small>${hpBar(pokemon.currentHp, pokemon.maxHp)}</div></button>`).join('')}</div>` : `<div class="bag-actions"><button class="button primary-button" data-use ${item.effect.type === 'capture-modifier' || item.effect.type === 'material' ? 'disabled' : ''}>${item.effect.type === 'capture-modifier' ? 'Battle use only' : item.effect.type === 'material' ? 'For the Outfitter' : item.effect.type === 'machine' ? 'Read to a Pokémon' : 'Use item'}</button>${drop}</div>`}</section>` : '<section class="bag-detail"><p class="empty-state">Try another pocket.</p></section>';
    this.menuOverlay!.root.innerHTML = `<div class="menu-shell"><header class="menu-header"><button class="back-button" data-close>← Back to game</button><div><p class="eyebrow">Run supplies</p><h1>Bag</h1></div><p class="stash-count">${this.packLabel()}</p></header><main class="bag-layout">${this.packPanel(item?.id)}<section class="bag-list"><nav class="category-tabs">${CATEGORIES.map((category, index) => `<button class="${index === this.categoryIndex ? 'active' : ''}" data-category="${index}">${ITEM_CATEGORY_LABELS[category]}</button>`).join('')}</nav><div class="entity-list">${this.currentItems.map((entry, index) => `<button class="entity-row selectable ${index === this.selectedItemIndex ? 'selected' : ''}" data-item-index="${index}">${itemIcon(entry.id, entry.displayName)}<div><strong>${entry.displayName}</strong><small>${this.bag.count(entry.id)} carried · ${this.squareLabel(entry.id)}</small></div></button>`).join('') || '<p class="empty-state">Nothing in this pocket.</p>'}</div></section>${detail}</main>${message ? `<p class="menu-status">${message}</p>` : ''}</div>`;
    this.menuOverlay!.root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close();
    this.menuOverlay!.root.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) => button.onclick = () => { this.categoryIndex = Number(button.dataset.category); this.selectedItemIndex = 0; this.renderModernMenu(); });
    this.menuOverlay!.root.querySelectorAll<HTMLButtonElement>('[data-item-index]').forEach((button) => button.onclick = () => { this.selectedItemIndex = Number(button.dataset.itemIndex); this.renderModernMenu(undefined, true); });
    this.menuOverlay!.root.querySelector<HTMLButtonElement>('[data-use]')?.addEventListener('click', () => { this.choosingPokemon = true; this.renderModernMenu(); });
    this.menuOverlay!.root.querySelector<HTMLButtonElement>('[data-drop]')?.addEventListener('click', () => this.dropSelected());
    this.menuOverlay!.root.querySelectorAll<HTMLButtonElement>('[data-target]').forEach((button) => button.onclick = () => {
      const target = this.party.pokemon[Number(button.dataset.target)];
      const selectedItem = this.selectedItem;
      if (!target || !selectedItem) return;
      if (machineForItem(selectedItem)) { this.readMachine(selectedItem, target); return; }
      const result = useFieldItem(selectedItem, target);
      audioManager.play(result.used ? 'heal' : 'denied');
      if (result.used) { this.spend(selectedItem); }
      this.choosingPokemon = false; this.renderModernMenu(result.message);
    });
    this.menuOverlay!.focus(...bagFocusPreference({ choosingPokemon: this.choosingPokemon, itemJustChosen }));
  }

  /**
   * What the party row says under the name while a target is being chosen. For
   * a machine that is not the HP - it is whether this Pokemon can read the disc
   * at all, because that is the only question the screen is open to answer, and
   * a refusal a player meets before committing is a refusal they can act on.
   */
  private targetNote(item: ItemDefinition, pokemon: Pokemon): string {
    const machine = machineForItem(item);
    if (!machine) {
      return `${pokemon.currentHp}/${pokemon.maxHp} HP`;
    }
    if (pokemon.moves.some((known) => known.base === machine.move)) {
      return `Already knows ${machine.move.name}`;
    }
    return canBeTaught(item, pokemon)
      ? `Can learn ${machine.move.name}`
      : `Cannot learn ${machine.move.name}`;
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
    openMoveChooser(this, { pokemon: target, incoming: outcome.move, canDefer: false }, (choice) => {
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
    this.choosingPokemon = false;
    this.renderModernMenu(message);
  }

  /** Takes one of an item out of the pack and keeps the cursor on a row that exists. */
  private spend(item: ItemDefinition): void {
    this.bag.remove(item.id);
    this.onItemUsed();
    this.selectedItemIndex = Math.min(this.selectedItemIndex, Math.max(0, this.currentItems.length - 1));
  }

  /**
   * The pack itself, drawn as the squares it is, with the pointed-at item's own
   * blocks marked. It is above the pockets rather than beside them because the
   * question it answers - how much room is left - is the one the whole screen is
   * opened to ask when a crate is on the ground outside.
   */
  private packPanel(highlight?: string): string {
    const layout = this.bag.layout();
    return `<section class="bag-pack"><header><h2>Pack</h2><p>${this.packLabel()}</p></header>${this.gridMarkup(layout, highlight)}</section>`;
  }

  private packLabel(): string {
    const layout = this.bag.layout();
    const total = this.bag.capacity === null ? layout.cellsTotal : gridCells(this.bag.capacity);
    return `${layout.cellsUsed}/${total} squares`;
  }

  private squareLabel(itemId: string): string {
    const footprint = footprintOf(itemId);
    const squares = footprint.width * footprint.height;
    return squares === 1 ? '1 square' : `${squares} squares`;
  }

  private gridMarkup(layout: GridPacking, highlight?: string): string {
    const cells = new Array(layout.size.width * layout.size.height).fill('<i></i>').join('');
    const blocks = layout.placements
      .map((placement) => {
        const marked = highlight === placement.itemId ? ' marked' : '';
        const count = placement.quantity > 1 ? `<b>${placement.quantity}</b>` : '';
        return `<span class="raid-grid-block${marked}" style="grid-column:${placement.x + 1}/span ${placement.width};grid-row:${placement.y + 1}/span ${placement.height}">${itemIcon(placement.itemId)}${count}</span>`;
      })
      .join('');
    return `<div class="raid-grid" style="--cols:${layout.size.width};--rows:${layout.size.height}"><div class="raid-grid-cells" aria-hidden="true">${cells}</div><div class="raid-grid-blocks">${blocks}</div></div>`;
  }

  /** Puts one of the chosen item on the ground, and says the room it bought. */
  private dropSelected(): void {
    const item = this.selectedItem;
    if (!item || !this.bag.remove(item.id)) {
      return;
    }
    audioManager.play('menuClose');
    this.onItemUsed();
    this.selectedItemIndex = Math.min(this.selectedItemIndex, Math.max(0, this.currentItems.length - 1));
    this.renderModernMenu(`Dropped ${item.displayName}. ${this.packLabel()}.`);
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x09172a);
    graphics.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    graphics.fillStyle(0x122d45);
    graphics.fillRect(0, 20, SCREEN_WIDTH, SCREEN_HEIGHT - 20);
    graphics.lineStyle(2, 0x8ed4c2);
    graphics.strokeRect(6, 6, SCREEN_WIDTH - 12, SCREEN_HEIGHT - 12);
    graphics.lineStyle(1, 0x31566a);
    graphics.strokeRect(157, 37, 150, 178);
    this.add.text(14, 11, 'BAG', this.headingStyle());
    this.add.text(166, 11, 'ITEM INFO', this.headingStyle());
  }

  private bindInput(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is not available.');
    }

    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ESC,
      Phaser.Input.Keyboard.KeyCodes.BACKSPACE,
    ]);
    this.input.keyboard.on('keydown-UP', () => this.moveSelection(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.moveSelection(1));
    this.input.keyboard.on('keydown-LEFT', () => this.changeCategory(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.changeCategory(1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.input.keyboard.on('keydown-BACKSPACE', () => this.close());
  }

  private changeCategory(direction: number): void {
    if (this.choosingPokemon) {
      return;
    }
    this.categoryIndex = (this.categoryIndex + direction + CATEGORIES.length) % CATEGORIES.length;
    this.selectedItemIndex = 0;
    this.refresh();
  }

  private moveSelection(direction: number): void {
    if (this.choosingPokemon) {
      const count = this.party.pokemon.length;
      if (count > 0) {
        this.selectedPokemonIndex = (this.selectedPokemonIndex + direction + count) % count;
      }
    } else {
      const count = this.currentItems.length;
      if (count > 0) {
        this.selectedItemIndex = (this.selectedItemIndex + direction + count) % count;
      }
    }
    this.refresh();
  }

  private confirm(): void {
    const item = this.selectedItem;
    if (!item) {
      return;
    }

    if (!this.choosingPokemon) {
      if (item.effect.type === 'capture-modifier') {
        this.detailText.setText(`${item.displayName}\n\n${item.description}\n\nIt can only be used\nin battle.`);
        return;
      }
      if (item.effect.type === 'material') {
        this.detailText.setText(`${item.displayName}\n\n${item.description}\n\nBring it home:\nit is for the Outfitter.`);
        return;
      }
      this.choosingPokemon = true;
      this.selectedPokemonIndex = 0;
      this.refresh();
      return;
    }

    const pokemon = this.party.pokemon[this.selectedPokemonIndex];
    if (!pokemon) {
      return;
    }
    const result = useFieldItem(item, pokemon);
    if (result.used) {
      this.bag.remove(item.id);
      this.onItemUsed();
      this.selectedItemIndex = Math.min(this.selectedItemIndex, Math.max(0, this.currentItems.length - 1));
    }
    this.choosingPokemon = false;
    this.refresh(result.message);
  }

  private close(): void {
    audioManager.play('menuClose');
    this.scene.stop();
    this.scene.resume('world');
  }

  private get currentCategory(): ItemCategory {
    return CATEGORIES[this.categoryIndex];
  }

  private get currentItems(): readonly ItemDefinition[] {
    return this.bag.itemsInCategory(this.currentCategory);
  }

  private get selectedItem(): ItemDefinition | undefined {
    return this.currentItems[this.selectedItemIndex];
  }

  private refresh(message?: string): void {
    const item = this.selectedItem;
    this.itemText.setText(
      CATEGORIES.map((category, index) => `${index === this.categoryIndex ? '▶' : ' '} ${ITEM_CATEGORY_LABELS[category].toUpperCase()}`)
        .concat('')
        .concat(
          this.currentItems.length === 0
            ? ['  (empty)']
            : this.currentItems.map(
                (entry, index) =>
                  `${!this.choosingPokemon && index === this.selectedItemIndex ? '▶' : ' '} ${entry.displayName} x${this.bag.count(entry.id)}`,
              ),
        )
        .join('\n'),
    );

    this.detailText.setText(
      message ??
        (item
          ? `${item.displayName}\n\n${item.description}\n\n${this.choosingPokemon ? 'Choose a Pokemon.' : 'Select to use.'}`
          : 'No items in this pocket.'),
    );
    this.partyText.setText(
      this.choosingPokemon
        ? `PARTY\n${this.party.pokemon
            .map(
              (pokemon, index) =>
                `${index === this.selectedPokemonIndex ? '▶' : ' '} ${pokemon.base.name}\n   HP ${pokemon.currentHp}/${pokemon.maxHp}`,
            )
            .join('\n')}`
        : '',
    );
    this.footerText.setText(
      this.choosingPokemon
        ? 'UP/DOWN: CHOOSE  ENTER: USE  ESC: BACK'
        : 'LEFT/RIGHT: POCKET  UP/DOWN: SELECT  ENTER: USE  ESC: BACK',
    );
  }

  private textStyle(fontSize = '10px'): Phaser.Types.GameObjects.Text.TextStyle {
    return { color: '#f8f5d7', fontFamily: GAME_FONT, fontSize, lineSpacing: 3 };
  }

  private headingStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { color: '#8ed4c2', fontFamily: GAME_FONT, fontSize: '12px', fontStyle: 'bold' };
  }
}
