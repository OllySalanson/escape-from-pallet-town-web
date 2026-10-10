import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { LoggedAction } from '../feedback/actionLog';
import { contextLines, type FeedbackContext } from '../feedback/feedbackContext';
import type { FeedbackCourier } from '../feedback/courier';
import { MAX_FEEDBACK_TEXT, feedbackTag, hasSomethingToSay } from '../feedback/feedbackNote';
import {
  allLines,
  commitBar,
  countLine,
  outcomeMarkup,
  panelMarkup,
  pictureRow,
  saveRow,
  seeAllRow,
  voiceRow,
  type PanelView,
  type VoiceView,
} from '../feedback/feedbackPanel';
import {
  EMPTY_SEND_LINE,
  MIC_MISSING_LINE,
  MIC_REFUSED_LINE,
  SENDING_LINE,
  TAPE_FULL_LINE,
  TAPE_LOW_LINE,
  TOO_LONG_LINE,
} from '../feedback/feedbackWords';
import { VoiceTape, tapeIsFull, tapeIsLow, tapeTime } from '../feedback/voiceTape';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { PIXEL_STATUS_SELECTOR, takeDownPixelStatus } from '../ui/pixelUi';

export interface FeedbackSceneData {
  readonly context: FeedbackContext;
  readonly actions: readonly LoggedAction[];
  /** The picture, which arrives a frame after the tab was pressed (or never). */
  readonly picture: Promise<Blob | null>;
  /** The raw stored save at the instant the tab was pressed, or null with none. */
  readonly save: string | null;
  readonly courier: FeedbackCourier;
  /** Called once the panel is gone, to give the game back. */
  readonly onClose: () => void;
}

type Phase = 'writing' | 'scrapping' | 'sending' | 'done';

/** Below this many game pixels across, the panel is the whole screen rather than a column. */
const SIDE_PANEL_MIN_LAYER_WIDTH = 440;

/**
 * The feedback panel: a column down the right of the window, over a game that
 * is paused underneath it (`feedback/feedbackDesk.ts` pauses and resumes).
 *
 * It is a scene of its own, as the field guide is, so it opens over any screen
 * at all - a raid, a fight, a menu, the title - and the MenuOverlay it owns is
 * on top of the keyboard while it is up: a key typed into the box is never a
 * step in the raid.
 */
export class FeedbackScene extends Phaser.Scene {
  private overlay!: MenuOverlay;
  private request!: FeedbackSceneData;
  private phase: Phase = 'writing';
  private text = '';
  private picture: Blob | null = null;
  private pictureUrl: string | null = null;
  private includePicture = true;
  private includeSave = true;
  private seeAll = false;
  /** An Escape the overlay already acted on, so its key-up in the box does not act again. */
  private escapeTaken = false;
  private tape = new VoiceTape();
  /** Redraws the tape's time and meter while it records; null while it does not. */
  private ticker: number | null = null;
  /** Whether the low-tape line has been said for this recording. */
  private warnedLow = false;
  private playback: HTMLAudioElement | null = null;
  private playbackUrls: string[] = [];
  /** A TALK press still waiting on the microphone, so a second press cannot start two. */
  private talkPending = false;
  private readonly onResize = (): void => this.fitToWindow();

  public constructor() {
    super('feedback');
  }

  public init(data: FeedbackSceneData): void {
    this.request = data;
    this.phase = 'writing';
    this.text = '';
    this.picture = null;
    this.pictureUrl = null;
    this.includePicture = true;
    this.includeSave = data.save !== null;
    this.seeAll = false;
    this.escapeTaken = false;
    this.tape = new VoiceTape();
    this.ticker = null;
    this.warnedLow = false;
    this.playback = null;
    this.playbackUrls = [];
    this.talkPending = false;
    this.overlay = new MenuOverlay(this, 'feedback-panel pixel-ui', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', 'Send feedback');
    this.fitToWindow();
    window.addEventListener('resize', this.onResize);
    this.overlay.root.addEventListener('keyup', (event) => this.onKeyUp(event));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tearDown());
    this.renderWriting();
    void data.picture.then((picture) => this.receivePicture(picture));
  }

  public create(): void {
    // Built in init, so the panel is on screen the frame the game pauses.
  }

  private view(): PanelView {
    return {
      pictureUrl: this.pictureUrl,
      includePicture: this.includePicture,
      includeSave: this.includeSave,
      hasSave: this.request.save !== null,
      seeAll: this.seeAll,
      details: contextLines(this.request.context),
      actions: this.request.actions,
      voice: this.voiceView(),
    };
  }

