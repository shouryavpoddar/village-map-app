import { useState } from 'react';
import { Modal, Eyebrow, FieldLabel, Input, ColorSwatch, Button } from '../../ui';

export default function NewGroupModal({ onConfirm, onCancel }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4a90d9');

  const canConfirm = name.trim().length > 0;

  return (
    <Modal onClose={onCancel}>
      <Eyebrow className="mb-1">New group</Eyebrow>
      <h3 className="font-serif font-semibold text-lg m-0 mb-4 text-ink">Start an empty group</h3>

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
