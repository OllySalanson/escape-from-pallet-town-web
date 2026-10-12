import { describe, expect, it, vi } from 'vitest';
import { signInWith, troubleOf, type SignInParts } from './playerSignIn';
import { BOT_CHECK_QUIET_MS, BOT_CHECK_TIMEOUT_MS, botCheckNeeded, checkWith, type TurnstileApi } from './turnstile';
import { TURNSTILE_SITE_KEY } from './submitConfig';

/** A sign-in's parts with every call written down, in order. */
function parts(overrides: Partial<SignInParts> = {}) {
  const calls: string[] = [];
  const made: SignInParts = {
    needsCheck: true,
    session: () => (calls.push('session'), Promise.resolve(null)),
    check: () => (calls.push('check'), Promise.resolve({ passed: true, token: 'tok' })),
    signIn: (token) => (calls.push(`sign in ${token ?? 'without a token'}`), Promise.resolve({ uid: 'u1', error: null })),
    ...overrides,
  };
  return { calls, parts: made };
}

describe('signing a browser in as a player', () => {
  it('ships with the Pallet Town bot check switched on', () => {
    expect(TURNSTILE_SITE_KEY).toBe('0x4AAAAAAFU2WopkVTcJJdi1');
    expect(botCheckNeeded()).toBe(true);
    expect(botCheckNeeded('')).toBe(false);
  });

  it("passes a fresh check's token with every sign-in, whether or not the project asks for one yet", async () => {
    const { calls, parts: made } = parts();
    expect(await signInWith(made)).toEqual({ ok: true, uid: 'u1' });
    expect(calls).toEqual(['session', 'check', 'sign in tok']);
  });

  it('draws no check and makes no player when the browser is already one', async () => {
    const { calls, parts: made } = parts({ session: () => Promise.resolve('u0') });
    expect(await signInWith(made)).toEqual({ ok: true, uid: 'u0' });
    expect(calls).toEqual([]);
  });

  it('never signs in when the check would not load or did not pass, and says which', async () => {
    for (const why of ['unavailable', 'failed'] as const) {
      const { calls, parts: made } = parts({ check: () => Promise.resolve({ passed: false, why }) });
      expect(await signInWith(made)).toEqual({ ok: false, trouble: why });
      expect(calls).toEqual(['session']);
    }
  });

  it('reads what the project said when it refused', async () => {
    const refused = (message: string, status?: number) =>
      parts({ signIn: () => Promise.resolve({ uid: null, error: { message, ...(status ? { status } : {}) } }) }).parts;
    expect(await signInWith(refused('captcha protection: request disallowed (invalid-input-response)'))).toEqual({
      ok: false,
      trouble: 'failed',
    });
    expect(await signInWith(refused('Anonymous sign-ins are disabled'))).toEqual({ ok: false, trouble: 'refused' });
    expect(await signInWith(refused('Request rate limit reached', 429))).toEqual({ ok: false, trouble: 'busy' });
    expect(await signInWith(refused('Failed to fetch'))).toEqual({ ok: false, trouble: 'offline' });
    expect(
      await signInWith(parts({ session: () => Promise.reject(new TypeError('Failed to fetch')) }).parts),
    ).toEqual({ ok: false, trouble: 'offline' });
  });

  it('knows the troubles by their codes too', () => {
    expect(troubleOf({ code: 'captcha_failed' })).toBe('failed');
    expect(troubleOf({ code: 'anonymous_provider_disabled' })).toBe('refused');
    expect(troubleOf({ status: 429 })).toBe('busy');
    expect(troubleOf(undefined)).toBe('offline');
  });
});

describe('the bot check', () => {
  /** A stand-in Turnstile: hands back the options it was drawn with, and what was removed. */
  function turnstile() {
    const drawn: Record<string, unknown>[] = [];
    const removed: string[] = [];
    const api: TurnstileApi = {
      render: (_element, options) => (drawn.push(options), `w${drawn.length}`),
      remove: (widget) => void removed.push(widget),
    };
    const call = (name: string, ...args: unknown[]) => (drawn.at(-1)![name] as (...rest: unknown[]) => unknown)(...args);
    return { api, drawn, removed, call };
  }
  const element = {} as HTMLElement;

  it('is drawn invisibly, asking the player something only when Turnstile is unsure', async () => {
    const { api, drawn, removed, call } = turnstile();
    let asked = false;
    const check = checkWith(api, element, 'key', { onAsking: () => (asked = true) });
    expect(drawn[0]).toMatchObject({ sitekey: 'key', appearance: 'interaction-only', retry: 'never' });
    call('before-interactive-callback');
    expect(asked).toBe(true);
    call('callback', 'tok');
    expect(await check).toEqual({ passed: true, token: 'tok' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(removed).toEqual(['w1']);
  });

  it('fails on an error, an expiry or a timeout, handling the error so Turnstile does not throw it', async () => {
    for (const ending of ['error-callback', 'expired-callback', 'timeout-callback']) {
      const { api, call } = turnstile();
      const check = checkWith(api, element, 'key');
      const handled = call(ending, '300030');
      if (ending === 'error-callback') {
        expect(handled).toBe(true);
      }
      expect(await check).toEqual({
        passed: false,
        why: 'failed',
        code: ending === 'error-callback' ? '300030' : ending === 'expired-callback' ? 'expired' : 'timeout',
      });
    }
  });

  it('counts only its first ending', async () => {
    const { api, call } = turnstile();
    const check = checkWith(api, element, 'key');
    call('error-callback', '1');
    call('callback', 'late');
    expect(await check).toEqual({ passed: false, why: 'failed', code: '1' });
  });

  it('is unavailable when Turnstile would not load, will not draw, or does not work in this browser', async () => {
    expect(await checkWith(undefined, element, 'key')).toEqual({ passed: false, why: 'unavailable' });
    const broken: TurnstileApi = {
      render: () => {
        throw new Error('no');
      },
      remove: () => undefined,
    };
    expect(await checkWith(broken, element, 'key')).toEqual({ passed: false, why: 'unavailable' });
    const { api, call } = turnstile();
    const check = checkWith(api, element, 'key');
    call('unsupported-callback');
    expect(await check).toEqual({ passed: false, why: 'unavailable' });
  });

  it('fails a check that stays silent, and gives a player it asks the time to answer', async () => {
    vi.useFakeTimers();
    try {
      const silent = turnstile();
      let ended: unknown;
      void checkWith(silent.api, element, 'key').then((result) => (ended = result));
      await vi.advanceTimersByTimeAsync(BOT_CHECK_QUIET_MS - 1);
      expect(ended).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(ended).toEqual({ passed: false, why: 'failed', code: 'unanswered' });

      const asking = turnstile();
      let answered: unknown;
      void checkWith(asking.api, element, 'key').then((result) => (answered = result));
      await vi.advanceTimersByTimeAsync(BOT_CHECK_QUIET_MS - 1);
      asking.call('before-interactive-callback');
      await vi.advanceTimersByTimeAsync(BOT_CHECK_TIMEOUT_MS - 1);
      expect(answered).toBeUndefined();
      asking.call('callback', 'tok');
      await vi.advanceTimersByTimeAsync(0);
      expect(answered).toEqual({ passed: true, token: 'tok' });
    } finally {
      vi.useRealTimers();
    }
  });
});
