import { TURNSTILE_SITE_KEY } from './submitConfig';

/**
 * The bot check a browser passes before it signs in as a player: Cloudflare
 * Turnstile, drawn invisibly (`interaction-only`), so nearly everybody passes
 * it without seeing anything and the few it is unsure of are asked to tick a
 * box. Its script is fetched the first time a browser has to sign in - to send
 * a message, a map or a console score - so nobody else downloads it.
 *
 * A check ends one of three ways, and each is said differently to a player:
 * `passed` with a token good for one sign-in; `unavailable`, when the check
 * could not even be drawn (the script would not load - a blocker, no internet);
 * and `failed`, when it was drawn and did not pass, ran out of time or was
 * never answered.
 */

export interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(widget: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type BotCheck =
  | { readonly passed: true; readonly token: string }
  | {
      readonly passed: false;
      readonly why: 'unavailable' | 'failed';
      /** Turnstile's own error code, when it gave one: what the feedback log keeps of a failure. */
      readonly code?: string;
    };

export interface BotCheckOptions {
  /** Turnstile is unsure and is about to ask the player something: show the check. */
  readonly onAsking?: () => void;
  /** How long a check that has not asked anything may take before it counts as failed. */
  readonly quietMs?: number;
  /** How long it may take once it has asked the player something. */
  readonly askingMs?: number;
}

/**
 * An invisible pass takes a second or two; a check still silent after this
 * is not going to answer (a headless browser waits on Turnstile forever), and
 * the player is told rather than left watching "Transmitting...".
 */
export const BOT_CHECK_QUIET_MS = 30_000;

/**
 * Long enough for somebody who is asked to tick a box to read the line above
 * it and tick it. Nothing waits on a check longer than this.
 */
export const BOT_CHECK_TIMEOUT_MS = 120_000;

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading: Promise<TurnstileApi | undefined> | undefined;

function loadTurnstile(): Promise<TurnstileApi | undefined> {
  loading ??= new Promise((resolve) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => {
      // A script that would not load is tried again next time, not remembered as gone.
      loading = undefined;
      script.remove();
      resolve(undefined);
    };
    document.head.append(script);
  });
  return loading;
}

/** Whether this build asks for a bot check before signing in. */
export function botCheckNeeded(siteKey: string = TURNSTILE_SITE_KEY): boolean {
  return siteKey.length > 0;
}

/** Draws the check into `element` and resolves with how it ended. */
export async function runBotCheck(element: HTMLElement, options: BotCheckOptions = {}): Promise<BotCheck> {
  return checkWith(await loadTurnstile(), element, TURNSTILE_SITE_KEY, options);
}

/**
 * The check against a loaded Turnstile, or none: the whole rule, kept apart
 * from the script tag so it is tested as it is. The widget is always taken
 * down again once the check has ended, however it ended, so the next check
 * can be drawn in the same place, and only the first ending counts.
 */
export function checkWith(
  api: TurnstileApi | undefined,
  element: HTMLElement,
  siteKey: string,
  options: BotCheckOptions = {},
): Promise<BotCheck> {
  if (!api) {
    return Promise.resolve({ passed: false, why: 'unavailable' });
  }
  return new Promise((resolve) => {
    let widget: string | undefined;
    let ended = false;
    const end = (result: BotCheck): void => {
      if (ended) {
        return;
      }
      ended = true;
      clearTimeout(timer);
      // Taken down after the callback that ended it has returned: Turnstile
      // does not expect a widget to be removed from inside its own callback.
      setTimeout(() => {
        if (widget !== undefined) {
          try {
            api.remove(widget);
          } catch {
            // Already gone with its element.
          }
        }
      }, 0);
      resolve(result);
    };
    const failed = (code?: unknown): void =>
      end({ passed: false, why: 'failed', ...(typeof code === 'string' && code ? { code } : {}) });
    let timer = setTimeout(() => failed('unanswered'), options.quietMs ?? BOT_CHECK_QUIET_MS);
    try {
      widget = api.render(element, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        theme: 'light',
        retry: 'never',
        'refresh-expired': 'never',
        callback: (token: string) => end({ passed: true, token }),
        // Handled, so Turnstile reports the error to us rather than throwing it.
        'error-callback': (code: unknown) => {
          failed(code);
          return true;
        },
        'expired-callback': () => failed('expired'),
        'timeout-callback': () => failed('timeout'),
        'unsupported-callback': () => end({ passed: false, why: 'unavailable' }),
        'before-interactive-callback': () => {
          // A player being asked gets the time to answer.
          clearTimeout(timer);
          timer = setTimeout(() => failed('unanswered'), options.askingMs ?? BOT_CHECK_TIMEOUT_MS);
          options.onAsking?.();
        },
      });
    } catch {
      end({ passed: false, why: 'unavailable' });
    }
  });
}
