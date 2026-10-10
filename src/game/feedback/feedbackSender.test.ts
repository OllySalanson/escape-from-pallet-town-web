import { readdirSync } from 'node:fs';
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
