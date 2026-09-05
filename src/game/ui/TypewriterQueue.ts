export interface TypewriterQueueOptions {
  charsPerSecond?: number;
}

const DEFAULT_CHARS_PER_SECOND = 40;

export class TypewriterQueue {
  private readonly charsPerSecond: number;
  private readonly messages: string[];

  private currentIndex = 0;
  private revealedChars = 0;
  private partialChars = 0;

  public constructor(messages: string[] = [], options: TypewriterQueueOptions = {}) {
    const charsPerSecond = options.charsPerSecond ?? DEFAULT_CHARS_PER_SECOND;
    if (!Number.isFinite(charsPerSecond) || charsPerSecond <= 0) {
      throw new Error('charsPerSecond must be a finite number greater than zero.');
    }

    this.charsPerSecond = charsPerSecond;
    this.messages = [...messages];
  }

  public get visibleText(): string {
    const message = this.currentMessage;
    if (message === null) {
      return '';
    }
    return message.slice(0, this.revealedChars);
  }

  public get isComplete(): boolean {
    return this.isDone || this.revealedChars >= this.currentMessageLength;
  }

  public get isDone(): boolean {
    return this.currentIndex >= this.messages.length;
  }

  public get currentMessage(): string | null {
    return this.messages[this.currentIndex] ?? null;
  }

  public update(deltaMs: number): void {
    if (deltaMs <= 0 || this.isDone || this.isComplete) {
      return;
    }

    this.partialChars += (deltaMs / 1000) * this.charsPerSecond;
    const wholeCharsToReveal = Math.floor(this.partialChars);
    if (wholeCharsToReveal <= 0) {
      return;
    }

    this.partialChars -= wholeCharsToReveal;
    this.revealedChars = Math.min(this.currentMessageLength, this.revealedChars + wholeCharsToReveal);

    if (this.isComplete) {
      this.partialChars = 0;
    }
  }

  public skip(): void {
    if (this.isDone) {
      return;
    }

    this.revealedChars = this.currentMessageLength;
    this.partialChars = 0;
  }

  public advance(): boolean {
    if (this.isDone || !this.isComplete) {
      return false;
    }

    this.currentIndex += 1;
    this.revealedChars = 0;
    this.partialChars = 0;
    return !this.isDone;
  }

  private get currentMessageLength(): number {
    return this.currentMessage?.length ?? 0;
  }
}
