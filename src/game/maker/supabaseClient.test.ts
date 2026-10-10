import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playerClientOptions, reviewClientOptions } from './supabaseClient';

describe('two sessions, kept apart', () => {
  it("keeps the player's anonymous session across visits, and never reads a sign-in from the address", () => {
    const { auth } = playerClientOptions();
    expect(auth.persistSession).toBe(true);
    expect(auth.detectSessionInUrl).toBe(false);
  });

  it("keeps the reviewer's session for this tab only, never in storage every page on the origin can read (M5)", () => {
    const tab = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
    const { auth } = reviewClientOptions(tab);
    expect(auth.storage).toBe(tab);
    expect(auth.detectSessionInUrl).toBe(true);
    expect(auth.flowType).toBe('pkce');
    expect(auth.storageKey).not.toBe(playerClientOptions().auth.storageKey);
    // No tab storage at all: no session is kept anywhere, rather than falling back to localStorage.
    expect(reviewClientOptions(undefined).auth.persistSession).toBe(false);
  });

  it('is the only client the review screens use', () => {
    const review = readFileSync(new URL('./review.ts', import.meta.url), 'utf8');
    expect(review).not.toMatch(/\bsupabase\(\)/);
    expect(review).toMatch(/reviewSupabase\(\)/);
  });
});
