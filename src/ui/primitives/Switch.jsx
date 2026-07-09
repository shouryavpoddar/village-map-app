import { cn } from '../utils/cn';

const SIZE_CLASSES = {
  sm: { track: 'h-[16px] w-[28px]', thumb: 'h-[10px] w-[10px]', on: 'translate-x-[14px]', off: 'translate-x-[2px]' },
  md: { track: 'h-[18px] w-[32px]', thumb: 'h-[12px] w-[12px]', on: 'translate-x-[16px]', off: 'translate-x-[2px]' },
};

// An on/off toggle, styled as a switch rather than a checkbox.
export default function Switch({ checked, onChange, label, size = 'md', className }) {
  const s = SIZE_CLASSES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex flex-none items-center border cursor-pointer transition-colors',
        s.track,
        checked ? 'bg-stamp border-stamp' : 'bg-paper border-line',
        className,
      )}
    >
      <span className={cn('inline-block bg-paper-raised transition-transform', s.thumb, checked ? s.on : s.off)} />
    </button>
  );
}
