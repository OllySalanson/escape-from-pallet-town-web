/**
 * Every word the feedback panel says to a player.
 *
 * The owner's ruling (2026-10-10, on the plan board): "Sent. Thank you. Your
 * code is ..." was as boring as a stock 404 page, and the game has an attitude
 * of its own. So the panel is a radio call home from a raid, in the voice the
 * raid already speaks in - extraction, the hunter, the pack, Oak's Lab, Bill -
 * and the rules are that a line is short, never blames the player, and every
 * line that says a message got through carries its tag, because the tag is what
 * a player quotes if they write again.
 *
 * The tab itself is the one plain word on purpose: FEEDBACK, so nobody has to
 * guess what it is before they press it.
 */

/** The always-there tab on the edge of the screen. */
export const FEEDBACK_TAB_LABEL = 'Feedback';

/** The panel's name, in its title bar. */
export const PANEL_TITLE = "Radio Oak's Lab";

/** Said once, small, beside the title: the game behind the panel is stopped. */
export const PANEL_PAUSED = 'Game paused';

/** Above the box. */
export const PANEL_ASK = 'What happened out there? What would make it better?';

export const PANEL_HINTS = 'TYPE · TAB to the buttons · ESC close';

/** SEND with nothing typed (and, from the voice stage on, nothing recorded). */
export const EMPTY_SEND_LINE = 'Dead air. Type something first.';

/** The box is full. */
export const TOO_LONG_LINE = "Even Bill wouldn't read all that. Trim it.";

export const SCRAP_QUESTION = "Scrap this message? It's gone for good.";
export const KEEP_WRITING = 'Keep writing';
export const SCRAP_IT = 'Scrap it';

export const SENDING_LINE = 'Transmitting...';

/** What became of a message, as the player is told it. */
export type FeedbackOutcome = 'sent' | 'queued' | 'held';

export interface OutcomeWords {
  readonly headline: string;
  readonly line: string;
}

/**
 * The three endings of a SEND, each shown above the message's tag. `sent` is
 * the server holding it; `queued` is this browser holding it until it can reach
 * the server (no internet, or the lab's radio not switched on yet); `held` is
 * the daily limit, kept for tomorrow.
 */
export function outcomeWords(outcome: FeedbackOutcome): OutcomeWords {
  switch (outcome) {
    case 'sent':
      return {
        headline: 'Message extracted.',
        line: "It made it out, which is more than most. Oak's Lab has it.",
      };
    case 'queued':
      return {
        headline: 'No signal.',
        line: "Your message is safe in your pack. It sends itself next time you're on the air.",
      };
    case 'held':
      return {
        headline: "The lab's radio is red hot.",
        line: 'Five a day; even Oak sleeps. Your message is kept and goes out tomorrow.',
      };
  }
}

/** Beside the tag, on every ending. */
export const TAG_NOTE = 'Your tag. Quote it if you write again.';

export const BACK_TO_THE_GAME = 'Back to the game';
