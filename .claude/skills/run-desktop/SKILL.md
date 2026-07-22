---
name: run-desktop
description: Build, run, and drive the SCP Doc Editor Electron desktop app. Use when asked to start the desktop app, take a screenshot of it, build it, or interact with its UI.
---

SCP Doc Editor is an Electron + Vite + React (TypeScript) desktop app. It
runs natively on this Windows machine (a real window opens) — no xvfb/tmux
needed, unlike a headless Linux container.

All paths are relative to the repo root.

## Build

```bash
npm install
npm run build   # produces out/main, out/preload, out/renderer
```

## Run (agent path)

Drive it via the Playwright `_electron` REPL at
`.claude/skills/run-desktop/driver.mjs`. It launches the **production
build** (`out/`), not `electron-vite dev` — simpler to automate, no HMR/dev
server timing to wait on.

```bash
node .claude/skills/run-desktop/driver.mjs
```

It's a REPL: type a command, see the result, type the next one. Because
readline can race ahead of async commands piped in all at once, prefer
driving it interactively or one command at a time rather than piping a
whole script of commands through stdin in one shot.

Screenshots land in `.driver-shots/` (override: `SCREENSHOT_DIR`).

### Commands

| command | what it does |
|---|---|
| `launch` | launch the app, wait for the window |
| `ss [name]` | screenshot → `.driver-shots/<name>.png` |
| `click <css-sel>` | click element (via DOM, not coords) |
| `click-text <text>` | click button/link containing text |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` | wait for element, 10s timeout |
| `eval <js>` | evaluate in the page, print JSON |
| `text [css-sel]` | print innerText |
| `html [css-sel]` | print innerHTML |
| `windows` | list all windows |
| `quit` | close app, exit |

## Run (human path)

```bash
npm run dev   # opens a real window with HMR
```

## Verify the packaged build

To check the actual NSIS-packaged app (not just the dev build) — e.g. to
confirm `process.resourcesPath` resolution for `resources/ftml-pkg`:

```bash
npm run build:win
```

Then point a driver script's `executablePath` at
`dist/win-unpacked/SCP-Doc-Editor.exe` instead of launching via `[APP_DIR]`
args against `node_modules/electron/dist/electron.exe`.

## Gotchas

- **`sandbox: true` in `webPreferences` breaks `require()` of npm packages
  in the preload script** — sandboxed preload scripts only get Electron's
  own built-ins (`electron` itself), not full Node module resolution. This
  is why the preload (`src/preload/index.ts`) doesn't use
  `@electron-toolkit/preload`'s `electronAPI` — it broke with "module not
  found: @electron-toolkit/preload" and left `window.api` undefined. Keep
  the preload dependency-free (bare `contextBridge`/`ipcRenderer` from
  `electron` only) if `sandbox: true` stays set.
- **`playwright-core` is a devDependency specifically for this driver** —
  it's not otherwise used by the app itself.

## Troubleshooting

- **`window.api` is `undefined` in the renderer:** check the main process
  stderr for a preload load error (`app.process().stderr` if driving via
  Playwright) — almost always the sandboxed-preload-require issue above.
- **Blank preview after clicking render:** the IPC call likely rejected;
  attach `page.on('pageerror', ...)` and `page.on('console', ...)` listeners
  before clicking to see the real error instead of a silent blank div.
