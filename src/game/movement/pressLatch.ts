/**
 * A key press that is still a press when the frame comes to read it.
 *
 * Movement reads whether a direction key *is* down, once a frame. A press that
 * goes down and comes back up between two frames was therefore never seen: at
 * sixty frames a second that is a tap shorter than 17ms, which a driver sending
 * keydown and keyup back to back produces every time, and at ten frames a second
 * it is any ordinary tap at all. The latch remembers the frame a key went down
 * in, so the frame that processes the press still sees it, held or not.
 *
 * It is good for that frame only. A press that lands while the scene is not
 * reading movement - mid-step, under a dialogue, asleep behind a battle - is
 * dropped exactly as it always was, rather than kept to walk the player off a
 * tile the moment the dialogue closes.
 */
export class PressLatch<TKey extends string> {
  private readonly pressedOnFrame = new Map<TKey, number>();

  public press(key: TKey, frame: number): void {
    this.pressedOnFrame.set(key, frame);
  }

  public wasPressedOn(key: TKey, frame: number): boolean {
    return this.pressedOnFrame.get(key) === frame;
  }

  public clear(): void {
    this.pressedOnFrame.clear();
  }
}
