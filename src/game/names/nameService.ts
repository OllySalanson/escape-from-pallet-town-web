import { checkPlayerName } from '../console/playerName';
import { pageHarbourMode, rememberHouseWritten } from '../harbour/harbour';

/**
 * A player's name is one each: nobody else in Pallet Town has it, whatever its
 * case. The database decides (`supabase/migrations/*_unique_names.sql`): a
 * name is checked as it is typed (`name_is_free`, signed out too) and held by
 * the player who chose it in the same step it is checked (`name_my_house`,
 * under a lock, with a unique index under that), so two people pressing OK on
 * the same name at the same moment cannot both have it.
 *
 * A name belongs to the browser it was made in: the player is an anonymous
 * Supabase user, and their id lives in this browser's storage. Clearing the
 * browser's data loses the id, and with it the name.
 *
 * The local stand-in plays the same part in a test (`?harbour=local`): names
 * the test lists as taken (`sessionStorage`, `LOCAL_TAKEN_KEY`) are taken, and
 * nothing reaches the live project.
 */

/** What a typed name would be: free, already the player's, somebody else's, or not a name at all. */
export type NameCheck = 'free' | 'yours' | 'taken' | 'invalid' | 'unkind';

/** What came of choosing one: it is the player's now, somebody else's, refused by the rules, or no answer. */
export type NameClaim = 'claimed' | 'taken' | 'refused' | 'offline';

export interface NameService {
  check(name: string): Promise<NameCheck>;
  claim(name: string): Promise<NameClaim>;
}

const CHECKS: readonly NameCheck[] = ['free', 'yours', 'taken', 'invalid', 'unkind'];

/** The live service: the game's Supabase project, through the game's one sign-in. */
export function liveNameService(): NameService {
  return {
    async check(name) {
      const { supabase } = await import('../maker/supabaseClient');
      const { data, error } = await (await supabase()).rpc('name_is_free', { player_name: name });
      if (error) {
        throw new Error(error.message);
      }
      return CHECKS.find((each) => each === data) ?? 'invalid';
    },
    async claim(name) {
      try {
        const [{ signInAsPlayer }, { supabase }] = await Promise.all([
          import('../maker/playerSignIn'),
          import('../maker/supabaseClient'),
        ]);
        const signedIn = await signInAsPlayer();
        if (!signedIn.ok) {
          return 'offline';
        }
        const { data, error } = await (await supabase()).rpc('name_my_house', { player_name: name });
        if (error) {
          // The rules the database repeats are the game's own, so a refusal
          // here is a name the screen should not have let through.
          return error.code === '22023' ? 'refused' : 'offline';
        }
        if (data === 'taken') {
          return 'taken';
        }
        rememberHouseWritten(signedIn.uid, name);
        return 'claimed';
      } catch {
        return 'offline';
      }
    },
  };
}

/** The names a test lists as somebody else's, comma-separated, for the local stand-in. */
export const LOCAL_TAKEN_KEY = 'eptw-names-local-taken';

/** The local stand-in: every name is free but the ones the test says are taken. */
export function localNameService(): NameService {
  const taken = (): Set<string> => {
    try {
      return new Set(
        (window.sessionStorage.getItem(LOCAL_TAKEN_KEY) ?? '')
          .split(',')
          .map((name) => name.trim().toUpperCase())
          .filter(Boolean),
      );
    } catch {
      return new Set();
    }
  };
  const check = (name: string): NameCheck => {
    const ruled = checkPlayerName(name);
    if (!ruled.ok) {
      return ruled.problem === 'unkind' ? 'unkind' : 'invalid';
    }
    return taken().has(ruled.name.toUpperCase()) ? 'taken' : 'free';
  };
  return {
    check: (name) => Promise.resolve(check(name)),
    claim: (name) => {
      const answer = check(name);
      return Promise.resolve(answer === 'free' ? 'claimed' : answer === 'taken' ? 'taken' : 'refused');
    },
  };
}

let service: NameService | null | undefined;

/** This page's names, or null where there is nothing to check them against: a test that did not ask. */
export function nameService(): NameService | null {
  if (service === undefined) {
    const mode = pageHarbourMode();
    service = mode === 'live' ? liveNameService() : mode === 'local' ? localNameService() : null;
  }
  return service;
}