  private voiceView(): VoiceView {
    const reading = this.tape.reading();
    return {
      supported: VoiceTape.supported(),
      recording: reading.recording,
      totalMs: reading.totalMs,
      clips: reading.clips,
      playing: this.playback !== null,
    };
  }

  /**
   * A column down the right where there is room beside it, the whole screen
   * where there is not - and never wider than the window. On a phone the menu
   * layer is wider than the screen (it is never narrower than 320 game pixels
   * at 2x), and a panel laid out against the layer put SEND off the edge.
   */
  private fitToWindow(): void {
    const root = this.overlay.root;
    const layer = root.parentElement;
    const unit = Number.parseFloat(layer?.style.getPropertyValue('--px') ?? '') || 2;
    const box = layer?.getBoundingClientRect();
    const across = (box?.width ?? 0) / unit;
    const visible = Math.floor((window.innerWidth - (box?.left ?? 0)) / unit);
    if (box && visible < across) {
      root.dataset.layout = 'sheet';
      root.style.width = `${visible * unit}px`;
      return;
    }
    root.dataset.layout = across >= SIDE_PANEL_MIN_LAYER_WIDTH ? 'side' : 'sheet';
    root.style.width = '';
  }

  private renderWriting(): void {
    const root = this.overlay.root;
    root.innerHTML = panelMarkup(this.view());
    const box = root.querySelector<HTMLTextAreaElement>('#feedback-text')!;
    box.value = this.text;
    box.addEventListener('input', () => {
      this.text = box.value;
      this.writeCount();
    });
    this.writeCount();
    this.wireRows();
    this.wireVoice();
    this.wireCommit();
    root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.cancel();
    this.overlay.focus('#feedback-text');
  }

  private wireRows(): void {
    const root = this.overlay.root;
    const picture = root.querySelector<HTMLButtonElement>('[data-picture]');
    if (picture) {
      picture.onclick = () => {
        this.includePicture = !this.includePicture;
        this.replaceRow('[data-picture]', pictureRow(this.view()));
      };
    }
    const save = root.querySelector<HTMLButtonElement>('[data-save]');
    if (save) {
      save.onclick = () => {
        this.includeSave = !this.includeSave;
        this.replaceRow('[data-save]', saveRow(this.view()));
      };
    }
    root.querySelector<HTMLButtonElement>('[data-see-all]')!.onclick = () => {
      this.seeAll = !this.seeAll;
      this.replaceRow('[data-see-all]', seeAllRow(this.view()));
      root.querySelector('[data-all]')!.outerHTML = allLines(this.view());
      // A pane that has just appeared is measured for its MORE strip here.
      this.overlay.refocus('[data-see-all]');
    };
  }

  private wireVoice(): void {
    const root = this.overlay.root;
    const talk = root.querySelector<HTMLButtonElement>('[data-talk]');
    if (talk) talk.onclick = () => void this.talk();
    const play = root.querySelector<HTMLButtonElement>('[data-play]');
    if (play) play.onclick = () => this.togglePlayback();
    const remove = root.querySelector<HTMLButtonElement>('[data-delete-voice]');
    if (remove) remove.onclick = () => void this.deleteVoice();
  }

  /** Redraws the voice row, keeping the cursor on the control it was on. */
  private redrawVoice(focus = '[data-talk]'): void {
    const row = this.overlay.root.querySelector<HTMLElement>('[data-voice]');
    if (!row) {
      return;
    }
    const hadFocus = row.contains(document.activeElement);
    row.outerHTML = voiceRow(this.voiceView());
    this.wireVoice();
    if (hadFocus) {
      this.overlay.root.querySelector<HTMLElement>(focus)?.focus();
    }
  }

  /** TALK: start the tape, or stop it. Pressing once records until the next press. */
  private async talk(): Promise<void> {
    if (this.phase !== 'writing' || this.talkPending) {
      return;
    }
    if (this.tape.reading().recording) {
      await this.stopTape();
      return;
    }
    this.stopPlayback();
    this.talkPending = true;
    const started = await this.tape.start();
    this.talkPending = false;
    if (!this.overlay.root.isConnected) {
      await this.tape.discard();
      return;
    }
    if (started === 'refused') {
      this.say(MIC_REFUSED_LINE);
    } else if (started === 'unsupported') {
      this.say(MIC_MISSING_LINE);
    } else if (started === 'full') {
      this.say(TAPE_FULL_LINE);
    } else {
      takeDownPixelStatus(this.overlay.root);
      this.warnedLow = false;
      this.ticker = window.setInterval(() => this.tick(), 100);
    }
    this.redrawVoice();
  }

