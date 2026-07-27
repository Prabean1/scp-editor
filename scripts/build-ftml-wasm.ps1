# Rebuilds the vendored ftml wasm package (resources/ftml-pkg/) from source.
# Only needed when upgrading ftml; end users of the packaged app never need Rust/wasm-pack.
#
# Requires the GNU (not MSVC) toolchain: MSYS2/MinGW gcc+ld as host linker, since
# build-dependencies like git2 compile for the host even when targeting wasm32.
# Uses default cargo features (html + mathml), which render_html() needs.

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
