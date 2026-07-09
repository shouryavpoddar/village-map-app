import { forwardRef } from 'react';
import { cn } from '../utils/cn';

const SIZE_CLASSES = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
};

// A native color picker, trimmed down to a plain square swatch.
const ColorSwatch = forwardRef(function ColorSwatch({ size = 'md', className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="color"
      className={cn('p-0 border border-line cursor-pointer bg-transparent', SIZE_CLASSES[size], className)}
      {...props}
    />
  );
});

export default ColorSwatch;
