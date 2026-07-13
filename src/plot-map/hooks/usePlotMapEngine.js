import { useCallback, useEffect, useRef, useState } from 'react';
import { NS, PAD, TICK_CLASSES, DRAW_LINE_CLASSES, DRAW_POINT_CLASSES } from '../helpers/constants';
import { PALETTE, bboxOf, centroidOf, shoelaceArea } from '../helpers/geometry';
import { summarizeGroups } from '../helpers/plotColor';
import { usePlotCanvas } from './usePlotCanvas';
import { deletePlotDoc, upsertPlot, upsertPlotsBatch } from '../../lib/plotsRepo';

// Strips a processed plot (with derived fields like area/centroid/bbox) back
// to the on-disk/Firestore shape - {color}/{groups} are only included when
// actually set, so plots without an override don't carry dead fields.
function toPlotDoc({ id, label, points, color, hasCustomColor, groups }) {
  return {
    id, label, points,
    ...(hasCustomColor ? { color } : {}),
    ...(groups?.length ? { groups } : {}),
  };
}

// Owns the SVG viewport (pan/zoom/fly-to) and plot selection/editing. The
// polygons themselves are rendered as React <Plot> components (see
// MapCanvas.jsx) driven by the `plots` state below - this hook only computes
// their geometry/data and hands it to React, rather than creating/mutating
// polygon DOM nodes itself. `viewRef` and `calibration` are passed in rather
// than owned here, since the background-image calibration mode
// (useCalibration) needs to read the current view scale and branch the same
// wheel/drag handlers this hook installs.
//
// The extraction script only extracts geometry - every plot starts
// unlabeled, some detected "plots" are really two parcels merged into one
// closed path, and some real parcels are missed entirely - so labeling and
// cleanup happen here (renameLabel/deletePlot/addPlot) and are saved
// straight back to Firestore (maps/{mapId}/plots/{plotId}, see
// src/lib/plotsRepo.ts), one targeted write per edit, rather than into
// localStorage where nothing but this browser would ever see them.
export function usePlotMapEngine({ rawPlots, viewRef, calibration, mapId }) {
  const svgRef = useRef(null);
  const viewportRef = useRef(null);
  const overlayRef = useRef(null);
  const overlaySvgRef = useRef(null);
  const mapWrapRef = useRef(null);
  const coordRef = useRef(null);

  const plotsRef = useRef([]);
  const boundsRef = useRef({ VB_MINX: 0, VB_MINY: 0, VB_W: 0, VB_H: 0, globalMinX: 0, globalMinY: 0, globalMaxX: 0, globalMaxY: 0 });
  const dragRef = useRef({ dragging: false, dragMoved: false, lastVB: null, lastClientX: 0, lastClientY: 0, pressedPlotId: null });
  const selectedIdRef = useRef(null);
  const drawingRef = useRef(false);
  const drawPointsRef = useRef([]);
  const visibleGroupsRef = useRef(new Set());
  // groups created via createGroup before any plot has been tagged into them
  // yet - summarizeGroups only sees groups that appear on a plot, so these
  // are tracked separately just so they still show up (with a 0 count) in
  // groupList until addPlotToGroup gives them their first member
  const manualGroupsRef = useRef([]);

  const [plots, setPlots] = useState([]);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [plotCount, setPlotCount] = useState(0);
  const [unlabeledCount, setUnlabeledCount] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'error'
  const [groupList, setGroupList] = useState([]); // [{ name, color, count }]
  const [visibleGroups, setVisibleGroups] = useState(new Set());

  const { canvasRef, scheduleRedraw, refreshScreenCTM, hitTest, setHovered } = usePlotCanvas({
    svgRef, mapWrapRef, viewRef, plotsRef, selectedIdRef, drawingRef, visibleGroupsRef,
  });

  const refreshUnlabeledCount = useCallback(() => {
    setUnlabeledCount(plotsRef.current.filter((p) => !p.label).length);
  }, []);

  // Runs a single Firestore write (one plot, or a small batch of them) and
  // reflects its outcome in saveStatus - every mutation below writes only
  // the plot(s) it actually touched, not the whole map's plot array.
  const runPersist = useCallback(async (op) => {
    if (!mapId) return;
    setSaveStatus('saving');
    try {
      await op();
      setSaveStatus('idle');
    } catch (err) {
      console.error('Failed to save', mapId, err);
      setSaveStatus('error');
    }
  }, [mapId]);

  const refreshGroupList = useCallback(() => {
    const derived = summarizeGroups(plotsRef.current);
    const derivedNames = new Set(derived.map((g) => g.name));
    const empties = manualGroupsRef.current
      .filter((g) => !derivedNames.has(g.name))
      .map((g) => ({ ...g, count: 0 }));
    setGroupList([...derived, ...empties]);
  }, []);

  const applyTransform = useCallback(() => {
    const { scale, tx, ty } = viewRef.current;
    if (viewportRef.current) {
      viewportRef.current.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
    }
  }, [viewRef]);

  const updateOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.innerHTML = '';
    const { scale, tx, ty } = viewRef.current;
    const toScreen = (x, y) => [scale * x + tx, scale * y + ty];

    if (drawingRef.current) {
      const screenPts = drawPointsRef.current.map(([x, y]) => toScreen(x, y));
      if (screenPts.length > 1) {
        const line = document.createElementNS(NS, 'polyline');
        line.setAttribute('points', screenPts.map(p => p.join(',')).join(' '));
        line.setAttribute('class', DRAW_LINE_CLASSES);
        overlay.appendChild(line);
      }
      screenPts.forEach(([vx, vy], i) => {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', vx); dot.setAttribute('cy', vy);
        dot.setAttribute('r', i === 0 ? 6 : 4);
        dot.setAttribute('class', DRAW_POINT_CLASSES);
        overlay.appendChild(dot);
      });
      return;
    }

    const plot = plotsRef.current.find(p => p.id === selectedIdRef.current);
    if (!plot) return;
    const { minX, minY, maxX, maxY } = plot.bbox;
    const corners = [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]];
    const size = 7;
    corners.forEach(([x, y]) => {
      const [vx, vy] = toScreen(x, y);
      const g = document.createElementNS(NS, 'g');
      const l1 = document.createElementNS(NS, 'line');
      l1.setAttribute('x1', vx - size); l1.setAttribute('x2', vx + size);
      l1.setAttribute('y1', vy); l1.setAttribute('y2', vy);
      l1.setAttribute('class', TICK_CLASSES);
      const l2 = document.createElementNS(NS, 'line');
      l2.setAttribute('y1', vy - size); l2.setAttribute('y2', vy + size);
      l2.setAttribute('x1', vx); l2.setAttribute('x2', vx);
      l2.setAttribute('class', TICK_CLASSES);
      g.appendChild(l1); g.appendChild(l2);
      overlay.appendChild(g);
    });
  }, [viewRef]);

  const flyTo = useCallback((minX, minY, maxX, maxY, animate = true) => {
    const { VB_MINX, VB_MINY, VB_W, VB_H } = boundsRef.current;
    const padFrac = 0.14;
    const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);
    const tMinX = minX - w * padFrac, tMaxX = maxX + w * padFrac;
    const tMinY = minY - h * padFrac, tMaxY = maxY + h * padFrac;
    const tw = tMaxX - tMinX, th = tMaxY - tMinY;
    const s = Math.min(VB_W / tw, VB_H / th);
    const cx = (tMinX + tMaxX) / 2, cy = (tMinY + tMaxY) / 2;
    const newTx = (VB_MINX + VB_W / 2) - s * cx;
    const newTy = (VB_MINY + VB_H / 2) - s * cy;

    if (!animate) {
      viewRef.current = { scale: s, tx: newTx, ty: newTy };
      applyTransform(); updateOverlay(); scheduleRedraw();
      return;
    }
    const start = { ...viewRef.current };
    const t0 = performance.now();
    const dur = 480;
    function step(now) {
      let p = Math.min(1, (now - t0) / dur);
      p = 1 - Math.pow(1 - p, 3); // ease-out cubic
      viewRef.current = {
        scale: start.scale + (s - start.scale) * p,
        tx: start.tx + (newTx - start.tx) * p,
        ty: start.ty + (newTy - start.ty) * p,
      };
      applyTransform(); updateOverlay(); scheduleRedraw();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [applyTransform, updateOverlay, scheduleRedraw, viewRef]);

  const fitAll = useCallback((animate = true) => {
    const b = boundsRef.current;
    flyTo(b.globalMinX, b.globalMinY, b.globalMaxX, b.globalMaxY, animate);
  }, [flyTo]);

  const svgPointFromEvent = useCallback((e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM().inverse();
    return pt.matrixTransform(ctm);
  }, []);

  const zoomAt = useCallback((vbPoint, newScale) => {
    newScale = Math.max(0.4, Math.min(newScale, 60));
    const { scale, tx, ty } = viewRef.current;
    const localX = (vbPoint.x - tx) / scale;
    const localY = (vbPoint.y - ty) / scale;
    const newTx = vbPoint.x - newScale * localX;
    const newTy = vbPoint.y - newScale * localY;
    viewRef.current = { scale: newScale, tx: newTx, ty: newTy };
    applyTransform(); updateOverlay(); scheduleRedraw();
  }, [applyTransform, updateOverlay, scheduleRedraw, viewRef]);

  // canvas draws the selected plot in its own pass on top of everything else
  // (see usePlotCanvas), so there's no need to reorder the underlying array
  // just to control paint order the way the old SVG-DOM renderer required
  const selectPlot = useCallback((plot, fly = true) => {
    selectedIdRef.current = plot.id;
    setSelectedPlot(plot);
    updateOverlay();
    scheduleRedraw();
    if (fly) flyTo(plot.bbox.minX, plot.bbox.minY, plot.bbox.maxX, plot.bbox.maxY, true);
  }, [updateOverlay, scheduleRedraw, flyTo]);

  // jump to the nearest still-unlabeled plot (by centroid distance from the
  // currently selected one), or just the first one found if nothing's
  // selected yet - there's no "current position" to be closest to in that
  // case, so any unlabeled plot is as good a starting point as any other
  const focusNextUnlabeled = useCallback(() => {
    const current = plotsRef.current.find((p) => p.id === selectedIdRef.current);
    const candidates = plotsRef.current.filter((p) => !p.label && p.id !== selectedIdRef.current);
    if (!candidates.length) return;

    let target = candidates[0];
    if (current) {
      let bestDist = Infinity;
      for (const p of candidates) {
        const dx = p.centroid[0] - current.centroid[0];
        const dy = p.centroid[1] - current.centroid[1];
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; target = p; }
      }
    }
    selectPlot(target, true);
  }, [selectPlot]);

  // compute geometry once plots data arrives; the actual polygons are
  // rendered by React from the `plots` state this sets (see MapCanvas.jsx)
  useEffect(() => {
    selectedIdRef.current = null;
    setSelectedPlot(null);
    if (!rawPlots || !svgRef.current) return;

    manualGroupsRef.current = [];

    if (!rawPlots.length) {
      plotsRef.current = [];
      setPlots([]);
      setPlotCount(0);
      setUnlabeledCount(0);
      setGroupList([]);
      visibleGroupsRef.current = new Set();
      setVisibleGroups(new Set());
      scheduleRedraw();
      return;
    }

    let globalMinX = Infinity, globalMinY = Infinity, globalMaxX = -Infinity, globalMaxY = -Infinity;
    const processed = rawPlots.map((p, idx) => {
      const bbox = bboxOf(p.points);
      globalMinX = Math.min(globalMinX, bbox.minX);
      globalMinY = Math.min(globalMinY, bbox.minY);
      globalMaxX = Math.max(globalMaxX, bbox.maxX);
      globalMaxY = Math.max(globalMaxY, bbox.maxY);
      return {
        id: p.id, label: p.label, points: p.points,
        area: shoelaceArea(p.points),
        centroid: centroidOf(p.points),
        bbox,
        color: p.color ?? PALETTE[idx % PALETTE.length],
        hasCustomColor: p.color != null,
        groups: p.groups,
      };
    });
    plotsRef.current = processed;
    setPlots(processed);

    // every group found on load starts toggled visible
    const groups = summarizeGroups(processed);
    const groupNames = new Set(groups.map((g) => g.name));
    visibleGroupsRef.current = groupNames;
    setVisibleGroups(groupNames);
    setGroupList(groups);
    boundsRef.current = {
      globalMinX, globalMinY, globalMaxX, globalMaxY,
      VB_MINX: globalMinX - PAD, VB_MINY: globalMinY - PAD,
      VB_W: (globalMaxX - globalMinX) + PAD * 2,
      VB_H: (globalMaxY - globalMinY) + PAD * 2,
    };

    const svg = svgRef.current;
    const { VB_MINX, VB_MINY, VB_W, VB_H } = boundsRef.current;
    const viewBoxAttr = `${VB_MINX} ${VB_MINY} ${VB_W} ${VB_H}`;
    svg.setAttribute('viewBox', viewBoxAttr);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (overlaySvgRef.current) {
      overlaySvgRef.current.setAttribute('viewBox', viewBoxAttr);
      overlaySvgRef.current.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    refreshScreenCTM();

    setPlotCount(processed.length);
    setUnlabeledCount(processed.filter((p) => !p.label).length);
    fitAll(false);
    scheduleRedraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPlots]);

  // hand-correct a plot's label (every plot starts unlabeled - see
  // usePlotMapEngine's doc comment above), saved back to Firestore
  const renameLabel = useCallback((plotId, newLabel) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const next = plotsRef.current.map((p) => (p.id === plotId ? { ...p, label: trimmed } : p));
    plotsRef.current = next;
    setPlots(next);
    const updated = next.find((p) => p.id === plotId);
    if (selectedIdRef.current === plotId) {
      setSelectedPlot(updated ?? null);
    }
    refreshUnlabeledCount();
    scheduleRedraw();
    if (updated) runPersist(() => upsertPlot(mapId, toPlotDoc(updated)));
  }, [mapId, runPersist, refreshUnlabeledCount, scheduleRedraw]);

  // hand-pick a plot's fill color, saved back to Firestore as an explicit
  // `color` field (plots without one keep cycling through the default
  // palette by position, so this only needs to persist the overrides)
  const setPlotColor = useCallback((plotId, color) => {
    const next = plotsRef.current.map((p) => (p.id === plotId ? { ...p, color, hasCustomColor: true } : p));
    plotsRef.current = next;
    setPlots(next);
    const updated = next.find((p) => p.id === plotId);
    if (selectedIdRef.current === plotId) {
      setSelectedPlot(updated ?? null);
    }
    scheduleRedraw();
    if (updated) runPersist(() => upsertPlot(mapId, toPlotDoc(updated)));
  }, [mapId, runPersist, scheduleRedraw]);

  // remove a plot - for shapes that turned out to be two parcels merged
  // into one closed path, stray non-parcel shapes that slipped through
  // extraction, or a hand-drawn plot the user wants to redo
  const deletePlot = useCallback((plotId) => {
    const next = plotsRef.current.filter((p) => p.id !== plotId);
    plotsRef.current = next;
    setPlots(next);
    if (selectedIdRef.current === plotId) {
      selectedIdRef.current = null;
      setSelectedPlot(null);
      updateOverlay();
    }
    setPlotCount(next.length);
    refreshUnlabeledCount();
    refreshGroupList();
    scheduleRedraw();
    runPersist(() => deletePlotDoc(mapId, plotId));
  }, [updateOverlay, mapId, runPersist, refreshUnlabeledCount, refreshGroupList, scheduleRedraw]);

  // tag every plot whose label matches a number from an imported CSV/Excel
  // file with a named, colored group (see helpers/parsePlotNumbers.js) -
  // added as a new `groups` entry alongside the existing label, never
  // touching it, since labels are the plot numbers other calculations rely on
  const importGroup = useCallback((name, color, matchedIds) => {
    const idSet = new Set(matchedIds);
    const next = plotsRef.current.map((p) => {
      if (!idSet.has(p.id)) return p;
      const rest = (p.groups ?? []).filter((g) => g.name !== name);
      return { ...p, groups: [...rest, { name, color }] };
    });
    plotsRef.current = next;
    setPlots(next);
    visibleGroupsRef.current = new Set(visibleGroupsRef.current).add(name);
    setVisibleGroups(new Set(visibleGroupsRef.current));
    refreshGroupList();
    if (selectedIdRef.current != null) {
      setSelectedPlot(next.find((p) => p.id === selectedIdRef.current) ?? null);
    }
    scheduleRedraw();
    const touched = next.filter((p) => idSet.has(p.id)).map(toPlotDoc);
    runPersist(() => upsertPlotsBatch(mapId, touched));
  }, [mapId, runPersist, refreshGroupList, scheduleRedraw]);

  // start a named, colored group with no plots yet - tracked in
  // manualGroupsRef so it shows up (0 count) in groupList until
  // addPlotToGroup gives it a first member, at which point summarizeGroups
  // picks it up on its own and refreshGroupList stops adding it separately
  const createGroup = useCallback((name, color) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const taken = summarizeGroups(plotsRef.current).some((g) => g.name === trimmed)
      || manualGroupsRef.current.some((g) => g.name === trimmed);
    if (taken) return;
    manualGroupsRef.current = [...manualGroupsRef.current, { name: trimmed, color }];
    visibleGroupsRef.current = new Set(visibleGroupsRef.current).add(trimmed);
    setVisibleGroups(new Set(visibleGroupsRef.current));
    refreshGroupList();
  }, [refreshGroupList]);

  // tag a single existing plot into a group (created via createGroup or
  // already populated via importGroup) - the group's own color wins, same as
  // importGroup, so every member stays visually consistent
  const addPlotToGroup = useCallback((plotId, groupName) => {
    const group = summarizeGroups(plotsRef.current).find((g) => g.name === groupName)
      ?? manualGroupsRef.current.find((g) => g.name === groupName);
    if (!group) return;
    const next = plotsRef.current.map((p) => {
      if (p.id !== plotId || p.groups?.some((g) => g.name === groupName)) return p;
      return { ...p, groups: [...(p.groups ?? []), { name: groupName, color: group.color }] };
    });
    plotsRef.current = next;
    setPlots(next);
    refreshGroupList();
    const updated = next.find((p) => p.id === plotId);
    if (selectedIdRef.current === plotId) {
      setSelectedPlot(updated ?? null);
    }
    scheduleRedraw();
    if (updated) runPersist(() => upsertPlot(mapId, toPlotDoc(updated)));
  }, [mapId, runPersist, refreshGroupList, scheduleRedraw]);

  // undo a single plot's membership in one group, leaving the group (and its
  // other members) otherwise intact - the group only disappears once every
  // plot has been removed from it (see removeGroup) or manualGroupsRef no
  // longer remembers it as a placeholder
  const removePlotFromGroup = useCallback((plotId, groupName) => {
    const next = plotsRef.current.map((p) => {
      if (p.id !== plotId || !p.groups?.some((g) => g.name === groupName)) return p;
      const remaining = p.groups.filter((g) => g.name !== groupName);
      return { ...p, groups: remaining.length ? remaining : undefined };
    });
    plotsRef.current = next;
    setPlots(next);
    refreshGroupList();
    const updated = next.find((p) => p.id === plotId);
    if (selectedIdRef.current === plotId) {
      setSelectedPlot(updated ?? null);
    }
    scheduleRedraw();
    if (updated) runPersist(() => upsertPlot(mapId, toPlotDoc(updated)));
  }, [mapId, runPersist, refreshGroupList, scheduleRedraw]);

  // show/hide a group's color overlay on the map without touching membership
  // - just flips which group names are considered "active", which the
  // <Plot> list re-derives its fill from on the next render
  const toggleGroup = useCallback((name) => {
    const next = new Set(visibleGroupsRef.current);
    if (next.has(name)) next.delete(name); else next.add(name);
    visibleGroupsRef.current = next;
    setVisibleGroups(next);
    scheduleRedraw();
  }, [scheduleRedraw]);

  // un-tag every plot in a group entirely (the group disappears once no
  // plot references it - there's nothing else to clean up)
  const removeGroup = useCallback((name) => {
    const touchedIds = new Set(
      plotsRef.current.filter((p) => p.groups?.some((g) => g.name === name)).map((p) => p.id)
    );
    const next = plotsRef.current.map((p) => {
      if (!p.groups?.some((g) => g.name === name)) return p;
      const remaining = p.groups.filter((g) => g.name !== name);
      return { ...p, groups: remaining.length ? remaining : undefined };
    });
    plotsRef.current = next;
    setPlots(next);
    manualGroupsRef.current = manualGroupsRef.current.filter((g) => g.name !== name);
    const nextVisible = new Set(visibleGroupsRef.current);
    nextVisible.delete(name);
    visibleGroupsRef.current = nextVisible;
    setVisibleGroups(nextVisible);
    refreshGroupList();
    if (selectedIdRef.current != null) {
      setSelectedPlot(next.find((p) => p.id === selectedIdRef.current) ?? null);
    }
    scheduleRedraw();
    const touched = next.filter((p) => touchedIds.has(p.id)).map(toPlotDoc);
    if (touched.length) runPersist(() => upsertPlotsBatch(mapId, touched));
  }, [mapId, runPersist, refreshGroupList, scheduleRedraw]);

  // add a hand-drawn plot (see startDrawing/finishDrawing below), numbered
  // to continue on from the highest existing id
  const addPlot = useCallback((points) => {
    if (!points || points.length < 3) return;
    const rounded = points.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    const newId = Math.max(0, ...plotsRef.current.map((p) => p.id)) + 1;

    const bbox = bboxOf(rounded);
    const plot = {
      id: newId, label: '', points: rounded,
      area: shoelaceArea(rounded),
      centroid: centroidOf(rounded),
      bbox,
      color: PALETTE[plotsRef.current.length % PALETTE.length],
      hasCustomColor: false,
    };
    const next = [...plotsRef.current, plot];
    plotsRef.current = next;
    setPlots(next);

    boundsRef.current = {
      ...boundsRef.current,
      globalMinX: Math.min(boundsRef.current.globalMinX, bbox.minX),
      globalMinY: Math.min(boundsRef.current.globalMinY, bbox.minY),
      globalMaxX: Math.max(boundsRef.current.globalMaxX, bbox.maxX),
      globalMaxY: Math.max(boundsRef.current.globalMaxY, bbox.maxY),
    };

    setPlotCount(next.length);
    refreshUnlabeledCount();
    selectPlot(plot, false);
    runPersist(() => upsertPlot(mapId, toPlotDoc(plot)));
  }, [selectPlot, mapId, runPersist, refreshUnlabeledCount]);

  // click-to-place-corners drawing mode for plots the extraction missed.
  // Existing polygons are made pointer-events:none for the duration so that
  // clicking (or even just hovering) over one while drawing can't select,
  // hover-highlight, or otherwise trigger any of its normal behavior - every
  // click on the map should only ever place a corner while this is active.
  const startDrawing = useCallback(() => {
    drawingRef.current = true;
    drawPointsRef.current = [];
    setDrawPoints([]);
    setDrawing(true);
    selectedIdRef.current = null;
    setSelectedPlot(null);
    setHovered(null);
    updateOverlay();
    scheduleRedraw();
  }, [updateOverlay, setHovered, scheduleRedraw]);

  const stopDrawing = useCallback(() => {
    drawingRef.current = false;
    drawPointsRef.current = [];
    setDrawPoints([]);
    setDrawing(false);
    updateOverlay();
    scheduleRedraw();
  }, [updateOverlay, scheduleRedraw]);

  const cancelDrawing = useCallback(() => {
    stopDrawing();
  }, [stopDrawing]);

  const undoDrawPoint = useCallback(() => {
    drawPointsRef.current = drawPointsRef.current.slice(0, -1);
    setDrawPoints(drawPointsRef.current);
    updateOverlay();
  }, [updateOverlay]);

  const finishDrawing = useCallback(() => {
    const pts = drawPointsRef.current;
    stopDrawing();
    if (pts.length >= 3) addPlot(pts);
  }, [addPlot, stopDrawing]);

  // wheel + drag + click-to-select/draw handlers
  useEffect(() => {
    const mapWrap = mapWrapRef.current;
    if (!mapWrap) return;

    const onWheel = (e) => {
      e.preventDefault();
      const vb = svgPointFromEvent(e);
      const factor = Math.pow(1.0018, -e.deltaY);
      if (calibration.calibratingRef.current) {
        calibration.handleCalibWheel(vb, factor);
        return;
      }
      zoomAt(vb, viewRef.current.scale * factor);
    };
    const onPointerDown = (e) => {
      if (e.target.closest('button')) return;
      if (drawingRef.current) {
        const vb = svgPointFromEvent(e);
        const { scale, tx, ty } = viewRef.current;
        drawPointsRef.current = [...drawPointsRef.current, [(vb.x - tx) / scale, (vb.y - ty) / scale]];
        setDrawPoints(drawPointsRef.current);
        updateOverlay();
        return;
      }
      dragRef.current.dragging = true;
      dragRef.current.dragMoved = false;
      dragRef.current.lastVB = svgPointFromEvent(e);
      dragRef.current.lastClientX = e.clientX;
      dragRef.current.lastClientY = e.clientY;
      // captured here (not read from the eventual 'click' event) because
      // setPointerCapture below can keep the browser's synthesized 'click'
      // from ever reaching the polygon itself once the pointer is captured.
      // hitTest replaces the old e.target.dataset.id read now that plots
      // are painted onto one canvas instead of being individual DOM nodes.
      dragRef.current.pressedPlotId = hitTest(e.clientX, e.clientY)?.id ?? null;
      mapWrap.dataset.dragging = 'true';
      mapWrap.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      const vb = svgPointFromEvent(e);
      if (coordRef.current) {
        coordRef.current.textContent = `x: ${vb.x.toFixed(1)}   y: ${vb.y.toFixed(1)}`;
      }
      if (!dragRef.current.dragging && !drawingRef.current && !calibration.calibratingRef.current) {
        const hit = hitTest(e.clientX, e.clientY);
        setHovered(hit?.id ?? null);
      }
      if (!dragRef.current.dragging) return;
      const { lastVB } = dragRef.current;
      const dx = vb.x - lastVB.x, dy = vb.y - lastVB.y;
      // measured in real screen pixels, not viewBox units, so the click-vs-drag
      // threshold stays meaningful regardless of zoom level or dataset scale
      const screenDx = e.clientX - dragRef.current.lastClientX;
      const screenDy = e.clientY - dragRef.current.lastClientY;
      if (Math.abs(screenDx) > 4 || Math.abs(screenDy) > 4) dragRef.current.dragMoved = true;
      dragRef.current.lastVB = vb;
      dragRef.current.lastClientX = e.clientX;
      dragRef.current.lastClientY = e.clientY;
      if (calibration.calibratingRef.current) {
        calibration.handleCalibDrag(dx, dy);
        return;
      }
      viewRef.current = { ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy };
      applyTransform(); updateOverlay(); scheduleRedraw();
    };
    const endDrag = () => {
      dragRef.current.dragging = false;
      dragRef.current.pressedPlotId = null;
      mapWrap.dataset.dragging = 'false';
      if (calibration.calibratingRef.current) {
        calibration.commitCalibDrag();
      }
    };
    const onPointerUp = () => {
      const { dragMoved, pressedPlotId } = dragRef.current;
      endDrag();
      if (drawingRef.current || calibration.calibratingRef.current || dragMoved || pressedPlotId == null) return;
      const plot = plotsRef.current.find(p => p.id === pressedPlotId);
      if (plot) selectPlot(plot);
    };
    const onPointerLeave = () => {
      endDrag();
      setHovered(null);
    };

    mapWrap.addEventListener('wheel', onWheel, { passive: false });
    mapWrap.addEventListener('pointerdown', onPointerDown);
    mapWrap.addEventListener('pointermove', onPointerMove);
    mapWrap.addEventListener('pointerup', onPointerUp);
    mapWrap.addEventListener('pointerleave', onPointerLeave);
    mapWrap.addEventListener('pointercancel', endDrag);

    return () => {
      mapWrap.removeEventListener('wheel', onWheel);
      mapWrap.removeEventListener('pointerdown', onPointerDown);
      mapWrap.removeEventListener('pointermove', onPointerMove);
      mapWrap.removeEventListener('pointerup', onPointerUp);
      mapWrap.removeEventListener('pointerleave', onPointerLeave);
      mapWrap.removeEventListener('pointercancel', endDrag);
    };
  }, [
    svgPointFromEvent, zoomAt, applyTransform, updateOverlay, scheduleRedraw, viewRef, selectPlot,
    hitTest, setHovered,
    calibration.handleCalibWheel, calibration.handleCalibDrag, calibration.commitCalibDrag,
  ]);

  const zoomButtonCenter = useCallback(() => ({
    x: boundsRef.current.VB_MINX + boundsRef.current.VB_W / 2,
    y: boundsRef.current.VB_MINY + boundsRef.current.VB_H / 2,
  }), []);

  return {
    svgRef, viewportRef, overlayRef, overlaySvgRef, canvasRef, mapWrapRef, coordRef,
    plotsRef, viewRef, plots, selectedIdRef,
    selectedPlot, plotCount, unlabeledCount, saveStatus,
    fitAll, zoomAt, zoomButtonCenter, selectPlot, renameLabel, deletePlot, setPlotColor,
    focusNextUnlabeled,
    drawing, drawPoints, startDrawing, cancelDrawing, finishDrawing, undoDrawPoint,
    groupList, visibleGroups, importGroup, toggleGroup, removeGroup,
    createGroup, addPlotToGroup, removePlotFromGroup,
  };
}
