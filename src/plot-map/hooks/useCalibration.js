import { useCallback, useEffect, useRef, useState } from 'react';
import { CALIB_STORAGE_KEY, clamp } from '../helpers/constants';

const NO_IMAGE_RECT = { x: 0, y: 0, width: 0, height: 0 };

// Lets a user drag/scroll/nudge the background survey-sheet image into place
// against the (already fixed) plot polygons, since the two are digitized
// independently and may not agree on scale/offset out of the box.
//
// `mapImageRect` is the village's starting rect (or null if it has no
// background image yet); `storageKey` namespaces the saved calibration so
// switching villages doesn't clobber another village's saved adjustment.
export function useCalibration({ viewRef, mapImageRect, storageKey = CALIB_STORAGE_KEY }) {
  const baseRect = mapImageRect ?? NO_IMAGE_RECT;

  const imageElRef = useRef(null);
  const calibRef = useRef({ x: baseRect.x, y: baseRect.y, scale: 1 });
  const calibratingRef = useRef(false);

  const [calibrating, setCalibrating] = useState(false);
  const [calibDisplay, setCalibDisplay] = useState(calibRef.current);

  useEffect(() => { calibratingRef.current = calibrating; }, [calibrating]);

  const applyImageTransform = useCallback(() => {
    const img = imageElRef.current;
    if (!img) return;
    const { x, y, scale } = calibRef.current;
    img.setAttribute('x', x);
    img.setAttribute('y', y);
    img.setAttribute('width', baseRect.width * scale);
    img.setAttribute('height', baseRect.height * scale);
  }, [baseRect.width, baseRect.height]);

  const persistCalib = useCallback(() => {
    localStorage.setItem(storageKey, JSON.stringify(calibRef.current));
  }, [storageKey]);

  const setCalib = useCallback((next) => {
    calibRef.current = next;
    applyImageTransform();
    setCalibDisplay(next);
    persistCalib();
  }, [applyImageTransform, persistCalib]);

  // (re)base to this village's rect, then restore any previously saved
  // calibration for it - runs on mount and whenever the village changes
  useEffect(() => {
    calibRef.current = { x: baseRect.x, y: baseRect.y, scale: 1 };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved.x === 'number') {
        calibRef.current = saved;
      }
    } catch { /* ignore malformed/missing saved calibration */ }
    setCalibDisplay(calibRef.current);
    applyImageTransform();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, baseRect.x, baseRect.y, baseRect.width, baseRect.height]);

  // arrow-key nudging while calibrating the background image
  useEffect(() => {
    if (!calibrating) return;
    const onKeyDown = (e) => {
      const nudge = (e.shiftKey ? 20 : 2) / viewRef.current.scale;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -nudge;
      else if (e.key === 'ArrowRight') dx = nudge;
      else if (e.key === 'ArrowUp') dy = -nudge;
      else if (e.key === 'ArrowDown') dy = nudge;
      else return;
      e.preventDefault();
      setCalib({ ...calibRef.current, x: calibRef.current.x + dx, y: calibRef.current.y + dy });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [calibrating, setCalib, viewRef]);

  const resetCalib = useCallback(() => {
    setCalib({ x: baseRect.x, y: baseRect.y, scale: 1 });
  }, [setCalib, baseRect.x, baseRect.y]);

  const copyCalib = useCallback(() => {
    const { x, y, scale } = calibRef.current;
    const rect = {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      width: Number((baseRect.width * scale).toFixed(2)),
      height: Number((baseRect.height * scale).toFixed(2)),
    };
    navigator.clipboard.writeText(JSON.stringify(rect));
  }, [baseRect.width, baseRect.height]);

  // called from the map's own wheel handler when calibrating is active,
  // scaling anchored at the cursor (same behavior as the main view's zoomAt)
  const handleCalibWheel = useCallback((vb, factor) => {
    const { scale: viewScale, tx, ty } = viewRef.current;
    const plotX = (vb.x - tx) / viewScale, plotY = (vb.y - ty) / viewScale;
    const { x, y, scale } = calibRef.current;
    const newScale = clamp(scale * factor, 0.05, 20);
    const localX = (plotX - x) / scale, localY = (plotY - y) / scale;
    setCalib({ x: plotX - newScale * localX, y: plotY - newScale * localY, scale: newScale });
  }, [viewRef, setCalib]);

  // called from the map's own drag handler when calibrating is active;
  // applies the move immediately (imperatively) without waiting for React
  const handleCalibDrag = useCallback((dx, dy) => {
    const { scale: viewScale } = viewRef.current;
    calibRef.current = {
      ...calibRef.current,
      x: calibRef.current.x + dx / viewScale,
      y: calibRef.current.y + dy / viewScale,
    };
    applyImageTransform();
  }, [viewRef, applyImageTransform]);

  // called once a calibration drag ends, to sync the readout + persist
  const commitCalibDrag = useCallback(() => {
    setCalibDisplay({ ...calibRef.current });
    persistCalib();
  }, [persistCalib]);

  return {
    imageElRef,
    calibratingRef,
    calibrating,
    setCalibrating,
    calibDisplay,
    resetCalib,
    copyCalib,
    handleCalibWheel,
    handleCalibDrag,
    commitCalibDrag,
  };
}
