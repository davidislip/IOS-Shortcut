param(
    [ValidateSet('All', 'Native', 'Cache', 'Wasm')]
    [string]$Stage = 'All',
    [ValidateSet('release-fast', 'web-release')]
    [string]$WasmProfile = 'release-fast',
    [ValidateRange(1, 4)]
    [int]$Jobs = 2
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'rust-env.ps1')
$env:CARGO_BUILD_JOBS = [string]$Jobs
$SourceDir = Join-Path $BasisRoot 'upstream/julia-vm-oss'
$BuildRoot = Join-Path $BasisRoot 'runtime-build'
$PackageDir = Join-Path $BuildRoot 'pkg'
$NativeExe = Join-Path $env:CARGO_TARGET_DIR 'release-fast/sjulia.exe'
$BaseCache = Join-Path $BuildRoot 'base_cache.bin'
$PreludeCache = Join-Path $BuildRoot 'prelude_program_cache.bin'
New-Item -ItemType Directory -Path $BuildRoot -Force | Out-Null

function Assert-Exit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed with exit code $LASTEXITCODE" }
}

Push-Location $SourceDir
try {
    if ($Stage -in @('All', 'Native')) {
        Remove-Item Env:SJULIA_BASE_CACHE -ErrorAction SilentlyContinue
        Remove-Item Env:SJULIA_PRELUDE_PROGRAM_CACHE -ErrorAction SilentlyContinue
        $env:CARGO_PROFILE_RELEASE_FAST_DEBUG = '0'
        $env:CARGO_PROFILE_RELEASE_FAST_OPT_LEVEL = '3'
        $env:CARGO_PROFILE_RELEASE_FAST_INCREMENTAL = 'false'
        # The host executable generates caches and validates semantics. Keep the
        # large compiler/wrapper crates at level 1; retain the optimized VM core.
        & cargo build --locked --offline --profile release-fast -p subset_julia_vm --bin sjulia --features repl --config 'profile.release-fast.package.subset_julia_vm_compile.opt-level=1' --config 'profile.release-fast.package.subset_julia_vm.opt-level=1' --config 'profile.release-fast.package.subset_julia_vm_compile.incremental=true' --config 'profile.release-fast.package.subset_julia_vm.incremental=true'
        Assert-Exit 'Native build'
    }
    if ($Stage -in @('All', 'Cache')) {
        if (-not (Test-Path -LiteralPath $NativeExe)) { throw 'Build the native runtime first.' }
        & $NativeExe --precompile-prelude $PreludeCache
        Assert-Exit 'Prelude cache'
        & $NativeExe --precompile-base $BaseCache
        Assert-Exit 'Base cache'
    }
    if ($Stage -in @('All', 'Wasm')) {
        if (-not (Test-Path -LiteralPath $PreludeCache) -or -not (Test-Path -LiteralPath $BaseCache)) {
            throw 'Generate both runtime caches first.'
        }
        $env:SJULIA_BASE_CACHE = $BaseCache
        $env:SJULIA_PRELUDE_PROGRAM_CACHE = $PreludeCache
        # Iterate with modest optimization and no LTO on this memory-limited host.
        # Use -WasmProfile web-release for the upstream size-optimized build.
        $env:CARGO_PROFILE_RELEASE_FAST_DEBUG = '0'
        $env:CARGO_PROFILE_RELEASE_FAST_OPT_LEVEL = '1'
        $env:CARGO_PROFILE_RELEASE_FAST_INCREMENTAL = 'true'
        & wasm-pack build (Join-Path $SourceDir 'subset_julia_vm_web') --target web --profile $WasmProfile --no-opt --mode no-install --out-dir $PackageDir -- --locked --offline
        Assert-Exit 'WASM package'
        $revision = (& git rev-parse HEAD).Trim()
        $patchFile = Join-Path $PackageDir 'runtime-source.patch'
        & git diff --binary --output=$patchFile HEAD
        Assert-Exit 'Source patch capture'
        $provenance = [ordered]@{
            builtAt = [DateTime]::UtcNow.ToString('o')
            source = 'https://github.com/AtelierArith/julia-vm-oss'
            revision = $revision
            modified = [bool]((& git status --porcelain) | Out-String).Trim()
            trackedPatchSHA256 = (Get-FileHash -LiteralPath $patchFile -Algorithm SHA256).Hash.ToLowerInvariant()
            rust = (& rustc --version | Out-String).Trim()
            wasmPack = (& wasm-pack --version | Out-String).Trim()
            wasmBindgen = (& wasm-bindgen --version | Out-String).Trim()
            nativeProfile = 'release-fast'
            nativeOptLevel = '3, with subset_julia_vm_compile and subset_julia_vm at 1'
            nativeIncrementalCrates = @('subset_julia_vm_compile', 'subset_julia_vm')
            wasmProfile = $WasmProfile
            wasmOptLevel = $(if ($WasmProfile -eq 'release-fast') { '1' } else { 's' })
            wasmLTO = ($WasmProfile -eq 'web-release')
            wasmIncremental = ($WasmProfile -eq 'release-fast')
            buildJobs = $Jobs
            embeddedBaseCache = $true
            embeddedPreludeCache = $true
            baseCacheSHA256 = (Get-FileHash -LiteralPath $BaseCache -Algorithm SHA256).Hash.ToLowerInvariant()
            preludeCacheSHA256 = (Get-FileHash -LiteralPath $PreludeCache -Algorithm SHA256).Hash.ToLowerInvariant()
            nativeSHA256 = (Get-FileHash -LiteralPath $NativeExe -Algorithm SHA256).Hash.ToLowerInvariant()
            wasmOpt = $false
            command = "powershell -File basis/scripts/build-runtime.ps1 -Stage $Stage -WasmProfile $WasmProfile -Jobs $Jobs"
            rebuildCommand = "powershell -File basis/scripts/build-runtime.ps1 -Stage All -WasmProfile $WasmProfile -Jobs $Jobs"
            wasmSHA256 = (Get-FileHash -LiteralPath (Join-Path $PackageDir 'subset_julia_vm_web_bg.wasm') -Algorithm SHA256).Hash.ToLowerInvariant()
        }
        $json = $provenance | ConvertTo-Json -Depth 5
        [IO.File]::WriteAllText((Join-Path $PackageDir 'runtime-provenance.json'), $json + "`n", [Text.UTF8Encoding]::new($false))
        Write-Output "Runtime package: $PackageDir"
    }
} finally {
    Pop-Location
}
