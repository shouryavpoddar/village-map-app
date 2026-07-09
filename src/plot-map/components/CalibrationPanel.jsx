import { Card, DetailRow, Button } from '../../ui';

export default function CalibrationPanel({ calibDisplay, onReset, onCopy }) {
  return (
    <Card padding="sm" className="absolute left-[22px] top-[70px] z-[5] w-[240px] text-[11px] text-ink shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
      <p className="m-0 mb-2 tracking-[0.03em] text-ink-soft leading-[1.6]">
        Drag the map to move the image · scroll to scale · arrow keys to nudge (hold Shift for bigger steps).
      </p>
      <DetailRow label="x" value={calibDisplay.x.toFixed(2)} />
      <DetailRow label="y" value={calibDisplay.y.toFixed(2)} />
      <DetailRow label="scale" value={calibDisplay.scale.toFixed(4)} divider={false} />
      <div className="flex gap-2 mt-2">
        <Button variant="raised" size="sm" fullWidth onClick={onReset}>Reset</Button>
        <Button variant="raised" size="sm" fullWidth onClick={onCopy}>Copy rect</Button>
      </div>
    </Card>
  );
}
