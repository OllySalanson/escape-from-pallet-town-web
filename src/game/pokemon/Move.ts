import type { MoveBase } from './MoveBase';

export class Move {
  public readonly base: MoveBase;
  private currentPp: number;

  public constructor(base: MoveBase) {
    this.base = base;
    this.currentPp = base.pp;
  }

  public get pp(): number {
    return this.currentPp;
  }

  public canUse(): boolean {
    return this.currentPp > 0;
  }

  public use(): boolean {
    if (!this.canUse()) {
      return false;
    }

    this.currentPp -= 1;
    return true;
  }

  /** Synchronizes battle-state PP without allowing invalid values into the party model. */
  public setPp(value: number): void {
    this.currentPp = Math.min(this.base.pp, Math.max(0, Math.floor(value)));
  }

  public restorePp(amount?: number): void {
    if (amount === undefined) {
      this.currentPp = this.base.pp;
      return;
    }

    const sanitizedAmount = Math.max(0, Math.floor(amount));
    this.currentPp = Math.min(this.base.pp, this.currentPp + sanitizedAmount);
  }
}
