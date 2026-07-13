#!/usr/bin/env node
// Replaces one village's plots in Firestore with the contents of a given
// -plots.json file, from anywhere on disk (not just src/assets) - this is
// the tool for "someone finished labeling a village on a checkout that
// isn't wired to Firestore, and has a finished plots.json to bring in."
//
// Unlike migrate-to-firestore.mjs (add/update only, meant for the one-time
// initial seed), this does a full replace: any plot currently in Firestore
// but missing from the new file is deleted, since a finished labeling pass
// often merges or drops plots the auto-extraction got wrong.
//
// Usage:
//   node scripts/replace-map.mjs --file=<path-to-plots.json> --map=<mapId-or-name> --target=emulator|prod [--yes]
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BATCH_LIMIT = 500;

function parseArgs() {
  const get = (flag) => process.argv.find((a) => a.startsWith(`--${flag}=`))?.slice(flag.length + 3);
  const file = get('file');
  const map = get('map');
  const target = get('target');
  const yes = process.argv.includes('--yes');
  if (!file || !map || !['emulator', 'prod'].includes(target)) {
    console.error('Usage: node scripts/replace-map.mjs --file=<path> --map=<mapId-or-name> --target=emulator|prod [--yes]');
    process.exit(1);
  }
  return { file, map, target, yes };
}

function initFirestore(target) {
  if (target === 'emulator') {
    const app = initializeApp({ projectId: 'demo-village-map' });
    const db = getFirestore(app);
    db.settings({ host: 'localhost:8080', ssl: false, ignoreUndefinedProperties: true });
    return db;
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS must point at a service account key JSON to replace data in prod.');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// Firestore doesn't allow arrays nested directly inside arrays, so `points`
// ([number,number][]) can't be written as-is - encode each point as {x,y}.
// Mirrors src/lib/plotsRepo.ts's encoding for the frontend's own writes.
function encodePlot(plot) {
  return { ...plot, points: plot.points.map(([x, y]) => ({ x, y })) };
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

// --map is matched against maps already known to Firestore (by doc id, or a
// substring of the stored `key`/plotsPath) rather than derived from --file's
// path, since --file can point anywhere on disk - a labeler's own checkout,
// not necessarily this repo's src/assets layout.
async function resolveMapId(db, mapArg) {
  const snap = await db.collection('maps').get();
  const needle = mapArg.toLowerCase();
  const matches = snap.docs.filter(
    (d) => d.id === mapArg || (d.data().key ?? '').toLowerCase().includes(needle)
  );
  if (matches.length === 0) {
    console.error(
      `No existing map matched --map=${mapArg}. (This tool replaces an EXISTING map - use migrate-to-firestore.mjs to seed a brand new one first.)`
    );
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`--map=${mapArg} matched more than one map: ${matches.map((d) => d.id).join(', ')}. Use a more specific value.`);
    process.exit(1);
  }
  return matches[0].id;
}

async function main() {
  const { file, map, target, yes } = parseArgs();
  const db = initFirestore(target);
  const mapId = await resolveMapId(db, map);

  const newPlots = JSON.parse(readFileSync(file, 'utf8'));
  const newIds = new Set(newPlots.map((p) => String(p.id)));

  const existingSnap = await db.collection('maps').doc(mapId).collection('plots').get();
  const toDelete = existingSnap.docs.filter((d) => !newIds.has(d.id)).map((d) => d.id);

  console.log(`Map: ${mapId}`);
  console.log(`  ${newPlots.length} plots in ${file}`);
  console.log(`  ${toDelete.length} plot(s) currently in ${target} will be deleted (not present in the new file)`);

  if (target === 'prod' && !yes) {
    const proceed = await confirm(`This will REPLACE map "${mapId}" in PRODUCTION with ${file}. Continue?`);
    if (!proceed) {
      console.log('Aborted.');
      return;
    }
  }

  const plotsCol = db.collection('maps').doc(mapId).collection('plots');
  const ops = [
    ...newPlots.map((plot) => ({ type: 'set', ref: plotsCol.doc(String(plot.id)), data: encodePlot(plot) })),
    ...toDelete.map((id) => ({ type: 'delete', ref: plotsCol.doc(id) })),
  ];

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      if (op.type === 'set') batch.set(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }

  await db.collection('maps').doc(mapId).set(
    { plotCount: newPlots.length, updatedAt: new Date() },
    { merge: true }
  );

  console.log(`Done. ${mapId}: ${newPlots.length} plots written, ${toDelete.length} deleted, in ${target}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
