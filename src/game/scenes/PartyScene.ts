import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { Bag, HELD_ITEM_DEFINITIONS, getHeldItem, type ItemDefinition } from '../items';
import { itemIcon } from '../ui/icons';
import type { Pokemon, PokemonParty } from '../pokemon';
import type { PokemonType } from '../pokemon/PokemonType';
import { MenuOverlay, hpBar, pokemonAvatar, typeBadge } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { GAME_FONT } from '../ui/gameFont';
import { conditionLine } from '../ui/condition';
import {
  cursorMayDescribe,
  describeKey,
  describedKey,
  POINTER_ONLY,
  previewAfterPointer,
} from '../ui/hoverDescribe';

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 240;
const LIST_X = 8;
const LIST_WIDTH = 142;
const DETAIL_X = 156;
const DETAIL_WIDTH = 156;
const CARD_HEIGHT = 31;
const CARD_GAP = 3;
const CARD_START_Y = 29;

const TYPE_COLORS: Partial<Record<PokemonType, string>> = {
  Bug: '#9cab47',
  // Dark and Steel are live from the moment a Charmander reaches 13 or a
  // Wartortle 19, so they need an ink of their own: without one the move row
  // fell back to the same pale default every other listed thing uses, and the
  // one typed move on the screen was the one that did not look typed.
  Dark: '#6f5b52',
  Electric: '#e3c75f',
  Fire: '#d87856',
  Flying: '#9caed8',
  Grass: '#7db65b',
  Normal: '#aaa898',
  Poison: '#a060a8',
  Steel: '#9098a8',
  Water: '#6096d0',
};

interface PartySceneData {
  party: PokemonParty;
  /**
   * The raid's own pack. Gear is given and taken here rather than only at base,
   * because a piece found halfway through a raid is no use to the fight it was
   * found for if it has to be carried home first - and because taking it back
   * off a Pokemon before the run for an exit is the other half of the same
   * decision.
   */
  bag?: Bag;
}

export class PartyScene extends Phaser.Scene {
  private party!: PokemonParty;
  private bag = new Bag();
  private selectedIndex = 0;
  /**
   * What the pointer is on and what the keyboard cursor is on - see
   * `ui/hoverDescribe.ts`. Neither is a selection: pointing at a party member
   * shows their card, and the member the player chose is still the chosen one.
   */
  private pointerDescribe: string | null = null;
  private cursorDescribe: string | null = null;
  private isReordering = false;
  private readonly cardBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private readonly cardSprites: Phaser.GameObjects.Image[] = [];
  private readonly cardTexts: Phaser.GameObjects.Text[] = [];
  private readonly cardHpBars: Phaser.GameObjects.Rectangle[] = [];
  private detailContent!: Phaser.GameObjects.Container;
  private footerText!: Phaser.GameObjects.Text;
  private menuOverlay?: MenuOverlay;

  public constructor() {
    super('party');
  }

  public init(data: PartySceneData): void {
    this.party = data.party;
    // Phaser reuses this scene, so a pack from an earlier raid would otherwise
    // still be the one this screen gives out of.
    this.bag = data.bag ?? new Bag();
    this.selectedIndex = 0;
    this.isReordering = false;
    this.pointerDescribe = null;
    this.cursorDescribe = null;
  }

  public create(): void {
    this.createModernMenu();
    return;
    this.cardBackgrounds.length = 0;
    this.cardSprites.length = 0;
    this.cardTexts.length = 0;
    this.cardHpBars.length = 0;
    this.drawBackground();
    this.createHeading();
    this.createPartyCards();
    this.detailContent = this.add.container(DETAIL_X, 30);
    this.footerText = this.add.text(SCREEN_WIDTH / 2, 231, '', {
      align: 'center',
      color: '#d6e7ed',
      fontFamily: GAME_FONT,
      fontSize: '8px',
    }).setOrigin(0.5);
    this.bindInput();
    this.refresh();
  }

