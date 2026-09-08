import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { SaveManager } from '../save/SaveManager';
import { getStarterSpecies } from '../stash';

/** The mint frame the title screen is composed inside. */
const FRAME_INSET = 12;
const FRAME_WIDTH = 2;

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
    this.createPrompt();

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

  /** Drawn to the live screen size, so the frame always sits on its edges. */
  private drawBackdrop(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const horizonY = Math.round(height * 0.733);
    // The mint frame is a 2px stroke centred on x=12, so the picture it frames
    // starts at 13. The ground band and its horizon stripe are drawn to that
    // box rather than to the whole canvas: at full width they ran straight
    // through the frame and out the sides of the screen.
    const inset = FRAME_INSET + FRAME_WIDTH / 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x09172a);
    graphics.fillRect(0, 0, width, height);
    graphics.fillStyle(0x122d45);
    graphics.fillRect(inset, horizonY, width - inset * 2, height - horizonY - inset);
    graphics.fillStyle(0x1f4c5f);
    graphics.fillRect(inset, horizonY + 5, width - inset * 2, 4);

    graphics.lineStyle(FRAME_WIDTH, 0x8ed4c2);
    graphics.strokeRect(FRAME_INSET, FRAME_INSET, width - FRAME_INSET * 2, height - FRAME_INSET * 2);
    graphics.lineStyle(1, 0x31566a);
    graphics.strokeRect(17, 17, width - 34, height - 34);
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

    this.add.text(this.scale.width / 2, this.scale.height * 0.275, 'ESCAPE FROM', titleStyle).setOrigin(0.5);
    this.add
      .text(this.scale.width / 2, this.scale.height * 0.417, 'PALLET TOWN', {
        ...titleStyle,
        color: '#8ed4c2',
        fontSize: '28px',
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, this.scale.height * 0.604, 'A WEB ADVENTURE', {
        align: 'center',
        color: '#9bb4c6',
        fontFamily: 'monospace',
        fontSize: '9px',
      })
      .setOrigin(0.5);
  }

  private createPrompt(): void {
    this.prompt = this.add
      .text(this.scale.width / 2, this.scale.height * 0.85, 'PRESS ENTER OR TAP', {
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
    void this.playStartAudio();
    this.prompt.setText('READY!');
    this.time.delayedCall(180, () => {
      const savedGame = this.loadOrCreateGame();
      this.scene.start(savedGame ? 'hub' : 'starter', savedGame ? { savedGame } : undefined);
    });
  }

  private loadOrCreateGame() {
    const savedGame = this.saveManager.load();
    if (savedGame) {
      if (savedGame.stash.ensurePlayable(
        savedGame.starterSpeciesId ? getStarterSpecies(savedGame.starterSpeciesId) : undefined,
      )) {
        this.saveManager.save(savedGame);
      }
      return savedGame;
    }
    return null;
  }

  private async playStartAudio(): Promise<void> {
    await audioManager.activate();
    void audioManager.startTheme('title');
    audioManager.playConfirm();
  }
}
