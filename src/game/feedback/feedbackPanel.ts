import { escapeAttribute, pixelCommitBar, pixelScreen, pixelTag, pixelWindow } from '../ui/pixelUi';
import type { LoggedAction } from './actionLog';
import type { FeedbackDetail } from './feedbackContext';
import { MAX_FEEDBACK_TEXT } from './feedbackNote';
import { MAX_VOICE_MS, tapeIsLow, tapeTime } from './voiceTape';
import {
  BACK_TO_THE_GAME,
  KEEP_WRITING,
  MIC_MISSING_LINE,
  ON_AIR,
  STOP_TALKING,
  TALK,
  TALK_MORE,
  TALK_NOTE,
  PANEL_ASK,
  PANEL_HINTS,
  PANEL_PAUSED,
  PANEL_TITLE,
  SCRAP_IT,
  SCRAP_QUESTION,
  TAG_NOTE,
  outcomeWords,
  type FeedbackOutcome,
} from './feedbackWords';

/**
 * The feedback panel's markup, and nothing else: the scene owns what happens.
 *
 * It is the same pixel-ui as every other screen, narrowed to a column down the
 * right of the window - the shape the owner's review tool has, so the player
 * writes beside the thing they are writing about. Everything that rides along
 * with a message is listed on the panel, and SEE IT ALL opens every line of it
 * before anything is sent.
 */
export interface PanelView {
  /** An object URL for the picture, or null when the game could not take one. */
  readonly pictureUrl: string | null;
  readonly includePicture: boolean;
  readonly includeSave: boolean;
  /** Whether there is a save at all; with none, its row says so and does nothing. */
  readonly hasSave: boolean;
  readonly seeAll: boolean;
  readonly details: readonly FeedbackDetail[];
  readonly actions: readonly LoggedAction[];
  readonly voice: VoiceView;
}

/** The voice row, as the panel draws it. */
export interface VoiceView {
  /** Whether this browser can record at all. */
  readonly supported: boolean;
  readonly recording: boolean;
  /** Every clip so far, plus the one being recorded. */
  readonly totalMs: number;
  readonly clips: number;
  readonly playing: boolean;
}

/** How many bars the level meter has. */
export const METER_BARS = 5;

export function countLine(length: number): string {
  return `${length.toLocaleString('en-GB')} / ${MAX_FEEDBACK_TEXT.toLocaleString('en-GB')}`;
}

export function panelMarkup(view: PanelView): string {
  const message = pixelWindow(
    `<label class="feedback-ask px-wrap" for="feedback-text">${PANEL_ASK}</label><textarea id="feedback-text" class="px-window px-field feedback-text" maxlength="${MAX_FEEDBACK_TEXT}" rows="6" spellcheck="true" autocomplete="off" data-help="Type here. TAB takes you on to TALK and the buttons."></textarea>${voiceRow(view.voice)}`,
    { heading: 'Your message', note: `<span data-count>${countLine(0)}</span>`, className: 'feedback-message' },
  );
  const attached = pixelWindow(
    `<div class="px-list feedback-attached-list">${pictureRow(view)}${saveRow(view)}${seeAllRow(view)}</div>${allLines(view)}`,
    { heading: 'Sent with it', className: 'feedback-attached' },
  );
  const body = `<main class="px-body feedback-body">${message}${attached}<div data-commit>${commitBar('writing')}</div></main>`;
  return pixelScreen({
    title: PANEL_TITLE,
    back: { label: 'Game', attribute: 'data-close' },
    aside: PANEL_PAUSED,
    body,
    hints: PANEL_HINTS,
  });
}

/**
 * TALK and what it has recorded. One button that starts and stops (the
 * owner's ruling: press once, not hold), the tape's time beside it, and once
 * there is something on the tape, PLAY and DELETE.
 */
export function voiceRow(voice: VoiceView): string {
  if (!voice.supported) {
    return `<div class="feedback-voice" data-voice><button class="px-window px-button" aria-disabled="true" data-help="${MIC_MISSING_LINE}">${TALK}</button><small class="px-wrap">${MIC_MISSING_LINE}</small></div>`;
  }
  const time = `<span class="feedback-voice-time${tapeIsLow(voice.totalMs) ? ' is-low' : ''}" data-voice-time>${tapeTime(voice.totalMs)}</span>`;
  if (voice.recording) {
    const bars = Array.from({ length: METER_BARS }, () => '<i></i>').join('');
    return `<div class="feedback-voice is-recording" data-voice><button class="px-window px-button feedback-talk is-recording" data-talk data-help="Stop recording. Your words are kept.">${STOP_TALKING}</button><span class="feedback-on-air"><span class="feedback-dot"></span>${ON_AIR}</span><span class="feedback-meter" data-meter>${bars}</span>${time}</div>`;
  }
  if (voice.clips === 0) {
    return `<div class="feedback-voice" data-voice><button class="px-window px-button feedback-talk" data-talk data-help="Record your voice. Press again to stop; up to ${tapeTime(MAX_VOICE_MS)} in all.">${TALK}</button><small class="px-wrap">${TALK_NOTE}</small></div>`;
  }
  return `<div class="feedback-voice" data-voice><button class="px-window px-button feedback-talk" data-talk data-help="Record some more onto the end.">${TALK_MORE}</button>${time}<button class="px-window px-chip" data-play data-help="${voice.playing ? 'Stop playing it back.' : 'Hear what you recorded.'}">${voice.playing ? 'Stop' : 'Play'}</button><button class="px-window px-chip" data-delete-voice data-help="Throw the recording away.">Delete</button></div>`;
}

