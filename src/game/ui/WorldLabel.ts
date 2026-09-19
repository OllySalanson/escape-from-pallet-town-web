import type Phaser from 'phaser';
import { drawPixelWindow } from './pixelWindow';
import { GAME_FONT } from './gameFont';
import { CAPTION_FONT_SIZE } from './screenType';
import {
  SUBJECT_GAP,
  type CaptionPlacement,
  type CaptionRequest,
  type CaptionSide,
  type Rect,
} from './labelPlacement';
import { captionSpeaks, type CaptionAudience, type CaptionSpeech } from './captionReveal';

/**
 * A caption pinned to something on the map.
 *
 * Map captions used to be `Text` objects with a `backgroundColor`, which draws a
 * hard rectangle with no frame - a second visual language beside the raid HUD's
 * windows. This is the same drawn window as the HUD, in a darker weight so world
 * annotation reads as quieter than screen furniture.
 *
 * Where it is allowed to sit is not decided here: `labelPlacement.ts` owns that
 * rule for every caption at once, and this only draws the answer. Nor is
 * whether it speaks at all: `captionReveal.ts` owns that, and a caption carries
 * the `speech` it is judged by - what kind of thing it is, and which tiles it
 * is about - rather than the scene deciding per label.
 */

export interface WorldLabelTone {
  readonly fill: number;
  readonly border: number;
  readonly ink: string;
}

/**
 * Which side of its anchor the caption prefers. Captions sit above what they
 * name, except where that would cover the thing being explained - a trainer's
 * watch runs north out of the trainer, so its caption prefers south of them.
 * A caption with nowhere clear on its preferred side is moved by
 * `placeCaptions`, so this is a preference rather than an instruction.
 */
export type WorldLabelPlacement = CaptionSide;

const PADDING_X = 3;
const PADDING_Y = 2;

/**
 * A caption's part in a group that is named together when it is on screen
 * together - see `CaptionRequest.group`.
 */
export interface WorldLabelGrouping {
  readonly group?: string;
  readonly speaksFor?: string;
}

/** Everything a caption is made of but its scene. */
export interface WorldLabelSpec {
  /**
   * The rectangle of map the named thing is drawn on. The caption is seated
   * around it and never over it.
   */
  readonly subject: Rect;
  readonly text: string;
  readonly tone: WorldLabelTone;
  readonly depth: number;
  readonly placement?: WorldLabelPlacement;
  /** What kind of thing this caption is, and which tiles - see `captionReveal.ts`. */
  readonly speech: CaptionSpeech;
  /** A caption that is one sentence said twice - see `CaptionRequest.group`. */
  readonly grouping?: WorldLabelGrouping;
}

export class WorldLabel {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly subject: Rect;
  private readonly preferred: WorldLabelPlacement;
  private speech: CaptionSpeech;
  private readonly grouping: WorldLabelGrouping;
  private tone: WorldLabelTone;
  private held: number | undefined;
  /** Whether it speaks this frame, decided by `describe()` and read by `request()`. */
  private speaking = true;

  public constructor(scene: Phaser.Scene, spec: WorldLabelSpec) {
    const { subject, text, tone, depth, placement = 'above', speech, grouping = {} } = spec;
    this.grouping = grouping;
    this.subject = subject;
    this.preferred = placement;
    this.speech = speech;
    this.tone = tone;
    this.frame = scene.add.graphics().setDepth(depth);
    // Drawn from the top-left rather than centred: a centred caption whose text
    // is an odd number of pixels wide lands on a half pixel, and every glyph in
    // it is then resampled into a grey smear at the screen's whole-number zoom.
    this.label = scene.add
      .text(subject.x, subject.y, text, {
        fontFamily: GAME_FONT,
        fontSize: CAPTION_FONT_SIZE,
        color: tone.ink,
        lineSpacing: 1,
      })
      .setOrigin(0, 0)
      .setDepth(depth + 0.0005);
    this.draw(
      Math.round(subject.x + subject.width / 2 - this.windowWidth() / 2),
      Math.round(
        placement === 'above'
          ? subject.y - SUBJECT_GAP - this.windowHeight()
          : subject.y + subject.height + SUBJECT_GAP,
      ),
    );
  }

  /**
   * An exit that has just opened is a different caption to `captionReveal.ts`:
   * an open way out calls for itself once the clock goes red, and a sealed one
   * never does.
   */
  public setOpen(open: boolean): void {
    this.speech = { ...this.speech, open };
  }

  public setText(text: string, tone: WorldLabelTone): void {
    this.label.setText(text);
    this.tone = tone;
    this.label.setColor(tone.ink);
    this.draw(this.windowX, this.windowY);
  }

  /**
   * Asks `captionReveal.ts` whether this caption speaks to this player, this
   * frame. Called once per frame before the seating, because what speaks is
   * what has to be seated.
   */
  public describe(audience: CaptionAudience): void {
    this.speaking = captionSpeaks(this.speech, audience);
  }

  /** What this caption asks of `placeCaptions`: what it names, its size, and whether it speaks. */
  public request(): CaptionRequest {
    return {
      subject: this.subject,
      width: this.windowWidth(),
      height: this.windowHeight(),
      preferred: this.preferred,
      held: this.held,
      warns: this.speech.voice === 'warning',
      speaks: this.speaking,
      ...this.grouping,
    };
  }

  /**
   * Takes the seat `placeCaptions` found for it. Called every frame, because
   * the view and the HUD both move under the caption while the player walks. A
   * caption with no clear seat is not drawn at all.
   */
  public seat(placement: CaptionPlacement): void {
    this.held = placement.visible ? placement.candidate : undefined;
    this.frame.setVisible(placement.visible);
    this.label.setVisible(placement.visible);
    if (placement.visible && (placement.x !== this.windowX || placement.y !== this.windowY)) {
      this.draw(placement.x, placement.y);
    }
  }

  public destroy(): void {
    this.frame.destroy();
    this.label.destroy();
  }

  private get windowX(): number {
    return this.label.x - PADDING_X;
  }

  private get windowY(): number {
    return this.label.y - PADDING_Y;
  }

  private windowWidth(): number {
    return Math.ceil(this.label.width) + PADDING_X * 2;
  }

  private windowHeight(): number {
    return Math.ceil(this.label.height) + PADDING_Y * 2;
  }

  private draw(x: number, y: number): void {
    const width = this.windowWidth();
    const height = this.windowHeight();
    this.frame.clear();
    drawPixelWindow(
      this.frame,
      { x, y, width, height },
      { fill: this.tone.fill, border: this.tone.border },
    );
    this.label.setPosition(x + PADDING_X, y + PADDING_Y);
  }
}
