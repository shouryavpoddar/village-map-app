import { useEffect, useMemo, useRef, useState } from 'react';
import { useCalibration } from './plot-map/hooks/useCalibration';
import { usePlotMapEngine } from './plot-map/hooks/usePlotMapEngine';
import { useSearch } from './plot-map/hooks/useSearch';
import { VILLAGES } from './plot-map/helpers/villages';
import MapCanvas from './plot-map/components/MapCanvas';
import Sidebar from './plot-map/components/Sidebar';

const EMPTY_PLOTS = [];

/**
 * <PlotMap />
 * Villages are auto-discovered from src/assets (see plot-map/villages.js) -
 * drop a new "<name>-plots.json" (or matching image/rect) in there and it'll
 * show up in the village picker, no code changes needed.
 */
export default function PlotMap() {
  const [villageKey, setVillageKey] = useState(VILLAGES[0]?.key ?? null);
  const [rawPlots, setRawPlots] = useState(null);

  const village = useMemo(
    () => VILLAGES.find((v) => v.key === villageKey) ?? null,
    [villageKey]
  );

  useEffect(() => {
    if (!village) { setRawPlots([]); return; }
    let cancelled = false;
    setRawPlots(null); // loading
    village.loadPlots().then((plots) => {
      if (!cancelled) setRawPlots(plots);
    });
    return () => { cancelled = true; };
  }, [village]);

  const viewRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const calibration = useCalibration({
    viewRef,
    mapImageRect: village?.imageRect ?? null,
    storageKey: village ? `pm-map-calibration:${village.key}` : undefined,
  });
  const engine = usePlotMapEngine({
    rawPlots: rawPlots ?? EMPTY_PLOTS,
    viewRef,
    calibration,
    plotsPath: village?.plotsPath,
  });
  const search = useSearch({ plotsRef: engine.plotsRef, selectPlot: engine.selectPlot });

  return (
    <div className="flex h-screen w-full bg-ink font-mono text-ink overflow-hidden max-[760px]:flex-col">
      <MapCanvas
        engine={engine}
        calibration={calibration}
        mapImageUrl={village?.imageUrl ?? null}
        mapImageRect={village?.imageRect ?? null}
        villageLabel={village?.label ?? 'No village selected'}
      />
      <Sidebar
        engine={engine}
        search={search}
        villages={VILLAGES}
        villageKey={villageKey}
        onVillageChange={setVillageKey}
        loading={rawPlots === null}
      />
    </div>
  );
}
