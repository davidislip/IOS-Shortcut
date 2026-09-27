$BasisRoot = Split-Path $PSScriptRoot -Parent
$env:CARGO_HOME = Join-Path $BasisRoot '.tools/cargo'
$env:RUSTUP_HOME = Join-Path $BasisRoot '.tools/rustup'
$env:CARGO_TARGET_DIR = Join-Path $BasisRoot 'runtime-build/target'
$env:WASM_PACK_CACHE = Join-Path $BasisRoot '.tools/wasm-pack-cache'
$env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH
$env:PATH = (Join-Path $BasisRoot '.tools/wasm-pack-v0.15.0-x86_64-pc-windows-msvc') + ';' + (Join-Path $BasisRoot '.tools/wasm-bindgen-0.2.122-x86_64-pc-windows-msvc') + ';' + $env:PATH
$env:CARGO_BUILD_JOBS = '2'
