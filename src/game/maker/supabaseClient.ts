import type { SupabaseClient } from '@supabase/supabase-js';
import { SUBMISSIONS_PUBLISHABLE_KEY, SUBMISSIONS_URL } from './submitConfig';

/**
 * The one Supabase client the game makes, loaded on first use so nobody who
 * never sends or reviews a map downloads it.
 *
 * Its types are the database as `supabase/migrations/` declares it. A maker's
 * browser can only call `submit_map` and `my_submissions`, and a player's
 * `submit_feedback` (`feedback/feedbackSender.ts`); the table rows are here for
 * the reviewer, whom row-level security lets read and decide.
 */

export type SubmissionStatus = 'waiting' | 'sent_back' | 'approved' | 'rejected' | 'published';

export type SubmissionRow = {
  readonly id: string;
  readonly receipt_code: string;
  readonly maker_uid: string;
  readonly maker_name: string;
  readonly map_name: string;
  readonly map: unknown;
  readonly format: number;
  readonly status: SubmissionStatus;
  readonly owner_note: string | null;
  readonly revision: number;
  readonly revision_of: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

export type SentRow = {
  readonly receipt_code: string;
  readonly map_name: string;
  readonly status: SubmissionStatus;
  readonly owner_note: string | null;
  readonly revision: number;
  readonly created_at: string;
  readonly updated_at: string;
};

export type GameDatabase = {
  public: {
    Tables: {
      map_submissions: {
        Row: SubmissionRow;
        Insert: Record<string, never>;
        Update: {
          status?: SubmissionStatus;
          owner_note?: string | null;
          map?: unknown;
          map_name?: string;
        };
        Relationships: [];
      };
      blocked_makers: {
        Row: { maker_uid: string; reason: string | null; created_at: string };
        Insert: { maker_uid: string; reason?: string | null };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_map: {
        Args: { map: unknown; maker_name: string; resubmits: string | null };
        Returns: string;
      };
      my_submissions: { Args: Record<PropertyKey, never>; Returns: SentRow[] };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      submit_feedback: {
        Args: {
          tag: string;
          message: string;
          context: unknown;
          actions: unknown;
          save: string | null;
          picture_path: string | null;
          voice_paths: string[];
          voice_ms: number;
          written_at: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Where a client keeps its session, as the auth library reads it. */
type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * The player's client: an anonymous maker or feedback sender, kept across
 * visits so "your maps" stay theirs. It never signs in through a redirect, so
 * it never reads the address - the reviewer's sign-in comes back with a code
 * that is the review client's to spend.
 */
export function playerClientOptions() {
  return {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'escape-from-pallet-town.maker.session',
    },
  } as const;
}

/**
 * The reviewer's client, and only the reviewer's (the security review's M5).
 * A reviewer's session can read every player's map and approve one into the
 * game, and the game shares its origin with every other page served from
 * ollysalanson.github.io - so the session is kept for this tab only
 * (`sessionStorage`, which also holds the sign-in's PKCE verifier across the
 * GitHub round trip in the same tab) and never in the `localStorage` any page
 * on that origin can read. Closing the tab signs the reviewer out. It is a
 * client of its own, so signing in to review no longer replaces the browser's
 * anonymous maker session either.
 */
export function reviewClientOptions(storage: SessionStore | undefined) {
  return {
    auth: {
      persistSession: storage !== undefined,
      autoRefreshToken: true,
      // The reviewer signs in through GitHub and comes back with a code in
      // the address, which this client trades for a session as it starts.
      flowType: 'pkce',
      detectSessionInUrl: true,
      storageKey: 'escape-from-pallet-town.review.session',
      ...(storage ? { storage } : {}),
    },
  } as const;
}

function tabStorage(): SessionStore | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

let client: Promise<SupabaseClient<GameDatabase>> | undefined;
let reviewClient: Promise<SupabaseClient<GameDatabase>> | undefined;

/** The player's client. See `playerClientOptions`. */
export function supabase(): Promise<SupabaseClient<GameDatabase>> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<GameDatabase>(SUBMISSIONS_URL, SUBMISSIONS_PUBLISHABLE_KEY, playerClientOptions()),
  );
  return client;
}

/** The reviewer's client. See `reviewClientOptions`. */
export function reviewSupabase(): Promise<SupabaseClient<GameDatabase>> {
  reviewClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<GameDatabase>(SUBMISSIONS_URL, SUBMISSIONS_PUBLISHABLE_KEY, reviewClientOptions(tabStorage())),
  );
  return reviewClient;
}
