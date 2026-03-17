import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';

const SRC = process.env.ECODOCS_SRC;
if (!SRC) {
  console.error(
    'Missing ECODOCS_SRC. Example: ECODOCS_SRC="/abs/path/Ecodocs"'
  );
  process.exit(2);
}

const DEST = join(process.cwd(), 'docs', 'ecodocs');

const ALLOWED_EXT = new Set(['.md', '.txt']);
const SKIP_NAMES = new Set(['.DS_Store']);

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function main() {
  const srcStat = await stat(SRC).catch(() => null);
  if (!srcStat || !srcStat.isDirectory()) {
    console.error(`ECODOCS_SRC is not a directory: ${SRC}`);
    process.exit(2);
  }

  // Keep repo clean: delete synced files but keep README.md.
  await mkdir(DEST, { recursive: true });
  const existing = await readdir(DEST).catch(() => []);
  for (const name of existing) {
    if (name === 'README.md') continue;
    await rm(join(DEST, name), { recursive: true, force: true });
  }

  let copied = 0;
  for await (const file of walk(SRC)) {
    const ext = extname(file).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) continue;
    const rel = relative(SRC, file);
    const target = join(DEST, rel);
    await mkdir(dirname(target), { recursive: true });
    await cp(file, target, { force: true });
    copied++;
  }

  console.log(`Synced ${copied} files into ${DEST}`);
}

await main();
