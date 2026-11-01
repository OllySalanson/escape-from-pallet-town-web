import type { SignInTrouble } from '../maker/playerSignIn';

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
export const PANEL_TITLE = "Call Oak's Lab";

/** Said once, small, beside the title: the game behind the panel is stopped. */
export const PANEL_PAUSED = 'Game paused';

/** Above the box. */
export const PANEL_ASK = 'What happened out there? What would make it better?';

export const PANEL_HINTS = 'TYPE or TALK · TAB to the buttons · ESC close';

/** SEND with nothing typed and nothing recorded. */
export const EMPTY_SEND_LINE = 'Dead air. Type something, or press TALK.';

/** The voice button, before anything is recorded and once something is. */
export const TALK = 'Talk';
export const TALK_MORE = 'Talk more';
/** The same button while it is recording: pressing it again stops. */
export const STOP_TALKING = 'Stop';
export const ON_AIR = 'On air';
export const TALK_NOTE = 'Press once to talk, again to stop.';

export const TAPE_LOW_LINE = '30 seconds of tape left.';
export const TAPE_FULL_LINE = "Tape's full. Every word kept.";
export const MIC_REFUSED_LINE = "No mic, no problem. Type it. The hunter can't hear keys.";
export const MIC_MISSING_LINE = "This browser can't record. Type it instead.";

/** The box is full. */
export const TOO_LONG_LINE = "Even Bill wouldn't read all that. Trim it.";

export const SCRAP_QUESTION = "Scrap this message? It's gone for good.";
export const KEEP_WRITING = 'Keep writing';
export const SCRAP_IT = 'Scrap it';

export const SENDING_LINE = 'Transmitting...';

/** What became of a message, as the player is told it. */
export type FeedbackOutcome = 'sent' | 'queued' | 'held' | 'refused' | 'check-failed' | 'check-missing';

/** The outcomes a TRY AGAIN can do something about: the bot check, passed this time. */
export function canTryTheCheckAgain(outcome: FeedbackOutcome): boolean {
  return outcome === 'check-failed' || outcome === 'check-missing';
}

export const TRY_THE_CHECK_AGAIN = 'Try again';

/**
 * What the panel says while TRY AGAIN is taking the check again. The ending it
 * was pressed on said the check had jammed, and left standing it went on saying
 * so under "Transmitting..." for as long as the new check took.
 */
export const RETRYING_WORDS: OutcomeWords = {
  headline: 'Taking the check again.',
  line: 'One more go at the bot check. If it passes, your message goes now.',
};

export interface OutcomeWords {
  readonly headline: string;
  readonly line: string;
}

/**
 * The three endings of a SEND, each shown above the message's tag. `sent` is
 * the server holding it; `queued` is this browser holding it until it can reach
 * the server (no internet, or the lab's radio not switched on yet); `held` is
 * the daily limit, kept for tomorrow. The two `check-` endings are this browser
 * not getting past the bot check (`maker/playerSignIn.ts`): it `failed`, or it
 * would not even load. Both keep the message, and both can be tried again from
 * where the player is standing.
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
    case 'refused':
      return {
        headline: 'Static on the line.',
        line: "The lab can't take this message as it is. It's kept in your pack, and the next one still goes.",
      };
    case 'check-failed':
      return {
        headline: 'Bot check jammed.',
        line: "The bot check didn't pass, so the lab can't hear you yet. Your message is safe in your pack. Try again, or it goes with the next one you send.",
      };
    case 'check-missing':
      return {
        headline: "Bot check won't load.",
        line: "Something stopped the bot check loading, so the lab can't hear you yet. Your message is safe in your pack. Try again, or it goes with the next one you send.",
      };
  }
}

/** How long a message is kept, said where the panel lists what is sent. */
export const KEPT_LINE = "At the lab for 90 days, then gone. Your voice is deleted as soon as it's been heard.";

/** Beside the tag, on every ending. */
export const TAG_NOTE = 'Your tag. Quote it if you write again.';

export const BACK_TO_THE_GAME = 'Back to the game';

/**
 * What a SEND tells the player once the bot check has had its say: a message
 * that could not go because the check did not pass, or would not load, says
 * so - not "no signal" - so the player knows what to try again.
 */
export function outcomeAfterCheck(outcome: FeedbackOutcome, trouble: SignInTrouble | undefined): FeedbackOutcome {
  if (outcome !== 'queued') {
    return outcome;
  }
  if (trouble === 'failed') {
    return 'check-failed';
  }
  return trouble === 'unavailable' ? 'check-missing' : outcome;
}
