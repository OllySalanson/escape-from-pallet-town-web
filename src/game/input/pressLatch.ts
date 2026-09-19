/**
 * A key press that is still a press when the frame comes to read it.
 *
 * The scenes read keys once a frame, and both ways of reading lose a press that
 * goes down and comes back up between two frames: `isDown` is false again, and
 * Phaser's `JustDown` is no better, because `Key.onUp` clears the flag it reads.
 * At sixty frames a second that is a tap shorter than 17ms, which a driver
 * sending keydown and keyup back to back produces every time; at the ten frames
 * a second of test mode it is any ordinary tap at all. The latch remembers the
 * frame a key went down in, so the frame that processes the press still sees
 * it, held or not.
 *
 * It is good for that frame only. A press that lands while the scene is not
 * reading movement - mid-step, under a dialogue, asleep behind a battle - is
 * dropped exactly as it always was, rather than kept to walk the player off a
 * tile the moment the dialogue closes.
 */
export class PressLatch<TKey> {
  private readonly pressedOnFrame = new Map<TKey, number>();

  public press(key: TKey, frame: number): void {
    this.pressedOnFrame.set(key, frame);
  }

  public wasPressedOn(key: TKey, frame: number): boolean {
    return this.pressedOnFrame.get(key) === frame;
  }

  /** `wasPressedOn`, for a press that must be answered once and only once. */
  public consume(key: TKey, frame: number): boolean {
    const pressed = this.wasPressedOn(key, frame);
    this.pressedOnFrame.delete(key);
    return pressed;
  }

  public clear(): void {
    this.pressedOnFrame.clear();
  }
}
