import { forwardRef } from 'react';
import { cn } from '../utils/cn';

const VARIANT_CLASSES = {
  // filled stamp-red action — the one clear "do this" button per view
  primary: 'border-stamp bg-stamp text-paper-raised hover:opacity-90',
  // default button — bordered, sits on the paper background
  outline: 'border-line bg-paper text-ink hover:bg-highlight',
  // like outline but sits on the raised panel tone instead
  raised: 'border-line bg-paper-raised text-ink hover:bg-highlight',
  // faint border, no fill — for low-emphasis actions like "delete"
  ghost: 'border-line-faint bg-transparent text-ink-soft hover:border-stamp hover:text-stamp',
};

const SIZE_CLASSES = {
  sm: 'px-2 py-1 text-[10px] tracking-[0.06em] uppercase',
  md: 'px-[12px] py-[8px] text-[10px] tracking-[0.06em] uppercase',
  // fixed square, for a single glyph/icon (zoom +/-, etc.)
  icon: 'w-[34px] h-[34px] p-0 text-base',
};

function toggleVariantClasses(active) {
  return active
    ? 'border-stamp bg-stamp text-paper-raised'
    : 'border-line bg-paper-raised text-ink hover:bg-highlight';
}

// Shared class builder so non-<button> elements styled to look like a
// button (e.g. FileButton's <label>) stay pixel-identical to Button.
export function buttonClasses({ variant = 'outline', size = 'md', active = false, fullWidth = false, className } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-1 font-mono border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit',
    variant === 'toggle' ? toggleVariantClasses(active) : VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && 'w-full',
    className,
  );
}

// The default control for any clickable action. Style is driven entirely by
// props — `variant` picks the fill/border treatment, `size` the padding,
// and `active` flips a `variant="toggle"` button between its on/off look —
// so callers reach for a prop instead of writing out Tailwind classes.
const Button = forwardRef(function Button(
  { variant = 'outline', size = 'md', active = false, fullWidth = false, className, type = 'button', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, active, fullWidth, className })}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
