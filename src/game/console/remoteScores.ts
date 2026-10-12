import { signedInAs } from '../feedback/feedbackSender';
import { supabase } from '../maker/supabaseClient';
import type { BoardEntry, ConsoleScore, PalletTownBoards } from './leaderboard';

/**
 * The Pallet Town boards, in the game's own Supabase project: the one the map
 * maker sends maps to and the FEEDBACK tab sends notes to
 * (`maker/submitConfig.ts`).
 *
 * The browser is the same anonymous player it is for those two - no account,
 * just a private id - and all it may do here is post a finished game's score
 * (`submit_console_score`) and read a game's board (`console_leaderboard`); the
 * database checks every score and name again and holds a player to its limits
 * (`supabase/migrations/*_console_leaderboards.sql`). A failure of any kind
 * throws, and `Leaderboards` falls back on this device's own board.
 *
 * The client is loaded on first use, so nobody downloads it until they sit
 * down at the console.
 */
export const palletTownBoards: PalletTownBoards = {
  async load(game: string): Promise<readonly BoardEntry[]> {
    const db = await signedIn();
    const { data, error } = await db.rpc('console_leaderboard', { game });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => ({ name: row.player_name, score: row.score, mine: row.mine }));
  },
  async post(game: string, name: string, score: ConsoleScore): Promise<void> {
    const db = await signedIn();
    const { error } = await db.rpc('submit_console_score', {
      game,
      player_name: name,
      score: score.score,
      lines: score.lines,
      level: score.level,
      duration_ms: score.durationMs,
    });
    if (error) {
      throw new Error(error.message);
    }
  },
};

async function signedIn() {
  const db = await supabase();
  if (!(await signedInAs())) {
    throw new Error('Could not sign in to the boards.');
  }
  return db;
}
