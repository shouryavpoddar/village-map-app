// Villages are whatever plot JSON files have been dropped under src/assets -
// scanned broadly (not tied to one folder name) since files have ended up
// scattered across a few differently-named subfolders.
const plotModules = import.meta.glob([
  '../../assets/**/*.json',
  '!../../assets/**/*-rect.json',
  '!../../assets/**/*-labels-review.json',
]);
const imageModules = import.meta.glob('../../assets/**/*.png', { eager: true, import: 'default' });
const rectModules = import.meta.glob('../../assets/**/*-rect.json', { eager: true, import: 'default' });

function keyOf(path, suffix) {
  const name = path.split('/').pop().replace(/\.(json|png)$/i, '');
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

// Source filenames are long survey-sheet titles (e.g. "Ahu Rev 3.2-NEW
// VILLAGE MAPPING A1") - trim down to just the village name for display.
function prettyName(key) {
  const match = key.match(/^(.*?)[\s_-]*rev\s*\d/i);
  return (match ? match[1] : key).trim();
}

function dirOf(path) {
  return path.slice(0, path.lastIndexOf('/'));
}

// Directories that own a plots.json - an image/rect sitting in one of these
// belongs specifically to that plots.json (the "src/assets/villages/<name>/"
// convention keeps a map's plots+image+rect co-located in one folder). Such
// files must never leak into the "loose" any-file-with-a-matching-name
// fallback below, or they'd get paired with some *other*, unrelated file
// that happens to reduce to the same name-derived key - e.g. two separate
// extraction attempts of the same source PDF, which produce different
// coordinate spaces and would otherwise render as scrambled, misaligned
// plots (plots.json from one attempt, image/rect from the other).
const plotDirs = new Set(Object.keys(plotModules).map(dirOf));

// Co-located files (same directory *and* matching name-key as the plots.json)
// are matched first and are always correct by construction - both come from
// the same extraction run. Directory alone isn't enough: a shared legacy
// folder (see "Plots JSON/" below, which holds one village's plots.json
// alongside an unrelated village's leftover "-rect.json") can put two
// different villages' files in the same directory, and matching on
// directory alone would wrongly pair them up. The "loose" maps below are the
// fallback for such shared-folder legacy files, matched by name-key alone.
const imagesByDirAndKey = new Map(
  Object.entries(imageModules).map(([path, url]) => [`${dirOf(path)} ${keyOf(path, '-map')}`, url])
);
const rectsByDirAndKey = new Map(
  Object.entries(rectModules).map(([path, rect]) => [`${dirOf(path)} ${keyOf(path, '-rect')}`, rect])
);
const looseImagesByKey = new Map(
  Object.entries(imageModules)
    .filter(([path]) => !plotDirs.has(dirOf(path)))
    .map(([path, url]) => [keyOf(path, '-map'), url])
);
const looseRectsByKey = new Map(
  Object.entries(rectModules)
    .filter(([path]) => !plotDirs.has(dirOf(path)))
    .map(([path, rect]) => [keyOf(path, '-rect'), rect])
);

// `path` is relative to this file (src/plot-map/helpers/villages.js), two
// directories below the project root - rewriting its "../../" prefix to
// "src/" gives the project-root-relative path the save-plots dev server
// middleware (see vite.config.ts) needs to write edits back to the right file.
function toProjectPath(path) {
  return path.replace(/^(\.\.\/)+/, 'src/');
}

const MAPS = Object.entries(plotModules)
  .map(([path, load]) => {
    const dir = dirOf(path);
    // Name-derived key, used only to group by town and to match loose
    // (non-co-located) image/rect files - not this map's identity, since
    // two differently-located files can reduce to the same name (see
    // plotDirs above), and identity needs to stay unique for calibration
    // storage and the <select>'s value.
    const nameKey = keyOf(path, '-plots');
    const plotsPath = toProjectPath(path);
    return {
      key: plotsPath,
      nameKey,
      townLabel: prettyName(nameKey),
      loadPlots: () => load().then((m) => m.default),
      plotsPath,
      imageUrl: imagesByDirAndKey.get(`${dir} ${nameKey}`) ?? looseImagesByKey.get(nameKey) ?? null,
      imageRect: rectsByDirAndKey.get(`${dir} ${nameKey}`) ?? looseRectsByKey.get(nameKey) ?? null,
    };
  })
  .sort((a, b) => a.key.localeCompare(b.key));

// A survey sheet's "part1"/"part2" tag is the one convention actually seen
// so far (e.g. Khattalwada's two-sheet map) - use it as the map's label
// when present. Anything else with no such tag just gets numbered in order
// (still deterministic, since MAPS is pre-sorted by key).
function mapLabel(nameKey, index) {
  const part = nameKey.match(/part\s*(\d+)/i);
  return part ? `Part ${part[1]}` : `Map ${index + 1}`;
}

// Labels are derived from the sheet title (mapLabel) and so can collide -
// most notably two different extraction attempts of the very same sheet,
// which both read as "part1". Numbering duplicates keeps every option in
// the picker distinguishable instead of showing indistinguishable entries.
function withUniqueLabels(maps, labelFor) {
  const seen = new Map();
  return maps.map((m, i) => {
    const label = labelFor(m, i);
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return { ...m, label: n > 1 ? `${label} (${n})` : label };
  });
}

// Some towns have more than one survey sheet (different sections of the
// same village, or a map redone across multiple pages) - group every map
// whose title reduces to the same town name (see prettyName) under one
// entry, so the UI can offer a single town picker plus a second picker for
// which of its sheets to view, instead of listing indistinguishable
// same-named entries side by side.
export const TOWNS = Array.from(
  MAPS.reduce((byTown, map) => {
    if (!byTown.has(map.townLabel)) byTown.set(map.townLabel, []);
    byTown.get(map.townLabel).push(map);
    return byTown;
  }, new Map())
)
  .map(([townLabel, maps]) => ({
    key: townLabel,
    label: townLabel,
    maps: maps.length > 1
      ? withUniqueLabels(maps, (m, i) => mapLabel(m.nameKey, i))
      : maps.map((m) => ({ ...m, label: townLabel })),
  }))
  .sort((a, b) => a.label.localeCompare(b.label));
