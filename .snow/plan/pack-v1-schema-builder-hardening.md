# Pack v1 Schema Builder Hardening

## Status: ✅ Completed

## Context
The initial `vanblog pack build <directory>` path compiled `schema.ts` and checked only for the text `exports.models`. That did not prove the artifact was executable by the Goja runtime, and a failed build could replace an existing artifact. This hardening closes the tooling/runtime boundary.

## Analysis
- **Affected files**: `vault/internal/validation/validation.go`, `vault/internal/packcli/command.go`, `vault/internal/packcli/command_test.go`, `docs/future-pack-architecture.md`
- **New files**: none
- **Dependencies**: existing Goja validation loader, Node/Vite builder, PackSource
- **Complexity**: medium
- **Risk areas**: staging cleanup, preserving the previous artifact on failure, keeping source validation separate from runtime artifact validation

## Phases

### Phase 1: Goja artifact validation
- **Goal**: expose the runtime-equivalent validation boundary without binding PocketBase hooks.
- **Files**: `vault/internal/validation/validation.go`, `vault/internal/packcli/command_test.go`
- **Steps**:
  - [x] Add `validation.ValidateModelSource` using the existing compile/run/loadModels path.
  - [x] Allow `PackSource` to read an explicit staging path while preserving the default `schema.js` behavior.
  - [x] Verify generated artifacts through Goja in CLI tests.
- **Done when**: generated `schema.js` must compile, execute, and expose a usable `exports.models` object.

### Phase 2: Validate-then-promote CLI flow
- **Goal**: make artifact generation failure-safe.
- **Files**: `vault/internal/packcli/command.go`, `vault/internal/packcli/command_test.go`
- **Steps**:
  - [x] Detect missing `schema.ts` before invoking the builder and preserve no-op semantics.
  - [x] Write builder output to a same-directory temporary staging file.
  - [x] Validate the staged artifact through Goja, then rename it to `schema.js` only after success.
  - [x] Remove staging files on failure and preserve any existing artifact.
- **Done when**: production path sees only a successfully validated artifact, and no invalid build can replace the previous one.

### Phase 3: Documentation and verification
- **Goal**: align architecture docs and verify all affected packages.
- **Files**: `docs/future-pack-architecture.md`, this plan
- **Steps**:
  - [x] Document validate-then-promote and production's schema.js-only behavior.
  - [x] Record implementation results and remaining future work.
- **Done when**: Go tests/build pass and the documented boundary matches implementation.

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Builder emits syntactically valid but runtime-incompatible JS | Runtime validation failure | Execute the exact artifact through Goja before promotion |
| Failed build overwrites a good artifact | Production startup/runtime regression | Same-directory staging plus rename only after validation |
| Source Pack has `schema.ts` but no artifact yet | False runtime rejection | Keep source validation and runtime artifact validation separate |
| Existing callers construct `PackSource` without a path | Compile/runtime breakage | Preserve default `schema.js` path when `Path` is empty |

## Rollback Strategy
Revert the changes to the validation helper, PackSource optional path, CLI staging flow, tests, and documentation. Since promotion is atomic and validation precedes rename, failed builds do not require data rollback.

## Completion Summary

**Status**: Completed
**Phases**: 3 / 3

### Results
- Added Goja-backed `ValidateModelSource`.
- Added staged build output and validate-then-rename promotion.
- Preserved existing artifacts when a new build fails.
- Kept no-schema Packs as a stable no-op.
- Added runtime-loadability coverage to the schema builder test.
- Updated Pack architecture documentation.

### Verification
- [x] `go test ./internal/pack ./internal/packcli ./internal/validation`
- [x] `go build ./...`
- [ ] Root model/Astro verification pending final run
- [x] No unrelated dirty files intentionally modified
