import Phaser from 'phaser';
import { WINDOW_CREAM, drawPixelWindow } from './pixelWindow';
import { GAME_FONT } from './gameFont';
import { CHIP_FONT_SIZE } from './screenType';

const PADDING_X = 4;
const PADDING_Y = 1;
const GAP = 2;

/**
 * A chip stood on the dialogue box's corner while Professor Oak is on the radio:
 * the key - or the click - that opens the whole field guide instead of his two
 * lines (`WorldScene.answerRadioKey`). On the corner, because the camera keeps
 * the player in the middle of the screen, just above the box.
 */
export class RadioChip extends Phaser.GameObjects.Container {
  public constructor(
    scene: Phaser.Scene,
    words: string,
    box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    onClick: () => void,
  ) {
    const text = scene.add.text(PADDING_X, PADDING_Y, words, {
      fontFamily: GAME_FONT,
      fontSize: CHIP_FONT_SIZE,
      color: '#171717',
    });
    const width = Math.ceil(text.width) + PADDING_X * 2;
    const height = Math.ceil(text.height) + PADDING_Y * 2;
    // Above the box, unless the box has been raised clear of the player.
    const above = box.y - height - GAP;
    super(scene, box.x + box.width - width, above >= 0 ? above : box.y + box.height + GAP);
    const frame = scene.add.graphics();
    drawPixelWindow(frame, { x: 0, y: 0, width, height }, { fill: WINDOW_CREAM });
    this.add([frame, text]);
    this.setSize(width, height);
    // Its own scroll factor as well as the box's: a pointer is tested against it.
    text.setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.setDepth(1000);
    this.setScrollFactor(0, 0, true);
    scene.add.existing(this);
  }
}
