#!/usr/bin/env node
// Deliberate, explicit sync between two Firestore instances (local emulator
// and prod) - always a full overwrite of the destination map(s), never an
// automatic or two-way sync. This is the only path by which local dev data
// and production data are ever allowed to affect each other.
//
// Usage:
//   node scripts/sync-firestore.mjs --from=emulator --to=prod [--map=<mapId>] [--yes]
//   node scripts/sync-firestore.mjs --from=prod --to=emulator [--map=<mapId>]
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BATCH_LIMIT = 500;

function parseArgs() {
  const get = (flag) => process.argv.find((a) => a.startsWith(`--${flag}=`))?.slice(flag.length + 3);
  const from = get('from');
  const to = get('to');
  const map = get('map'); // optional: sync only this mapId
  const yes = process.argv.includes('--yes');
  if (!['emulator', 'prod'].includes(from) || !['emulator', 'prod'].includes(to) || from === to) {
    console.error('Usage: node scripts/sync-firestore.mjs --from=emulator|prod --to=emulator|prod [--map=<mapId>] [--yes]');
    process.exit(1);
  }
  return { from, to, map, yes };
}

function initFirestoreNamed(target, appName) {
  if (target === 'emulator') {
    const app = initializeApp({ projectId: 'demo-village-map' }, appName);
    const db = getFirestore(app);
    db.settings({ host: 'localhost:8080', ssl: false, ignoreUndefinedProperties: true });
    return db;
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS must point at a service account key JSON to sync with prod.');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id }, appName);
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

async function copyMap(sourceDb, destDb, mapId) {
  const mapSnap = await sourceDb.collection('maps').doc(mapId).get();
  if (!mapSnap.exists) throw new Error(`Source has no maps/${mapId}`);

  const plotsSnap = await sourceDb.collection('maps').doc(mapId).collection('plots').get();
  const plots = plotsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

  await destDb.collection('maps').doc(mapId).set(mapSnap.data());

  for (let i = 0; i < plots.length; i += BATCH_LIMIT) {
    const batch = destDb.batch();
    for (const plot of plots.slice(i, i + BATCH_LIMIT)) {
      batch.set(destDb.collection('maps').doc(mapId).collection('plots').doc(plot.id), plot.data);
    }
    await batch.commit();
  }

  console.log(`  ${mapId}: ${plots.length} plots`);
  return plots.length;
}

async function main() {
  const { from, to, map, yes } = parseArgs();

  if (to === 'prod' && !yes) {
    const scope = map ? `map "${map}"` : 'ALL maps';
    const proceed = await confirm(
      `This will overwrite ${scope} in PRODUCTION with data from ${from}. Continue?`
    );
    if (!proceed) {
      console.log('Aborted.');
      return;
    }
  }

  const sourceDb = initFirestoreNamed(from, 'source');
  const destDb = initFirestoreNamed(to, 'dest');

  const mapIds = map
    ? [map]
    : (await sourceDb.collection('maps').listDocuments()).map((ref) => ref.id);

  console.log(`Syncing ${mapIds.length} map(s) from ${from} to ${to}...`);
  let total = 0;
  for (const mapId of mapIds) {
    total += await copyMap(sourceDb, destDb, mapId);
  }
  console.log(`Done. ${total} plots across ${mapIds.length} map(s) synced ${from} -> ${to}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
