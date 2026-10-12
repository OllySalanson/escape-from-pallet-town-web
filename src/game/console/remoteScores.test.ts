import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerSignIn } from '../maker/playerSignIn';
import { BoardTrouble } from './leaderboard';

/**
 * What the console asks of Pallet Town, against a stand-in client: a board is
 * read without signing anybody in (red team F10), and only a score signs in -
 * behind the bot check - before it is posted.
 */
const calls: string[] = [];
let signIn: PlayerSignIn = { ok: true, uid: 'u1' };
let postError: { code: string; message: string } | null = null;

vi.mock('../maker/playerSignIn', () => ({
  signInAsPlayer: () => (calls.push('sign in'), Promise.resolve(signIn)),
}));
vi.mock('../maker/supabaseClient', () => ({
  supabase: () =>
    Promise.resolve({
      rpc: (name: string) => {
        calls.push(`rpc ${name}`);
        return Promise.resolve(
          name === 'console_leaderboard'
            ? { data: [{ player_name: 'ASH', score: 900, mine: null }], error: null }
            : { data: null, error: postError },
        );
      },
    }),
}));

const { palletTownBoards, postTrouble } = await import('./remoteScores');
const score = { score: 900, lines: 10, level: 2, durationMs: 60_000 };

beforeEach(() => {
  calls.length = 0;
  signIn = { ok: true, uid: 'u1' };
  postError = null;
});

describe('the Pallet Town boards', () => {
  it('reads a board signed out: looking never signs a visitor up or draws a check', async () => {
    expect(await palletTownBoards.load('pallet-blocks')).toEqual([{ name: 'ASH', score: 900, mine: false }]);
    expect(calls).toEqual(['rpc console_leaderboard']);
  });

  it('signs in, behind the bot check, only to post a score', async () => {
    await palletTownBoards.post('pallet-blocks', 'ASH', score);
    expect(calls).toEqual(['sign in', 'rpc submit_console_score']);
  });

  it('says a bot check that did not pass, or would not load, is why a score did not go', async () => {
    for (const trouble of ['failed', 'unavailable'] as const) {
      signIn = { ok: false, trouble };
      await expect(palletTownBoards.post('pallet-blocks', 'ASH', score)).rejects.toMatchObject({ kind: 'check' });
    }
    signIn = { ok: false, trouble: 'offline' };
    await expect(palletTownBoards.post('pallet-blocks', 'ASH', score)).rejects.toMatchObject({ kind: 'later' });
    expect(calls.filter((call) => call.startsWith('rpc'))).toEqual([]);
  });

  it('tells a score refused for good from one refused for today', async () => {
    postError = { code: '22023', message: 'Pick another name.' };
    await expect(palletTownBoards.post('pallet-blocks', 'ASH', score)).rejects.toBeInstanceOf(BoardTrouble);
    await expect(palletTownBoards.post('pallet-blocks', 'ASH', score)).rejects.toMatchObject({ kind: 'refused' });
    expect(postTrouble('42501')).toBe('refused');
    expect(postTrouble('54000')).toBe('later');
    expect(postTrouble(undefined)).toBe('later');
  });
});
