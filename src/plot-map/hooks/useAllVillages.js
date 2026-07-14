import { useCallback, useEffect, useMemo, useState } from 'react';
import { TOWNS } from '../helpers/villages';
import { bboxOf, computeVillageScale } from '../helpers/geometry';
import { loadMapArrangement, loadMapPlots, saveMapArrangement } from '../../lib/plotsRepo';

// Breathing room (world units, post-scale) between villages' default shelf
// positions - arbitrary, just needs to keep freshly-loaded villages from
// starting on top of each other before the user drags them apart.
const GRID_MARGIN = 200;

function flattenMaps() {
  return TOWNS.flatMap((town) => town.maps.map((m) => ({ ...m, townLabel: town.label })));
}

function scalePoints(points, scale) {
  return points.map(([x, y]) => [x * scale, y * scale]);
}

function unionBbox(plots) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of plots) {
    const b = bboxOf(p.points);
    minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

// Loads every village's plots at once, scales each one independently using
// whatever real-world areas have been tagged on its plots (computeVillageScale
// - see helpers/geometry.js), and gives every village a starting position (its
// last-saved manual offset, or a simple non-overlapping grid slot if it's
// never been positioned). See useVillageArrangement.js for how that offset
// gets dragged into place.
export function useAllVillages({ enabled }) {
  const [loading, setLoading] = useState(true);
  // [{ mapId, label, townLabel, scale, hasScale, plots (scaled, local origin), offsetX, offsetY }]
  const [villages, setVillages] = useState([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    // Loads every village's plots + saved arrangement once, on first switch
    // into the combined view - not on every app load, since most sessions
    // never open it.
    if (!enabled || loadedOnce) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const maps = flattenMaps();
      const loaded = await Promise.all(maps.map(async (m) => {
        const [plots, arrangement] = await Promise.all([
          loadMapPlots(m.mapId),
          loadMapArrangement(m.mapId),
        ]);
        const scale = computeVillageScale(plots);
        const scaledPlots = plots.map((p) => ({ ...p, points: scalePoints(p.points, scale) }));
        return {
          mapId: m.mapId, label: m.label, townLabel: m.townLabel,
          scale, hasScale: scale !== 1, plots: scaledPlots, savedOffset: arrangement,
        };
      }));

      if (cancelled) return;

      const bboxes = loaded.map((v) => unionBbox(v.plots));
      const widths = bboxes.map((b) => b.maxX - b.minX).filter(Number.isFinite);
      const heights = bboxes.map((b) => b.maxY - b.minY).filter(Number.isFinite);
      const cellWidth = (widths.length ? Math.max(...widths) : 1000) + GRID_MARGIN;
      const cellHeight = (heights.length ? Math.max(...heights) : 1000) + GRID_MARGIN;
      const cols = Math.max(1, Math.ceil(Math.sqrt(loaded.length)));

      const positioned = loaded.map((v, i) => {
        const b = bboxes[i];
        const defaultOffsetX = Number.isFinite(b.minX) ? (i % cols) * cellWidth - b.minX : 0;
        const defaultOffsetY = Number.isFinite(b.minY) ? Math.floor(i / cols) * cellHeight - b.minY : 0;
        return {
          mapId: v.mapId, label: v.label, townLabel: v.townLabel,
          scale: v.scale, hasScale: v.hasScale, plots: v.plots,
          offsetX: v.savedOffset?.offsetX ?? defaultOffsetX,
          offsetY: v.savedOffset?.offsetY ?? defaultOffsetY,
          // Only ever set by a precise anchor-plot fit between two sheets
          // sharing a real plot in common - the drag UI never sets this,
          // only offsetX/offsetY (see setVillageOffset below).
          rotation: v.savedOffset?.rotation ?? 0,
        };
      });

      setVillages(positioned);
      setLoading(false);
      setLoadedOnce(true);
    })();

    return () => { cancelled = true; };
  }, [enabled, loadedOnce]);

  // Every plot from every village, merged into one array with each village's
  // scale+offset already baked into its points, and ids namespaced by mapId
  // so two villages' plot #1 can't collide once merged (usePlotMapEngine/
  // usePlotCanvas only ever compare ids for equality, so string ids work
  // exactly like the numeric ones do everywhere else).
  const rawPlots = useMemo(() => villages.flatMap((v) => {
    const cos = Math.cos(v.rotation), sin = Math.sin(v.rotation);
    return v.plots.map((p) => ({
      ...p,
      id: `${v.mapId}:${p.id}`,
      points: p.points.map(([x, y]) => [
        x * cos - y * sin + v.offsetX,
        x * sin + y * cos + v.offsetY,
      ]),
    }));
  }), [villages]);

  const setVillageOffset = useCallback((mapId, offsetX, offsetY) => {
    setVillages((prev) => prev.map((v) => (v.mapId === mapId ? { ...v, offsetX, offsetY } : v)));
    saveMapArrangement(mapId, { offsetX, offsetY }).catch((err) => {
      console.error('Failed to save village arrangement', mapId, err);
    });
  }, []);

  return { loading, villages, rawPlots, setVillageOffset };
}
