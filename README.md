# SCP Doc Editor

A desktop editor for writing SCP Wikidot articles, with a live preview
rendered by the SCP Wiki's own **ftml** parser (compiled to wasm) instead
of a homegrown regex approximation so what you see is what will actually
(more or less, still in beta so I'm constantly looking to improve it) render on the wiki.

## WARNING

- This branch still uses the v0.2.0-alpha build and include features
here barely work at the moment. It works, *per se* but has reliability
issues with Wikidot's rate limiting because the program spoofs a user-agent
and it's pretty unreliable at the moment. On top of that, rendering whatever 
the program gets back from Wikidot is hell to fix and figure out + test. 
Shockingly, people who make themes only account for how it renders on Wikidot
and not some rinky-dinky piece of software I ~~vibe-coded~~ made to avoid using
the wikidot sandbox!

## Features

### Real Wikidot rendering

The preview pane uses [ftml](https://github.com/scpwiki/ftml) — the same
parser scp-wiki.wikidot.com itself runs — compiled to wasm and called
in-process, not a homegrown approximation of Wikidot syntax. What renders
here is what will (more or less) render on the real wiki.

### Two ways to write

- **Split source view** — a raw Wikidot text editor with a live preview,
  switchable between Edit / Split / Preview via one view-mode dropdown.
- **Rich Text mode** — a block-based WYSIWYG editor. Paragraphs, headings,
  lists, and inline formatting (bold/italic/underline/strikethrough,
  sub/superscript) are all editable directly, no markup typing required.
  Anything ftml can't cleanly map to a rich block — component includes,
  collapsibles, tables, nested divs — automatically falls back to an
  inline raw-source block instead of losing or mangling it. You can also
  force any block into raw view yourself (right-click → "Raw Text") to
  hand-edit its Wikidot source, then click away to re-render it — and
  while editing a raw block, Ctrl+Enter splits it into two at the cursor.

### Home / Insert ribbon toolbar

An MS Word-style ribbon, chosen after prototyping a few toolbar layouts:

- **Home** — paragraph style (Normal/Heading 1–4), text size, and inline
  formatting: bold, italic, underline, strikethrough, subscript,
  superscript, inline code, colored text, custom-styled spans, an
  escape-parsing wrapper (`@@literal@@`), list markers, and centered
  blocks.
- **Insert** — block-level snippets: a quick table grid plus a manual
  `[[table]]` layout for colspan/rowspan or rich cell content;
  collapsibles (plain and the "long" variant with a repeated hide link);
  a horizontal rule; internal, external, new-tab, and custom-styled
  links; line-prefixed and div-based quote blocks; tabbed views; images
  (either the documented `image-block` include or ftml's native
  `[[image url]]` tag); footnotes and footnote-block markers; an
  audio/video embed; addendum, incident-log, and interview-log
  scaffolds; a danger/anomaly-class-bar starter; and a redaction block
  (`█`) inserter.

### Wikidot syntax helpers in the source editor

- **Auto-closing pairs** — typing an opening `**`, `//`, `__`, `--`, `[[`,
  or list marker (`#`/`-`) inserts its matching closer; typing over an
  already-inserted closer just moves the cursor instead of doubling it up.
- **Unclosed-tag linter** — flags a tag that's missing its closing pair
  before you export or paste to the real wiki.
- **Smart quotes** — turns straight `"`/`'` into curly quotes as you
  type.
  - **Footnote handling** - Footnote blocks auto-count and renumber when document structure changes

All three are independently toggleable from the toolbar. All Insert ribbon tools now work in RTE as of v.0.2.0 (but not perfect.)

### Offline-safe preview of live-wiki components

Real SCP articles routinely pull shared templates from the live wiki —
the rating module, the license box, image blocks, classification/anomaly-class
bars, the classified-content decoration, the audio/video player snippet.
None of those can resolve over the network from a standalone desktop app,
so recognized calls degrade to a clearly-labeled, correctly-shaped
placeholder (e.g. "anomaly class bar — not resolved offline") instead of
raw, broken markup — the article's real structure and layout stay
visible while you work entirely offline. Everything else ftml doesn't
recognize is left as-is, since ftml already degrades unknown syntax to
visible, editable text on its own.

### Autosave & crash recovery

Unsaved changes are backed up automatically on a configurable interval
(30s / 1 min / 2 min). If the app is closed or crashes with unsaved work,
opening that file again (or relaunching after an unclean shutdown) offers
to recover the backed-up version instead of silently discarding it.

### Image handling

Drop an image file onto the editor or paste one from the clipboard and
it's saved to a local image cache and referenced inline. Because the real wiki has no idea about that local
cache, **Export** (below) warns you before copying source that still
references a locally-stored image, so you don't paste a broken link into
the live wiki by mistake. Now works in both source view AND Rich Text blocks.

### Export

Copies cleaned-up Wikidot source to the clipboard, ready to paste into
the real wiki's edit box.

### Version history

Every save is kept as a point-in-time snapshot you can browse and
restore from, once a file has been saved at least once.

### Recent files & file associations

`.wikidot` files open directly from Explorer/Finder, and the app
remembers what you were last working on.



## Download

Pre-built installers are published on the
[Releases page](https://github.com/Prabean1/scp-editor/releases).
Grab the one for your platform:

| Platform | File | Notes |
|---|---|---|
| Windows | `scp-doc-editor-<version>-setup.exe` | Installer (NSIS). Unsigned — see below. |
| macOS | `scp-doc-editor-<version>.dmg` | Unsigned/not notarized — see below. |
| Linux | `scp-doc-editor-<version>.AppImage`, `.deb`, or `.snap` | Pick whichever fits your distro. |

**About the "unrecognized publisher" warnings:** this project doesn't
(yet) pay for a code-signing certificate, so your OS will flag the
installer as coming from an unverified source. You're
welcome to build from source yourself instead if you'd rather not click
through the warning:

- **Windows:** SmartScreen will say "Windows protected your PC" — click
  **More info → Run anyway**.
- **macOS:** Gatekeeper will refuse to open it from a normal double-click
  — right-click (or Control-click) the app and choose **Open**, then
  confirm in the dialog that appears.
- **Linux (AppImage):** mark it executable first —
  `chmod +x scp-doc-editor-*.AppImage`.

## Building from source

Requires [Node.js](https://nodejs.org/) (v20+ recommended).

```bash
git clone https://github.com/Prabean1/scp-editor.git
cd scp-editor
npm install
```

### Development

```bash
npm run dev
```

### Package an installer

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

Output lands in `dist/`.

## License

AGPL-3.0-or-later (see `LICENSE`). This app statically bundles and calls
into [ftml](https://github.com/scpwiki/ftml) (compiled to wasm, running
in-process in Electron's main process), which is itself
AGPL-3.0-or-later/
