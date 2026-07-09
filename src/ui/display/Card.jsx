import { cn } from '../utils/cn';

const PADDING_CLASSES = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

// A bordered panel. `corners` adds the decorative stamp-colored corner
// brackets used to mark a "surveyed" record card.
export default function Card({ padding = 'md', corners = false, className, children, ...props }) {
  return (
    <div
      className={cn(
        'border border-line bg-paper-raised',
        PADDING_CLASSES[padding],
        corners && [
          'relative',
          "before:content-[''] before:absolute before:w-[9px] before:h-[9px] before:border-[1.4px] before:border-stamp before:-top-px before:-left-px before:border-r-0 before:border-b-0",
          "after:content-[''] after:absolute after:w-[9px] after:h-[9px] after:border-[1.4px] after:border-stamp after:-bottom-px after:-right-px after:border-l-0 after:border-t-0",
        ],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
