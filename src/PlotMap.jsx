import { useEffect, useMemo, useRef, useState } from 'react';
import { useCalibration } from './plot-map/hooks/useCalibration';
import { usePlotMapEngine } from './plot-map/hooks/usePlotMapEngine';
import { useSearch } from './plot-map/hooks/useSearch';
import { useAllVillages } from './plot-map/hooks/useAllVillages';
import { useVillageArrangement } from './plot-map/hooks/useVillageArrangement';
import { TOWNS } from './plot-map/helpers/villages';
import { loadMapPlots } from './lib/plotsRepo';
import MapCanvas from './plot-map/components/MapCanvas';
import AllVillagesCanvas from './plot-map/components/AllVillagesCanvas';
import Sidebar from './plot-map/components/Sidebar';

const EMPTY_PLOTS = [];
// Sentinel town key for the combined view (see useAllVillages.js /
// useVillageArrangement.js) - deliberately not a real TOWNS entry, so the
// normal single-village `town`/`map` lookups below just resolve to null
// while it's selected instead of needing their own special-casing.
export const ALL_VILLAGES_KEY = '__all_villages__';

/**
 * <PlotMap />
 * Towns are auto-discovered from src/assets (see plot-map/villages.js) -
 * drop a new "<name>-plots.json" (or matching image/rect) in there and it'll
 * show up in the town picker, no code changes needed. A town with more than
 * one survey sheet (e.g. Khattalwada's part1/part2) gets a second "map"
 * picker to switch between its sheets.
 */
export default function PlotMap() {
  const [townKey, setTownKey] = useState(TOWNS[0]?.key ?? null);
  const [mapKey, setMapKey] = useState(TOWNS[0]?.maps[0]?.key ?? null);
  const [rawPlots, setRawPlots] = useState(null);

  const town = useMemo(
    () => TOWNS.find((t) => t.key === townKey) ?? null,
    [townKey]
  );
  const map = useMemo(
    () => town?.maps.find((m) => m.key === mapKey) ?? town?.maps[0] ?? null,
    [town, mapKey]
  );

  // switching town: jump to its first map (unless it already owns the
  // current mapKey, so navigating away and back doesn't lose the sheet)
  const handleTownChange = (nextTownKey) => {
    setTownKey(nextTownKey);
    const nextTown = TOWNS.find((t) => t.key === nextTownKey);
    setMapKey(nextTown?.maps[0]?.key ?? null);
  };

  useEffect(() => {
    if (!map) { setRawPlots([]); return; }
    let cancelled = false;
    setRawPlots(null); // loading
    loadMapPlots(map.mapId).then((plots) => {
      if (!cancelled) setRawPlots(plots);
    });
    return () => { cancelled = true; };
  }, [map]);

  const viewRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const calibration = useCalibration({
    viewRef,
    mapImageRect: map?.imageRect ?? null,
    storageKey: map ? `pm-map-calibration:${map.key}` : undefined,
  });
  const engine = usePlotMapEngine({
    rawPlots: rawPlots ?? EMPTY_PLOTS,
    viewRef,
    calibration,
    mapId: map?.mapId,
  });
  const search = useSearch({ plotsRef: engine.plotsRef, selectPlot: engine.selectPlot });

  const isAllVillages = townKey === ALL_VILLAGES_KEY;

  // Combined view: separate view/engine instance so switching into it never
  // disturbs the single-village one above - only whichever pair is actually
  // rendered attaches its pan/zoom listeners (see usePlotMapEngine's effect
  // on mapWrapRef). `mapId: null` makes any stray edit action a guaranteed
  // no-op (usePlotMapEngine.js's runPersist already skips writes when mapId
  // is falsy), which matters here since this view merges plots from every
  // village and has no single Firestore doc an edit could safely target.
  const allVillagesViewRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const allVillagesData = useAllVillages({ enabled: isAllVillages });
  const arrangement = useVillageArrangement({
    villages: allVillagesData.villages,
    viewRef: allVillagesViewRef,
    setVillageOffset: allVillagesData.setVillageOffset,
  });
  const allVillagesEngine = usePlotMapEngine({
    rawPlots: allVillagesData.rawPlots,
    viewRef: allVillagesViewRef,
    calibration: arrangement,
    mapId: null,
  });
  // usePlotMapEngine.zoomAt doesn't exist until the engine above is built,
  // but arrangement (built first, since the engine takes it as an input)
  // needs it so wheel-zoom keeps working normally while a village is armed
  // for dragging - see useVillageArrangement.js.
  useEffect(() => {
    arrangement.zoomAtRef.current = allVillagesEngine.zoomAt;
  }, [arrangement.zoomAtRef, allVillagesEngine.zoomAt]);

  const sidebarTowns = useMemo(
    () => [{ key: ALL_VILLAGES_KEY, label: 'All Villages', maps: [] }, ...TOWNS],
    []
  );

  const villageLabel = town
    ? (town.maps.length > 1 && map ? `${town.label} — ${map.label}` : town.label)
    : 'No village selected';

  return (
    <div className="flex h-screen w-full bg-ink font-mono text-ink overflow-hidden max-[760px]:flex-col">
      {/*
        Both canvases stay mounted at all times (visibility toggled via CSS,
        not conditional rendering) so each engine's one-time canvas-sizing
        effect (see usePlotCanvas.js's ResizeObserver setup, which only ever
        runs once per mount and has no dependency that would make it re-run
        later) fires while its DOM node is actually attached. If
        AllVillagesCanvas only mounted on demand, its sizing effect would
        already have run-and-bailed (empty refs) back when this component
        first rendered in single-village mode, and would never fire again -
        leaving its canvas stuck at the browser's 300x150 default forever.
        `display:contents` on the visible one keeps it a normal flex item of
        this row; `hidden` on the other removes it from layout while keeping
        it mounted.
      */}
      <div className={isAllVillages ? 'hidden' : 'contents'}>
        <MapCanvas
          engine={engine}
          calibration={calibration}
          mapImageUrl={map?.imageUrl ?? null}
          mapImageRect={map?.imageRect ?? null}
          villageLabel={villageLabel}
        />
      </div>
      <div className={isAllVillages ? 'contents' : 'hidden'}>
        <AllVillagesCanvas
          engine={allVillagesEngine}
          arrangement={arrangement}
          villages={allVillagesData.villages}
        />
      </div>
      <Sidebar
        engine={isAllVillages ? allVillagesEngine : engine}
        search={search}
        towns={sidebarTowns}
        townKey={townKey}
        onTownChange={handleTownChange}
        maps={town?.maps ?? []}
        mapKey={mapKey}
        onMapChange={setMapKey}
        loading={rawPlots === null}
        allVillages={isAllVillages ? {
          villages: allVillagesData.villages,
          loading: allVillagesData.loading,
          arrangement,
        } : null}
      />
    </div>
  );
}
