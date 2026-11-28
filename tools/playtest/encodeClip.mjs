// Lays recorded visits (each a directory holding frames/*.png, as
// billShopClip.mjs and keeperClip.mjs write them) end to end as one looping
// clip at 15 frames a second: <out>.webm, and <out>-poster.png from the frame
// a fraction of the way in.
//
//   node tools/playtest/encodeClip.mjs <out> <visit dir> [<visit dir> ...] [--poster=0.3]
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const [out, ...dirs] = args.filter((arg) => !arg.startsWith('--'));
const poster = Number(args.find((arg) => arg.startsWith('--poster='))?.split('=')[1] ?? 0.3);
if (!out || dirs.length === 0) {
  console.error('usage: encodeClip.mjs <out> <visit dir> [...]');
  process.exit(2);
}
const joined = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'clip-'));
let count = 0;
for (const dir of dirs) {
  for (const name of readdirSync(join(dir, 'frames')).filter((file) => file.endsWith('.png')).sort()) {
    copyFileSync(join(dir, 'frames', name), join(joined, `${String(count).padStart(5, '0')}.png`));
    count += 1;
  }
}
mkdirSync(join(out, '..'), { recursive: true });
const ffmpeg = (more) => spawnSync('nice', ['-n', '15', 'ffmpeg', '-y', '-loglevel', 'error', ...more], { stdio: 'inherit' });
ffmpeg(['-framerate', '15', '-i', join(joined, '%05d.png'), '-vf', 'scale=600:-2:flags=neighbor', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p', `${out}.webm`]);
copyFileSync(join(joined, `${String(Math.floor(count * poster)).padStart(5, '0')}.png`), `${out}-poster.png`);
rmSync(joined, { recursive: true, force: true });
console.log(`${out}.webm: ${count} frames, ${(count / 15).toFixed(1)} s`);
