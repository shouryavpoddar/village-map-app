import { cn } from '../utils/cn';

// A bare, borderless button for a single small glyph — the "x" to remove a
// group, etc. Not a variant of Button because it deliberately has no
// border/background even on hover, just a text color shift.
export default function IconButton({ className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center bg-transparent border-0 p-1 leading-none text-[13px] text-ink-soft cursor-pointer hover:text-stamp',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
