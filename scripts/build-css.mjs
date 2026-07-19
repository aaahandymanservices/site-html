import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

mkdirSync(join(ROOT, 'public/css'), { recursive: true });

const input = join(ROOT, 'scripts/tailwind-input.css');
const output = join(ROOT, 'public/css/tailwind.css');
const config = join(ROOT, 'tailwind.config.cjs');
const tailwind = join(ROOT, 'node_modules/.bin/tailwindcss');

if (existsSync(tailwind)) {
  execFileSync(
    tailwind,
    ['-c', config, '-i', input, '-o', output, '--minify'],
    { cwd: ROOT, stdio: 'inherit' },
  );

  console.log('Wrote', output);
} else if (existsSync(output)) {
  console.log('Tailwind CLI unavailable; using precompiled stylesheet at', output);
} else {
  throw new Error('Tailwind CLI and precompiled stylesheet are both unavailable.');
}
