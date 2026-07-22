# SCP Doc Editor

A desktop SCP Wikidot article editor, rendering previews with the SCP
Wiki's own ftml parser (compiled to wasm) instead of a homegrown regex
parser. Electron app — see `PLAN.md` for the full design.

## License

AGPL-3.0-or-later (see `LICENSE`). This app statically bundles and calls
into [ftml](https://github.com/scpwiki/ftml) (compiled to wasm, running
in-process in Electron's main process), which is itself
AGPL-3.0-or-later — so the combined work is licensed the same way.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
