import { Eyebrow, Badge } from '../../ui';

// Companion to AllVillagesCanvas.jsx - a village list (pick one to arm it
// for dragging on the canvas, see useVillageArrangement.js) plus a read-only
// readout of whatever plot is clicked. Deliberately has none of the normal
// Sidebar's editing affordances (rename/delete/color/groups) - this view
// never writes to any village's saved plots.
export default function AllVillagesSidebar({ villages, loading, arrangement, selectedPlot }) {
  return (
    <>
      <div className="px-5 py-4 border-b border-line-faint">
        <Eyebrow className="mb-1">Combined Draft</Eyebrow>
        <p className="text-[11px] text-ink-soft tracking-[0.03em]">
          {loading ? 'Loading villages…' : `${villages.length} villages loaded`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-[14px]">
        <p className="text-[11.5px] text-ink-soft leading-[1.7] mb-3">
          Pick a village, then drag it on the map to position it relative to the others. Scale comes from whatever real-world plot areas have been tagged in that village's Plot Register.
        </p>
        <div className="flex flex-col gap-[6px]">
          {villages.map((v) => {
            const active = arrangement.activeMapId === v.mapId;
            return (
              <button
                key={v.mapId}
                type="button"
                onClick={() => arrangement.setActive(active ? null : v.mapId)}
                className={`text-left px-3 py-2 border transition-colors ${active ? 'border-stamp bg-paper-raised' : 'border-line-faint hover:bg-paper-raised'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-ink">
                    {v.townLabel !== v.label ? `${v.townLabel} — ${v.label}` : v.townLabel}
                  </span>
                  {!v.hasScale && <Badge variant="tag">unscaled</Badge>}
                </div>
                <div className="text-ink-soft text-[11px] mt-0.5">{v.plots.length.toLocaleString()} plots</div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedPlot && (
        <div className="px-5 py-3 border-t border-line-faint">
          <p className="text-ink font-medium text-[13px] mb-0.5">{selectedPlot.label || 'Unlabeled'}</p>
          <p className="text-ink-soft text-[11px]">{selectedPlot.area.toFixed(1)} sq. units (scaled)</p>
        </div>
      )}

      <div className="px-5 pt-3 pb-4 border-t border-line-faint text-[10.5px] text-ink-soft tracking-[0.03em]">
        Drag positions save automatically · read-only — no edits reach any village's saved plots
      </div>
    </>
  );
}
