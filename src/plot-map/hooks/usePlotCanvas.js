import { useCallback, useEffect, useRef } from 'react';
import { pointInPolygon } from '../helpers/geometry';
import { effectiveColor, withOpacity } from '../helpers/plotColor';

function drawPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

// Paints all plot polygons onto a single <canvas> instead of one SVG
// <polygon> DOM node each - at a few thousand plots the per-node React/DOM
// cost dominates, while redrawing the same shapes into canvas every frame is
// comfortably sub-frame-budget. Everything else (pan/zoom, overlay
// tick-marks, selection state) stays owned by usePlotMapEngine, which calls
// into this hook for canvasRef/hitTest/setHovered/scheduleRedraw.
export function usePlotCanvas({ svgRef, mapWrapRef, viewRef, plotsRef, selectedIdRef, drawingRef, visibleGroupsRef }) {
  const canvasRef = useRef(null);
  const hoveredIdRef = useRef(null);
  // world -> viewBox->screen mapping is cached and only recomputed on
  // resize/viewBox change, not per pan/zoom frame - see computeWorldToCanvasMatrix
  const screenCTMRef = useRef(null);
  const canvasRectRef = useRef(null);
  const resolvedColorsRef = useRef(null);
  const rafPendingRef = useRef(false);

  const refreshScreenCTM = useCallback(() => {
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    if (!svg || !canvas) return;
    screenCTMRef.current = svg.getScreenCTM();
    canvasRectRef.current = canvas.getBoundingClientRect();
  }, [svgRef]);

  const computeWorldToCanvasMatrix = useCallback(() => {
    const ctm = screenCTMRef.current;
    const rect = canvasRectRef.current;
    if (!ctm || !rect) return null;
    const dpr = window.devicePixelRatio || 1;
    const { scale, tx, ty } = viewRef.current;
    return new DOMMatrix()
      .scale(dpr, dpr)
      .translate(-rect.left, -rect.top)
      .multiply(ctm)
      .translate(tx, ty)
      .scale(scale);
  }, [viewRef]);

  // resolved once - CSS custom properties (--color-line etc) aren't valid
  // canvas fillStyle/strokeStyle values, and this app has no theme switching
  const ensureResolvedColors = useCallback(() => {
    if (resolvedColorsRef.current || !mapWrapRef.current) return;
    const cs = getComputedStyle(mapWrapRef.current);
    const line = cs.getPropertyValue('--color-line').trim();
    const ink = cs.getPropertyValue('--color-ink').trim();
    const highlight = cs.getPropertyValue('--color-highlight').trim();
    if (!line || !ink || !highlight) return;
    resolvedColorsRef.current = { line, ink, highlight, highlightFillA: withOpacity(highlight, 0.3) };
  }, [mapWrapRef]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const m = computeWorldToCanvasMatrix();
    if (!m) return;
    ensureResolvedColors();
    const colors = resolvedColorsRef.current;
    if (!colors) return;

    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);

    const dpr = window.devicePixelRatio || 1;
    const pxPerWorld = m.a || 1; // no rotation anywhere in this app - one scalar suffices
    const baseLW = (1.1 * dpr) / pxPerWorld;
    const hoverLW = (1.8 * dpr) / pxPerWorld;
    const selLW = (2.6 * dpr) / pxPerWorld;

    const plots = plotsRef.current;
    const selectedId = selectedIdRef.current;
    const hoveredId = drawingRef.current ? null : hoveredIdRef.current;
    const visibleGroups = visibleGroupsRef.current;

    for (const p of plots) {
      if (p.id === selectedId) continue;
      drawPath(ctx, p.points);
      ctx.fillStyle = effectiveColor(p, visibleGroups);
      ctx.fill();
      const hovered = p.id === hoveredId;
      ctx.strokeStyle = hovered ? colors.ink : colors.line;
      ctx.lineWidth = hovered ? hoverLW : baseLW;
      ctx.stroke();
    }

    if (selectedId != null) {
      const sel = plots.find((p) => p.id === selectedId);
      if (sel) {
        drawPath(ctx, sel.points);
        ctx.fillStyle = colors.highlightFillA;
        ctx.fill();
        ctx.lineWidth = selLW;
        ctx.strokeStyle = colors.highlight;
        ctx.shadowColor = colors.highlight;
        ctx.shadowBlur = 3 * dpr;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }, [computeWorldToCanvasMatrix, ensureResolvedColors, plotsRef, selectedIdRef, drawingRef, visibleGroupsRef]);

  const scheduleRedraw = useCallback(() => {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      draw();
    });
  }, [draw]);

  // screen -> world, mirroring svgPointFromEvent (usePlotMapEngine.js) plus
  // one more step to undo the pan/zoom transform; broad-phase bbox scan then
  // narrow-phase point-in-polygon only on bbox matches. Iterated back-to-front
  // so a plot later in the array (== painted on top) wins ties on overlap.
  const hitTest = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const vb = pt.matrixTransform(ctm.inverse());
    const { scale, tx, ty } = viewRef.current;
    const wx = (vb.x - tx) / scale;
    const wy = (vb.y - ty) / scale;

    const plots = plotsRef.current;
    for (let i = plots.length - 1; i >= 0; i--) {
      const p = plots[i];
      const { minX, minY, maxX, maxY } = p.bbox;
      if (wx < minX || wx > maxX || wy < minY || wy > maxY) continue;
      if (pointInPolygon(wx, wy, p.points)) return p;
    }
    return null;
  }, [svgRef, viewRef, plotsRef]);

  const setHovered = useCallback((id) => {
    if (hoveredIdRef.current === id) return;
    hoveredIdRef.current = id;
    scheduleRedraw();
  }, [scheduleRedraw]);

  useEffect(() => {
    const wrap = mapWrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      refreshScreenCTM();
      scheduleRedraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [mapWrapRef, refreshScreenCTM, scheduleRedraw]);

  return { canvasRef, hoveredIdRef, scheduleRedraw, refreshScreenCTM, hitTest, setHovered };
}
