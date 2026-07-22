# Rebuilds the vendored ftml wasm package (resources/ftml-pkg/) from source.
#
# Only needed when upgrading ftml or re-doing the Phase 0 spike — the
# committed resources/ftml-pkg/ is what the Electron app actually uses at
# runtime, this script is not part of the app's own build.
#
# Prerequisites confirmed working on the machine used to build this
# (2026-07-22) — this is a build-time toolchain requirement for whoever
# rebuilds the vendored wasm package, not a runtime requirement for the
# app itself (end users never need Rust/wasm-pack):
#   - rustup (installed via `winget install --id Rustlang.Rustup`)
#   - stable-x86_64-pc-windows-gnu toolchain + wasm32-unknown-unknown target
#     (chosen over the MSVC toolchain because no Visual Studio Build Tools
#     were installed; MSYS2/MinGW gcc+ld at C:\msys64\mingw64\bin was used
#     as the host linker instead — needed even for a wasm32 target, since
#     build scripts/proc-macros/git2 (a build-dependency of ftml itself)
#     compile for the host, not wasm32)
#   - wasm-pack 0.15.0 (prebuilt binary from
#     https://github.com/wasm-bindgen/wasm-pack releases — the repo moved
#     from rustwasm/wasm-pack to wasm-bindgen/wasm-pack)
#
# ftml commit this was last built from: c262439b518b4f4de1b86b253b874d41970c2314
# (v1.42.0, cloned from https://github.com/scpwiki/ftml)
#
# The build command below uses default features (html + mathml), which is
# what render_html() needs — no --no-default-features flag required, despite
# the README's release-build example implying otherwise.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$ftmlDir = Join-Path $repoRoot "ftml"
$pkgDest = Join-Path $repoRoot "resources\ftml-pkg"

if (-not (Test-Path $ftmlDir)) {
    throw "ftml source not found at $ftmlDir - clone https://github.com/scpwiki/ftml there first."
}

# Ensure MinGW gcc/ld is on PATH for the host-target build steps (git2, build scripts).
$env:Path = "C:\msys64\mingw64\bin;$env:Path"

Push-Location $ftmlDir
try {
    wasm-pack build --target nodejs --dev
} finally {
    Pop-Location
}

if (Test-Path $pkgDest) {
    Remove-Item -Recurse -Force $pkgDest
}
New-Item -ItemType Directory -Force -Path $pkgDest | Out-Null
Copy-Item -Path (Join-Path $ftmlDir "pkg\*") -Destination $pkgDest -Recurse -Force

Write-Host "Rebuilt and copied ftml wasm pkg to $pkgDest"
