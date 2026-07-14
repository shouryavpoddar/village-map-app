export const PALETTE = ['#AEBA97', '#9DAE8E', '#C3BD97', '#D3C9A2', '#93A88E'];

export function shoelaceArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function centroidOf(pts) {
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  return [cx / pts.length, cy / pts.length];
}

export function bboxOf(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// A village's plots are digitized from its own PDF survey sheet in that
// sheet's arbitrary local units - there's no shared scale between villages.
// Plots tagged with a known real-world area (see Plot.realAreaSqM,
// plotsRepo.ts) give us a reference: since area scales with the square of
// the linear scale factor, sqrt(real/computed) per tagged plot is that
// village's unit->meter conversion, and averaging across every tagged plot
// smooths out digitization error in any single one. A village with no
// tagged plots yet has no reference and stays at its native scale (1).
export function computeVillageScale(plots) {
  const ratios = [];
  for (const p of plots) {
    if (p.realAreaSqM == null) continue;
    const computed = shoelaceArea(p.points);
    if (computed > 0) ratios.push(Math.sqrt(p.realAreaSqM / computed));
  }
  if (!ratios.length) return 1;
  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}

// Even-odd ray casting - used for canvas hit-testing, where (unlike SVG)
// there's no native per-shape point containment the browser gives us for free
export function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
