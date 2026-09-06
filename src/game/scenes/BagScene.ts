import Phaser from 'phaser';
import { ItemCategory, useFieldItem, type Bag, type ItemDefinition } from '../items';
import type { PokemonParty } from '../pokemon';

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
      CATEGORIES.map((category, index) => `${index === this.categoryIndex ? '▶' : ' '} ${category.toUpperCase()}`)
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
    return { color: '#f8f5d7', fontFamily: 'monospace', fontSize, lineSpacing: 3 };
  }

  private headingStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { color: '#8ed4c2', fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold' };
  }
}
