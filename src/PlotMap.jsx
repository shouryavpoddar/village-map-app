import { useEffect, useMemo, useRef, useState } from 'react';
import { useCalibration } from './plot-map/hooks/useCalibration';
import { usePlotMapEngine } from './plot-map/hooks/usePlotMapEngine';
import { useSearch } from './plot-map/hooks/useSearch';
import { TOWNS } from './plot-map/helpers/villages';
import MapCanvas from './plot-map/components/MapCanvas';
import Sidebar from './plot-map/components/Sidebar';

const EMPTY_PLOTS = [];

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
    map.loadPlots().then((plots) => {
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
    plotsPath: map?.plotsPath,
  });
  const search = useSearch({ plotsRef: engine.plotsRef, selectPlot: engine.selectPlot });

  const villageLabel = town
    ? (town.maps.length > 1 && map ? `${town.label} — ${map.label}` : town.label)
    : 'No village selected';

  return (
    <div className="flex h-screen w-full bg-ink font-mono text-ink overflow-hidden max-[760px]:flex-col">
      <MapCanvas
        engine={engine}
        calibration={calibration}
        mapImageUrl={map?.imageUrl ?? null}
        mapImageRect={map?.imageRect ?? null}
        villageLabel={villageLabel}
      />
      <Sidebar
        engine={engine}
        search={search}
        towns={TOWNS}
        townKey={townKey}
        onTownChange={handleTownChange}
        maps={town?.maps ?? []}
        mapKey={mapKey}
        onMapChange={setMapKey}
        loading={rawPlots === null}
      />
    </div>
  );
}
