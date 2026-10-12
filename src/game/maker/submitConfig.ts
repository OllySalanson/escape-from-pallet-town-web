/**
 * Where player maps are sent: the game's own Supabase project.
 *
 * Both values are public by design and ship in every build - the publishable
 * key only lets a browser call what the database's row-level security and its
 * two functions allow (`supabase/migrations/`), which is to send a map in and
 * ask after its own maps. Nothing that can read the inbox is ever in the game.
 */
export const SUBMISSIONS_URL = 'https://ejdazksxwwiubudkkvaj.supabase.co';
export const SUBMISSIONS_PUBLISHABLE_KEY = 'sb_publishable_QEg_5n-gSmRZZPU4NZU0nA_kZuWehzf';

/**
 * The Cloudflare Turnstile site key the bot check is drawn with: the widget
 * "Pallet Town" (managed, for ollysalanson.github.io and localhost). Public by
 * design, like the key above; its secret lives only in the project's Attack
 * Protection settings. Every sign-in passes a token from it
 * (`playerSignIn.ts`), so the project's captcha protection can be switched on
 * or off without a build. Empty would mean no check is drawn at all.
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFU2WopkVTcJJdi1';
