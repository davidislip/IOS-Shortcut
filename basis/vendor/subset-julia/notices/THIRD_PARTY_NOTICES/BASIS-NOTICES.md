# Basis runtime notices

The original upstream README.md describes the upstream direct-dependency notice collection. Basis supplements that collection with licenses copied from the exact cached packages for all 74 registry crates observed in the WASM target depfiles. See BASIS-WASM-INVENTORY.json. This conservative build-input inventory may include compiled code removed during linking; retained upstream notices can also describe native or development dependencies.

The vendored astro-float-num path dependency and Julia/LinearAlgebra source notices are included separately. Source-license texts are preserved unchanged.

Basis modified the runtime to correct array flattening, LU row permutations, and square/rectangular linear solves. The exact modifications are distributed in runtime-source.patch next to the WASM, with its hash and upstream revision in runtime-provenance.json.