  private createModernMenu(): void {
    this.menuOverlay = new MenuOverlay(this, 'party-menu', (event) => {
      // P is what opened this, so P is what the player will press to leave it.
      if (isOverlayDismissKey(event, 'p', 'Backspace')) {
        event.preventDefault();
        this.close();
        return;
      }
      // Only the controls that are drawn: every member has a card now and all
      // but one is hidden, and focus refuses a hidden control silently - so a
      // cursor that counted them stopped dead on the row above the first one.
      const buttons = [...this.menuOverlay!.root.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
        .filter((button) => button.offsetParent !== null);
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && buttons.length) {
        event.preventDefault();
        buttons[(current + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    });
    this.watchDescribing();
    this.renderModernMenu();
  }

  /**
   * The pointer and the keyboard cursor, each saying which member it is on.
   * Both listeners sit on the overlay root, because every render replaces the
   * rows. See `BagScene.watchDescribing` for the same rule on the same screen's
   * sibling.
   */
  private watchDescribing(): void {
    const root = this.menuOverlay!.root;
    root.addEventListener('mouseover', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      this.setDescribing(
        previewAfterPointer(this.pointerDescribe, {
          on: target?.closest<HTMLElement>('[data-describes]')?.dataset.describes ?? null,
          withinGroup: Boolean(target?.closest('[data-describe-group]')),
        }),
        this.cursorDescribe,
      );
    });
    root.addEventListener('mouseleave', () => this.setDescribing(null, this.cursorDescribe));
    root.addEventListener('focusin', (event) => {
      const control = event.target instanceof Element ? event.target : null;
      const described = control?.closest<HTMLElement>('[data-describes]');
      this.setDescribing(
        this.pointerDescribe,
        described && cursorMayDescribe(described.dataset.describesOn)
          ? described.dataset.describes ?? null
          : null,
      );
    });
  }

  private setDescribing(pointer: string | null, cursor: string | null): void {
    if (pointer === this.pointerDescribe && cursor === this.cursorDescribe) {
      return;
    }
    this.pointerDescribe = pointer;
    this.cursorDescribe = cursor;
    this.showDescribedCard();
  }

  private renderModernMenu(): void {
    // Every member's card is built and all but one hidden, rather than one card
    // rebuilt whenever the answer changes: pointing at a row must not replace
    // markup the pointer could be about to click, and a rebuilt card re-fetches
    // its portrait and flashes.
    const cards = this.party.pokemon
      .map((member, index) => `<section class="party-detail" data-detail-for="${index}" data-describe-group hidden><div class="detail-hero">${pokemonAvatar(member.base.dexId, member.base.name)}<div><p class="eyebrow">Party member</p><h2>${member.base.name}</h2><p>${conditionLine(member)}</p>${hpBar(member.currentHp, member.maxHp)}<div>${typeBadge(member.base.primaryType)}${member.base.secondaryType ? typeBadge(member.base.secondaryType) : ''}</div></div></div><div class="stats-grid"><span><small>HP</small><b>${member.stats.hp}</b></span><span><small>Attack</small><b>${member.stats.attack}</b></span><span><small>Defense</small><b>${member.stats.defense}</b></span><span><small>Speed</small><b>${member.stats.speed}</b></span></div>${this.gearSection(member, index)}<h3>Moves</h3><div class="move-list">${member.moves.map((move) => `<div><strong>${move.base.name}</strong>${typeBadge(move.base.type)}<small>${move.pp}/${move.base.pp} PP</small></div>`).join('') || '<p class="empty-state">No known moves.</p>'}</div></section>`)
      .join('') || '<section class="party-detail"><p class="empty-state">No Pokémon in your party.</p></section>';
    this.menuOverlay!.root.innerHTML = `<div class="menu-shell"><header class="menu-header"><button class="back-button" data-close>← Back to game</button><div><p class="eyebrow">Run team</p><h1>Party</h1></div><p class="stash-count">Point at a member to read them</p></header><main class="party-layout"><section class="party-list" data-describe-group>${this.party.pokemon.map((pokemon, index) => `<button class="entity-row selectable ${index === this.selectedIndex ? 'selected' : ''}" data-member="${index}" data-describes="${describeKey('member', index)}" ${POINTER_ONLY}>${pokemonAvatar(pokemon.base.dexId, pokemon.base.name)}<div><strong>${pokemon.base.name}</strong><small>${conditionLine(pokemon)}${this.heldSuffix(pokemon)}</small>${hpBar(pokemon.currentHp, pokemon.maxHp)}</div></button>`).join('') || '<p class="empty-state">No Pokémon in your party.</p>'}</section>${cards}</main></div>`;
    this.menuOverlay!.root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close();
    this.menuOverlay!.root.querySelectorAll<HTMLButtonElement>('[data-member]').forEach((button) => button.onclick = () => { this.selectedIndex = Number(button.dataset.member); this.renderModernMenu(); });
    // A gear row names the member whose card it is on rather than reading the
    // selection, so a card shown because the pointer is on its row can never
    // hand its gear to somebody else.
    this.menuOverlay!.root.querySelectorAll<HTMLButtonElement>('[data-give-gear]').forEach((button) => button.onclick = () => this.giveGear(Number(button.dataset.gearMember), button.dataset.giveGear!));
    this.menuOverlay!.root.querySelectorAll<HTMLButtonElement>('[data-take-gear]').forEach((button) => button.onclick = () => this.takeGear(Number(button.dataset.gearMember)));
    this.showDescribedCard();
    this.menuOverlay!.focus('[data-member].selected', '[data-member]', '[data-close]');
  }

  /** The member the player chose, which pointing and arrowing never move. */
  private get selectedDescribeKey(): string | null {
    return this.party.pokemon.length ? describeKey('member', this.selectedIndex) : null;
  }

  /**
   * Shows the card for whatever the screen is about now. Nothing is rebuilt -
   * every card is already on the screen and this only says which one is drawn.
   */
  private showDescribedCard(): void {
    const root = this.menuOverlay?.root;
    if (!root) {
      return;
    }
    const cards = [...root.querySelectorAll<HTMLElement>('[data-detail-for]')];
    const known = (key: string | null): string | null =>
      key !== null && cards.some((card) => describeKey('member', card.dataset.detailFor ?? '') === key)
        ? key
        : null;
    const key = describedKey({
      pointer: known(this.pointerDescribe),
      cursor: known(this.cursorDescribe),
      selected: known(this.selectedDescribeKey),
    });
    cards.forEach((card) => {
      card.hidden = describeKey('member', card.dataset.detailFor ?? '') !== key;
    });
  }

  /** What the list row says after the condition, when there is gear to say. */
  private heldSuffix(pokemon: Pokemon): string {
    const held = getHeldItem(pokemon.heldItemId);
    return held ? ` · holding ${held.displayName}` : '';
  }

  /**
   * The gear pocket for one Pokemon: what it is carrying, and what the pack
   * could give it instead.
   *
   * Every control on a card carries that card's own describe key, exactly as a
   * pixel-ui detail pane's controls carry its `data-shows`: without it the
   * cursor landing on a gear button would say "on nothing", the card would go
   * back to the chosen member, and the button the cursor had just reached would
   * be hidden out from under it.
   *
   * One slot, so a give is always a swap - the piece already held goes back into
   * the pack in the same action, and there is never a moment where the player
   * owns two of something or none of it.
   */
  private gearSection(pokemon: Pokemon, memberIndex: number): string {
    const held = getHeldItem(pokemon.heldItemId);
    const offers = HELD_ITEM_DEFINITIONS.filter(
      (item) => this.bag.count(item.id) > 0 && item.id !== pokemon.heldItemId,
    );
    const rows = [
      ...(held
        ? [`<button class="entity-row selectable" data-take-gear="${held.id}" data-gear-member="${memberIndex}" data-describes="${describeKey('member', memberIndex)}">${itemIcon(held.id, held.displayName)}<div><strong>${held.displayName}</strong><small>${held.description} Press to take it back.</small></div></button>`]
        : []),
      ...offers.map(
        (item: ItemDefinition) =>
          `<button class="entity-row selectable" data-give-gear="${item.id}" data-gear-member="${memberIndex}" data-describes="${describeKey('member', memberIndex)}">${itemIcon(item.id, item.displayName)}<div><strong>Give ${item.displayName} ×${this.bag.count(item.id)}</strong><small>${item.description}</small></div></button>`,
      ),
    ];
    return `<h3>Gear</h3><div class="move-list">${
      rows.join('') ||
      '<p class="empty-state">Nothing held, and no gear in the pack. Gear is carried by the trainers holding the gates.</p>'
    }</div>`;
  }

  private giveGear(memberIndex: number, itemId: string): void {
    const pokemon = this.party.pokemon[memberIndex];
    if (!pokemon || this.bag.count(itemId) <= 0 || !this.bag.remove(itemId, 1)) {
      return;
    }
    const displaced = pokemon.giveHeldItem(itemId);
    if (displaced) {
      this.bag.add(displaced, 1);
    }
    audioManager.play('select');
    this.renderModernMenu();
  }

  private takeGear(memberIndex: number): void {
    const taken = this.party.pokemon[memberIndex]?.takeHeldItem();
    if (!taken) {
      return;
    }
    this.bag.add(taken, 1);
    audioManager.play('cancel');
    this.renderModernMenu();
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
    graphics.strokeRect(DETAIL_X - 4, 24, DETAIL_WIDTH + 4, 199);
  }

  private createHeading(): void {
    this.add.text(LIST_X, 11, 'PARTY', {
      color: '#f8f5d7',
      fontFamily: GAME_FONT,
      fontSize: '12px',
      fontStyle: 'bold',
    });
    this.add.text(DETAIL_X, 11, 'SUMMARY', {
      color: '#8ed4c2',
      fontFamily: GAME_FONT,
      fontSize: '12px',
      fontStyle: 'bold',
    });
  }

  private createPartyCards(): void {
    this.party.pokemon.forEach((pokemon, index) => {
      const y = CARD_START_Y + index * (CARD_HEIGHT + CARD_GAP);
      const background = this.add
        .rectangle(LIST_X, y, LIST_WIDTH, CARD_HEIGHT, 0x1e3650)
        .setOrigin(0)
        .setStrokeStyle(1, 0x50758a)
        .setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.POINTER_DOWN, () => {
          this.selectedIndex = index;
          this.isReordering = false;
          this.refresh();
        });
      const sprite = this.add
        .image(LIST_X + 4, y + CARD_HEIGHT / 2, `pokemon-front-${pokemon.base.dexId}`)
        .setDisplaySize(26, 26)
        .setOrigin(0, 0.5);
      const text = this.add.text(LIST_X + 34, y + 4, '', {
        color: '#f8f5d7',
        fontFamily: GAME_FONT,
        fontSize: '8px',
        lineSpacing: 2,
      });
      const hpBar = this.add.rectangle(LIST_X + 35, y + 24, 0, 4, 0x63b76c).setOrigin(0, 0);

      this.cardBackgrounds.push(background);
      this.cardSprites.push(sprite);
      this.cardTexts.push(text);
      this.cardHpBars.push(hpBar);
    });
  }

  private bindInput(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is not available.');
    }

    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ESC,
      Phaser.Input.Keyboard.KeyCodes.BACKSPACE,
    ]);
    this.input.keyboard.on('keydown-UP', () => this.handleVerticalInput(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.handleVerticalInput(1));
    this.input.keyboard.on('keydown-ENTER', () => this.toggleReorder());
    this.input.keyboard.on('keydown-SPACE', () => this.toggleReorder());
    this.input.keyboard.on('keydown-ESC', () => this.close());
    this.input.keyboard.on('keydown-BACKSPACE', () => this.close());
  }

  private handleVerticalInput(direction: number): void {
    const nextIndex = this.selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= this.party.pokemon.length) {
      return;
    }

    if (this.isReordering) {
      if (this.party.movePokemon(this.selectedIndex, nextIndex)) {
        this.selectedIndex = nextIndex;
        this.refresh();
      }
      return;
    }

    this.selectedIndex = nextIndex;
    this.refresh();
  }

  private toggleReorder(): void {
    if (this.party.pokemon.length < 2) {
      return;
    }

    this.isReordering = !this.isReordering;
    this.refresh();
  }

  private close(): void {
    audioManager.play('menuClose');
    this.scene.stop();
    this.scene.resume('world');
  }

  private refresh(): void {
    this.refreshPartyCards();
    this.refreshDetail();
    this.footerText.setText(
      this.isReordering
        ? 'MOVE MODE: UP/DOWN SWAPS  ENTER: DONE  ESC: BACK'
        : 'UP/DOWN: SELECT  ENTER: MOVE  ESC: BACK',
    );
  }

  private refreshPartyCards(): void {
    this.party.pokemon.forEach((pokemon, index) => {
      const isSelected = index === this.selectedIndex;
      const background = this.cardBackgrounds[index];
      const sprite = this.cardSprites[index];
      const text = this.cardTexts[index];
      const hpBar = this.cardHpBars[index];
      const hpRatio = pokemon.maxHp === 0 ? 0 : pokemon.currentHp / pokemon.maxHp;

      background.setFillStyle(isSelected ? (this.isReordering ? 0x86525d : 0x31566a) : 0x1e3650);
      background.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xf8f5d7 : 0x50758a);
      sprite.setTexture(`pokemon-front-${pokemon.base.dexId}`);
      text.setText(
        `${isSelected ? '▶ ' : '  '}${pokemon.base.name}\n  Lv.${pokemon.level}  HP ${pokemon.currentHp}/${pokemon.maxHp}`,
      );
      hpBar.setSize(93 * hpRatio, 4).setFillStyle(this.getHpColor(hpRatio));
    });
  }

  private refreshDetail(): void {
    this.detailContent.removeAll(true);
    const pokemon = this.party.pokemon[this.selectedIndex];
    if (!pokemon) {
      this.detailContent.add(
        this.add.text(8, 12, 'No Pokemon\nin your party.', this.detailTextStyle('12px')),
      );
      return;
    }

    this.detailContent.add(
      this.add
        .image(122, 20, `pokemon-front-${pokemon.base.dexId}`)
        .setDisplaySize(42, 42)
        .setOrigin(0.5),
    );
    this.detailContent.add(this.add.text(7, 2, pokemon.base.name.toUpperCase(), this.detailTextStyle('12px')));
    this.detailContent.add(
      this.add.text(7, 19, `Lv.${pokemon.level}  HP ${pokemon.currentHp}/${pokemon.maxHp}`, this.detailTextStyle()),
    );
    this.detailContent.add(
      this.add.text(7, 34, this.getTypesText(pokemon), {
        ...this.detailTextStyle('8px'),
        color: TYPE_COLORS[pokemon.base.primaryType] ?? '#d6e7ed',
      }),
    );
    this.detailContent.add(this.add.text(7, 53, 'STATS', this.labelTextStyle()));
    this.detailContent.add(
      this.add.text(
        7,
        65,
        `HP  ${pokemon.stats.hp}    ATK ${pokemon.stats.attack}\nDEF ${pokemon.stats.defense}    SPA ${pokemon.stats.spAttack}\nSPD ${pokemon.stats.spDefense}    SPE ${pokemon.stats.speed}`,
        this.detailTextStyle('8px'),
      ),
    );
    this.detailContent.add(this.add.text(7, 105, 'MOVES', this.labelTextStyle()));

    if (pokemon.moves.length === 0) {
      this.detailContent.add(this.add.text(7, 119, 'No known moves', this.detailTextStyle('8px')));
      return;
    }

    pokemon.moves.forEach((move, index) => {
      const y = 118 + index * 17;
      this.detailContent.add(
        this.add.text(7, y, move.base.name, this.detailTextStyle('8px')),
      );
      this.detailContent.add(
        this.add.text(70, y, move.base.type.toUpperCase(), {
          ...this.detailTextStyle('7px'),
          color: TYPE_COLORS[move.base.type] ?? '#d6e7ed',
        }),
      );
      this.detailContent.add(
        this.add.text(148, y, `${move.pp}/${move.base.pp}`, this.detailTextStyle('7px')).setOrigin(1, 0),
      );
    });
  }

  private getTypesText(pokemon: Pokemon): string {
    return pokemon.base.secondaryType
      ? `${pokemon.base.primaryType.toUpperCase()} / ${pokemon.base.secondaryType.toUpperCase()}`
      : pokemon.base.primaryType.toUpperCase();
  }

  private getHpColor(hpRatio: number): number {
    if (hpRatio > 0.5) {
      return 0x63b76c;
    }
    if (hpRatio > 0.2) {
      return 0xe3c75f;
    }
    return 0xd87856;
  }

  private detailTextStyle(fontSize = '9px'): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: '#f8f5d7',
      fontFamily: GAME_FONT,
      fontSize,
      lineSpacing: 2,
    };
  }

  private labelTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: '#8ed4c2',
      fontFamily: GAME_FONT,
      fontSize: '8px',
      fontStyle: 'bold',
    };
  }
}
