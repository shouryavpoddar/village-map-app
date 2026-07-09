import { cn } from '../utils/cn';

const VARIANT_CLASSES = {
  // small outlined chip, optionally with a color dot — for a group tag
  tag: 'inline-flex items-center gap-1 border border-line-faint px-[6px] py-[2px] text-[11px] text-ink',
  // rotated, stamp-colored badge — for a "Surveyed" mark
  stamp: 'inline-block rotate-[-3deg] border-[1.6px] border-stamp text-stamp text-[11px] tracking-[0.1em] uppercase px-[10px] py-[5px] font-semibold',
};

export default function Badge({ variant = 'tag', dotColor, className, children }) {
  return (
    <span className={cn(VARIANT_CLASSES[variant], className)}>
      {dotColor && <span className="w-2 h-2 flex-none" style={{ background: dotColor }} />}
      {children}
    </span>
  );
}
