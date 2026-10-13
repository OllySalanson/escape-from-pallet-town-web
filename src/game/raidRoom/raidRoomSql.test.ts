import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOM_CODE_LENGTH, ROOM_CODE_LETTERS, ROOM_SIZE } from './roomCode';

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

  it('lets four into a room and no more', () => {
    expect(definition('private.join_raid_room')).toContain(`m.left_at is null) >= ${ROOM_SIZE}`);
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

describe("the database's side of a room's shared loot", () => {
  it('lets the first claim on a piece hold, under a lock, for a player in the room', () => {
    const take = definition('private.take_raid_loot');
    expect(take).toContain('caller uuid := (select auth.uid())');
    expect(take).toContain("pg_advisory_xact_lock(hashtextextended('raid_room_loot:' || room::text, 0))");
    expect(take).toContain('private.my_open_raid_room(take_raid_loot.room_code)');
    expect(take).toContain("case when holder = caller then 'yours' else 'taken' end");
    expect(take).toContain('>= 120');
    expect(take).toContain('>= 500');
    expect(everything).toContain('primary key (room_id, loot_id)');
  });

  it('hands the room’s seed and what was taken only to the players in it', () => {
    expect(definition('private.raid_room_seed')).toContain('private.my_open_raid_room(raid_room_seed.room_code)');
    expect(definition('private.raid_loot_taken')).toContain('private.my_open_raid_room(raid_loot_taken.room_code)');
    const mine = definition('private.my_open_raid_room');
    expect(mine).toContain('m.player_uid = (select auth.uid())');
    expect(mine).toContain('m.left_at is null');
  });
});
