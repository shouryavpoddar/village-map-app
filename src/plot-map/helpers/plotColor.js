// #rgb/#rrggbb -> "rgba(r, g, b, alpha)", so a group's tint can be applied
// translucent without touching a separate fill-opacity property (which would
// otherwise stack multiplicatively with the selection highlight's own
// partial-opacity fill and end up far too faint once both apply at once)
export function withOpacity(hex, alpha) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Every plot always gets an inline fill so parcels stay visible against the
// survey image while drawing/labeling: a translucent tint from a group
// that's currently toggled visible takes priority (so several
// overlapping/adjacent group members and the map underneath both stay
// legible), then an explicit solid custom color (setPlotColor), and
// otherwise the plot's palette-cycled default color (see PALETTE in
// geometry.js), also translucent so the map underneath still shows through.
export function effectiveColor(plot, visibleGroupNames) {
  const active = plot.groups?.find((g) => visibleGroupNames.has(g.name));
  if (active) return withOpacity(active.color, 0.4);
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
