import { forwardRef } from 'react';
import { cn } from '../utils/cn';

const TONE_CLASSES = {
  // sits on the raised panel tone (search boxes, sidebar chrome)
  raised: 'bg-paper-raised',
  // sits on top of a raised panel, so it needs the flatter paper tone to read as a field
  inset: 'bg-paper',
};

// Plain text input. `tone` picks which background it sits on so it reads
// correctly against whatever panel contains it — that's the only thing that
// changes between the sidebar search box and a field inside a modal.
const Input = forwardRef(function Input({ tone = 'raised', className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full font-mono text-[13px] text-ink border border-line px-[10px] py-[9px] outline-none focus:border-stamp placeholder:text-ink-soft',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
});

export default Input;
