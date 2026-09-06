import Phaser from 'phaser';
import type { Pokemon, PokemonParty } from '../pokemon';
import type { PokemonType } from '../pokemon/PokemonType';

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
  Electric: '#e3c75f',
  Fire: '#d87856',
  Flying: '#9caed8',
  Grass: '#7db65b',
  Normal: '#aaa898',
  Poison: '#a060a8',
  Water: '#6096d0',
};

interface PartySceneData {
  party: PokemonParty;
}

export class PartyScene extends Phaser.Scene {
  private party!: PokemonParty;
  private selectedIndex = 0;
  private isReordering = false;
  private readonly cardBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private readonly cardSprites: Phaser.GameObjects.Image[] = [];
  private readonly cardTexts: Phaser.GameObjects.Text[] = [];
  private readonly cardHpBars: Phaser.GameObjects.Rectangle[] = [];
  private detailContent!: Phaser.GameObjects.Container;
  private footerText!: Phaser.GameObjects.Text;

  public constructor() {
    super('party');
  }

  public init(data: PartySceneData): void {
    this.party = data.party;
    this.selectedIndex = 0;
    this.isReordering = false;
  }

  public create(): void {
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
      fontFamily: 'monospace',
      fontSize: '8px',
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
    graphics.strokeRect(DETAIL_X - 4, 24, DETAIL_WIDTH + 4, 199);
  }

  private createHeading(): void {
    this.add.text(LIST_X, 11, 'PARTY', {
      color: '#f8f5d7',
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
    });
    this.add.text(DETAIL_X, 11, 'SUMMARY', {
      color: '#8ed4c2',
      fontFamily: 'monospace',
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
        fontFamily: 'monospace',
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
      fontFamily: 'monospace',
      fontSize,
      lineSpacing: 2,
    };
  }

  private labelTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: '#8ed4c2',
      fontFamily: 'monospace',
      fontSize: '8px',
      fontStyle: 'bold',
    };
  }
}
