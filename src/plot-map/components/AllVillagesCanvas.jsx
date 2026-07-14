import { NS } from '../helpers/constants';
import PlotCanvasLayer from './PlotCanvasLayer';
import { Button } from '../../ui';

function polygonPointsAttr(points) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

// Read-only combined view of every village at once (see useAllVillages.js) -
// reuses the same pan/zoom/render engine as the single-village map
// (usePlotMapEngine + PlotCanvasLayer), just with no editing chrome (no
// calibrate/draw/label buttons - engine is given mapId: null so any stray
// edit action is a guaranteed no-op, see PlotMap.jsx). The only interactive
// piece is the drag-to-reposition overlay from useVillageArrangement.js.
export default function AllVillagesCanvas({ engine, arrangement, villages }) {
  const { mapWrapRef, svgRef, viewportRef, overlayRef, overlaySvgRef, canvasRef, coordRef, fitAll } = engine;
  const activeVillage = villages.find((v) => v.mapId === arrangement.activeMapId) ?? null;
  const cos = activeVillage ? Math.cos(activeVillage.rotation) : 1;
  const sin = activeVillage ? Math.sin(activeVillage.rotation) : 0;

  return (
    <div
      className="relative flex-1 overflow-hidden cursor-grab data-[dragging=true]:cursor-grabbing bg-paper bg-[image:linear-gradient(var(--color-line-faint)_1px,transparent_1px),linear-gradient(90deg,var(--color-line-faint)_1px,transparent_1px)] bg-[length:40px_40px] max-[760px]:h-[54vh] max-[760px]:order-1"
      ref={mapWrapRef}
      data-dragging="false"
    >
      <div className="absolute inset-x-0 top-0 flex items-baseline gap-3 px-[22px] pt-4 pb-[10px] pointer-events-none z-[5]">
        <h1 className="font-serif font-semibold text-[22px] tracking-[0.02em] m-0 text-ink [text-shadow:0_1px_0_var(--color-paper-raised)]">All Villages</h1>
        <span className="text-[11px] tracking-[0.12em] uppercase text-ink-soft">Draft alignment · not geo-referenced</span>
      </div>

      <svg ref={svgRef} id="pm-all-stage" xmlns={NS} className="absolute inset-0 w-full h-full block pointer-events-none">
        <g ref={viewportRef}>
          {activeVillage && (
            <g ref={arrangement.dragOverlayRef}>
              {activeVillage.plots.map((p) => (
                <polygon
                  key={p.id}
                  points={polygonPointsAttr(p.points.map(([x, y]) => [
                    x * cos - y * sin + activeVillage.offsetX,
                    x * sin + y * cos + activeVillage.offsetY,
                  ]))}
                  fill="var(--color-highlight)"
                  fillOpacity="0.35"
                  stroke="var(--color-highlight)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}
        </g>
      </svg>
      <PlotCanvasLayer canvasRef={canvasRef} />
      <svg ref={overlaySvgRef} id="pm-all-overlay-stage" xmlns={NS} className="absolute inset-0 w-full h-full block pointer-events-none">
        <g ref={overlayRef} />
      </svg>

      <div
        className="absolute left-[22px] bottom-[18px] text-[11px] text-ink-soft bg-paper-raised border border-line-faint px-[10px] py-[5px] tracking-[0.03em] pointer-events-none z-[5]"
        ref={coordRef}
      >x: —&nbsp;&nbsp;y: —</div>

      <Button
        variant="raised"
        className="absolute right-[22px] bottom-[18px] z-[5]"
        onClick={() => fitAll(true)}
      >Fit all plots</Button>
    </div>
  );
}
