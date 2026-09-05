import Phaser from 'phaser';
import { Pokemon, type Pokemon as PokemonInstance } from '../pokemon';
import { BULBASAUR, CHARMANDER } from '../pokemon/species';
import {
  createBattleState,
  resolveTurn,
  type BattleCombatant,
  type BattleEvent,
  type BattleState,
} from '../pokemon/battle/battleEngine';
import { DialogBox } from '../ui/DialogBox';

type CommandMode = 'main' | 'moves' | 'events' | 'finished';

const COMMAND_Y = 168;

export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private dialog!: DialogBox;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpBar!: Phaser.GameObjects.Graphics;
  private playerHpText!: Phaser.GameObjects.Text;
  private commandTexts: Phaser.GameObjects.Text[] = [];
  private mode: CommandMode = 'main';
  private selectedCommand = 0;
  private commandContainer!: Phaser.GameObjects.Container;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;

  public constructor() {
    super('battle');
  }

  public create(): void {
    this.state = createBattleState(new Pokemon(CHARMANDER, 10), new Pokemon(BULBASAUR, 10));
    this.cameras.main.setBackgroundColor('#9bd8e8');
    this.drawBackdrop();
    this.drawCombatants();
    this.drawStatusBoxes();
    this.commandContainer = this.add.container(0, 0).setDepth(10);
    this.dialog = new DialogBox(this, {
      x: 8,
      y: COMMAND_Y,
      width: 304,
      height: 64,
      padding: 8,
      cornerRadius: 0,
      charsPerSecond: 55,
      onComplete: () => this.onMessagesComplete(),
    });

    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', () => this.confirm());
    this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.showCommands();
  }

  public update(_time: number, delta: number): void {
    this.dialog.update(delta);
    if (this.mode === 'events' || this.mode === 'finished') {
      if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
        this.confirm();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
      this.moveSelection(-1);
    } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
      this.moveSelection(1);
    } else if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
      this.confirm();
    }
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x75af63, 1);
    graphics.fillEllipse(242, 77, 120, 24);
    graphics.fillEllipse(77, 139, 140, 30);
    graphics.lineStyle(2, 0x4f7f43, 1);
    graphics.strokeEllipse(242, 77, 120, 24);
    graphics.strokeEllipse(77, 139, 140, 30);
  }

  private drawCombatants(): void {
    this.drawPlaceholderPokemon(238, 57, 0x75b95e, false);
    this.drawPlaceholderPokemon(79, 121, 0xf18e55, true);
  }

  private drawPlaceholderPokemon(x: number, y: number, color: number, isBack: boolean): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(x - 16, y - 20, 32, 34);
    graphics.fillCircle(x, y - 20, 15);
    graphics.fillTriangle(x - 12, y - 30, x - 4, y - 43, x - 1, y - 28);
    graphics.fillTriangle(x + 1, y - 28, x + 8, y - 43, x + 14, y - 30);
    graphics.fillStyle(0x2b2b2b, 1);
    if (isBack) {
      graphics.fillRect(x - 14, y + 1, 28, 3);
    } else {
      graphics.fillCircle(x - 6, y - 22, 2);
      graphics.fillCircle(x + 6, y - 22, 2);
    }
  }

  private drawStatusBoxes(): void {
    this.createStatusBox(16, 16, this.state.enemy, false);
    this.createStatusBox(150, 104, this.state.player, true);
  }

  private createStatusBox(
    x: number,
    y: number,
    combatant: BattleCombatant,
    showNumbers: boolean,
  ): void {
    const box = this.add.graphics();
    box.fillStyle(0xf8f8e8, 1);
    box.fillRect(x, y, 142, showNumbers ? 52 : 40);
    box.lineStyle(2, 0x303030, 1);
    box.strokeRect(x + 1, y + 1, 140, showNumbers ? 50 : 38);
    this.add.text(x + 8, y + 6, `${combatant.pokemon.base.name.toUpperCase()} :L${combatant.pokemon.level}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#202020',
    });
    this.add.text(x + 8, y + 21, 'HP:', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#202020',
    });
    const hpBar = this.add.graphics();
    if (showNumbers) {
      this.playerHpBar = hpBar;
      this.playerHpText = this.add.text(x + 80, y + 36, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#202020',
      });
      this.drawHpBar(hpBar, x + 34, y + 22, combatant.currentHp / combatant.pokemon.maxHp);
      this.playerHpText.setText(`${combatant.currentHp}/${combatant.pokemon.maxHp}`);
    } else {
      this.enemyHpBar = hpBar;
      this.drawHpBar(hpBar, x + 34, y + 22, combatant.currentHp / combatant.pokemon.maxHp);
    }
  }

  private drawHpBar(graphics: Phaser.GameObjects.Graphics, x: number, y: number, ratio: number): void {
    graphics.clear();
    graphics.fillStyle(0x303030, 1);
    graphics.fillRect(x, y, 92, 10);
    const color = ratio > 0.5 ? 0x40a850 : ratio > 0.2 ? 0xd8b840 : 0xd05040;
    graphics.fillStyle(color, 1);
    graphics.fillRect(x + 2, y + 2, Math.round(88 * Math.max(0, ratio)), 6);
  }

  private showCommands(): void {
    this.commandContainer.removeAll(true);
    this.commandContainer.setVisible(true);
    const isMain = this.mode === 'main';
    const labels = isMain
      ? ['FIGHT', 'BAG', 'POKéMON', 'RUN']
      : this.state.player.moves.map((move) => `${move.base.name}  ${move.pp}/${move.base.pp}`);
    this.commandContainer.add(this.createCommandBox(labels));
    this.selectedCommand = Math.min(this.selectedCommand, labels.length - 1);
    this.updateSelection();
  }

  private createCommandBox(labels: readonly string[]): Phaser.GameObjects.Container {
    const container = this.add.container(8, COMMAND_Y);
    const graphics = this.add.graphics();
    graphics.fillStyle(0xf8f8e8, 1);
    graphics.fillRect(0, 0, 304, 64);
    graphics.lineStyle(2, 0x303030, 1);
    graphics.strokeRect(1, 1, 302, 62);
    container.add(graphics);
    this.commandTexts = labels.map((label, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const text = this.add.text(20 + column * 148, 12 + row * 25, label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#202020',
      });
      container.add(text);
      return text;
    });
    return container;
  }

  private moveSelection(direction: number): void {
    const count = this.commandTexts.length;
    this.selectedCommand = (this.selectedCommand + direction + count) % count;
    this.updateSelection();
  }

  private updateSelection(): void {
    this.commandTexts.forEach((text, index) => {
      text.setText(`${index === this.selectedCommand ? '▶ ' : '  '}${text.text.replace(/^[▶ ]{2}/, '')}`);
    });
  }

  private confirm(): void {
    if (this.mode === 'events' || this.mode === 'finished') {
      if (!this.dialog.isCurrentMessageComplete) {
        this.dialog.skip();
      } else {
        this.dialog.advance();
      }
      return;
    }

    if (this.mode === 'main') {
      if (this.selectedCommand === 0) {
        this.mode = 'moves';
        this.selectedCommand = 0;
        this.showCommands();
      }
      return;
    }

    const result = resolveTurn(this.state, this.selectedCommand, () => Math.random());
    if (result.events.length === 0) {
      return;
    }
    const previousState = this.state;
    this.state = result.state;
    this.animateHp(previousState);
    this.mode = 'events';
    this.commandContainer.setVisible(false);
    this.dialog.showMessages(result.events.map(eventToMessage));
  }

  private animateHp(previousState: BattleState): void {
    this.animateHpBar(
      this.playerHpBar,
      previousState.player.currentHp,
      this.state.player.currentHp,
      this.state.player.pokemon,
      true,
    );
    this.animateHpBar(
      this.enemyHpBar,
      previousState.enemy.currentHp,
      this.state.enemy.currentHp,
      this.state.enemy.pokemon,
      false,
    );
  }

  private animateHpBar(
    bar: Phaser.GameObjects.Graphics,
    from: number,
    to: number,
    pokemon: PokemonInstance,
    showNumbers: boolean,
  ): void {
    if (from === to) {
      return;
    }
    this.tweens.addCounter({
      from,
      to,
      duration: 400,
      ease: 'Linear',
      onUpdate: (tween) => {
        const hp = Math.round(tween.getValue() ?? to);
        const ratio = hp / pokemon.maxHp;
        this.drawHpBar(bar, showNumbers ? 184 : 50, showNumbers ? 126 : 38, ratio);
        if (showNumbers) {
          this.playerHpText.setText(`${hp}/${pokemon.maxHp}`);
        }
      },
    });
  }

  private onMessagesComplete(): void {
    if (this.mode === 'finished') {
      return;
    }

    if (this.state.outcome === 'active') {
      this.mode = 'main';
      this.selectedCommand = 0;
      this.showCommands();
      return;
    }

    this.mode = 'finished';
    this.dialog.showMessage(this.state.outcome === 'victory' ? 'You won the battle!' : 'You blacked out!');
  }
}

const eventToMessage = (event: BattleEvent): string => {
  switch (event.type) {
    case 'used-move':
      return `${event.name} used ${event.move}!`;
    case 'missed':
      return 'But it missed!';
    case 'effectiveness':
      if (event.multiplier === 0) {
        return 'It does not affect the target...';
      }
      return event.multiplier > 1 ? "It's super effective!" : "It's not very effective...";
    case 'fainted':
      return `${event.name} fainted!`;
    case 'no-pp':
      return `No PP left for ${event.move}!`;
  }
};
