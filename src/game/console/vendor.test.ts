import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONSOLE_GAMES } from './consoleGames';

/**
 * Every console game is three things in step: a row in the fetch script (where
 * its code lives and the commit it is built from), the build that script left
 * in `vendor/<id>/`, and a board in the database. A game missing any one of
 * them is a menu row that does not start, or a score that is refused.
 */
const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const fetchScript = read('scripts/fetch-console-games.mjs');
const migrations = readdirSync(new URL('supabase/migrations/', root))
  .filter((name) => name.endsWith('.sql'))
  .map((name) => read(`supabase/migrations/${name}`))
  .join('\n');

interface SourceRecord {
  readonly id: string;
  readonly repo: string;
  readonly commit: string;
  readonly sha256: string;
}

describe('the games the console plays', () => {
  it('has at least Pallet Blocks, each with an id of its own', () => {
    expect(CONSOLE_GAMES.map((game) => game.id)).toContain('pallet-blocks');
    expect(new Set(CONSOLE_GAMES.map((game) => game.id)).size).toBe(CONSOLE_GAMES.length);
  });

  for (const game of CONSOLE_GAMES) {
    describe(game.name, () => {
      const folder = `src/game/console/vendor/${game.id}/`;

      it('is vendored as the very build its pinned commit makes', () => {
        const source = JSON.parse(read(`${folder}SOURCE.json`)) as SourceRecord;
        expect(source.id).toBe(game.id);
        expect(source.commit).toMatch(/^[0-9a-f]{40}$/);
        const module = readFileSync(new URL(`${folder}${game.id}.js`, root));
        expect(createHash('sha256').update(module).digest('hex')).toBe(source.sha256);
        expect(existsSync(new URL(`${folder}${game.id}.d.ts`, root))).toBe(true);
        expect(existsSync(new URL(`${folder}LICENSE`, root))).toBe(true);
      });

      it('is built from the repository and commit the fetch script names', () => {
        const source = JSON.parse(read(`${folder}SOURCE.json`)) as SourceRecord;
        const row = new RegExp(`id: '${game.id}',\\s*repo: '([^']+)',\\s*commit: '([0-9a-f]{40})'`).exec(fetchScript);
        expect(row?.[1]).toBe(source.repo);
        expect(row?.[2]).toBe(source.commit);
      });

      it('has a Pallet Town board to post to', () => {
        expect(migrations).toMatch(new RegExp(`insert into private\\.console_games \\(id, name\\) values \\('${game.id}'`));
      });
    });
  }
});
