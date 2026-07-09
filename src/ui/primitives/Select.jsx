import { forwardRef } from 'react';
import { cn } from '../utils/cn';

// A dropdown. Pass <option> children as usual, or an `options` array of
// { value, label } for the common case.
const Select = forwardRef(function Select({ options, className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full font-mono text-[12px] text-ink bg-paper-raised border border-line px-[10px] py-[7px] outline-none focus:border-stamp cursor-pointer',
        className,
      )}
      {...props}
    >
      {options
        ? options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))
        : children}
    </select>
  );
});

export default Select;