  private async stopTape(): Promise<void> {
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
    await this.tape.stop();
    if (this.overlay.root.isConnected && this.phase !== 'done') {
      this.redrawVoice();
    }
  }

  /** The time and the meter, written in place ten times a second while the tape runs. */
  private tick(): void {
    const reading = this.tape.reading();
    if (!reading.recording) {
      // Stopped by the browser rather than by the player: the clip is kept.
      void this.stopTape();
      return;
    }
    if (tapeIsFull(reading.totalMs)) {
      void this.stopTape().then(() => this.say(TAPE_FULL_LINE));
      return;
    }
    const root = this.overlay.root;
    const time = root.querySelector<HTMLElement>('[data-voice-time]');
    if (time) {
      time.textContent = tapeTime(reading.totalMs);
      time.classList.toggle('is-low', tapeIsLow(reading.totalMs));
    }
    if (tapeIsLow(reading.totalMs) && !this.warnedLow) {
      this.warnedLow = true;
      this.say(TAPE_LOW_LINE);
    }
    const bars = root.querySelectorAll<HTMLElement>('[data-meter] i');
    bars.forEach((bar, index) => {
      // Whole game pixels, middle bar tallest, so the meter reads as a voice.
      const shape = 1 - Math.abs(index - (bars.length - 1) / 2) / bars.length;
      bar.style.setProperty('--level', String(2 + Math.round(reading.level * shape * 8)));
    });
  }

  private togglePlayback(): void {
    if (this.playback) {
      this.stopPlayback();
      this.redrawVoice('[data-play]');
      return;
    }
    const clips = [...this.tape.clips];
    if (clips.length === 0) {
      return;
    }
    this.playbackUrls = clips.map((clip) => URL.createObjectURL(clip));
    const playFrom = (index: number): void => {
      if (index >= this.playbackUrls.length || !this.overlay.root.isConnected) {
        this.stopPlayback();
        this.redrawVoice('[data-play]');
        return;
      }
      const audio = new Audio(this.playbackUrls[index]);
      this.playback = audio;
      audio.addEventListener('ended', () => playFrom(index + 1), { once: true });
      void audio.play().catch(() => {
        this.stopPlayback();
        this.redrawVoice('[data-play]');
      });
    };
    playFrom(0);
    this.redrawVoice('[data-play]');
  }

  private stopPlayback(): void {
    this.playback?.pause();
    this.playback = null;
    this.playbackUrls.forEach((url) => URL.revokeObjectURL(url));
    this.playbackUrls = [];
  }

  private async deleteVoice(): Promise<void> {
    this.stopPlayback();
    await this.tape.discard();
    this.redrawVoice();
  }

  /** Swaps one row in place, so the box keeps its words and caret and the cursor stays put. */
  private replaceRow(selector: string, markup: string): void {
    const row = this.overlay.root.querySelector<HTMLElement>(selector);
    if (!row) {
      return;
    }
    const hadFocus = document.activeElement === row;
    row.outerHTML = markup;
    this.wireRows();
    if (hadFocus) {
      this.overlay.root.querySelector<HTMLElement>(selector)?.focus();
    }
  }

  private wireCommit(): void {
    const root = this.overlay.root;
    const bar = root.querySelector<HTMLElement>('[data-commit]');
    if (!bar) {
      return;
    }
    const button = (name: string): HTMLButtonElement | null => bar.querySelector(`[data-${name}]`);
    const send = button('send');
    const cancel = button('cancel');
    const scrap = button('scrap');
    const keep = button('keep');
    if (send) send.onclick = () => void this.send();
    if (cancel) cancel.onclick = () => this.cancel();
    if (scrap) scrap.onclick = () => this.close();
    if (keep) keep.onclick = () => this.keepWriting();
  }

  private setCommit(phase: 'writing' | 'scrapping'): void {
    const bar = this.overlay.root.querySelector<HTMLElement>('[data-commit]');
    if (bar) {
      bar.innerHTML = commitBar(phase);
      this.wireCommit();
    }
  }

  private writeCount(): void {
    const count = this.overlay.root.querySelector('[data-count]');
    if (count) {
      count.textContent = countLine(this.text.length);
    }
    if (this.text.length >= MAX_FEEDBACK_TEXT) {
      this.say(TOO_LONG_LINE);
    } else if (this.overlay.root.querySelector(PIXEL_STATUS_SELECTOR)?.textContent === TOO_LONG_LINE) {
      takeDownPixelStatus(this.overlay.root);
    }
  }

