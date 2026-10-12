import type { SupabaseClient } from '@supabase/supabase-js';
import { SUBMISSIONS_PUBLISHABLE_KEY, SUBMISSIONS_URL } from './submitConfig';

/**
 * The one Supabase client the game makes, loaded on first use so nobody who
 * never sends or reviews a map downloads it.
 *
 * Its types are the database as `supabase/migrations/` declares it. A maker's
 * browser can only call `submit_map` and `my_submissions`, and a player's
 * `reserve_feedback_uploads` and `submit_feedback` (`feedback/feedbackSender.ts`)
 * and the house console's `submit_console_score` and `console_leaderboard`
 * (`console/remoteScores.ts`), the last of which a browser may also call
 * signed out, and the shared harbour's `name_my_house` and `harbour_names`
 * (`harbour/`), the last of which is read signed out too, and its knocking
 * (`harbour/houseService.ts`), and the play counter's `record_play`, which is
 * only ever called signed out (`analytics/playCounter.ts`, by plain `fetch`,
 * never through this client);
 * the table rows are here for the reviewer, whom row-level security lets read
 * and decide.
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
  /** The file it is in the game as; on a fix to a map in the game, the file it replaces. */
  readonly map_file_id: string | null;
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

/** One place on a console game's Pallet Town board (`console/remoteScores.ts`). */
export type ConsoleBoardRow = {
  readonly player_name: string;
  readonly score: number;
  readonly lines: number;
  readonly level: number;
  readonly posted_at: string;
  readonly mine: boolean | null;
};

/** The name on one player's door, as the shared harbour reads it (`harbour/harbourWire.ts`). */
export type HarbourNameRow = {
  readonly player_uid: string;
  readonly name: string;
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
      reserve_feedback_uploads: {
        Args: { tag: string; names: string[] };
        Returns: undefined;
      };
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
      submit_console_score: {
        Args: {
          game: string;
          player_name: string;
          score: number;
          lines: number;
          level: number;
          duration_ms: number;
        };
        Returns: string;
      };
      console_leaderboard: {
        Args: { game: string };
        Returns: ConsoleBoardRow[];
      };
      name_my_house: {
        Args: { player_name: string };
        Returns: string;
      };
      name_is_free: {
        Args: { player_name: string };
        Returns: string;
      };
      harbour_names: {
        Args: { player_uids: string[] };
        Returns: HarbourNameRow[];
      };
      at_my_house: {
        Args: { at_home: boolean; snapshot: unknown };
        Returns: string;
      };
      harbour_houses: {
        Args: Record<PropertyKey, never>;
        Returns: { readonly player_uid: string; readonly name: string; readonly at_home: boolean | null }[];
      };
      knock_on: {
        Args: { owner: string };
        Returns: { readonly knock_id: string | null; readonly outcome: string }[];
      };
      knocks_at_my_door: {
        Args: Record<PropertyKey, never>;
        Returns: { readonly knock_id: string; readonly knocker_name: string; readonly knocked_at: string }[];
      };
      answer_knock: {
        Args: { knock_id: string; let_in: boolean };
        Returns: string;
      };
      my_knock: {
        Args: { knock_id: string };
        Returns: string;
      };
      visit_house: {
        Args: { owner: string };
        Returns: { readonly name: string; readonly snapshot: unknown }[];
      };
      /** Counting play (`analytics/playCounter.ts`), sent by plain `fetch` rather than this client. */
      record_play: {
        Args: { visitor_id: string; build: string; events: unknown };
        Returns: number;
      };
      /** The owner's play counts (`analytics/playStats.ts`), refused to anyone but an admin. */
      play_stats: { Args: Record<PropertyKey, never>; Returns: unknown };
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
 * on that origin can read. Closing the tab forgets the session, but only SIGN
 * OUT ends it on the server (`signOutOfReview`): a tab the browser restores
 * brings its session storage back, and a same-origin page opened in the same
 * tab can read it (red team F11). It is a
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
