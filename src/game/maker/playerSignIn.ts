import { supabase } from './supabaseClient';
import { botCheckNeeded, runBotCheck, type BotCheck } from './turnstile';

/**
 * Signing a browser in as a player: the one way the game ever does it, for all
 * three things a player sends - a message from the FEEDBACK tab, a map from the
 * map maker and a score from the house console - so a browser is one anonymous
 * player for all three, and every sign-in passes the bot check.
 *
 * A player has no account, only a private anonymous id, and the bot check is
 * what keeps those ids from being free (the security review's H1): every
 * sign-in carries a fresh Turnstile token. The project may or may not be asking
 * for one yet - it ignores a token it has not asked for - so the game passes
 * one either way and nothing changes the moment the owner switches the
 * project's captcha protection on.
 *
 * Signing in is done only to *send*, never to look: a console board is read
 * signed out, and a message waits in the pack until its sender is signed in.
 * Whatever goes wrong is handed back as a `SignInTrouble`, and each place says
 * it in its own voice and keeps what the player was sending to try again.
 */

/**
 * Why a browser is not signed in: the check would not load (`unavailable`), or
 * did not pass (`failed`); the project is not taking players (`refused`);
 * too many sign-ins from this connection lately (`busy`); or no answer at all
 * (`offline`).
 */
export type SignInTrouble = 'unavailable' | 'failed' | 'refused' | 'busy' | 'offline';

export type PlayerSignIn =
  | { readonly ok: true; readonly uid: string }
  | { readonly ok: false; readonly trouble: SignInTrouble };

/** What signing in needs from the world, so the rule is tested without one. */
export interface SignInParts {
  /** This browser's player id, if it is already signed in. */
  session(): Promise<string | null>;
  /** Asks the project for a new anonymous player, with a check's token if there is one. */
  signIn(captchaToken: string | undefined): Promise<{ readonly uid: string | null; readonly error: SignInError | null }>;
  /** Draws the bot check and waits for its end. */
  check(): Promise<BotCheck>;
  /** Whether this build asks for the check at all. */
  readonly needsCheck: boolean;
}

export interface SignInError {
  readonly message?: string;
  readonly status?: number;
  readonly code?: string;
}

/** The rule: a session if there is one, else the check, then a sign-in with its token. */
export async function signInWith(parts: SignInParts): Promise<PlayerSignIn> {
  try {
    const existing = await parts.session();
    if (existing) {
      return { ok: true, uid: existing };
    }
    let token: string | undefined;
    if (parts.needsCheck) {
      const check = await parts.check();
      if (!check.passed) {
        return { ok: false, trouble: check.why };
      }
      token = check.token;
    }
    const { uid, error } = await parts.signIn(token);
    if (error || !uid) {
      return { ok: false, trouble: troubleOf(error) };
    }
    return { ok: true, uid };
  } catch (error) {
    return { ok: false, trouble: troubleOf(error as SignInError) };
  }
}

/** What a refused sign-in means, from what the project said. */
export function troubleOf(error: SignInError | null | undefined): SignInTrouble {
  const message = error?.message ?? '';
  if (/captcha/i.test(message) || error?.code === 'captcha_failed') {
    return 'failed';
  }
  if (/anonymous sign-?ins are disabled/i.test(message) || error?.code === 'anonymous_provider_disabled') {
    return 'refused';
  }
  if (error?.status === 429 || /rate limit|too many/i.test(message)) {
    return 'busy';
  }
  return 'offline';
}

let signingIn: Promise<PlayerSignIn> | undefined;

/**
 * Signs this browser in as a player, drawing the bot check if it has to. Two
 * asks at once share one sign-in, so a score and a waiting score retried
 * beside it never draw two checks or make two players.
 */
export function signInAsPlayer(): Promise<PlayerSignIn> {
  signingIn ??= signInWith(liveParts()).finally(() => {
    signingIn = undefined;
  });
  return signingIn;
}

/** This browser's player id if it is signed in, without signing anybody in. */
export async function currentPlayer(): Promise<string | null> {
  const { data } = await (await supabase()).auth.getSession();
  return data.session?.user.id ?? null;
}

function liveParts(): SignInParts {
  return {
    needsCheck: botCheckNeeded(),
    session: currentPlayer,
    signIn: async (captchaToken) => {
      const db = await supabase();
      const { data, error } = await db.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
      return { uid: data.user?.id ?? null, error };
    },
    check: () => checkInItsOwnBox(),
  };
}

/** The one line the check says when it has to ask, wherever it is asked. */
export const BOT_CHECK_ASK = "One quick check that you're not a bot, so spam can't jam Pallet Town.";

/**
 * Draws the check in a box of its own over everything - every menu and a
 * console game too - rather than inside a screen, because a screen redraws its
 * markup on every change and would take the check down with it. The box shows
 * nothing at all unless Turnstile has to ask, and goes once the check has ended.
 */
async function checkInItsOwnBox(): Promise<BotCheck> {
  const box = document.createElement('div');
  box.className = 'bot-check';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Bot check');
  const line = document.createElement('p');
  line.textContent = BOT_CHECK_ASK;
  const widget = document.createElement('div');
  box.append(line, widget);
  document.body.append(box);
  try {
    return await runBotCheck(widget, { onAsking: () => box.classList.add('is-asking') });
  } finally {
    box.remove();
  }
}
