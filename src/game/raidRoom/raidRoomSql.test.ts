import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOM_CODE_LENGTH, ROOM_CODE_LETTERS } from './roomCode';

/**
 * The database is what a raid room believes, so its copy of the rules is held
 * to the game's here: the code is the game's alphabet, a room holds two, only
 * the players in a room are on its channel, and every count is under a lock.
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

describe("the database's side of raiding with a friend", () => {
  const code = `^[${ROOM_CODE_LETTERS}]{${ROOM_CODE_LENGTH}}$`;

  it('hands out codes in the game’s own alphabet', () => {
    expect(everything).toContain(`code text not null check (code ~ '${code}')`);
    expect(definition('private.open_raid_room')).toContain(`alphabet constant text := '${ROOM_CODE_LETTERS}'`);
    expect(definition('private.join_raid_room')).toContain(`wanted !~ '${code}'`);
    expect(everything).toContain('create unique index raid_rooms_open_code on public.raid_rooms (code) where closed_at is null;');
  });

  it('makes and joins rooms as the caller, under a lock, at a person’s pace', () => {
    const open = definition('private.open_raid_room');
    const join = definition('private.join_raid_room');
    for (const fn of [open, join, definition('private.leave_raid_room')]) {
      expect(fn).toContain('caller uuid := (select auth.uid())');
      expect(fn).toContain("pg_advisory_xact_lock(hashtextextended('raid_rooms', 0))");
    }
    expect(open).toContain("interval '5 seconds'");
    expect(open).toContain('>= 20');
    expect(open).toContain('>= 3000');
    expect(join).toContain("interval '1 second'");
    expect(join).toContain('mine.tries >= 30');
    expect(open).toContain('private.house_is_open(caller)');
    expect(join).toContain('private.house_is_open(caller)');
  });

  it('lets two into a room and no more', () => {
    expect(definition('private.join_raid_room')).toContain('m.left_at is null) >= 2');
  });

  it('puts only the players in an open room on its channel', () => {
    const may = definition('private.may_walk_raid_room');
    expect(may).toContain("may_walk_raid_room.topic = 'raid:' || r.code");
    expect(may).toContain('m.player_uid = (select auth.uid())');
    expect(may).toContain('m.left_at is null');
    expect(may).toContain('r.closed_at is null');
    for (const policy of ['room members watch their raid', 'room members walk their raid']) {
      expect(everything).toMatch(
        new RegExp(`create policy "${policy}" on realtime\\.messages[\\s\\S]*?like 'raid:%'[\\s\\S]*?private\\.may_walk_raid_room\\(\\(select realtime\\.topic\\(\\)\\)\\)`),
      );
    }
  });
});
