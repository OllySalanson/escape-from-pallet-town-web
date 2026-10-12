import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanPlayerName } from '../console/playerName';
import { HOUSE_SNAPSHOT_MAX_BYTES } from '../home/houseSnapshot';
import { KNOCK_WAIT_MS } from '../home/knocking';
import { HARBOUR_TOPIC } from './harbourProtocol';

/**
 * The database is what the shared harbour believes, so its copy of the rules
 * is held to the game's here: a house is named by the console's own rule and
 * word filter, only a player with a house may be heard on the channel, and
 * anybody may watch it.
 */
const migrationsDir = new URL('../../../supabase/migrations/', import.meta.url);
const everything = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'))
  .join('\n');

function definition(name: string): string {
  const pattern = new RegExp(`create (?:or replace )?function ${name.replace('.', '\\.')}\\([\\s\\S]*?\\n\\$\\$;`, 'g');
  const found = [...everything.matchAll(pattern)].at(-1)?.[0];
  if (!found) {
    throw new Error(`no migration defines ${name}`);
  }
  return found;
}

describe("the database's side of the shared harbour", () => {
  const naming = definition('private.name_my_house');

  it('names a house only as the console names a player', () => {
    const source = /player_name !~ '(\^[^']*(?:''[^']*)*\$)'/.exec(naming)?.[1];
    expect(source).toBeDefined();
    const pattern = new RegExp(source!.replaceAll("''", "'"));
    for (const name of ['ASH', "O'NEIL-2!?", 'ABCDEFGHIJ', 'ABCDEFGHIJK', 'olly', '<B>', ' ASH', 'RED  BLUE', '']) {
      expect(pattern.test(name) && !name.includes('  '), name).toBe(name !== '' && cleanPlayerName(name) === name);
    }
    expect(naming).toContain('private.console_name_is_clean(name_my_house.player_name)');
  });

  it('gives each name to one player only, whatever its case, and says so rather than failing', () => {
    expect(everything).toContain('create unique index player_houses_name_unique on public.player_houses (upper(name));');
    expect(naming).toContain('upper(h.name) = upper(name_my_house.player_name) and h.player_uid <> caller');
    expect(naming).toContain("return 'taken';");
    expect(naming).toContain('exception when unique_violation then');
    const free = definition('private.name_is_free');
    expect(free).toContain("then 'taken'");
    expect(free).toContain('private.console_name_is_clean(name_is_free.player_name)');
  });

  it('writes only as the caller, under a lock, and at the console pace', () => {
    expect(naming).toContain('caller uuid := (select auth.uid())');
    expect(naming).toContain("pg_advisory_xact_lock(hashtextextended('name_my_house', 0))");
    expect(naming).toContain("interval '10 seconds'");
    expect(naming).toContain('names_today >= 10');
    expect(naming).toContain('>= 2000');
    expect(naming).toContain('blocked_makers');
  });

  it('answers names a few at a time and never a hidden or blocked one', () => {
    const names = definition('private.harbour_names');
    expect(names).toContain('cardinality(harbour_names.player_uids) > 64');
    expect(names).toContain('not h.hidden');
    expect(names).toContain('blocked_makers');
  });

  it('takes a house to show no bigger than the game sends', () => {
    const atHome = definition('private.at_my_house');
    expect(atHome).toContain(`octet_length(at_my_house.snapshot::text) > ${HOUSE_SNAPSHOT_MAX_BYTES}`);
    expect(atHome).toContain("jsonb_typeof(at_my_house.snapshot) <> 'object'");
    expect(atHome).toContain('caller uuid := (select auth.uid())');
  });

  it('holds a knock for a minute, a yes for ten, and a knocker to the pace of a hand on a door', () => {
    const knock = definition('private.knock_on');
    expect(knock).toContain("pg_advisory_xact_lock(hashtextextended('knock_on', 0))");
    expect(knock).toContain("interval '5 seconds'");
    expect(knock).toContain('>= 60');
    expect(knock).toContain('>= 5000');
    expect(knock).toContain('knock_on.owner = caller');
    expect(definition('private.my_knock')).toContain("interval '1 minute'");
    expect(definition('private.visit_house')).toContain("interval '10 minutes'");
    expect(definition('private.visit_house')).toContain("k.answer = 'in'");
    // The knock screen waits a little longer than a knock is good for, so it
    // hears the database say 'gone' rather than giving up first.
    expect(KNOCK_WAIT_MS).toBeGreaterThan(60_000);
  });

  it('lets only the owner answer a knock at their own door', () => {
    expect(definition('private.answer_knock')).toContain('k.owner_uid = (select auth.uid())');
    expect(definition('private.knocks_at_my_door')).toContain('k.owner_uid = (select auth.uid())');
  });

  it('lets anybody watch the channel and only a named house be heard on it', () => {
    expect(everything).toMatch(
      new RegExp(`create policy "anybody may watch the harbour" on realtime\\.messages\\s+for select to anon, authenticated\\s+using \\(\\(select realtime\\.topic\\(\\)\\) = '${HARBOUR_TOPIC}'`),
    );
    expect(everything).toMatch(
      new RegExp(`create policy "players with a house walk the harbour" on realtime\\.messages\\s+for insert to authenticated\\s+with check \\(\\s+\\(select realtime\\.topic\\(\\)\\) = '${HARBOUR_TOPIC}'[\\s\\S]*?private\\.may_walk_the_harbour\\(\\)`),
    );
  });
});