  /** Puts a line over the help bar until the next one, as every other screen does. */
  private say(line: string): void {
    const help = this.overlay.root.querySelector('.px-help');
    if (!help) {
      return;
    }
    takeDownPixelStatus(this.overlay.root);
    const status = document.createElement('span');
    status.className = 'px-status-line';
    status.setAttribute('role', 'status');
    status.textContent = line;
    help.classList.add('has-status');
    help.append(status);
  }

  private onKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event, 'f')) {
      event.preventDefault();
      if (event.key === 'Escape') {
        this.escapeTaken = true;
      }
      this.back();
      return;
    }
    if (this.overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /**
   * The box is a typing target, so the overlay reads none of its keys
   * (`overlayKeyboard.ts`) - Escape in it is read here, on the way up, as the
   * stash's text fields do. An Escape the overlay already acted on lands here
   * too, on whatever it moved the cursor to, and is let go.
   */
  private onKeyUp(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    const taken = this.escapeTaken;
    this.escapeTaken = false;
    if (!taken && event.target instanceof HTMLTextAreaElement) {
      this.back();
    }
  }

  /** Escape, F off the box, or the title bar's way back: one step back from wherever the panel is. */
  private back(): void {
    switch (this.phase) {
      case 'writing':
        this.cancel();
        return;
      case 'scrapping':
        this.keepWriting();
        return;
      case 'done':
        this.close();
        return;
      case 'sending':
        return;
    }
  }

  private cancel(): void {
    // A question asked over a running tape would be asked over the player's
    // own voice: the clip is stopped, and kept, before anything is asked.
    if (this.tape.reading().recording) {
      void this.stopTape().then(() => this.cancel());
      return;
    }
    this.stopPlayback();
    if (!hasSomethingToSay(this.text, this.tape.clips.length)) {
      this.close();
      return;
    }
    this.phase = 'scrapping';
    this.setCommit('scrapping');
    // The safe answer has the cursor, as every irreversible question here does.
    this.overlay.focus('[data-keep]');
  }

  private keepWriting(): void {
    this.phase = 'writing';
    this.setCommit('writing');
    this.overlay.focus('#feedback-text');
  }

  private async send(): Promise<void> {
    if (this.phase !== 'writing') {
      return;
    }
    // SEND while the tape runs stops it and sends what was said, as the owner asked.
    this.phase = 'sending';
    await this.stopTape();
    this.stopPlayback();
    if (!hasSomethingToSay(this.text, this.tape.clips.length)) {
      this.phase = 'writing';
      this.say(EMPTY_SEND_LINE);
      this.overlay.focus('#feedback-text');
      return;
    }
    this.say(SENDING_LINE);
    const tag = feedbackTag();
    const outcome = await this.request.courier.dispatch(
      {
        tag,
        createdAt: new Date().toISOString(),
        text: this.text.trim(),
        context: this.request.context,
        actions: this.request.actions,
        picture: this.includePicture ? this.picture : null,
        voice: [...this.tape.clips],
        voiceMs: this.tape.recordedMs,
        save: this.includeSave ? this.request.save : null,
      },
      new Date(),
    );
    if (!this.overlay.root.isConnected) {
      return;
    }
    this.phase = 'done';
    audioManager.play('confirm');
    this.overlay.root.innerHTML = outcomeMarkup(outcome, tag);
    this.overlay.root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close();
    this.overlay.focus('[data-close]');
  }

  private receivePicture(picture: Blob | null): void {
    if (!picture || !this.overlay.root.isConnected) {
      return;
    }
    this.picture = picture;
    this.pictureUrl = URL.createObjectURL(picture);
    if (this.phase === 'writing' || this.phase === 'scrapping') {
      const row = this.overlay.root.querySelector<HTMLElement>('.feedback-attached-list > :first-child');
      if (row) {
        const hadFocus = document.activeElement === row;
        row.outerHTML = pictureRow(this.view());
        this.wireRows();
        if (hadFocus) {
          this.overlay.root.querySelector<HTMLElement>('[data-picture]')?.focus();
        }
      }
    }
  }

  private close(): void {
    if (!this.scene.isActive('feedback')) {
      return;
    }
    audioManager.play('menuClose');
    this.scene.stop();
  }

  private tearDown(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
    // Closing lets go of the microphone whatever state it was in. A message
    // that was sent took its own copy of the clips.
    this.stopPlayback();
    void this.tape.discard();
    if (this.pictureUrl) {
      URL.revokeObjectURL(this.pictureUrl);
      this.pictureUrl = null;
    }
    this.request.onClose();
  }
}
