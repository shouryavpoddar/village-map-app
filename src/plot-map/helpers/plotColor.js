// #rgb/#rrggbb -> [r, g, b]
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// #rgb/#rrggbb -> "rgba(r, g, b, alpha)", so a group's tint can be applied
// translucent without touching a separate fill-opacity property (which would
// otherwise stack multiplicatively with the selection highlight's own
// partial-opacity fill and end up far too faint once both apply at once)
export function withOpacity(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] :
    hp < 2 ? [x, c, 0] :
    hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] :
    hp < 5 ? [x, 0, c] : [c, 0, x];
  return [r1, g1, b1].map((v) => Math.round((v + m) * 255));
}

// Straight RGB averaging isn't how paint mixing reads: yellow and blue sit
// exactly opposite each other on the RGB/HSL hue wheel, so averaging their
// channels (or their hues) just cancels out to gray. The artist's RYB wheel
// instead orders the primaries/secondaries as red-orange-yellow-green-blue-
// violet, 60 degrees apart, which is why yellow and blue mix to green there.
// These anchor pairs remap a hue between the two wheels (piecewise-linear,
// exact at each named color) so blending can happen in RYB space and still
// render as an RGB color at the end.
const RGB_HUE_ANCHORS = [0, 30, 60, 120, 240, 270, 360];
const RYB_HUE_ANCHORS = [0, 60, 120, 180, 240, 300, 360];

function remapHue(hue, fromAnchors, toAnchors) {
  for (let i = 0; i < fromAnchors.length - 1; i++) {
    const a0 = fromAnchors[i], a1 = fromAnchors[i + 1];
    if (hue >= a0 && hue <= a1) {
      const t = a1 === a0 ? 0 : (hue - a0) / (a1 - a0);
      return toAnchors[i] + t * (toAnchors[i + 1] - toAnchors[i]);
    }
  }
  return hue;
}

// average every color's RYB-space hue (as a circular mean, so opposite
// hues in RYB space - like red/green - don't cancel out to nothing) plus a
// plain average of saturation/lightness, then convert the mixed hue back to
// RGB for rendering
function blendColors(hexColors) {
  const hsls = hexColors.map((hex) => rgbToHsl(hexToRgb(hex)));
  const rybHues = hsls.map(({ h }) => remapHue(h, RGB_HUE_ANCHORS, RYB_HUE_ANCHORS));

  let sx = 0, sy = 0, sSum = 0, lSum = 0;
  for (let i = 0; i < hsls.length; i++) {
    const rad = (rybHues[i] * Math.PI) / 180;
    sx += Math.cos(rad);
    sy += Math.sin(rad);
    sSum += hsls[i].s;
    lSum += hsls[i].l;
  }
  const meanRybHue = (Math.atan2(sy, sx) * 180) / Math.PI;
  const rgbHue = remapHue((meanRybHue + 360) % 360, RYB_HUE_ANCHORS, RGB_HUE_ANCHORS);

  const [r, g, b] = hslToRgb(rgbHue, sSum / hsls.length, lSum / hsls.length);
  return `rgba(${r}, ${g}, ${b}, 0.4)`;
}

// Every plot always gets an inline fill so parcels stay visible against the
// survey image while drawing/labeling: a translucent blend of every group
// the plot belongs to that's currently toggled visible takes priority (a
// plot in two groups reads as a mix of their colors, and a group that's
// toggled off drops out of the blend entirely rather than just losing to
// whichever group happened to be tagged first), then an explicit solid
// custom color (setPlotColor), and otherwise the plot's palette-cycled
// default color (see PALETTE in geometry.js), also translucent so the map
// underneath still shows through.
export function effectiveColor(plot, visibleGroupNames) {
  const active = plot.groups?.filter((g) => visibleGroupNames.has(g.name)) ?? [];
  if (active.length) return blendColors(active.map((g) => g.color));
  if (plot.hasCustomColor) return plot.color;
  return withOpacity(plot.color, 0.35);
}

export function summarizeGroups(plots) {
  const map = new Map();
  for (const p of plots) {
    for (const g of p.groups ?? []) {
      const entry = map.get(g.name);
      if (entry) entry.count += 1;
      else map.set(g.name, { name: g.name, color: g.color, count: 1 });
    }
  }
  return Array.from(map.values());
}
