import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { SaveManager } from '../save/SaveManager';
import { createStartingStash } from '../stash';

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 240;

export class TitleScene extends Phaser.Scene {
  private hasStarted = false;
  private prompt!: Phaser.GameObjects.Text;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('title');
  }

  public create(): void {
    this.drawBackdrop();
    this.createTitle();
    this.createPrompt(this.saveManager.hasSave());

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.once('keydown-SPACE', () => this.startGame());
    this.input.keyboard?.on('keydown-M', () => audioManager.toggleMute());
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.startGame());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audioManager.stopTheme());
  }

  public update(time: number): void {
    const pulse = (Math.sin(time / 260) + 1) / 2;
    this.prompt.setAlpha(0.45 + pulse * 0.55);
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x09172a);
    graphics.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    graphics.fillStyle(0x122d45);
    graphics.fillRect(0, 176, SCREEN_WIDTH, 64);
    graphics.fillStyle(0x1f4c5f);
    graphics.fillRect(0, 181, SCREEN_WIDTH, 4);

    graphics.lineStyle(2, 0x8ed4c2);
    graphics.strokeRect(12, 12, SCREEN_WIDTH - 24, SCREEN_HEIGHT - 24);
    graphics.lineStyle(1, 0x31566a);
    graphics.strokeRect(17, 17, SCREEN_WIDTH - 34, SCREEN_HEIGHT - 34);
  }

  private createTitle(): void {
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      align: 'center',
      color: '#f8f5d7',
      fontFamily: 'monospace',
      fontSize: '25px',
      fontStyle: 'bold',
      stroke: '#244159',
      strokeThickness: 4,
    };

    this.add.text(SCREEN_WIDTH / 2, 66, 'ESCAPE FROM', titleStyle).setOrigin(0.5);
    this.add
      .text(SCREEN_WIDTH / 2, 100, 'PALLET TOWN', {
        ...titleStyle,
        color: '#8ed4c2',
        fontSize: '28px',
      })
      .setOrigin(0.5);

    this.add
      .text(SCREEN_WIDTH / 2, 145, 'A WEB ADVENTURE', {
        align: 'center',
        color: '#9bb4c6',
        fontFamily: 'monospace',
        fontSize: '9px',
      })
      .setOrigin(0.5);
  }

  private createPrompt(hasSave: boolean): void {
    this.prompt = this.add
      .text(SCREEN_WIDTH / 2, 204, hasSave ? 'PRESS ENTER TO CONTINUE' : 'PRESS ENTER OR TAP', {
        align: 'center',
        color: '#f8f5d7',
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
  }

  private startGame(): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    const savedGame = this.loadOrCreateGame();
    void this.playStartAudio();
    this.prompt.setText('READY!');
    this.time.delayedCall(180, () => this.scene.start('hub', { savedGame }));
  }

  private loadOrCreateGame() {
    const savedGame = this.saveManager.load();
    if (savedGame) {
      return savedGame;
    }

    const stash = createStartingStash();
    const newGame = {
      party: new PokemonParty([]),
      mapId: 'pallet-town' as const,
      position: { x: 6, y: 8 },
      items: [],
      bag: new Bag(),
      stash,
    };
    this.saveManager.save(newGame);
    return this.saveManager.load() ?? newGame;
  }

  private async playStartAudio(): Promise<void> {
    await audioManager.activate();
    void audioManager.startTheme('title');
    audioManager.playConfirm();
  }
}
