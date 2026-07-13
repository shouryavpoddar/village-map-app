#!/usr/bin/env node
// One-time (but idempotent/rerunnable) seed script: reads every village's
// -plots.json under src/assets and writes each plot as its own doc under
// maps/{mapId}/plots/{plotId} in Firestore, either the local emulator (dev
// seed) or the real prod project (go-live), per --target.
//
// This reimplements the same file-discovery convention as
// src/plot-map/helpers/villages.js in plain Node, since that file's
// `import.meta.glob` only works inside a Vite-processed module.
//
// Usage:
//   node scripts/migrate-to-firestore.mjs --target=emulator
//   node scripts/migrate-to-firestore.mjs --target=prod
//   node scripts/migrate-to-firestore.mjs --target=prod --map=Ahu   (only this one map - see --map below)
//
// Without --map, EVERY discovered -plots.json is (re)written, overwriting
// whatever is currently in that target for every map - safe for the initial
// go-live seed, but NOT safe to rerun against prod afterwards, since it
// would stomp any edits made live through the app for maps whose JSON
// hasn't been re-exported. Use --map to scope a run to just the one new
// village you're adding (matches by mapId or by a case-insensitive
// substring of its plotsPath, e.g. the village name).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { computeMapId } from '../src/plot-map/helpers/mapIdentity.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = path.join(projectRoot, 'src', 'assets');
const BATCH_LIMIT = 500;

function parseArgs() {
  const target = process.argv
    .find((a) => a.startsWith('--target='))
    ?.slice('--target='.length);
  if (target !== 'emulator' && target !== 'prod') {
    console.error('Usage: node scripts/migrate-to-firestore.mjs --target=emulator|prod [--map=<mapId or name>]');
    process.exit(1);
  }
  const mapFilter = process.argv.find((a) => a.startsWith('--map='))?.slice('--map='.length);
  return { target, mapFilter };
}

// Recursively find every "*-plots.json" under src/assets, matching the
// filename convention villages.js relies on (excludes "-rect.json" and
// "-labels-review.json" by construction, since neither ends in "-plots.json").
function findPlotFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...findPlotFiles(full));
    } else if (entry.endsWith('-plots.json')) {
      found.push(full);
    }
  }
  return found;
}

function toPlotsPath(absPath) {
  return path.relative(projectRoot, absPath).split(path.sep).join('/');
}

// Firestore doesn't allow arrays nested directly inside arrays, so `points`
// ([number,number][]) can't be written as-is - encode each point as {x,y}
// (an array of maps, not an array of arrays). Mirrors the encoding
// src/lib/plotsRepo.ts uses for the frontend's writes.
function encodePlot(plot) {
  return { ...plot, points: plot.points.map(([x, y]) => ({ x, y })) };
}

function initFirestore(target) {
  if (target === 'emulator') {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
    const app = initializeApp({ projectId: 'demo-village-map' });
    const db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    return db;
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error(
      'GOOGLE_APPLICATION_CREDENTIALS must point at a service account key JSON to migrate to prod.'
    );
    process.exit(1);
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

async function migrateMap(db, absPath) {
  const plotsPath = toPlotsPath(absPath);
  const mapId = computeMapId(plotsPath);
  const plots = JSON.parse(readFileSync(absPath, 'utf8'));

  await db.collection('maps').doc(mapId).set({
    key: plotsPath,
    plotCount: plots.length,
    updatedAt: new Date(),
  });

  let written = 0;
  for (let i = 0; i < plots.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const plot of plots.slice(i, i + BATCH_LIMIT)) {
      batch.set(db.collection('maps').doc(mapId).collection('plots').doc(String(plot.id)), encodePlot(plot));
    }
    await batch.commit();
    written += Math.min(BATCH_LIMIT, plots.length - i);
  }

  if (written !== plots.length) {
    throw new Error(`${plotsPath}: wrote ${written} plots, expected ${plots.length}`);
  }
  console.log(`  ${mapId}: ${written} plots (${plotsPath})`);
  return written;
}

async function main() {
  const { target, mapFilter } = parseArgs();
  const db = initFirestore(target);
  let files = findPlotFiles(assetsRoot);

  if (mapFilter) {
    const needle = mapFilter.toLowerCase();
    files = files.filter((f) => {
      const plotsPath = toPlotsPath(f);
      return computeMapId(plotsPath) === mapFilter || plotsPath.toLowerCase().includes(needle);
    });
    if (!files.length) {
      console.error(`No map matched --map=${mapFilter}`);
      process.exit(1);
    }
  }

  console.log(`Migrating ${files.length} map(s) to ${target}...`);
  let total = 0;
  for (const file of files) {
    total += await migrateMap(db, file);
  }
  console.log(`Done. ${total} plots across ${files.length} map(s) written to ${target}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