export function pictureRow(view: Pick<PanelView, 'pictureUrl' | 'includePicture'>): string {
  if (!view.pictureUrl) {
    return `<button class="px-row px-tall" aria-disabled="true" data-help="The game could not take a picture this time."><span class="px-row-main"><span>Picture of this moment</span><small>None this time</small></span></button>`;
  }
  return `<button class="px-row px-tall has-icon has-thumb${view.includePicture ? '' : ' is-left-out'}" data-picture aria-pressed="${view.includePicture}" data-help="${
    view.includePicture ? 'The game as it was when you pressed FEEDBACK. Press to leave it out.' : 'Press to put the picture back in.'
  }"><img class="feedback-thumb" src="${escapeAttribute(view.pictureUrl)}" alt="" /><span class="px-row-main"><span>Picture of this moment</span><small>${
    view.includePicture ? 'Attached. Press to remove' : 'Left out. Press to add'
  }</small></span>${view.includePicture ? pixelTag('On', 'good', true) : pixelTag('Off', 'plain')}</button>`;
}

export function saveRow(view: Pick<PanelView, 'includeSave' | 'hasSave'>): string {
  if (!view.hasSave) {
    return `<button class="px-row px-tall" aria-disabled="true" data-help="There is no saved game in this browser yet."><span class="px-row-main"><span>Include my save</span><small>No save yet</small></span></button>`;
  }
  return `<button class="px-row px-tall" data-save aria-pressed="${view.includeSave}" data-help="${
    view.includeSave ? 'A copy of your saved game, so the lab can load exactly where you are. Press to leave it out.' : 'Press to send a copy of your saved game too.'
  }"><span class="px-row-main"><span>Include my save</span><small>So the lab can load your exact game</small></span>${
    view.includeSave ? pixelTag('On', 'good', true) : pixelTag('Off', 'plain')
  }</button>`;
}

export function seeAllRow(view: Pick<PanelView, 'seeAll' | 'actions'>): string {
  return `<button class="px-row px-tall" data-see-all aria-expanded="${view.seeAll}" data-help="Every line that goes with your message, before you send it."><span class="px-row-main"><span class="px-wrap">Game version, where you are, your last ${view.actions.length} moves</span><small>${
    view.seeAll ? 'Hide it' : 'See it all'
  }</small></span></button>`;
}

/** Every line that rides along, shown under SEE IT ALL. No name, email or location is ever among them. */
export function allLines(view: Pick<PanelView, 'seeAll' | 'details' | 'actions'>): string {
  // Each line is a row the cursor can rest on, though none does anything: a
  // pane with nothing focusable in it cannot be scrolled with the arrow keys.
  const line = (label: string, value: string): string =>
    `<button class="px-row feedback-line" aria-disabled="true"><span class="px-wrap"><span class="feedback-label">${escapeHtml(label)}</span> ${escapeHtml(value)}</span></button>`;
  const details = view.details.map((detail) => line(detail.label, detail.value)).join('');
  const moves = view.actions.length
    ? view.actions.map((action) => line(`${action.at.toFixed(1)}s`, action.what)).join('')
    : line('', 'Nothing yet.');
  return `<div class="px-list feedback-all px-scroll" data-all ${view.seeAll ? '' : 'hidden'}><p class="px-subheading">Where you are</p>${details}<p class="px-subheading">Last moves</p>${moves}<p class="px-subheading">Never sent</p>${line('', 'Your name, email or location, or anything you typed anywhere else.')}</div>`;
}

export function commitBar(phase: 'writing' | 'scrapping'): string {
  return phase === 'scrapping'
    ? pixelCommitBar({
        title: SCRAP_QUESTION,
        actions: `<button class="px-window px-button" data-scrap data-help="Throw this message away.">${SCRAP_IT}</button><button class="px-window px-button is-primary" data-keep data-help="Back to your message.">${KEEP_WRITING}</button>`,
      })
    : pixelCommitBar({
        title: 'Send to the lab',
        actions: `<button class="px-window px-button" data-cancel data-help="Close without sending.">Cancel</button><button class="px-window px-button is-primary" data-send data-help="Send your message to Oak's Lab.">Send</button>`,
      });
}

/** The panel once a message is away (or kept): the line, the tag, and the way back. */
export function outcomeMarkup(outcome: FeedbackOutcome, tag: string): string {
  const words = outcomeWords(outcome);
  const body = `<main class="px-body feedback-outcome-body">${pixelWindow(
    `<p class="px-wrap">${words.line}</p><p class="feedback-tag-row"><span class="feedback-tag">${tag}</span><span class="px-wrap">${TAG_NOTE}</span></p><button class="px-window px-button is-primary" data-close data-help="Close the radio and carry on.">${BACK_TO_THE_GAME}</button>`,
    { heading: words.headline, className: `feedback-outcome is-${outcome}` },
  )}</main>`;
  return pixelScreen({ title: PANEL_TITLE, aside: PANEL_PAUSED, body, hints: 'ENTER or ESC back to the game' });
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
