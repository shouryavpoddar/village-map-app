import { useEffect, useState } from 'react';
import { Card, DetailRow, Badge, ColorSwatch, Button, Select } from '../../ui';

export default function PlotDetailCard({ plot, groupList, onRename, onDelete, onColorChange, onSetRealArea, onAddToGroup, onRemoveFromGroup }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plot.label);
  const [editingArea, setEditingArea] = useState(false);
  const [areaDraft, setAreaDraft] = useState(plot.realAreaSqM ?? '');

  const memberNames = new Set((plot.groups ?? []).map((g) => g.name));
  const joinableGroups = (groupList ?? []).filter((g) => !memberNames.has(g.name));

  useEffect(() => {
    setDraft(plot.label);
    setEditing(false);
    setAreaDraft(plot.realAreaSqM ?? '');
    setEditingArea(false);
  }, [plot.id, plot.label, plot.realAreaSqM]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== plot.label) onRename(plot.id, trimmed);
    else setDraft(plot.label);
  };

  // Transcribed from a Form-7 land record (see PDF samples in project chat) -
  // used to derive a village's scale factor in the combined map view.
  // Blank clears it back to "unknown" rather than persisting a stale figure.
  const commitArea = () => {
    setEditingArea(false);
    const trimmed = String(areaDraft).trim();
    if (!trimmed) {
      if (plot.realAreaSqM != null) onSetRealArea(plot.id, null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== plot.realAreaSqM) {
      onSetRealArea(plot.id, parsed);
    } else {
      setAreaDraft(plot.realAreaSqM ?? '');
    }
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
      <DetailRow label="Real area" divider>
        {editingArea ? (
          <input
            autoFocus
            type="number"
            min="0"
            step="any"
            className="w-[90px] text-right bg-paper border border-stamp px-1 outline-none"
            value={areaDraft}
            onChange={(e) => setAreaDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitArea();
              if (e.key === 'Escape') { setAreaDraft(plot.realAreaSqM ?? ''); setEditingArea(false); }
            }}
            onBlur={commitArea}
          />
        ) : (
          <span
            className={`cursor-text hover:underline decoration-dashed decoration-1 underline-offset-4 ${plot.realAreaSqM == null ? 'text-ink-soft italic' : ''}`}
            title="Click to set the real-world area (sq. m) from a land record"
            onClick={() => setEditingArea(true)}
          >
            {plot.realAreaSqM != null ? `${plot.realAreaSqM.toFixed(1)} sq. m` : 'unknown'}
          </span>
        )}
      </DetailRow>
      <DetailRow label="Vertices" value={plot.points.length} />
      <DetailRow label="Centroid" value={`${plot.centroid[0].toFixed(1)}, ${plot.centroid[1].toFixed(1)}`} />
      <DetailRow label="Bounding box" value={`${(plot.bbox.maxX - plot.bbox.minX).toFixed(0)} × ${(plot.bbox.maxY - plot.bbox.minY).toFixed(0)}`} />
      <DetailRow label="Color" divider={plot.groups?.length > 0 || joinableGroups.length > 0}>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-ink font-medium">{plot.color}</span>
          <ColorSwatch size="sm" value={plot.color} onChange={(e) => onColorChange(plot.id, e.target.value)} />
        </label>
      </DetailRow>
      {plot.groups?.length > 0 && (
        <DetailRow label="Groups" divider={joinableGroups.length > 0} align="start">
          <div className="flex flex-wrap gap-[6px] justify-end max-w-[200px]">
            {plot.groups.map((g) => (
              <Badge key={g.name} variant="tag" dotColor={g.color}>
                {g.name}
                <button
                  type="button"
                  title={`Remove from "${g.name}"`}
                  className="ml-0.5 text-ink-soft hover:text-stamp"
                  onClick={() => onRemoveFromGroup(g.name)}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </DetailRow>
      )}
      {joinableGroups.length > 0 && (
        <DetailRow label="Add to group" divider={false}>
          <div className="w-[140px]">
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) onAddToGroup(e.target.value);
              }}
              options={[{ value: '', label: 'Choose…' }, ...joinableGroups.map((g) => ({ value: g.name, label: g.name }))]}
            />
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
