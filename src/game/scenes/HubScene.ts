import Phaser from 'phaser';
import { Bag, ITEM_DEFINITIONS, type ItemCategory, type ItemDefinition, type ItemId } from '../items';
import { PokemonParty } from '../pokemon';
import { activeRunManager, type ItemStack, type SecureSlot } from '../run';
import { createActiveRunSession } from '../run/RunSession';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { type SecureSlot as StashSecureSlot, type Stash, type StashedPokemon } from '../stash';

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 240;
const TABS = ['STASH', 'LOADOUT', 'SECURE', 'START RUN'] as const;
const RUN_DURATION_MS = 15 * 60 * 1000;

type HubTab = (typeof TABS)[number];

export interface HubSceneData {
  readonly savedGame?: RestoredGame;
}

export class HubScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private stash!: Stash;
  private savedGame!: RestoredGame;
  private tabIndex = 0;
  private entryIndex = 0;
  private selectedPokemonIds: string[] = [];
  private selectedItems = new Map<ItemId, number>();
  private securedPokemonId: string | undefined;
  private securedItemIds: ItemId[] = [];
  private listText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private footerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private readonly tabTexts: Phaser.GameObjects.Text[] = [];

  public constructor() {
    super('hub');
  }

  public init(data: HubSceneData = {}): void {
    const loaded = data.savedGame ?? this.saveManager.load();
    if (!loaded) {
      throw new Error('HubScene requires a saved game.');
    }

    this.savedGame = loaded;
    this.stash = loaded.stash;
    this.tabIndex = 0;
    this.entryIndex = 0;
    this.selectedPokemonIds = [];
    this.selectedItems.clear();
    this.securedPokemonId = undefined;
    this.securedItemIds = [];
  }

  public create(): void {
    this.tabTexts.length = 0;
    this.drawBackground();
    this.createTabs();
    this.listText = this.add.text(14, 52, '', this.textStyle('9px'));
    this.detailText = this.add.text(171, 52, '', this.textStyle('9px'));
    this.statusText = this.add.text(14, 202, '', this.textStyle('8px'));
    this.footerText = this.add
      .text(SCREEN_WIDTH / 2, 229, '', { ...this.textStyle('8px'), align: 'center' })
      .setOrigin(0.5);
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
    graphics.strokeRect(8, 43, 154, 152);
    graphics.strokeRect(168, 43, 144, 152);
    this.add.text(14, 29, 'PALLET BASE // RAID PREP', this.headingStyle('10px'));
  }

  private createTabs(): void {
    TABS.forEach((tab, index) => {
      const text = this.add
        .text(12 + index * 76, 11, tab, this.textStyle('7px'))
        .setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.POINTER_DOWN, () => {
          this.tabIndex = index;
          this.entryIndex = 0;
          this.refresh();
        });
      this.tabTexts.push(text);
    });
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
    ]);
    this.input.keyboard.on('keydown-UP', () => this.moveEntry(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.moveEntry(1));
    this.input.keyboard.on('keydown-LEFT', () => this.changeTab(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.changeTab(1));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());
  }

  private get tab(): HubTab {
    return TABS[this.tabIndex];
  }

  private get stashPokemon(): readonly StashedPokemon[] {
    return this.stash.listPokemon();
  }

  private get stashItems(): readonly ItemDefinition[] {
    return ITEM_DEFINITIONS.filter((item) => this.stash.itemCount(item.id) > 0);
  }

  private get loadoutPokemon(): readonly StashedPokemon[] {
    return this.selectedPokemonIds
      .map((id) => this.stashPokemon.find((stored) => stored.id === id))
      .filter((stored): stored is StashedPokemon => stored !== undefined);
  }

  private get loadoutItems(): readonly ItemStack[] {
    return [...this.selectedItems].map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  private moveEntry(direction: number): void {
    const count = this.entryCount();
    if (count > 0) {
      this.entryIndex = (this.entryIndex + direction + count) % count;
      this.refresh();
    }
  }

  private changeTab(direction: number): void {
    this.tabIndex = (this.tabIndex + direction + TABS.length) % TABS.length;
    this.entryIndex = 0;
    this.refresh();
  }

  private entryCount(): number {
    switch (this.tab) {
      case 'STASH':
        return this.stashPokemon.length + this.stashItems.length;
      case 'LOADOUT':
        return this.stashPokemon.length + this.stashItems.length;
      case 'SECURE':
        return 1 + this.loadoutPokemon.length + this.loadoutItems.length;
      case 'START RUN':
        return 1;
    }
  }

  private confirm(): void {
    switch (this.tab) {
      case 'LOADOUT':
        this.toggleLoadoutEntry();
        break;
      case 'SECURE':
        this.toggleSecureEntry();
        break;
      case 'START RUN':
        this.startRun();
        break;
      case 'STASH':
        break;
    }
    this.refresh();
  }

  private toggleLoadoutEntry(): void {
    if (this.entryIndex < this.stashPokemon.length) {
      const pokemon = this.stashPokemon[this.entryIndex];
      if (this.selectedPokemonIds.includes(pokemon.id)) {
        this.selectedPokemonIds = this.selectedPokemonIds.filter((id) => id !== pokemon.id);
        if (this.securedPokemonId === pokemon.id) {
          this.securedPokemonId = undefined;
        }
        return;
      }
      if (this.selectedPokemonIds.length < 6) {
        this.selectedPokemonIds.push(pokemon.id);
      } else {
        this.setStatus('Party limit: 6 Pokemon.');
      }
      return;
    }

    const item = this.stashItems[this.entryIndex - this.stashPokemon.length];
    if (!item) {
      return;
    }
    const itemId = item.id as ItemId;
    const nextQuantity = (this.selectedItems.get(itemId) ?? 0) + 1;
    if (nextQuantity > this.stash.itemCount(itemId)) {
      this.selectedItems.delete(itemId);
      this.securedItemIds = this.securedItemIds.filter((id) => id !== itemId);
    } else {
      this.selectedItems.set(itemId, nextQuantity);
    }
  }

  private toggleSecureEntry(): void {
    if (this.entryIndex === 0) {
      this.securedPokemonId = undefined;
      return;
    }
    if (this.entryIndex <= this.loadoutPokemon.length) {
      const pokemon = this.loadoutPokemon[this.entryIndex - 1];
      this.securedPokemonId = this.securedPokemonId === pokemon.id ? undefined : pokemon.id;
      return;
    }

    const item = this.loadoutItems[this.entryIndex - 1 - this.loadoutPokemon.length];
    if (!item) {
      return;
    }
    if (this.securedItemIds.includes(item.itemId)) {
      this.securedItemIds = this.securedItemIds.filter((id) => id !== item.itemId);
    } else if (this.securedItemIds.length < 2) {
      this.securedItemIds.push(item.itemId);
    } else {
      this.setStatus('Secure slot limit: 2 item stacks.');
    }
  }

  private startRun(): void {
    const party = this.loadoutPokemon;
    if (party.length === 0) {
      this.setStatus('Select at least one Pokemon.');
      return;
    }

    const secureSlot = this.runSecureSlot(party);
    activeRunManager.startRun(
      { party: party.map((stored) => stored.pokemon), items: this.loadoutItems },
      { mapId: 'pallet-town', durationMs: RUN_DURATION_MS },
      secureSlot,
    );
    const runSession = createActiveRunSession(
      activeRunManager,
      secureSlot,
      this.stashSecureSlot(),
      this.selectedPokemonIds,
      this.loadoutItems,
    );
    this.scene.start('world', {
      savedGame: this.savedGame,
      party: new PokemonParty(party.map((stored) => stored.pokemon)),
      bag: new Bag(Object.fromEntries(this.loadoutItems.map(({ itemId, quantity }) => [itemId, quantity]))),
      runSession,
    });
  }

  private runSecureSlot(party: readonly StashedPokemon[]): SecureSlot {
    const securedPokemon = party.find((stored) => stored.id === this.securedPokemonId)?.pokemon;
    return {
      ...(securedPokemon === undefined ? {} : { pokemon: securedPokemon }),
      items: this.loadoutItems.filter((item) => this.securedItemIds.includes(item.itemId)),
    };
  }

  private stashSecureSlot(): StashSecureSlot {
    return {
      ...(this.securedPokemonId === undefined ? {} : { pokemonId: this.securedPokemonId }),
      items: this.loadoutItems
        .filter((item) => this.securedItemIds.includes(item.itemId))
        .map(({ itemId, quantity }) => ({ itemId, quantity })),
    };
  }

  private refresh(): void {
    this.tabTexts.forEach((text, index) => {
      const selected = index === this.tabIndex;
      text.setColor(selected ? '#09172a' : '#d6e7ed');
      text.setBackgroundColor(selected ? '#8ed4c2' : '#122d45');
      text.setStyle({ fontStyle: selected ? 'bold' : 'normal' });
    });
    this.entryIndex = Math.min(this.entryIndex, Math.max(0, this.entryCount() - 1));
    this.listText.setText(this.listContent());
    this.detailText.setText(this.detailContent());
    this.footerText.setText(this.footerContent());
  }

  private listContent(): string {
    switch (this.tab) {
      case 'STASH':
        return this.stashLines(false);
      case 'LOADOUT':
        return this.stashLines(true);
      case 'SECURE':
        return this.secureLines();
      case 'START RUN':
        return '\n\n▶ DEPLOY TO PALLET TOWN\n\n   15 MINUTE RAID\n\n   Party and bag contents\n   are at risk on a wipe.';
    }
  }

  private stashLines(showLoadout: boolean): string {
    const title = showLoadout ? 'SELECT FOR RAID' : 'STASH POKEMON';
    const pokemonLines = this.stashPokemon.map((stored, index) => {
      const selected = showLoadout && this.selectedPokemonIds.includes(stored.id);
      return `${this.cursor(index)} ${selected ? '[X]' : '   '} ${this.pokemonLine(stored)}`;
    });
    const itemStart = this.stashPokemon.length;
    const itemLines = this.stashItems.map((item, index) => {
      const selectedQuantity = this.selectedItems.get(item.id as ItemId) ?? 0;
      const count = this.stash.itemCount(item.id);
      return `${this.cursor(itemStart + index)} ${showLoadout ? `[${selectedQuantity}/${count}]` : ` x${count} `} ${item.displayName}`;
    });
    return [title, ...pokemonLines, '', 'ITEMS', ...this.groupItems(itemLines)].join('\n');
  }

  private groupItems(itemLines: readonly string[]): readonly string[] {
    const result: string[] = [];
    let category: ItemCategory | undefined;
    this.stashItems.forEach((item, index) => {
      if (item.category !== category) {
        category = item.category;
        result.push(` ${category.toUpperCase()}`);
      }
      result.push(itemLines[index]);
    });
    return result;
  }

  private secureLines(): string {
    const pokemonLines = this.loadoutPokemon.map(
      (stored, index) =>
        `${this.cursor(index + 1)} ${this.securedPokemonId === stored.id ? 'SECURED ' : '        '}${this.pokemonLine(stored)}`,
    );
    const itemStart = 1 + this.loadoutPokemon.length;
    const itemLines = this.loadoutItems.map(
      (item, index) =>
        `${this.cursor(itemStart + index)} ${this.securedItemIds.includes(item.itemId) ? 'SECURED ' : '        '}${this.itemName(item.itemId)} x${item.quantity}`,
    );
    return [
      'SECURE SLOT',
      `${this.cursor(0)} ${this.securedPokemonId ? 'Clear Pokemon' : 'No Pokemon secured'}`,
      '',
      'POKEMON (ONE)',
      ...(pokemonLines.length ? pokemonLines : ['  Select a raid party first.']),
      '',
      'ITEMS (TWO STACKS)',
      ...(itemLines.length ? itemLines : ['  Select raid items first.']),
    ].join('\n');
  }

  private detailContent(): string {
    if (this.tab === 'START RUN') {
      return [
        'RAID MANIFEST',
        '',
        `PARTY ${this.loadoutPokemon.length}/6`,
        ...this.loadoutPokemon.map((stored) => `- ${stored.pokemon.base.name}`),
        '',
        'RISKED ITEMS',
        ...(this.loadoutItems.length
          ? this.loadoutItems.map((item) => `- ${this.itemName(item.itemId)} x${item.quantity}`)
          : ['- None']),
        '',
        'SECURED',
        `P: ${this.securedPokemonId ? this.securedPokemonName() : 'None'}`,
        `I: ${this.securedItemIds.length ? this.securedItemIds.map((id) => this.itemName(id)).join(', ') : 'None'}`,
      ].join('\n');
    }
    if (this.tab === 'SECURE') {
      return 'SECURED assets survive\nan unsuccessful raid.\n\nChoose up to:\n- 1 deployed Pokemon\n- 2 deployed item stacks\n\nOnly deployed assets\ncan be secured.';
    }
    const selected = this.selectedStashEntry();
    if (!selected) {
      return 'Your stash is empty.';
    }
    if ('pokemon' in selected) {
      const pokemon = selected.pokemon;
      return `${pokemon.base.name.toUpperCase()}\n\nLv.${pokemon.level}\nHP ${pokemon.currentHp}/${pokemon.maxHp}\n\n${pokemon.base.primaryType.toUpperCase()}${pokemon.base.secondaryType ? ` / ${pokemon.base.secondaryType.toUpperCase()}` : ''}\n\n${this.tab === 'LOADOUT' ? 'ENTER: add/remove\nfrom raid party.' : 'Stored safely at base.'}`;
    }
    return `${selected.displayName.toUpperCase()}\n\n${selected.description}\n\nSTASH: x${this.stash.itemCount(selected.id)}\n\n${this.tab === 'LOADOUT' ? 'ENTER: cycles quantity\nfor this raid.' : `CATEGORY:\n${selected.category.toUpperCase()}`}`;
  }

  private selectedStashEntry(): StashedPokemon | ItemDefinition | undefined {
    if (this.entryIndex < this.stashPokemon.length) {
      return this.stashPokemon[this.entryIndex];
    }
    return this.stashItems[this.entryIndex - this.stashPokemon.length];
  }

  private footerContent(): string {
    if (this.tab === 'STASH') {
      return 'LEFT/RIGHT: PAGE  UP/DOWN: BROWSE';
    }
    if (this.tab === 'START RUN') {
      return 'ENTER: START RUN  LEFT/RIGHT: PAGE';
    }
    return 'UP/DOWN: SELECT  ENTER: TOGGLE  LEFT/RIGHT: PAGE';
  }

  private pokemonLine(stored: StashedPokemon): string {
    const pokemon = stored.pokemon;
    return `${pokemon.base.name} Lv${pokemon.level} HP ${pokemon.currentHp}/${pokemon.maxHp}`;
  }

  private itemName(itemId: ItemId): string {
    return ITEM_DEFINITIONS.find((item) => item.id === itemId)?.displayName ?? itemId;
  }

  private securedPokemonName(): string {
    return this.stashPokemon.find((stored) => stored.id === this.securedPokemonId)?.pokemon.base.name ?? 'None';
  }

  private cursor(index: number): string {
    return this.entryIndex === index ? '▶' : ' ';
  }

  private setStatus(message: string): void {
    this.statusText?.setText(message);
    this.time.delayedCall(1600, () => this.statusText?.setText(''));
  }

  private textStyle(fontSize = '9px'): Phaser.Types.GameObjects.Text.TextStyle {
    return { color: '#f8f5d7', fontFamily: 'monospace', fontSize, lineSpacing: 2 };
  }

  private headingStyle(fontSize = '12px'): Phaser.Types.GameObjects.Text.TextStyle {
    return { color: '#8ed4c2', fontFamily: 'monospace', fontSize, fontStyle: 'bold' };
  }
}
