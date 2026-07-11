import { describe, it, expect, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { usePlotCanvas } from '../../../src/plot-map/hooks/usePlotCanvas';
import { withOpacity } from '../../../src/plot-map/helpers/plotColor';
import { NS } from '../../../src/plot-map/helpers/constants';
import {
  FakeDOMMatrix, installDOMMatrixPolyfill, installCanvasContextMock, installResizeObserverMock,
  installControllableRAF, mockSvgGeometry, mockBoundingClientRect, getMockCanvasContext,
} from '../testUtils/domMocks';

const SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]];

function makePlot(id, points = SQUARE) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    id, points, color: '#AEBA97', hasCustomColor: false,
    bbox: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
  };
}

// A hook alone has nowhere to mount a real <canvas> - the resize effect that
// sizes the backing store, and everything downstream of it, needs one - so
// this tiny harness renders one bound to the hook's own canvasRef and hands
// the hook's full return value back out via onApi, mirroring exactly how
// usePlotMapEngine composes usePlotCanvas in the real app.
function Harness({ engineRefs, onApi }) {
  const api = usePlotCanvas(engineRefs);
  onApi(api);
  return <canvas ref={api.canvasRef} />;
}

function setup({
  plots = [makePlot(1)], selectedId = null, drawing = false, visibleGroups = new Set(),
  ctm = new FakeDOMMatrix(), view = { scale: 1, tx: 0, ty: 0 },
} = {}) {
  installDOMMatrixPolyfill();
  installCanvasContextMock();
  const ro = installResizeObserverMock();
  const raf = installControllableRAF();

  const svgEl = document.createElementNS(NS, 'svg');
  mockSvgGeometry(svgEl, ctm);

  const wrapEl = document.createElement('div');
  wrapEl.style.setProperty('--color-line', '#4a4237');
  wrapEl.style.setProperty('--color-ink', '#2b2a28');
  wrapEl.style.setProperty('--color-highlight', '#e8b84b');
  mockBoundingClientRect(wrapEl, { width: 800, height: 600 });

  const engineRefs = {
    svgRef: { current: svgEl },
    mapWrapRef: { current: wrapEl },
    viewRef: { current: view },
    plotsRef: { current: plots },
    selectedIdRef: { current: selectedId },
    drawingRef: { current: drawing },
    visibleGroupsRef: { current: visibleGroups },
  };

  let api;
  act(() => {
    render(<Harness engineRefs={engineRefs} onApi={(a) => { api = a; }} />);
  });

  // the canvas element only exists after the harness mounts, so its own
  // bounding rect can only be stubbed afterward - re-triggering the resize
  // observer forces usePlotCanvas to re-cache geometry against the now-mocked
  // rect (mirroring a real container resize, which the app also relies on to
  // pick up a canvas that's changed size)
  mockBoundingClientRect(api.canvasRef.current, { width: 800, height: 600 });
  act(() => ro.triggerAll());
  act(() => raf.flush()); // drain the resize-triggered redraw so each test starts from a clean frame

  // that drain still recorded fill()/stroke() calls onto the mock context -
  // clear them so each test's own assertions only see draws it triggered itself
  const ctx = getMockCanvasContext(api.canvasRef.current);
  ctx.fillCalls.length = 0;
  ctx.strokeCalls.length = 0;

  return { api, engineRefs, ro, raf };
}

afterEach(() => {
  delete window.devicePixelRatio;
});

describe('usePlotCanvas hitTest', () => {
  it('maps a screen point through both the SVG-viewBox mapping and the current pan/zoom to find the right plot', () => {
    // ctm: viewBox units -> screen px at 2x; view: world -> viewBox at 3x
    // scale plus a (100, 50) pan offset. World point (5,5) should land at
    // screen (2*(3*5+100), 2*(3*5+50)) = (230, 130) - see usePlotCanvas.js's
    // computeWorldToCanvasMatrix, which composes the same two transforms.
    const { api } = setup({
      plots: [makePlot(1)],
      ctm: new FakeDOMMatrix({ a: 2, d: 2 }),
      view: { scale: 3, tx: 100, ty: 50 },
    });

    expect(api.hitTest(230, 130)?.id).toBe(1);
    expect(api.hitTest(0, 0)).toBeNull();
  });

  it('rejects a point inside the bbox but outside a concave polygon', () => {
    const lShape = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];
    const { api } = setup({ plots: [makePlot(1, lShape)] });

    expect(api.hitTest(3, 3)).toBeNull(); // inside the bbox, in the missing notch
    expect(api.hitTest(1, 1)?.id).toBe(1);
  });

  it('prefers whichever overlapping plot is later in the array (painted on top)', () => {
    const { api } = setup({ plots: [makePlot(1), makePlot(2)] }); // identical, fully overlapping squares
    expect(api.hitTest(5, 5)?.id).toBe(2);
  });
});

