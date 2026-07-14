import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
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
  // Real-world area in square meters, transcribed from a Form-7 land record.
  // Used to derive a village's scale factor for the combined multi-village
  // view (see computeVillageScale in plot-map/helpers/geometry.js) - most
  // plots won't have this set, only whichever ones the user has looked up.
  realAreaSqM?: number;
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

// A village's manually-dragged position in the combined "All Villages" view
// (see plot-map/hooks/useVillageArrangement.js) - lives as fields on the
// map's own doc, not its `plots` subcollection, since it describes the
// village as a whole rather than any one plot. `rotation` (radians) is only
// ever set by a precise anchor-plot fit (two sheets sharing a real plot in
// common - see useAllVillages.js), never by the drag UI, which only ever
// adjusts offsetX/offsetY on top of whatever rotation is already saved.
export interface MapArrangement {
  offsetX: number;
  offsetY: number;
  rotation?: number;
}

function mapDoc(mapId: string) {
  return doc(db, 'maps', mapId);
}

export async function loadMapArrangement(mapId: string): Promise<MapArrangement | null> {
  const snapshot = await getDoc(mapDoc(mapId));
  const data = snapshot.data();
  if (!data || typeof data.offsetX !== 'number' || typeof data.offsetY !== 'number') return null;
  return {
    offsetX: data.offsetX,
    offsetY: data.offsetY,
    ...(typeof data.rotation === 'number' ? { rotation: data.rotation } : {}),
  };
}

export async function saveMapArrangement(mapId: string, arrangement: MapArrangement): Promise<void> {
  assertWritable();
  await setDoc(mapDoc(mapId), arrangement, { merge: true });
}

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
