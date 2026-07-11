import { useEffect } from 'react';
import { NS } from '../helpers/constants';
import CalibrationPanel from './CalibrationPanel';
import PlotCanvasLayer from './PlotCanvasLayer';
import { Button } from '../../ui';

export default function MapCanvas({ engine, calibration, mapImageUrl, mapImageRect, villageLabel }) {
  const {
    mapWrapRef, svgRef, viewportRef, overlayRef, overlaySvgRef, canvasRef, coordRef, viewRef,
    fitAll, zoomAt, zoomButtonCenter,
    drawing, drawPoints, startDrawing, cancelDrawing, finishDrawing, undoDrawPoint,
    unlabeledCount, focusNextUnlabeled,
  } = engine;
  const { imageElRef, calibrating, setCalibrating, calibDisplay, resetCalib, copyCalib } = calibration;

  // Escape cancels an in-progress hand-drawn polygon
  useEffect(() => {
    if (!drawing) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') cancelDrawing(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawing, cancelDrawing]);

  return (
    <div
      className="relative flex-1 overflow-hidden cursor-grab data-[dragging=true]:cursor-grabbing data-[drawing=true]:cursor-crosshair bg-paper bg-[image:linear-gradient(var(--color-line-faint)_1px,transparent_1px),linear-gradient(90deg,var(--color-line-faint)_1px,transparent_1px)] bg-[length:40px_40px] max-[760px]:h-[54vh] max-[760px]:order-1"
      ref={mapWrapRef}
      data-dragging="false"
      data-drawing={drawing}
    >
      <div className="absolute inset-x-0 top-0 flex items-baseline gap-3 px-[22px] pt-4 pb-[10px] pointer-events-none z-[5]">
        <h1 className="font-serif font-semibold text-[22px] tracking-[0.02em] m-0 text-ink [text-shadow:0_1px_0_var(--color-paper-raised)]">{villageLabel}</h1>
        <span className="text-[11px] tracking-[0.12em] uppercase text-ink-soft">Survey Plot Index</span>
      </div>

      <svg ref={svgRef} id="pm-stage" xmlns={NS} className="absolute inset-0 w-full h-full block pointer-events-none">
        <g ref={viewportRef}>
          {mapImageUrl && (
            <image
              ref={imageElRef}
              href={mapImageUrl}
              x={mapImageRect.x}
              y={mapImageRect.y}
              width={mapImageRect.width}
              height={mapImageRect.height}
            />
          )}
        </g>
      </svg>
      <PlotCanvasLayer canvasRef={canvasRef} />
      <svg ref={overlaySvgRef} id="pm-overlay-stage" xmlns={NS} className="absolute inset-0 w-full h-full block pointer-events-none">
        <g ref={overlayRef} />
      </svg>

      <div
        className="absolute left-[22px] bottom-[18px] text-[11px] text-ink-soft bg-paper-raised border border-line-faint px-[10px] py-[5px] tracking-[0.03em] pointer-events-none z-[5]"
        ref={coordRef}
      >x: —&nbsp;&nbsp;y: —</div>

      <Button
        variant="raised"
        className="absolute right-[22px] bottom-[128px] z-[5]"
        onClick={() => fitAll(true)}
      >Fit all plots</Button>
      {mapImageUrl && !drawing && (
        <Button
          variant="toggle"
          active={calibrating}
          className="absolute right-[22px] bottom-[168px] z-[5]"
          onClick={() => setCalibrating(v => !v)}
        >{calibrating ? 'Done calibrating' : 'Calibrate map'}</Button>
      )}
      {!calibrating && (
        <Button
          variant="toggle"
          active={drawing}
          className="absolute right-[22px] bottom-[208px] z-[5]"
          onClick={() => (drawing ? cancelDrawing() : startDrawing())}
        >{drawing ? 'Cancel drawing' : 'Add plot'}</Button>
      )}
      {!calibrating && !drawing && (
        <Button
          variant="raised"
          className="absolute right-[22px] bottom-[248px] z-[5] disabled:hover:bg-paper-raised"
          onClick={focusNextUnlabeled}
          disabled={unlabeledCount === 0}
        >{unlabeledCount === 0 ? 'All plots labeled' : `Next unlabeled · ${unlabeledCount}`}</Button>
      )}
      <div className="absolute right-[22px] bottom-[18px] flex flex-col z-[5] shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
        <Button
          variant="raised"
          size="icon"
          className="first:border-b-0 active:bg-stamp-soft"
          onClick={() => zoomAt(zoomButtonCenter(), viewRef.current.scale * 1.4)}
        >+</Button>
        <Button
          variant="raised"
          size="icon"
          className="first:border-b-0 active:bg-stamp-soft"
          onClick={() => zoomAt(zoomButtonCenter(), viewRef.current.scale / 1.4)}
        >−</Button>
      </div>

      {mapImageUrl && calibrating && (
        <CalibrationPanel calibDisplay={calibDisplay} onReset={resetCalib} onCopy={copyCalib} />
      )}

      {drawing && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 z-[6] flex items-center gap-3 bg-paper-raised border border-line px-[14px] py-[9px] shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
          <span className="text-[11px] tracking-[0.06em] text-ink">
            Click each corner · {drawPoints.length} point{drawPoints.length === 1 ? '' : 's'}
          </span>
          <Button variant="outline" size="sm" onClick={undoDrawPoint} disabled={drawPoints.length === 0}>Undo</Button>
          <Button variant="primary" size="sm" onClick={finishDrawing} disabled={drawPoints.length < 3}>Finish</Button>
          <Button variant="outline" size="sm" onClick={cancelDrawing}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