describe('usePlotCanvas hover', () => {
  it('does nothing when the hovered id is unchanged', () => {
    const { api, raf } = setup({ plots: [makePlot(1), makePlot(2)] });

    act(() => api.setHovered(2));
    expect(raf.pendingCount()).toBe(1);
    act(() => raf.flush());

    act(() => api.setHovered(2)); // same id again
    expect(raf.pendingCount()).toBe(0);
  });

  it('strokes only the hovered plot with the thicker, ink-colored stroke', () => {
    const { api, raf } = setup({ plots: [makePlot(1), makePlot(2)] });

    act(() => api.setHovered(2));
    act(() => raf.flush());

    const ctx = getMockCanvasContext(api.canvasRef.current);
    // plot 1 drawn first (base style), plot 2 drawn second (hovered style)
    expect(ctx.strokeCalls[0]).toMatchObject({ strokeStyle: '#4a4237', lineWidth: 1.1 });
    expect(ctx.strokeCalls[1]).toMatchObject({ strokeStyle: '#2b2a28', lineWidth: 1.8 });
  });

  it('suppresses hover styling while in hand-drawing mode', () => {
    const { api, engineRefs, raf } = setup({ plots: [makePlot(1), makePlot(2)] });
    act(() => api.setHovered(2));
    act(() => raf.flush());

    engineRefs.drawingRef.current = true;
    act(() => api.scheduleRedraw());
    act(() => raf.flush());

    const ctx = getMockCanvasContext(api.canvasRef.current);
    const lastTwoStrokes = ctx.strokeCalls.slice(-2);
    expect(lastTwoStrokes.every((c) => c.lineWidth === 1.1)).toBe(true);
  });
});

describe('usePlotCanvas scheduleRedraw', () => {
  it('coalesces repeated calls within the same frame into a single queued redraw', () => {
    const { api, raf } = setup();

    act(() => {
      api.scheduleRedraw();
      api.scheduleRedraw();
      api.scheduleRedraw();
    });
    expect(raf.pendingCount()).toBe(1);

    act(() => raf.flush());
    act(() => api.scheduleRedraw()); // flag was reset by the flush, so this queues a fresh one
    expect(raf.pendingCount()).toBe(1);
  });
});

describe('usePlotCanvas draw', () => {
  it('paints the selected plot in a second pass, on top, with the highlight fill/stroke/glow', () => {
    const { api, raf } = setup({ plots: [makePlot(1), makePlot(2)], selectedId: 2 });
    act(() => api.scheduleRedraw());
    act(() => raf.flush());

    const ctx = getMockCanvasContext(api.canvasRef.current);
    // selected plot is skipped in the main loop and redrawn last, so the
    // context's final style state reflects its highlight styling
    expect(ctx.fillStyle).toBe(withOpacity('#e8b84b', 0.3));
    const lastStroke = ctx.strokeCalls.at(-1);
    expect(lastStroke).toMatchObject({ strokeStyle: '#e8b84b', lineWidth: 2.6, shadowBlur: 3 });
    // shadowBlur must not leak into whatever draws on the next frame
    expect(ctx.shadowBlur).toBe(0);
  });

  it('fills every plot using effectiveColor, including group tints', () => {
    const grouped = { ...makePlot(1), groups: [{ name: 'Road', color: '#ff0000' }] };
    const { api, raf } = setup({ plots: [grouped], visibleGroups: new Set(['Road']) });
    act(() => api.scheduleRedraw());
    act(() => raf.flush());

    const ctx = getMockCanvasContext(api.canvasRef.current);
    expect(ctx.fillCalls).toContain(withOpacity('#ff0000', 0.4));
  });
});

describe('usePlotCanvas resize', () => {
  it('sizes the canvas backing store to the wrapper size times devicePixelRatio', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const { api } = setup(); // wrapper is mocked to 800x600 in setup()

    expect(api.canvasRef.current.width).toBe(1600);
    expect(api.canvasRef.current.height).toBe(1200);
    expect(api.canvasRef.current.style.width).toBe('800px');
  });
});
