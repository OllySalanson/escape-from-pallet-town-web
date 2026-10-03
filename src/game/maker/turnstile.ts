import { TURNSTILE_SITE_KEY } from './submitConfig';

/**
 * The bot check a maker passes before their first map is sent: Cloudflare
 * Turnstile, which mostly passes without asking anything. Its script is only
 * fetched when a maker opens the send panel, so nobody else downloads it.
 */

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(widget: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

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
      loading = undefined;
      resolve(undefined);
    };
    document.head.append(script);
  });
  return loading;
}

export function botCheckNeeded(): boolean {
  return TURNSTILE_SITE_KEY.length > 0;
}

/**
 * Draws the check into `element` and resolves with its token once it is
 * passed, or undefined if the check could not be shown at all.
 */
export async function passBotCheck(element: HTMLElement): Promise<string | undefined> {
  const api = await loadTurnstile();
  if (!api) {
    return undefined;
  }
  return new Promise((resolve) => {
    api.render(element, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'light',
      callback: (token: string) => resolve(token),
      'error-callback': () => resolve(undefined),
      'expired-callback': () => resolve(undefined),
    });
  });
}
