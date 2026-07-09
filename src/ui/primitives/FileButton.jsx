import { buttonClasses } from './Button';
import { cn } from '../utils/cn';

// A button that opens the OS file picker. Looks exactly like <Button> (same
// variant/size props) but is a <label> wrapping a hidden <input type=file>,
// since that's the only accessible way to style a file input.
export default function FileButton({
  variant = 'raised',
  size = 'md',
  className,
  children,
  accept,
  multiple = false,
  onFileSelect,
  ...inputProps
}) {
  return (
    <label className={cn(buttonClasses({ variant, size }), className)}>
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          const value = multiple ? Array.from(files ?? []) : files?.[0];
          e.target.value = '';
          if (value) onFileSelect(value);
        }}
        {...inputProps}
      />
    </label>
  );
}
