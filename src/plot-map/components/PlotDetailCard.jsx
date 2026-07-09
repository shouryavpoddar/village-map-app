import { useEffect, useState } from 'react';
import { Card, DetailRow, Badge, ColorSwatch, Button } from '../../ui';

export default function PlotDetailCard({ plot, onRename, onDelete, onColorChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plot.label);

  useEffect(() => {
    setDraft(plot.label);
    setEditing(false);
  }, [plot.id, plot.label]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== plot.label) onRename(plot.id, trimmed);
    else setDraft(plot.label);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this plot? This removes it from the map (undo by reloading before it saves, otherwise it\'s gone for good).')) {
      onDelete(plot.id);
    }
  };

  return (
    <Card corners>
      {editing ? (
        <input
          autoFocus
          className="font-serif font-semibold text-[19px] text-ink bg-paper border border-stamp px-1 -mx-1 w-[calc(100%+8px)] mb-0.5 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(plot.label); setEditing(false); }
          }}
          onBlur={commit}
        />
      ) : (
        <p
          className={`font-serif font-semibold text-[19px] m-0 mb-0.5 cursor-text hover:underline decoration-dashed decoration-1 underline-offset-4 ${plot.label ? 'text-ink' : 'text-ink-soft italic'}`}
          title="Click to edit label"
          onClick={() => setEditing(true)}
        >
          {plot.label || 'Unlabeled'}
        </p>
      )}
      <p className="text-[11px] text-stamp tracking-[0.06em] mb-[14px]">PLOT ID · {plot.id}</p>

      <DetailRow label="Area" value={`${plot.area.toFixed(1)} sq. units`} />
      <DetailRow label="Vertices" value={plot.points.length} />
      <DetailRow label="Centroid" value={`${plot.centroid[0].toFixed(1)}, ${plot.centroid[1].toFixed(1)}`} />
      <DetailRow label="Bounding box" value={`${(plot.bbox.maxX - plot.bbox.minX).toFixed(0)} × ${(plot.bbox.maxY - plot.bbox.minY).toFixed(0)}`} />
      <DetailRow label="Color" divider={plot.groups?.length > 0}>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-ink font-medium">{plot.color}</span>
          <ColorSwatch size="sm" value={plot.color} onChange={(e) => onColorChange(plot.id, e.target.value)} />
        </label>
      </DetailRow>
      {plot.groups?.length > 0 && (
        <DetailRow label="Groups" divider={false} align="start">
          <div className="flex flex-wrap gap-[6px] justify-end max-w-[200px]">
            {plot.groups.map((g) => (
              <Badge key={g.name} variant="tag" dotColor={g.color}>{g.name}</Badge>
            ))}
          </div>
        </DetailRow>
      )}

      <div className="flex items-center justify-between mt-4">
        <Badge variant="stamp">Surveyed</Badge>
        <Button variant="ghost" onClick={handleDelete}>Delete plot</Button>
      </div>
    </Card>
  );
}
