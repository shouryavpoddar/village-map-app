// Joins classNames, dropping falsy values. Accepts strings, arrays, and
// conditional expressions (`condition && 'class'`) mixed together.
export function cn(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(' ');
}
