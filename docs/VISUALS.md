# Visual notes

The README uses a small, consistent set of visuals: an original identity banner, full interface captures, and focused detail crops. All images are stored in this repository rather than on a temporary image host.

## Image provenance

- **`assets/banner.svg`** is the editable source for the original Thongs 3 banner. Its blue checkmark follows the local build's independently generated application icon. The three decorative cards are illustrations, not screenshots or additional app features. `assets/banner.png` is a raster export for consistent GitHub rendering.
- **`assets/today-light.png` and `assets/today-dark.png`** show the actual Today interface with the same fictional task library in both appearances.
- **`assets/project-light.png` and `assets/project-dark.png`** show the actual project interface, including areas, progress, headings, tags, and a deadline.
- **`assets/task-detail.png` and `assets/task-detail-dark.png`** show the actual expanded task editor, with notes, a checklist, a tag, and a start date.
- **`assets/quick-entry.png` and `assets/quick-entry-dark.png`** show the actual Quick Entry panel.

The interface captures were made from the local 0.1.0 app renderer in Chromium, at a 1040 × 700 CSS-pixel viewport and 2× device scale. They use isolated browser storage populated with fictional data. No personal task library, account information, local filesystem paths, or vendor reference screenshots are included. Images are losslessly optimized; the interface itself is not retouched.

All 72 extracted interface resources have been replaced by independently authored geometric artwork, including list symbols, toolbar glyphs, task indicators, preference icons, and larger preference illustrations. The replacements are drawn from new SVG paths rather than editing, tracing, recoloring, or reusing vendor pixels. Legacy internal resource identifiers are retained for compatibility, not as a claim of shared artwork. The package audit finds zero matches against the 72 recorded extracted-image hashes, including embedded PNG data. Licensed Lucide glyphs retain their ISC notice. Thongs 3 is not an official Things product or port.

## What screenshots do not establish

These are browser-rendered app previews, not captures from a native Windows installation. They do not certify Windows behavior, DPI support, accessibility compliance, pixel identity with another application, or the availability of a public release.

The README automatically selects light or dark captures, including detail crops, using the viewer's color preference. Every README image has descriptive alternative text, so the page remains understandable if images cannot load.

## Updating the visuals

1. Use an isolated demo library with fictional task content. Never capture a personal library.
2. Capture the real interface at 2× scale. Wait for fonts and images to load, move the pointer away, and avoid transient menus, selection highlights, notifications, or clipped content.
3. Keep light/dark pairs on the same view with matching data and dimensions.
4. Preserve the banner's editable SVG alongside its PNG export. Do not use third-party marketing images as project screenshots.
5. Check the rendered README at desktop and mobile widths, in light and dark appearance. Verify relative asset paths and review every image for sensitive data before publishing.
