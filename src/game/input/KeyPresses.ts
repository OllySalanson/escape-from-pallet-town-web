import Phaser from 'phaser';
import { PressLatch } from './pressLatch';

type Key = Phaser.Input.Keyboard.Key;

/**
 * `Phaser.Input.Keyboard.JustDown`, for a scene that must not lose a short press.
 *
 * `JustDown` is true for a key that went down and has not been read - unless it
 * has also come back up, because `Key.onUp` clears the flag. A press that starts
 * and ends between two frames is therefore never seen by a scene that polls it
 * in `update`, which at the ten frames a second of test mode is most taps. A
 * watched key also latches its press for the frame that processed it, and
 * `justPressed` answers to either, once.
 */
export class KeyPresses {
  private readonly latch = new PressLatch<Key>();
  private readonly currentFrame: () => number;

  public constructor(currentFrame: () => number) {
    this.currentFrame = currentFrame;
  }

  public watch(keys: readonly Key[]): void {
    for (const key of keys) {
      key.on('down', () => this.latch.press(key, this.currentFrame()));
    }
  }

  public justPressed(key: Key): boolean {
    // Both are read every time: each is consumed by the asking, and a held press
    // that is seen by both must not be answered again on the next call.
    const held = Phaser.Input.Keyboard.JustDown(key);
    const tapped = this.latch.consume(key, this.currentFrame());
    return held || tapped;
  }
}
