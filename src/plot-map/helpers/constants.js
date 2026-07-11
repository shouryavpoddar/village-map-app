export const NS = 'http://www.w3.org/2000/svg';
export const PAD = 30;

// Tailwind utility classes applied imperatively to SVG elements created outside React.
export const TICK_CLASSES = 'stroke-stamp [stroke-width:1.4px]';
export const DRAW_LINE_CLASSES = 'stroke-stamp [stroke-width:1.6px] [stroke-dasharray:5,4] fill-none [vector-effect:non-scaling-stroke]';
export const DRAW_POINT_CLASSES = 'fill-paper-raised stroke-stamp [stroke-width:1.6px] [vector-effect:non-scaling-stroke]';

export const CALIB_STORAGE_KEY = 'pm-map-calibration';
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
