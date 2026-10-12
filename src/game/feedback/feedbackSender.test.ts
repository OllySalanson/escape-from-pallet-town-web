import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { baseType, callDelivery, extensionFor, uploadDelivery } from './feedbackSender';

/** The migration as applied to the project: what the database will actually refuse. */
const folder = new URL('../../../supabase/migrations/', import.meta.url);
const migration = readdirSync(folder).find((name) => name.endsWith('_player_feedback.sql'))!;
const migrations = await readFile(new URL(migration, folder), 'utf8');

describe('what the sender uploads', () => {
  it('names a clip by its format, stored as a type the bucket allows', () => {
    expect(baseType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionFor('audio/ogg;codecs=opus')).toBe('ogg');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(baseType('')).toBe('audio/webm');
  });

  it('only ever uploads types the bucket accepts', () => {
    const allowed = /allowed_mime_types\)\s*values\s*\([^)]*array\[([^\]]*)\]/.exec(migrations)?.[1] ?? '';
    for (const type of ['image/png', 'audio/webm', 'audio/ogg', 'audio/mp4']) {
      expect(allowed).toContain(`'${type}'`);
    }
  });

  it('holds the same limits the panel promises', () => {
    expect(migrations).toContain('char_length(message) <= 2000');
    expect(migrations).toContain('voice_ms between 0 and 300000');
    expect(migrations).toMatch(/>= 5 then\s+raise exception 'Five messages a day/);
  });
});

describe("the day's uploads", () => {
  // The newest definition of the function that hands out upload names is the one the project runs.
  const all = readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(new URL(name, folder), 'utf8'))
    .join('\n');
  const reserve = all.split('create or replace function private.reserve_feedback_uploads').at(-1)!.split('$$;')[0];

  it('are counted in bytes as well as files, under the lock, a name still empty at the most it could hold', () => {
    expect(reserve).toMatch(/pg_advisory_xact_lock/);
    expect(reserve.indexOf('pg_advisory_xact_lock')).toBeLessThan(reserve.indexOf('feedback_upload_bytes_today'));
    expect(reserve).toMatch(/feedback_upload_bytes_today\(caller, most\) \+ wanted \* most > 32 \* 1048576/);
    expect(reserve).toMatch(/feedback_upload_bytes_today\(null, most\) \+ wanted \* most > 200 \* 1048576/);
    expect(all).toMatch(/coalesce\(\(o\.metadata ->> 'size'\)::bigint, most\)/);
  });

  it('are refused as a limit for today, so the message waits in the pack rather than being given up', () => {
    for (const line of ['Your files for today are used up', 'The lab is full for today']) {
      expect(reserve).toMatch(new RegExp(`'${line}[^']*' using errcode = '54000'`));
    }
    expect(callDelivery({ code: '54000', message: 'Your files for today are used up.' })).toBe('later');
  });
});

describe('what a refusal means', () => {
  it('gives up only on what will be refused every time', () => {
    for (const code of ['22023', '22P02', '23514', '22001', '42501']) {
      expect(callDelivery({ code, message: 'no' })).toEqual({ refused: 'no' });
    }
    expect(callDelivery({ code: '54000', message: 'Five messages a day.' })).toBe('later');
    expect(callDelivery({ code: '28000' })).toBe('later');
    expect(callDelivery({})).toBe('later');
    expect(uploadDelivery({ statusCode: '413', message: 'too big' })).toEqual({ refused: 'too big' });
    expect(uploadDelivery({ statusCode: 415 })).toEqual({ refused: 'upload refused (415)' });
    expect(uploadDelivery({ statusCode: '403', message: 'new row violates row-level security policy' })).toBe('later');
  });
});
