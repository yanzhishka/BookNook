# EPUB reader

Reflowable EPUB 2/3 imports use the container → OPF → spine reading order, with
metadata and cover from the package. A lazy local JSZip import replaces the old
external parser and alphabetical concatenation of HTML files.

`services/epub/import.ts` creates an allowlisted document tree; the original
publisher HTML, scripts, styles, event handlers and external image requests are
never inserted into the page. XML parsing preserves RoyalLib's unusual body
`title` elements. Malformed HTML has a separate recovery path.

The version 1 document lives in `books.document` (owner RLS), alongside a plain
text representation used by quotes. Progress updates neither send nor fetch the
whole document. The nullable migration keeps existing text/PDF imports working.

The reader uses browser column fragmentation to fit text into the available
viewport without scrolling. Wide screens show two columns; smaller screens show
one. Fixed footer buttons and Left/Right keys turn the entire screen. Long verse
blocks and letters continue on the next screen, preserving inline markup and
verse line breaks. Headings stay with following text when they fit.

Clicking/tapping the left half of the text goes back; the right half goes
forward. These handlers use the existing progress-save flow. Interactive links,
footnotes, selection drags, long presses and selection-clearing clicks do not
turn pages. Desktop single clicks wait briefly to allow double-click selection.
The footer page number is editable: Enter or the adjacent submit button jumps to
that screen page. Out-of-range integers clamp to the first/last page; empty or
non-integer input restores the current number. Escape cancels editing.

Screen page numbers change with font and viewport. DOM text ranges map column
boundaries to source offsets; the `books.reading_offset` anchor preserves the
reading position across rotation, font changes and reloads. Legacy `current_page`
is used only when no anchor exists. Stable semantic fragments are still used for
backward-compatible storage and imports, not for the displayed page number.

The font slider supports 12–42 px in 0.1 px increments; the buttons adjust by
1 px. Fractional sizes persist across reloads. A 180 ms scale/fade animates the
clipped visible spread after one repagination at the requested size. The EPUB
tree is memoized so animation frames do not rerender or reflow the entire book.
Interrupted transitions start from the visible scale, and reduced-motion
preferences disable this feedback. Anchor measurement normalizes transformed
coordinates if a resize or image load arrives during the animation.

ResizeObserver, font-load and image-load events trigger repagination. Ink insets
keep superscript footnotes inside the clipped viewport, including at 42 px.
Notes open as an overlay so the reading area always uses the full width.

EPUB 3 nav / EPUB 2 NCX supply the contents, supplemented by chapter headings
when the package contains only a single TOC entry. Local references resolve
relative to their source chapter. EPUB footnotes and RoyalLib's duplicate `n_`
anchors open in a modal without changing reading progress. Emphasis, superscripts,
ruby, raster illustrations and paragraphs survive; linked non-linear footnotes
remain accessible without entering the primary reading sequence.

The library's “Replace EPUB” action preserves book ID and user annotations. It
restores location using a text anchor, with proportional fallback. Reimport is
necessary for legacy EPUBs because plain text no longer contains their markup.

## Limits

- No DRM or fixed-layout rendering.
- Publisher CSS, embedded fonts, SVG/MathML layout and complex tables are not
  reproduced. Tables become text; unsupported images produce an import warning.
- Source text is retained as supplied, including existing encoding mistakes.
- Import limits: 30 MB archive, 100 MB unpacked, 4,000 files, 12 MB per text
  resource, 4 MB per image and 12 MB total images.

## Verification

`npm test` includes spine order, namespace-aware metadata, malformed body titles,
verse boundaries, emphasis, EPUB 3 nav, separate footnotes, local URL resolution,
inactive scripts, quote whitespace matching, rejected formats, and DB roundtrip
and ownership filters. `npm run build` checks TypeScript and production bundles.

The user's RoyalLib *Евгений Онегин* was reimported in place: 998 blocks, 396 verse
blocks, eight chapters, both letters, 80 notes and 399 semantic fragments. Browser
checks cover TOC, footnotes, persisted reload, text selection and widths
320–1440 px. Screen pagination was also checked in portrait/landscape at 320×568,
568×320, 390×844, 844×390 and 1440×900, with 22/42 px fonts. All text/footnote
rectangles fit vertically; keyboard turns and reload persisted the source anchor.
A long plain-text fixture verified intra-paragraph anchors across rotation.
The source EPUB, browser fixture and screenshots stay in ignored `work/`.
