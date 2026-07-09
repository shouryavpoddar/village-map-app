#!/usr/bin/env python3
"""
Extract parcel-boundary polygons and a background image from a survey-map
PDF, in the style of the Khattalwada village maps used by src/PlotMap.jsx.

How it works
------------
These survey PDFs draw each parcel boundary as its own closed vector path
(a "curve" object in pdfplumber's terms) with a black stroke and no fill.
Other page content - dashed village boundaries, roads, canals, symbol
markers, and plot-number text - shows up as either open (non-closed) paths
or filled paths, so a few simple filters isolate the parcel outlines:

  1. closed path (first point == last point)
  2. stroked, not filled
  3. vertex count and bounding-box area inside a plausible parcel range

That geometric filter alone still lets through shapes that aren't really
parcels (stray roads, symbols, dashes that happen to close up), and misses
real parcels drawn unusually. Labeling and cleanup are left entirely to a
human from the frontend's plot editor (rename, delete, or hand-draw a
polygon for anything the geometry filter missed) rather than attempted here
- reading the plot numbers automatically was tried (clustering the tiny
vector glyph curves each digit is drawn from and OCR'ing them) and dropped:
the digits are a stylized CAD text style that doesn't match printed Gujarati
typography closely enough for reliable OCR, so every extracted plot starts
unlabeled ("").

Some source PDFs draw a parcel's boundary stroke twice (pdfplumber then
reports it as two identical curves), which would otherwise produce two
exactly-stacked duplicate plots - `dedupe_rings` drops any ring whose
rounded points exactly match an earlier one, so this is handled automatically
on every run rather than needing a manual dedup pass on the output JSON.

The background PNG is rendered from the same PDF page and cropped to the
bounding box of every vector object on the page (border to border, dropping
the surrounding white margin). Because both the polygons and the image come
from the same PDF coordinate space, they line up exactly - no manual
calibration needed like the Khattalwada dataset required (that one was
digitized separately from this PDF, at an unknown scale).

Requirements
------------
    pip install -r scripts/requirements.txt

Usage
-----
    python3 scripts/extract_plot_map.py path/to/map.pdf
    python3 scripts/extract_plot_map.py path/to/map.pdf --page 0 --dpi 400 --out-dir out/

Output
------
By default, output for "<stem>.pdf" goes to src/assets/villages/<stem>/:
    <stem>-plots.json  - [{ id, label: "", points: [[x,y], ...] }, ...]
    <stem>-map.png     - background image, cropped to page content
    <stem>-rect.json   - { x, y, width, height } for MAP_IMAGE_RECT in PlotMap.jsx

This is a heuristic extraction, not a guaranteed one. Every source map is
drawn a little differently, so always sanity-check the output (open the PNG
and plots JSON together, e.g. by pointing PlotMap.jsx at them) before
trusting it. Stray shapes (roads, symbols) that slip through the filters,
two adjacent parcels that got merged into one closed path, and real parcels
the filter missed entirely are all easiest to spot and fix by eye once
rendered - use the frontend's delete and draw-new-plot tools rather than
re-running with different thresholds.
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    sys.exit("Missing dependency: run `pip install -r scripts/requirements.txt` first.")
try:
    import pypdfium2 as pdfium
except ImportError:
    sys.exit("Missing dependency: run `pip install -r scripts/requirements.txt` first.")


def is_closed(pts, eps=0.5):
    if len(pts) < 3:
        return False
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    return abs(x0 - x1) <= eps and abs(y0 - y1) <= eps


def bbox_of(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def extract_polygons(page, min_vertices, max_vertices, min_side, max_side):
    polygons = []
    for curve in page.curves:
        if curve["fill"] or not curve["stroke"]:
            continue
        pts = curve["pts"]
        if not is_closed(pts):
            continue
        # drop the duplicated closing point
        ring = pts[:-1]
        if not (min_vertices <= len(ring) <= max_vertices):
            continue
        minx, miny, maxx, maxy = bbox_of(ring)
        w, h = maxx - minx, maxy - miny
        if w < min_side or h < min_side or w > max_side or h > max_side:
            continue
        polygons.append(ring)
    return polygons


def dedupe_rings(rings):
    """Drop rings that are exact duplicates of an earlier one (same points,
    same order) - some source PDFs draw a parcel boundary's stroke twice
    (e.g. a doubled/emphasized line), which pdfplumber then reports as two
    identical curves, and without this would show up as two stacked-
    identical plots in the output."""
    seen = set()
    deduped = []
    for ring in rings:
        key = tuple((round(x, 2), round(y, 2)) for x, y in ring)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(ring)
    return deduped


def content_bbox(page):
    objs = page.lines + page.rects + page.curves
    xs0 = [o["x0"] for o in objs]
    xs1 = [o["x1"] for o in objs]
    ys0 = [o["top"] for o in objs]
    ys1 = [o["bottom"] for o in objs]
    return min(xs0), min(ys0), max(xs1), max(ys1)


def default_out_dir(stem):
    repo_root = Path(__file__).resolve().parent.parent
    return repo_root / "src" / "assets" / "villages" / stem


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf", type=Path, help="path to the source survey-map PDF")
    ap.add_argument("--page", type=int, default=0, help="0-indexed page number (default: 0)")
    ap.add_argument("--dpi", type=int, default=400, help="render resolution for the background PNG (default: 400)")
    ap.add_argument("--out-dir", type=Path, default=None,
                     help="output directory (default: src/assets/villages/<pdf-stem>/)")
    ap.add_argument("--min-vertices", type=int, default=4, help="minimum polygon vertex count (default: 4)")
    ap.add_argument("--max-vertices", type=int, default=60, help="maximum polygon vertex count (default: 60)")
    ap.add_argument("--min-side", type=float, default=2.0, help="minimum bbox side in PDF points, filters out tiny specks (default: 2.0)")
    ap.add_argument("--max-side", type=float, default=200.0, help="maximum bbox side in PDF points, filters out large non-parcel shapes (default: 200.0)")
    args = ap.parse_args()

    if not args.pdf.exists():
        sys.exit(f"No such file: {args.pdf}")

    stem = args.pdf.stem
    out_dir = args.out_dir or default_out_dir(stem)
    out_dir.mkdir(parents=True, exist_ok=True)

    with pdfplumber.open(args.pdf) as pdf:
        if args.page >= len(pdf.pages):
            sys.exit(f"PDF only has {len(pdf.pages)} page(s); --page {args.page} is out of range.")
        page = pdf.pages[args.page]

        rings = extract_polygons(page, args.min_vertices, args.max_vertices, args.min_side, args.max_side)
        if not rings:
            sys.exit(
                "No candidate polygons found. Try loosening --min-vertices/--max-vertices/--min-side/--max-side, "
                "or inspect page.curves yourself - this map may draw parcels differently."
            )

        deduped = dedupe_rings(rings)
        dupes_dropped = len(rings) - len(deduped)
        rings = deduped

        plots = [
            {"id": i + 1, "label": "", "points": [[round(x, 2), round(y, 2)] for x, y in ring]}
            for i, ring in enumerate(rings)
        ]

        minx, miny, maxx, maxy = content_bbox(page)

    plots_path = out_dir / f"{stem}-plots.json"
    plots_path.write_text(json.dumps(plots))

    rect_path = out_dir / f"{stem}-rect.json"
    rect_path.write_text(json.dumps({
        "x": round(minx, 2), "y": round(miny, 2),
        "width": round(maxx - minx, 2), "height": round(maxy - miny, 2),
    }))

    pdf_doc = pdfium.PdfDocument(str(args.pdf))
    bitmap = pdf_doc[args.page].render(scale=args.dpi / 72)
    image = bitmap.to_pil()
    scale = args.dpi / 72
    crop_box = (
        round(minx * scale), round(miny * scale),
        round(maxx * scale), round(maxy * scale),
    )
    image = image.crop(crop_box)
    png_path = out_dir / f"{stem}-map.png"
    image.save(png_path)

    dupe_note = f" ({dupes_dropped} exact-duplicate curve(s) dropped)" if dupes_dropped else ""
    print(f"Found {len(plots)} candidate plot(s){dupe_note}, all unlabeled - label, delete, or hand-draw missing ones from the frontend.")
    print(f"Wrote {plots_path}")
    print(f"Wrote {png_path}  ({image.width}x{image.height}px)")
    print(f"Wrote {rect_path}")
    print()
    print(f"To use in PlotMap.jsx: {out_dir} already matches the src/assets/villages/<name>/ convention,")
    print("so it'll show up in the village picker automatically - no other code changes needed.")


if __name__ == "__main__":
    main()
