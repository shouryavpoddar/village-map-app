import { describe, it, expect, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { usePlotMapEngine } from '../../../src/plot-map/hooks/usePlotMapEngine';
import {
  installDOMMatrixPolyfill, installCanvasContextMock, installResizeObserverMock,
  installControllableRAF, installSvgGeometryMock, installPointerCaptureStub, mockBoundingClientRect,
} from '../testUtils/domMocks';

const RAW_PLOTS = [
  { id: 1, label: 'Plot A', points: [[0, 0], [10, 0], [10, 10], [0, 10]] },
  { id: 2, label: 'Plot B', points: [[20, 0], [30, 0], [30, 10], [20, 10]] },
  { id: 3, label: '', points: [[0, 20], [10, 20], [10, 30], [0, 30]] },
];

// usePlotMapEngine renders nothing itself - it hands back refs the real
// MapCanvas.jsx attaches to a specific three-layer DOM structure (image svg,
// canvas, overlay svg, all inside the pointer-handling wrapper div). This
// harness reproduces that same structure so the engine's effects (which read
// svgRef.current.getScreenCTM() etc on mount) have real elements to attach to.
function Harness({ rawPlots, viewRef, calibration, plotsPath, onEngine }) {
  const engine = usePlotMapEngine({ rawPlots, viewRef, calibration, plotsPath });
  onEngine(engine);
  return (
    <div ref={engine.mapWrapRef}>
      <svg ref={engine.svgRef}><g ref={engine.viewportRef} /></svg>
      <canvas ref={engine.canvasRef} />
      <svg ref={engine.overlaySvgRef}><g ref={engine.overlayRef} /></svg>
    </div>
  );
}

function setup({ rawPlots = RAW_PLOTS, plotsPath = 'village-plots.json' } = {}) {
  installDOMMatrixPolyfill();
  installSvgGeometryMock(); // identity getScreenCTM by default - see below for why that matters
  installCanvasContextMock();
  installResizeObserverMock();
  installPointerCaptureStub();
  const raf = installControllableRAF();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));

  const viewRef = { current: { scale: 1, tx: 0, ty: 0 } };
  const calibration = {
    calibratingRef: { current: false },
    handleCalibWheel: vi.fn(),
    handleCalibDrag: vi.fn(),
    commitCalibDrag: vi.fn(),
  };

  // holds the latest engine snapshot - onEngine fires on every render, so
  // reading engineHolder.current after an act() always reflects the state
  // that render produced, the same way renderHook's result.current does
  const engineHolder = {};
  act(() => {
    render(
      <Harness
        rawPlots={rawPlots}
        viewRef={viewRef}
        calibration={calibration}
        plotsPath={plotsPath}
        onEngine={(e) => { engineHolder.current = e; }}
      />
    );
  });

  mockBoundingClientRect(engineHolder.current.mapWrapRef.current, { width: 800, height: 600 });
  mockBoundingClientRect(engineHolder.current.canvasRef.current, { width: 800, height: 600 });

  // fitAll(false) runs on load and changes viewRef to whatever framing fits
  // all plots - tests that need to click on a specific world coordinate
  // reset it to identity so screen px map 1:1 to world units (the svg's own
  // getScreenCTM is already identity via installSvgGeometryMock)
  viewRef.current = { scale: 1, tx: 0, ty: 0 };

  return { engineHolder, viewRef, calibration, raf };
}

describe('usePlotMapEngine data loading', () => {
  it('computes geometry for every plot and counts unlabeled ones', () => {
    const { engineHolder } = setup();
    expect(engineHolder.current.plotCount).toBe(3);
    expect(engineHolder.current.unlabeledCount).toBe(1); // only "Plot C" has a blank label
  });
});

describe('usePlotMapEngine selectPlot', () => {
  it('does not reorder the plots array - the old renderer reordered it to control SVG paint order, which the canvas renderer no longer needs (it paints the selected plot in its own pass instead)', () => {
    const { engineHolder } = setup();
    const idsBefore = engineHolder.current.plotsRef.current.map((p) => p.id);

    act(() => engineHolder.current.selectPlot(engineHolder.current.plotsRef.current[0], false));

    expect(engineHolder.current.plotsRef.current.map((p) => p.id)).toEqual(idsBefore);
    expect(engineHolder.current.plots.map((p) => p.id)).toEqual(idsBefore);
  });

  it('sets selectedPlot to the plot that was selected', () => {
    const { engineHolder } = setup();
    const target = engineHolder.current.plotsRef.current[1];

    act(() => engineHolder.current.selectPlot(target, false));

    expect(engineHolder.current.selectedPlot?.id).toBe(2);
    expect(engineHolder.current.selectedIdRef.current).toBe(2);
  });
});

describe('usePlotMapEngine pointer-driven selection', () => {
  it('clicking a point inside a plot selects that plot, via hitTest rather than a DOM target lookup', () => {
    const { engineHolder } = setup();
    const wrap = engineHolder.current.mapWrapRef.current;

    // (5,5) falls inside Plot A ([0,0]-[10,10]); view/CTM are both identity
    // (see setup()), so screen px map 1:1 to world units here
    act(() => {
      fireEvent.pointerDown(wrap, { clientX: 5, clientY: 5, pointerId: 1 });
      fireEvent.pointerUp(wrap, { clientX: 5, clientY: 5, pointerId: 1 });
    });

    expect(engineHolder.current.selectedPlot?.id).toBe(1);
  });

  it('clicking empty space selects nothing', () => {
    const { engineHolder } = setup();
    const wrap = engineHolder.current.mapWrapRef.current;

    act(() => {
      fireEvent.pointerDown(wrap, { clientX: 500, clientY: 500, pointerId: 1 });
      fireEvent.pointerUp(wrap, { clientX: 500, clientY: 500, pointerId: 1 });
    });

    expect(engineHolder.current.selectedPlot).toBeNull();
  });

  it('a drag past the movement threshold does not count as a click, even if it ends over a plot', () => {
    const { engineHolder } = setup();
    const wrap = engineHolder.current.mapWrapRef.current;

    act(() => {
      fireEvent.pointerDown(wrap, { clientX: 500, clientY: 500, pointerId: 1 });
      fireEvent.pointerMove(wrap, { clientX: 5, clientY: 5, pointerId: 1 }); // far past the 4px drag threshold
      fireEvent.pointerUp(wrap, { clientX: 5, clientY: 5, pointerId: 1 });
    });

    expect(engineHolder.current.selectedPlot).toBeNull();
  });
});

describe('usePlotMapEngine label editing', () => {
  it('renameLabel updates the label, recomputes unlabeledCount, and persists to the save endpoint', async () => {
    const { engineHolder } = setup();
    expect(engineHolder.current.unlabeledCount).toBe(1);

    await act(async () => engineHolder.current.renameLabel(3, 'Plot C'));

    expect(engineHolder.current.unlabeledCount).toBe(0);
    expect(engineHolder.current.plotsRef.current.find((p) => p.id === 3).label).toBe('Plot C');
    expect(fetch).toHaveBeenCalledWith('/api/save-plots', expect.objectContaining({ method: 'POST' }));
  });
});
