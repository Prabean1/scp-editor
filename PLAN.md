# SCP Editor Desktop App — Electron + ftml Integration

Desktop SCP Wikidot article editor. Electron+Vite+React+TS. Uses ftml
(SCP Wiki's real Rust parser, compiled to wasm, run in main process) instead
of the old regex-based `scp-editor.jsx` prototype.

## Status (2026-07-25)

Phases 0–3: **done, verified**. Full file I/O, real `PageInfo` UI, recent
files, unsaved-changes guard. Rich Text mode and post-v1 roadmap
tiers 1–3: also done — see `.scratch/roadmap.md` for what's still open.

Shipped, in order:
- Phase 0: ftml wasm spike/pipeline validation. Done.
- Phase 1: electron-vite scaffold + `ftml-bridge.ts` IPC + NSIS packaging. Done.
- Phase 2: Toolbar/Editor/PreviewPane/StatusBar componentized, presubstitution pass, live preview. Done.
- Phase 3: file I/O, recent files, dirty-state tracking, close-guard, file association. Done.
- Post-v1: ribbon redesign, unclosed-tag linting, smart quotes v1, Rich Text v1+v2, release pipeline, StatusBar dev-only. Done.

Key empirical findings (still load-bearing, re-derive from code otherwise):
- **Unresolved `[[include]]`/`[[module]]` degrade gracefully** to visible
  editable text — ftml never throws. Basis for the presubstitution approach.
- **ftml wasm-bindgen objects are consumed by value** —
  `PageInfo`/`WikitextSettings`/`Tokenization` need `.copy()` before reuse
  (parse→render→render_text etc.) or "Attempt to use a moved value". See
  `src/main/ftml-bridge.ts`.
- **`sandbox: true` breaks `require()` of npm packages in preload** —
  sandboxed preload only gets Electron's own built-ins.
  `@electron-toolkit/preload` failed silently (`window.api` undefined). Keep
  `src/preload/index.ts` dependency-free: bare `contextBridge`/`ipcRenderer`
  from `electron` only.
- **`[[module Rate]]` already has ftml's own placeholder**
  (`<p>TODO: module Rate</p>`) — don't over-build the fake for it.
- **ftml has real, permanent coverage/strictness gaps vs. legacy Wikidot** —
  not fixable from this app, not a bundled-includes bug:
  - `[[module ListPages]]` isn't implemented (only Backlinks/Categories/CSS/
    Join/PageTree/Rate exist, see `ftml/src/parsing/rule/impls/block/blocks/
    module/mapping.rs`); always falls back to literal text.
  - Block argument values must be double-quoted; ftml has no bare-word
    fallback (`ftml/src/parsing/string.rs` `get_quoted_string`). Legacy
    Wikidot tolerates unquoted values — e.g. `component:image-block`'s
    `link={$link}|link=#` default produces unquoted `link=#` when the
    caller doesn't override it, which ftml rejects.
  - A block/module opened but never closed within the wikitext handed to
    ftml degrades everything from the open tag onward to literal text, not
    just that one block — expected per the "degrades gracefully" behavior
    above, but means testing a component in isolation from its paired
    closer (e.g. `license-box-backend` without `license-box-end`) will
    always look broken even when correct.

## Context / license

Public open-source repo, **AGPL-3.0-or-later** (matches ftml's license,
since ftml runs in-process via wasm `require()`, not a networked service —
this is linking, not aggregation).

## Architecture

- ftml runs in Electron's **main process** (`wasm-pack build --target
  nodejs`), exposed via `ipcMain.handle('ftml:render', ...)` + preload
  `contextBridge`. `contextIsolation: true`/`nodeIntegration: false`/
  `sandbox: true`.
- Scaffold: electron-vite (React) + electron-builder. Editor:
  `@uiw/react-codemirror`, **no Wikidot language mode** (Wikidot syntax
  conflicts with Markdown's own highlighting rules — a wrong highlighter is
  worse than none; plain CodeMirror gives undo/line-numbers only).
- File model: `<name>.wikidot` (raw source) + `<name>.wikidot.meta.json`
  sidecar (page/title/tags/category/rating/language — `PageInfo` fields
  with no natural home in prose). Falls back to filename-derived defaults.
- SCP component pre-substitution: `lib/wikidot-presubstitute.ts` rewrites
  recognized include/module calls into faked-but-valid raw Wikidot markup
  before ftml sees it; ftml stays the single source of truth for actual
  rendering. Unrecognized includes pass through unchanged.
- Packaging: electron-builder NSIS; `resources/ftml-pkg/` ships via
  `extraResources` (not asar).

## Critical files

- `scp-editor.jsx` — original UI/toolbar/theme prototype (superseded, kept
  as reference).
- `resources/ftml-pkg/ftml.js` — vendored wasm-pack output. Rebuild via
  `scripts/build-ftml-wasm.ps1`.
- `src/main/ftml-bridge.ts` — main-process ftml wrapper + IPC registration.
- `src/preload/index.ts` — dependency-free by necessity (see sandbox note
  above). Don't add npm-package imports without re-verifying.
- `src/renderer/src/App.tsx` — top-level layout/state, debounced render.
- `src/renderer/src/components/` — Toolbar/Editor/PreviewPane/StatusBar.
- `src/renderer/src/lib/wikidot-presubstitute.ts` — fake-include pass.
- `src/renderer/src/assets/preview.css` — SCP page theme.
- `electron-builder.yml` — extraResources/NSIS config.
- `.claude/skills/run-desktop/` — Playwright driver for verifying UI
  changes against the real app (not git-tracked, local tooling).

## Decisions confirmed with user

- AGPL scope: whole app AGPL-3.0-or-later, ftml linked in-process.
- Rust toolchain: GNU (not MSVC) — rustup `stable-x86_64-pc-windows-gnu` +
  MSYS2 MinGW gcc/ld as host linker, wasm-pack 0.15.0 prebuilt binary. Only
  needed again if upgrading ftml.
