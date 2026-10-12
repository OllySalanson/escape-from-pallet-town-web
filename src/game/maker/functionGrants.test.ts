import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every function the project's migrations create starts shut and is opened on
 * purpose (the red team's F8). Two halves: the global default that takes
 * EXECUTE away from PUBLIC on any function `postgres` creates - the per-schema
 * revoke written before it never did, because PUBLIC's EXECUTE is granted
 * globally - and, belt and braces, an explicit revoke from PUBLIC for every
 * function in `public` or `private` in the migration that creates it or a
 * later one, so a reader never has to know the default to know it is shut.
 */
const folder = new URL('../../../supabase/migrations/', import.meta.url);
const migrations = readdirSync(folder)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(new URL(name, folder), 'utf8') }));
const everything = migrations.map((migration) => migration.sql).join('\n');

/** Functions anyone may call, signed in or not, and why. */
const OPEN_TO_EVERYONE: Record<string, string> = {
  'public.console_leaderboard': 'a board is read signed out, so looking signs nobody up (F10)',
  'private.console_leaderboard': 'what the public board wraps',
  'public.harbour_names': 'the names over the figures in the shared harbour, watched signed out',
  'private.harbour_names': 'what the public names wrap',
  'public.name_is_free': 'a name is checked as it is typed at NEW GAME, before anybody is signed in',
  'private.name_is_free': 'what the public check wraps',
  'public.record_play': 'play is counted signed out, so counting a visitor signs nobody up and asks no bot check',
  'private.record_play': 'what the public count wraps',
};

describe('the functions the migrations create', () => {
  const created = [
    ...new Set(
      [...everything.matchAll(/create (?:or replace )?function ((?:public|private)\.\w+)\(/g)].map((match) => match[1]),
    ),
  ];

  it('start shut by default, wherever they are created', () => {
    expect(everything).toMatch(/alter default privileges for role postgres revoke execute on functions from public;/);
  });

  it('are each shut to PUBLIC and to signed-out visitors explicitly', () => {
    expect(created.length).toBeGreaterThan(10);
    const createdIn = (name: string): number =>
      migrations.findIndex((migration) => new RegExp(`create (?:or replace )?function ${name.replace('.', '\\.')}\\(`).test(migration.sql));
    // Named, or swept up with every function its schema held at the time.
    const shut = (name: string, who: string): boolean =>
      new RegExp(`revoke execute on function ${name.replace('.', '\\.')}\\([^)]*\\) from [^;]*\\b${who}\\b`).test(everything) ||
      migrations.some(
        (migration, index) =>
          index >= createdIn(name) &&
          new RegExp(`revoke execute on all functions in schema ${name.split('.')[0]} from [^;]*\\b${who}\\b`).test(migration.sql),
      );
    const open = created.filter((name) => !shut(name, 'public') || !shut(name, 'anon'));
    expect(open).toEqual([]);
  });

  it('are opened to signed-out visitors only where that is the point', () => {
    const toAnon = [...everything.matchAll(/grant execute on function ((?:public|private)\.\w+)\([^)]*\) to ([^;]*);/g)]
      .filter((match) => /\banon\b|\bpublic\b/.test(match[2]))
      .map((match) => match[1]);
    expect(toAnon.sort()).toEqual(Object.keys(OPEN_TO_EVERYONE).sort());
  });
});
