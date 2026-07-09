import { useState } from 'react';
import { Modal, Eyebrow, Muted, FieldLabel, Input, ColorSwatch, Button } from '../../ui';

export default function GroupImportModal({ fileName, matchedCount, unmatchedNumbers, totalCount, onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4a90d9');

  const canConfirm = name.trim().length > 0 && matchedCount > 0;

  return (
    <Modal onClose={onCancel}>
      <Eyebrow className="mb-1">Import group</Eyebrow>
      <h3 className="font-serif font-semibold text-lg m-0 mb-3 text-ink truncate">{fileName}</h3>
      <Muted className="mb-4">
        Matched <b className="text-ink">{matchedCount}</b> of {totalCount} plot number{totalCount === 1 ? '' : 's'} to existing plots.
        {matchedCount === 0 && ' Nothing to tag - check the file has plot numbers in its first column.'}
      </Muted>

      {unmatchedNumbers?.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] tracking-[0.06em] uppercase text-ink-soft mb-1">
            {unmatchedNumbers.length} not found - not yet labeled?
          </p>
          <div className="max-h-[120px] overflow-y-auto border border-line-faint bg-paper px-[10px] py-[8px]">
            <p className="font-mono text-[12px] text-ink leading-[1.7] m-0 break-words">
              {unmatchedNumbers.join(', ')}
            </p>
          </div>
        </div>
      )}

      <FieldLabel>Group name</FieldLabel>
      <Input
        autoFocus
        tone="inset"
        className="mb-4"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canConfirm) onConfirm(name.trim(), color);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="e.g. Irrigated Zone"
      />

      <label className="flex items-center justify-between text-[11px] tracking-[0.06em] uppercase text-ink-soft mb-4">
        Highlight color
        <ColorSwatch value={color} onChange={(e) => setColor(e.target.value)} />
      </label>

      <Modal.Footer>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!canConfirm} onClick={() => onConfirm(name.trim(), color)}>Create group</Button>
      </Modal.Footer>
    </Modal>
  );
}
