import { cn } from '../utils/cn';

// One label/value line in a record card (e.g. "Area · 12.3 sq. units").
// Pass `value` for a plain auto-styled string/number, or `children` to
// supply custom right-side content (a swatch, chips, etc).
export default function DetailRow({ label, value, children, divider = true, align = 'center', className }) {
  return (
    <div
      className={cn(
        'flex justify-between py-[7px] text-[12.5px]',
        align === 'center' ? 'items-center' : 'items-start',
        divider && 'border-b border-dashed border-line-faint',
        className,
      )}
    >
      <span className="text-ink-soft tracking-[0.03em]">{label}</span>
      {value !== undefined ? <span className="text-ink font-medium">{value}</span> : children}
    </div>
  );
}
