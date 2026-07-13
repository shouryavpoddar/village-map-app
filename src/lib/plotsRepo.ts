import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db, isReadOnlyRemote } from './firebase';

// Blocks every write when running locally against a non-emulator project
// (see firebase.ts) - the only way to edit locally is against a local copy
// (`npm run sync:pull` then edit against the emulator), never prod directly.
function assertWritable() {
  if (isReadOnlyRemote) {
    throw new Error(
      'Refusing to write: this local dev session is pointed at a real Firestore project, not the emulator. ' +
      'Run `npm run sync:pull` to get a local copy, then set VITE_USE_EMULATOR=true in .env.local and edit that instead.'
    );
  }
}

export interface PlotGroup {
  name: string;
  color: string;
}

export interface Plot {
  id: number;
  label: string;
  points: [number, number][];
  color?: string;
  groups?: PlotGroup[];
}

// Firestore doesn't allow arrays nested directly inside arrays, so `points`
// ([number,number][]) can't be written as-is - encode/decode each point as
// {x,y} (an array of maps, not an array of arrays) at this module's
// boundary, so every other module keeps working with plain [x,y] tuples.
function encodePlot(plot: Plot) {
  return { ...plot, points: plot.points.map(([x, y]) => ({ x, y })) };
}

function decodePlot(data: Record<string, unknown>): Plot {
  const points = data.points as { x: number; y: number }[];
  return { ...data, points: points.map((p) => [p.x, p.y]) } as Plot;
}

// Firestore's writeBatch caps out at 500 operations per commit.
const BATCH_LIMIT = 500;

function plotsCollection(mapId: string) {
  return collection(db, 'maps', mapId, 'plots');
}

function plotDoc(mapId: string, plotId: number) {
  return doc(db, 'maps', mapId, 'plots', String(plotId));
}

export async function loadMapPlots(mapId: string): Promise<Plot[]> {
  const snapshot = await getDocs(plotsCollection(mapId));
  return snapshot.docs.map((d) => decodePlot(d.data()));
}

export async function upsertPlot(mapId: string, plot: Plot): Promise<void> {
  assertWritable();
  await setDoc(plotDoc(mapId, plot.id), encodePlot(plot));
}

export async function deletePlotDoc(mapId: string, plotId: number): Promise<void> {
  assertWritable();
  await deleteDoc(plotDoc(mapId, plotId));
}

// Used by group operations (importGroup/removeGroup), which can touch many
// plots spread across an arbitrary number of ids in one user action -
// chunked into 500-write batches since a single CSV import could in
// principle match more plots than one batch allows.
export async function upsertPlotsBatch(mapId: string, plots: Plot[]): Promise<void> {
  assertWritable();
  for (let i = 0; i < plots.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const plot of plots.slice(i, i + BATCH_LIMIT)) {
      batch.set(plotDoc(mapId, plot.id), encodePlot(plot));
    }
    await batch.commit();
  }
}
