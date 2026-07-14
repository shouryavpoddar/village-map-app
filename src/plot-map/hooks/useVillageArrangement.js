import { useCallback, useRef, useState } from 'react';

// Lets the user drag a whole village's plot set around the combined "All
// Villages" canvas to position it relative to the others, and persists the
// result via setVillageOffset (see useAllVillages.js). Modeled directly on
// useCalibration.js, which does the same thing for one background image -
// exposing the same shape ({calibratingRef, handleCalibWheel, handleCalibDrag,
// commitCalibDrag}) means usePlotMapEngine's existing calibration branch
// (see its wheel/pointer handlers) can drive this with zero changes to that
// file, exactly as it already does for image calibration.
//
// This is a stopgap until enough Form-7 edge-length/adjacency data exists to
// place villages automatically (see the plan) - expected to be shelved
// (commented out of the UI, not deleted) once villages have been dragged
// into place, while the saved offsets keep rendering the combined view.
export function useVillageArrangement({ villages, viewRef, setVillageOffset }) {
  const dragOverlayRef = useRef(null); // <g> DOM node holding the active village's live-drag polygons
  const calibratingRef = useRef(false);
  const dragDeltaRef = useRef({ dx: 0, dy: 0 });
  // usePlotMapEngine.zoomAt isn't available yet when this hook is constructed
  // (it's a build input to that engine) - the owning component fills this in
  // once the engine exists, so wheel-zoom keeps working normally while a
  // village is armed for dragging (see PlotMap.jsx wiring).
  const zoomAtRef = useRef(null);

  const [activeMapId, setActiveMapId] = useState(null);

  const applyOverlayTransform = useCallback(() => {
    const g = dragOverlayRef.current;
    if (!g) return;
    const { dx, dy } = dragDeltaRef.current;
    g.setAttribute('transform', `translate(${dx}, ${dy})`);
  }, []);

  const setActive = useCallback((mapId) => {
    dragDeltaRef.current = { dx: 0, dy: 0 };
    applyOverlayTransform();
    calibratingRef.current = mapId != null;
    setActiveMapId(mapId);
  }, [applyOverlayTransform]);

  const handleCalibWheel = useCallback((vb, factor) => {
    zoomAtRef.current?.(vb, viewRef.current.scale * factor);
  }, [viewRef]);

  const handleCalibDrag = useCallback((dx, dy) => {
    const { scale } = viewRef.current;
    dragDeltaRef.current = {
      dx: dragDeltaRef.current.dx + dx / scale,
      dy: dragDeltaRef.current.dy + dy / scale,
    };
    applyOverlayTransform();
  }, [viewRef, applyOverlayTransform]);

  const commitCalibDrag = useCallback(() => {
    if (activeMapId == null) return;
    const village = villages.find((v) => v.mapId === activeMapId);
    const { dx, dy } = dragDeltaRef.current;
    if (village && (dx !== 0 || dy !== 0)) {
      setVillageOffset(activeMapId, village.offsetX + dx, village.offsetY + dy);
    }
    dragDeltaRef.current = { dx: 0, dy: 0 };
    applyOverlayTransform();
  }, [activeMapId, villages, setVillageOffset, applyOverlayTransform]);

  return {
    dragOverlayRef, calibratingRef, zoomAtRef, activeMapId, setActive,
    handleCalibWheel, handleCalibDrag, commitCalibDrag,
  };
}
