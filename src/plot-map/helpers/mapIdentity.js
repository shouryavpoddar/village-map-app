// Derives a stable Firestore document id from a map's plotsPath (its
// project-root-relative -plots.json path, e.g.
// "src/assets/villages/Ahu Rev 3.2-NEW VILLAGE MAPPING A1/Ahu Rev 3.2-NEW
// VILLAGE MAPPING A1-plots.json"). Used identically from the Vite frontend
// (villages.js) and from plain-Node migration/sync scripts, so both sides
// always agree on which Firestore doc a given map's plots live under -
// this file intentionally has zero Vite/browser-only syntax so it works
// unmodified under plain `node`.
export function computeMapId(plotsPath) {
  return plotsPath
    .toLowerCase()
    .replace(/\.json$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
