import Phaser from 'phaser';
import { TypewriterQueue } from './TypewriterQueue';

export interface DialogBoxOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  padding?: number;
  cornerRadius?: number;
  borderWidth?: number;
  borderColor?: number;
  backgroundColor?: number;
  charsPerSecond?: number;
  indicatorText?: string;
  indicatorBlinkMs?: number;
  textStyle?: Phaser.Types.GameObjects.Text.TextStyle;
  onComplete?: () => void;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 96;
const DEFAULT_PADDING = 12;
const DEFAULT_CORNER_RADIUS = 10;
const DEFAULT_BORDER_WIDTH = 2;
const DEFAULT_BORDER_COLOR = 0xffffff;
const DEFAULT_BACKGROUND_COLOR = 0x1e1e1e;
const DEFAULT_CHARS_PER_SECOND = 40;
const DEFAULT_INDICATOR_TEXT = '▼';
const DEFAULT_INDICATOR_BLINK_MS = 300;

export class DialogBox extends Phaser.GameObjects.Container {
  private readonly widthPx: number;
  private readonly heightPx: number;
  private readonly paddingPx: number;
  private readonly indicatorBlinkMs: number;
  private readonly charsPerSecond: number;
  private readonly onComplete?: () => void;

  private readonly textObject: Phaser.GameObjects.Text;
  private readonly indicatorObject: Phaser.GameObjects.Text;
  private readonly backgroundGraphics: Phaser.GameObjects.Graphics;

  private typewriter: TypewriterQueue | null = null;
  private indicatorElapsedMs = 0;
  private hasTriggeredCompletion = false;

  public constructor(scene: Phaser.Scene, options: DialogBoxOptions = {}) {
    const widthPx = options.width ?? DEFAULT_WIDTH;
    const heightPx = options.height ?? DEFAULT_HEIGHT;
    const x = options.x ?? 16;
    const y = options.y ?? scene.scale.height - heightPx - 16;

    super(scene, x, y);

    this.widthPx = widthPx;
    this.heightPx = heightPx;
    this.paddingPx = options.padding ?? DEFAULT_PADDING;
    this.indicatorBlinkMs = Math.max(1, options.indicatorBlinkMs ?? DEFAULT_INDICATOR_BLINK_MS);
    this.charsPerSecond = options.charsPerSecond ?? DEFAULT_CHARS_PER_SECOND;
    this.onComplete = options.onComplete;

    this.backgroundGraphics = scene.add.graphics();
    this.drawBackground(options);

    this.textObject = scene.add.text(this.paddingPx, this.paddingPx, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: {
        width: Math.max(0, this.widthPx - this.paddingPx * 2),
      },
      ...(options.textStyle ?? {}),
    });

    this.indicatorObject = scene.add
      .text(
        this.widthPx - this.paddingPx,
        this.heightPx - this.paddingPx,
        options.indicatorText ?? DEFAULT_INDICATOR_TEXT,
        {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffffff',
        },
      )
      .setOrigin(1, 1)
      .setVisible(false);

    this.add([this.backgroundGraphics, this.textObject, this.indicatorObject]);
    this.setDepth(1000);
    this.setVisible(false);
    scene.add.existing(this);
  }

  public showMessage(text: string): void {
    this.showMessages([text]);
  }

  public showMessages(texts: string[]): void {
    this.typewriter = new TypewriterQueue(texts, { charsPerSecond: this.charsPerSecond });
    this.hasTriggeredCompletion = false;
    this.indicatorElapsedMs = 0;
    this.textObject.setText(this.typewriter.visibleText);
    this.indicatorObject.setVisible(false);

    if (texts.length === 0) {
      this.setVisible(false);
      this.triggerCompletion();
      return;
    }

    this.setVisible(true);
  }

  public update(deltaMs: number): void {
    if (!this.visible || !this.typewriter || this.typewriter.isDone) {
      return;
    }

    this.typewriter.update(deltaMs);
    this.textObject.setText(this.typewriter.visibleText);

    if (this.typewriter.isComplete) {
      this.blinkIndicator(deltaMs);
      return;
    }

    this.indicatorElapsedMs = 0;
    this.indicatorObject.setVisible(false);
  }

  public skip(): void {
    if (!this.typewriter || this.typewriter.isDone) {
      return;
    }

    this.typewriter.skip();
    this.textObject.setText(this.typewriter.visibleText);
    this.indicatorElapsedMs = 0;
    this.indicatorObject.setVisible(true);
  }

  public advance(): boolean {
    if (!this.typewriter || this.typewriter.isDone) {
      return false;
    }

    if (!this.typewriter.isComplete) {
      return false;
    }

    const hasNextMessage = this.typewriter.advance();
    this.textObject.setText(this.typewriter.visibleText);
    this.indicatorElapsedMs = 0;
    this.indicatorObject.setVisible(false);

    if (hasNextMessage) {
      return true;
    }

    this.setVisible(false);
    this.triggerCompletion();
    return false;
  }

  public get isCurrentMessageComplete(): boolean {
    return this.typewriter?.isComplete ?? false;
  }

  public get isDone(): boolean {
    return this.typewriter?.isDone ?? true;
  }

  private triggerCompletion(): void {
    if (this.hasTriggeredCompletion) {
      return;
    }

    this.hasTriggeredCompletion = true;
    this.onComplete?.();
  }

  private blinkIndicator(deltaMs: number): void {
    this.indicatorElapsedMs += Math.max(0, deltaMs);
    const blinkPhase = Math.floor(this.indicatorElapsedMs / this.indicatorBlinkMs) % 2 === 0;
    this.indicatorObject.setVisible(blinkPhase);
  }

  private drawBackground(options: DialogBoxOptions): void {
    const cornerRadius = options.cornerRadius ?? DEFAULT_CORNER_RADIUS;
    const borderWidth = options.borderWidth ?? DEFAULT_BORDER_WIDTH;
    const borderColor = options.borderColor ?? DEFAULT_BORDER_COLOR;
    const backgroundColor = options.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;

    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillStyle(backgroundColor, 1);
    this.backgroundGraphics.fillRoundedRect(0, 0, this.widthPx, this.heightPx, cornerRadius);

    if (borderWidth > 0) {
      this.backgroundGraphics.lineStyle(borderWidth, borderColor, 1);
      this.backgroundGraphics.strokeRoundedRect(
        borderWidth / 2,
        borderWidth / 2,
        this.widthPx - borderWidth,
        this.heightPx - borderWidth,
        cornerRadius,
      );
    }
  }
}
