import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_FILE_KEYS, MAP_FILE_LIMITS, type MapFile } from '../world/mapFile';

/**
 * The submission service and the map format must agree, or a map the maker
 * draws is refused at SEND (or, the other way, something the reviewer cannot
 * see rides an approval into the game). The service's rules are the last
 * migration that writes `private.submit_map`; the format's are `MAP_FILE_KEYS`
 * and `MAP_FILE_LIMITS`. A new part of the map file is a key here and a
 * migration that lets it through, in the same change.
 */
const folder = new URL('../../../supabase/migrations/', import.meta.url);
const latest = readdirSync(folder)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, folder), 'utf8'))
  .filter((sql) => /create (or replace )?function private\.submit_map\(/.test(sql))
  .at(-1)!;
const submitMap = latest.slice(latest.search(/create (or replace )?function private\.submit_map\(/));

/** Every key of `MapFile` is in `MAP_FILE_KEYS`: a key added to the type and not to the list fails to compile here. */
type MissingKey = Exclude<keyof MapFile, (typeof MAP_FILE_KEYS)[number]>;
const everyKeyListed: [MissingKey] extends [never] ? true : MissingKey = true;

describe('what the map inbox takes', () => {
  it('lists every key a map file has, and no other', () => {
    expect(everyKeyListed).toBe(true);
    const listed = /jsonb_object_keys\(map\)[\s\S]*?not in \(([^)]*)\)/.exec(submitMap)?.[1] ?? '';
    const keys = [...listed.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]);
    expect(keys).toEqual([...MAP_FILE_KEYS]);
  });

  it('takes every size of map the maker can draw', () => {
    expect(submitMap).toContain(`width not between ${MAP_FILE_LIMITS.minWidth} and ${MAP_FILE_LIMITS.maxWidth}`);
    expect(submitMap).toContain(`height not between ${MAP_FILE_LIMITS.minHeight} and ${MAP_FILE_LIMITS.maxHeight}`);
    expect(submitMap).toContain(`octet_length(map::text) > ${MAP_FILE_LIMITS.maxBytes}`);
  });

  it('holds names to the lengths the maker does', () => {
    expect(submitMap).toContain(`char_length(trim(map ->> 'name')) not between 1 and ${MAP_FILE_LIMITS.maxNameLength}`);
    expect(submitMap).toContain(`char_length(trim(maker_name)) not between 1 and ${MAP_FILE_LIMITS.maxMakerLength}`);
  });
});
