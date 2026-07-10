export const NS = 'http://www.w3.org/2000/svg';
export const PAD = 30;

// Tailwind utility classes applied imperatively to SVG elements created outside React.
// fill-transparent here is just a pre-mount fallback - every plot always gets
// an inline fill from effectiveColor() in helpers/plotColor.js (translucent
// group tint, custom color, or translucent palette default) so parcels stay
// visible against the survey image.
// Selecting a plot tints it with a translucent highlight fill (not opaque -
// the background/any custom color should still show through) plus a
// glowing border, overriding whatever fill it already had (via `!important`)
// regardless of custom color or group tint.
export const PLOT_CLASSES =
  'fill-transparent stroke-line [stroke-width:1.1px] [vector-effect:non-scaling-stroke] ' +
  '[transition:stroke_120ms_ease,stroke-width_120ms_ease,fill_120ms_ease] cursor-pointer ' +
  'hover:stroke-ink hover:[stroke-width:1.8px] ' +
  'data-[selected=true]:fill-highlight/30! ' +
  'data-[selected=true]:stroke-highlight! data-[selected=true]:[stroke-width:2.6px] ' +
  'data-[selected=true]:[filter:drop-shadow(0_0_3px_var(--color-highlight))_drop-shadow(0_0_3px_var(--color-highlight))]';
export const TICK_CLASSES = 'stroke-stamp [stroke-width:1.4px]';
export const DRAW_LINE_CLASSES = 'stroke-stamp [stroke-width:1.6px] [stroke-dasharray:5,4] fill-none [vector-effect:non-scaling-stroke]';
export const DRAW_POINT_CLASSES = 'fill-paper-raised stroke-stamp [stroke-width:1.6px] [vector-effect:non-scaling-stroke]';

export const CALIB_STORAGE_KEY = 'pm-map-calibration';
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
