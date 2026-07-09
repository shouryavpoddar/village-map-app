// Component library entry point — import everything from here:
//   import { Button, Input, Modal } from '../../ui';
//
// Directory layout:
//   primitives/  interactive controls (Button, Input, Select, Switch, ...)
//   display/     non-interactive presentation (Card, Badge, DetailRow, Text)
//   overlay/     things that float above the page (Modal)
//   utils/       shared helpers (cn — className joiner)
//
// Every component takes a `className` for one-off tweaks, plus a small set
// of style props (variant/size/tone/...) for the tweaks that come up
// often enough to deserve a name instead of raw Tailwind utility classes.

export { default as Button, buttonClasses } from './primitives/Button';
export { default as IconButton } from './primitives/IconButton';
export { default as FileButton } from './primitives/FileButton';
export { default as Input } from './primitives/Input';
export { default as Select } from './primitives/Select';
export { default as Switch } from './primitives/Switch';
export { default as ColorSwatch } from './primitives/ColorSwatch';

export { default as Card } from './display/Card';
export { default as DetailRow } from './display/DetailRow';
export { default as Badge } from './display/Badge';
export { Eyebrow, FieldLabel, Muted } from './display/Text';

export { default as Modal } from './overlay/Modal';

export { cn } from './utils/cn';
