import { cn } from '../utils/cn';

const WIDTH_CLASSES = {
  sm: 'w-[320px]',
  md: 'w-[380px]',
  lg: 'w-[480px]',
};

// A centered dialog over a dimmed backdrop. Clicking the backdrop calls
// `onClose`; clicks inside the panel are stopped from bubbling to it.
export default function Modal({ onClose, width = 'md', className, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className={cn('bg-paper-raised border border-line p-5', WIDTH_CLASSES[width], className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

Modal.Footer = function ModalFooter({ className, children }) {
  return <div className={cn('flex justify-end gap-2 mt-4', className)}>{children}</div>;
};
