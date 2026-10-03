import type { SupabaseClient } from '@supabase/supabase-js';
import { SUBMISSIONS_PUBLISHABLE_KEY, SUBMISSIONS_URL } from './submitConfig';

/**
 * The one Supabase client the game makes, loaded on first use so nobody who
 * never sends or reviews a map downloads it.
 *
 * Its types are the database as `supabase/migrations/` declares it. A maker's
 * browser can only call `submit_map` and `my_submissions`; the table rows are
 * here for the reviewer, whom row-level security lets read and decide.
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: Promise<SupabaseClient<GameDatabase>> | undefined;

export function supabase(): Promise<SupabaseClient<GameDatabase>> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<GameDatabase>(SUBMISSIONS_URL, SUBMISSIONS_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The reviewer signs in through GitHub and comes back with a code in
        // the address, which the client trades for a session as it starts.
        flowType: 'pkce',
        detectSessionInUrl: true,
        storageKey: 'escape-from-pallet-town.maker.session',
      },
    }),
  );
  return client;
}
