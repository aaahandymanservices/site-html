#!/usr/bin/env python3
"""Trim the vendored Font Awesome webfonts to the glyphs this site renders.

The full Free webfonts carry ~2,000 glyphs each (156 kB solid, 117 kB brands).
This site uses ~150, so subsetting removes roughly 90% of the bytes from a font
that Font Awesome loads with `font-display: block` -- i.e. straight off the
critical path.

The subsetted results are committed, so the regular build needs neither Python
nor fonttools. Re-run this only when the set of icons in use changes:

    python3 -m pip install fonttools brotli
    node scripts/build-icon-css.mjs     # refreshes required-codepoints.json
    python3 scripts/subset-icon-fonts.py

build-icon-css.mjs warns on any icon whose glyph is missing from the committed
subsets, so a skipped run shows up at build time instead of as a blank icon.
"""
import json
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor" / "font-awesome"
OUT_DIR = ROOT / "public" / "fonts"

FONTS = ["fa-solid-900.woff2", "fa-brands-400.woff2"]


def main() -> int:
    required = json.loads((VENDOR / "required-codepoints.json").read_text())
    if not required:
        print("No required codepoints found; run build-icon-css.mjs first.")
        return 1

    shipped: set[int] = set()

    for name in FONTS:
        source = VENDOR / "webfonts" / name
        target = OUT_DIR / name

        font = TTFont(source)
        available = {cp for table in font["cmap"].tables for cp in table.cmap}
        font.close()

        # Each font only carries part of the icon set; asking fonttools for a
        # glyph it does not have is an error, so intersect first.
        keep = sorted(available & set(required))

        options = subset.Options()
        options.flavor = "woff2"
        options.desubroutinize = True
        options.drop_tables += ["FFTM"]
        options.layout_features = []
        options.name_IDs = ["*"]
        options.notdef_outline = True

        font = subset.load_font(str(source), options)
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=keep)
        subsetter.subset(font)
        subset.save_font(font, str(target), options)
        font.close()

        shipped.update(keep)
        before = source.stat().st_size
        after = target.stat().st_size
        print(
            f"{name}: {len(keep)} glyphs, "
            f"{before / 1024:.0f} kB -> {after / 1024:.0f} kB "
            f"({100 - after * 100 // before}% smaller)"
        )

    (VENDOR / "subset-codepoints.json").write_text(
        json.dumps(sorted(shipped)) + "\n"
    )

    unmatched = sorted(set(required) - shipped)
    if unmatched:
        print(
            "Warning: no font provides these codepoints: "
            + ", ".join(f"U+{cp:04X}" for cp in unmatched)
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
