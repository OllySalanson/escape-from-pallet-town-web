import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('publishing approved maps', () => {
  it('fails the run, and says why, when it has no key to read them with', () => {
    const env = { ...process.env };
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    const run = spawnSync(
      'npx',
      ['--no-install', 'vite-node', 'tools/maps/publishApproved.mts', '--', 'collect', 'unused.json'],
      { env, encoding: 'utf8' },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('No SUPABASE_SERVICE_ROLE_KEY');
  });
});
