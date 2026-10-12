import { signInAsPlayer } from '../maker/playerSignIn';
import { supabase } from '../maker/supabaseClient';
import { BoardTrouble, type BoardEntry, type ConsoleScore, type PalletTownBoards } from './leaderboard';

/**
 * The Pallet Town boards, in the game's own Supabase project: the one the map
 * maker sends maps to and the FEEDBACK tab sends notes to
 * (`maker/submitConfig.ts`).
 *
 * The browser is the same anonymous player it is for those two - no account,
 * just a private id - and all it may do here is post a finished game's score
 * (`submit_console_score`) and read a game's board (`console_leaderboard`). It
 * signs in only to post, behind the bot check (`maker/playerSignIn.ts`): a
 * board is read as whoever the browser already is, or as nobody, so sitting
 * down at the console makes no player of a visitor and a project that asks
 * for a bot check still shows its boards (red team F10). The
 * database checks every score and name again and holds a player to its limits
 * (`supabase/migrations/*_console_leaderboards.sql`). A failure of any kind
 * throws - a `BoardTrouble` saying why when it is known - and `Leaderboards`
 * falls back on this device's own board and keeps the score to send again.
 *
 * The client is loaded on first use, so nobody downloads it until they sit
 * down at the console.
 */
export const palletTownBoards: PalletTownBoards = {
  async load(game: string): Promise<readonly BoardEntry[]> {
    const db = await supabase();
    const { data, error } = await db.rpc('console_leaderboard', { game });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => ({ name: row.player_name, score: row.score, mine: row.mine === true }));
  },
  async post(game: string, name: string, score: ConsoleScore): Promise<void> {
    const signedIn = await signInAsPlayer();
    if (!signedIn.ok) {
      throw new BoardTrouble(
        signedIn.trouble === 'unavailable' || signedIn.trouble === 'failed' ? 'check' : 'later',
        `Could not sign in to the boards (${signedIn.trouble}).`,
      );
    }
    const { error } = await (await supabase()).rpc('submit_console_score', {
      game,
      player_name: name,
      score: score.score,
      lines: score.lines,
      level: score.level,
      duration_ms: score.durationMs,
    });
    if (error) {
      throw new BoardTrouble(postTrouble(error.code), error.message);
    }
  },
};

/**
 * What a refused score means, by its SQLSTATE: a name or a score Pallet Town
 * turns down (22023) or a player it will not hear from (42501) is refused every
 * time; the limits (54000) and anything else may clear up.
 */
export function postTrouble(code: string | undefined): 'later' | 'refused' {
  return code === '22023' || code === '42501' ? 'refused' : 'later';
}
