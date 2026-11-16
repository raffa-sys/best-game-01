// SPDX-License-Identifier: MIT
// Nova Harvest — the best-game-01 entry program (Node 22, standard library
// only). It hands the game in: it copies this repository's game/ and
// screenshots/ into the output directory and writes /output/dossier.json with
// the vendored make.fun library, so the judge can read the game and its
// screenshots. It writes the same bytes on every run: the files it copies are
// fixed, and buildDossier is deterministic over them.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps the gate enforces on /output: at most 4 screenshots of 256 KiB,
// game/ within 993 files and 48 MiB, and a dossier of at most 160 KiB of
// source text. An entry that breaks one is refused before it is judged.
// buildDossier is deterministic over fixed inputs, so two runs of this
// program write the same bytes — the grader runs it twice and compares.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Nova Harvest handed in to ${out}`);
