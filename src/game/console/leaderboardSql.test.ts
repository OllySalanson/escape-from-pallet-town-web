import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOKALIKES, STEMS, WHOLE_WORDS } from '../world/wordFilter';
import { CONSOLE_SCORE_LIMITS } from './leaderboard';
import { cleanPlayerName, PLAYER_NAME_MAX_LENGTH } from './playerName';

/**
 * The database repeats the console's rules, because a browser can skip the
 * game's own checks and a name on a board is shown to everybody. These hold
 * the copy in `supabase/migrations/` to the game's, so a word added to the
 * filter or a limit moved arrives with a migration that moves it there too.
 */
const migrationsDir = new URL('../../../supabase/migrations/', import.meta.url);
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'));

/** The body of the newest migration that (re)defines a function. */
function latestDefinition(name: string): string {
  const pattern = new RegExp(`create (?:or replace )?function ${name.replace('.', '\\.')}\\([\\s\\S]*?\\n\\$\\$;`);
  const found = migrations
    .map((sql) => pattern.exec(sql)?.[0])
    .filter((body): body is string => body !== undefined)
    .at(-1);
  if (!found) {
    throw new Error(`no migration defines ${name}`);
  }
  return found;
}

const sqlStrings = (text: string): string[] => [...text.matchAll(/'((?:[^']|'')*)'/g)].map((match) => match[1].replaceAll("''", "'"));

describe("the database's copy of the console's rules", () => {
  const filter = latestDefinition('private.console_name_is_clean');
  const submit = latestDefinition('private.submit_console_score');

  it('refuses the same whole words and stems the game does', () => {
    const whole = /= any \(array\[([\s\S]*?)\]\)/.exec(filter)?.[1] ?? '';
    const stems = /unnest\(array\[([\s\S]*?)\]\)/.exec(filter)?.[1] ?? '';
    expect(sqlStrings(whole).sort()).toEqual([...WHOLE_WORDS].sort());
    expect(sqlStrings(stems).sort()).toEqual([...STEMS].sort());
  });

  it('reads a name with its spaces and punctuation taken out as well, as the game does (red team F9)', () => {
    // Every run of words joined, squeezed again: `FU CK` is the word it spells.
    expect(filter).toMatch(/from words f join words l on l\.i >= f\.i/);
    expect(filter).toMatch(/string_agg\(x\.word, '' order by x\.i\) from words x where x\.i between f\.i and l\.i/);
    expect(filter).toMatch(/where r\.word = any \(array\[/);
    expect(filter).toMatch(/starts_with\(r\.word, s\.stem\)/);
  });

  it('reads the same lookalikes back as letters', () => {
    const [from, to] = sqlStrings(/translate\(lower\(player_name\), ('[^']*'), ('[^']*')\)/.exec(filter)?.slice(1).join(' ') ?? '');
    expect(from).toBeDefined();
    expect(Object.fromEntries([...from].map((character, index) => [character, to[index]]))).toEqual(LOOKALIKES);
  });

  it('takes exactly the names the console lets somebody type', () => {
    const source = /player_name !~ '(\^[^']*(?:''[^']*)*\$)'/.exec(submit)?.[1];
    expect(source).toBeDefined();
    const pattern = new RegExp(source!.replaceAll("''", "'"));
    const accepts = (name: string) => pattern.test(name) && !name.includes('  ');
    const samples = [
      'ASH', 'GARY OAK', "O'NEIL-2!?", 'A', 'ABCDEFGHIJ', 'ABCDEFGHIJK', ' ASH', 'ASH ', 'RED  BLUE',
      'olly', '<B>', 'ZOË', '', 'A.B', '..........', 'A B C D E',
    ];
    for (const name of samples) {
      expect(accepts(name), name).toBe(name !== '' && cleanPlayerName(name) === name);
    }
    expect(accepts('A'.repeat(PLAYER_NAME_MAX_LENGTH))).toBe(true);
  });

  it('holds a score to the same limits the console checks before it posts', () => {
    const limits = CONSOLE_SCORE_LIMITS;
    expect(submit).toContain(`score not between 0 and ${limits.maxScore}`);
    expect(submit).toContain(`lines not between 0 and ${limits.maxLines}`);
    expect(submit).toContain(`level not between 1 and ${limits.maxLevel}`);
    expect(submit).toContain(`duration_ms not between ${limits.minDurationMs} and ${limits.maxDurationMs}`);
    expect(submit).toContain(`(submit_console_score.duration_ms / 1000 + 1)::bigint * ${limits.pointsPerSecond}`);
  });
});
