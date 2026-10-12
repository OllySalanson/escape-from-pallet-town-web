import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Only the owner's GitHub account is ever an admin - the one who reviews maps
 * and reads the play stats - by its numeric id, never a name and never
 * whoever signs in first. Read off the migrations, because the rule lives in
 * the database (`*_admin_is_the_owner.sql`).
 */
const OWNER_GITHUB_ID = '40039465';
const folder = new URL('../../../supabase/migrations/', import.meta.url);
const migrations = readdirSync(folder)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, folder), 'utf8'));
const everything = migrations.join('\n');

/** The last definition of a function, as the database now holds it. */
function lastDefinition(name: string): string {
  const pattern = new RegExp(`create (?:or replace )?function ${name.replace('.', '\\.')}\\([\\s\\S]*?\\n\\$\\$;`, 'g');
  const found = [...everything.matchAll(pattern)].map((match) => match[0]);
  expect(found.length).toBeGreaterThan(0);
  return found[found.length - 1];
}

describe('who is an admin', () => {
  it('is the owner, known by their GitHub identity id', () => {
    expect(lastDefinition('private.is_owner')).toContain(`i.provider = 'github' and i.provider_id = '${OWNER_GITHUB_ID}'`);
  });

  it('asks for that identity as well as an admins row', () => {
    expect(lastDefinition('private.is_admin')).toMatch(/from public\.admins[\s\S]*and private\.is_owner\(\(select auth\.uid\(\)\)\)/);
  });

  it('refuses an admins row for anybody else, however it is written', () => {
    expect(everything).toMatch(/create trigger admins_are_the_owner\s+before insert or update on public\.admins/);
    expect(lastDefinition('private.admins_are_the_owner')).toContain('if not private.is_owner(new.user_id) then');
  });

  it('grants the row on sign-in only to that identity, never by a name', () => {
    const grant = lastDefinition('private.grant_owner_review');
    expect(grant).toContain(`new.provider = 'github' and new.provider_id = '${OWNER_GITHUB_ID}'`);
    expect(grant).not.toMatch(/user_name|preferred_username|email|identity_data/);
  });
});
