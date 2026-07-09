import { cn } from '../utils/cn';

// Small stamp-colored uppercase label that sits above a heading, e.g.
// "Field Notes" above "Plot Register".
export function Eyebrow({ className, children }) {
  return <p className={cn('text-[10px] tracking-[0.18em] uppercase text-stamp m-0', className)}>{children}</p>;
}

// Uppercase muted label for a form field, e.g. "Group name".
export function FieldLabel({ className, children, ...props }) {
  return (
    <label className={cn('block text-[11px] tracking-[0.06em] uppercase text-ink-soft mb-1', className)} {...props}>
      {children}
    </label>
  );
}

// Soft-toned helper/body paragraph.
export function Muted({ className, children }) {
  return <p className={cn('text-[12.5px] text-ink-soft leading-[1.6]', className)}>{children}</p>;
}
