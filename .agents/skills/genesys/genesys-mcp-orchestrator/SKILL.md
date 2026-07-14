---
name: genesys-mcp-orchestrator
description: Use Genesys MCP for live editor scene/selection/asset/diagnostic queries and editor actions when Connected or Probe-capable (CallMcpTool + Genesys descriptors). Do not call MCP via shell.
---

# Genesys MCP Orchestrator

Use this skill when a task needs live Genesys editor/project context through MCP rather than static file edits alone.

## MCP Availability Gate (Read First)

Do **not** require first-class `query_*` tool names in the top-level tool list. Classify MCP availability in three states:

| State | Signal | What to do |
|-------|--------|------------|
| **Connected** | Genesys MCP tools (e.g. `query_scene`, `query_editor`, `batch_execute`) appear directly in the chat tool list | Use this skill; call tools directly |
| **Probe-capable** | `CallMcpTool` is available **and** Genesys MCP tool descriptors exist under `mcps/*genesys*/tools/` (or equivalent server metadata shows the Genesys MCP server) | Use this skill; invoke Genesys tools via `CallMcpTool` after reading the tool schema |
| **Off** | User says MCP is disabled / not enabled; or neither Connected nor Probe-capable signals are present | Stop — do not use MCP |
| **Forbidden** | You would use `curl`, HTTP, `Invoke-WebRequest`, or shell against `mcp.json` URL | Never do this |

Descriptor presence means **probe-capable**, not **ready**. A successful `query_editor(getState)` probe is required before treating MCP as usable for mutations.

Signals that do **not** mean MCP is available on their own:

- Only `.cursor/mcp.json` on disk
- The user mentioned MCP without a connected/probe-capable session
- A skill references MCP but the session lacks tools or `CallMcpTool` + descriptors

When MCP is **off** (or probe fails):

1. Tell the user live editor access requires enabling the `genesys` MCP server in Cursor and running the Genesys editor with this project open; include `blockingReasons` from a failed probe when available.
2. Use normal code and filesystem tools; do not read or edit `*.genesys-scene` unless the user explicitly asks or filesystem fallback is appropriate after MCP is genuinely unavailable.
3. Do not retry MCP or simulate it from the terminal.

When MCP is **connected** or **probe-capable**, skip broad discovery preamble — but **before the first scene/editor mutation** in a task, run the mandatory readiness probe below.

## Prerequisites

- Genesys editor running with this project open.
- `genesys` MCP server enabled and connected in Cursor.
- Genesys MCP reachable in **this** chat session — either first-class tools in the tool list, or `CallMcpTool` plus Genesys MCP descriptors under `mcps/*genesys*/tools/`.

## Three Core Flows

### 1. Availability

1. Classify session state using the gate table above (Connected, Probe-capable, or Off).
2. **Mandatory readiness probe before mutations** — call `query_editor(operation="getState")` via the available MCP path (direct tool or `CallMcpTool`). Read the tool schema first when using `CallMcpTool`.
   - Do not call `query_scene(operation="getState")`; `getState` is an editor operation, not a scene operation.
3. If `editorReady` is true, MCP is usable for mutations. If false or the call fails, read `blockingReasons`, report them, and treat MCP as blocked for that task unless the user resolves the blocker.

### 2. Read-Only Inspection

1. Call the relevant `query_*` tool directly.
2. `query_editor(getBusyState)` — play mode, builds, scene load.
3. `batch_execute(mode="readOnly")` — scene, selection, actors, assets, diagnostics in one pass.
4. Resources: `genesysmcp://editor/state`, `genesysmcp://scene/summary`, `genesysmcp://project/manifest`.

Prefer `query_asset(find)` for assets, prefabs, and scenes before filesystem glob. Paths use forward slashes (`assets/foo.genesys-scene`); `assetPath` may use `@project/...`. Treat `assets/foo` and `.\assets\foo` as the same asset.

### 3. Safe Mutation

1. **Readiness probe** — `query_editor(operation="getState")` before the first mutation in a task (required even when Connected; skip only for read-only inspection).
2. Consult this skill for approval scopes and destructive labels.
3. **Prefer MCP actions** for scene/outliner operations when the probe passes — `action_actor`, `action_component`, `action_scene`, or `batch_execute` for rename, create, delete, reparent, `setTransform`, and component changes. Do **not** edit `*.genesys-scene` files directly as the first choice when MCP is usable.
4. `query_editor(getBusyState)` — no edits during play mode, reload, or long builds.
5. Use `batch_execute(dryRun)` when operations are destructive, broad, path/ID-resolution heavy, or otherwise ambiguous; inspect `plannedChanges` before applying.
6. `batch_execute(apply, ...)` — in `auto` mode the server mints the approval token automatically, so apply works with no `approval`/`approvalId` and no `genesys_request_approval` call.
   - Optional `approval={summary, operations?}` gives a clearer `prompt`-mode dialog and audit trail; pass `approvalId` only to reuse a pre-minted token.
   - Direct actions behave the same: `action_actor({...})` applies without approval in `auto` mode.
7. `action_scene(save)` when the scene changed.
8. Re-query and report `undoGroupId` / `undoGroupIds`.

Do not batch `action_build` apply with actor/scene/prefab apply.

## Efficiency Default

Prefer the shortest mutation path: `query_editor(getState)` → mutate → `action_scene(save)` when scene changed → minimal re-query. For multi-step or bulk work, default to a single `run_script` instead of sequential direct tool calls.

**Skip by default** — do not call `action_actor(select)`, `action_editor(frameSelection)`, or `action_actor(focus)` unless explicitly needed. They are viewport convenience only; they do not create, save, or modify scene content and add token cost (especially `select` with many `actorIds`).

**Call them only when:**

- The user asks to select, focus, or frame something in the viewport.
- The immediate next MCP step depends on active editor selection (e.g. `...From: "selection.actorIds"`).
- `action_editor(captureScreenshot)` needs a composed viewport — frame first if required, then capture.

After create/edit workflows, stop at save + brief verification. Do not append automatic `select` → `frameSelection` tail steps.

## Token efficiency (cache-aware)

- Cache read scales with turn count × growing context. Every tool result stays in context and is re-sent on later turns. Minimise turns and payload size, not just final output length.
- Prefer one `run_script` for probe → discover → mutate → save when the task needs more than ~2 MCP steps. Intermediate results stay in the script environment; only `return` / `console.log` enters the model context.
- Read only tool schemas you will call. Do not pre-read `batch_execute`, geometry catalog, or extra `query_*` descriptors unless the plan needs them.
- `query_editor(getState)` already includes busy state — do not also call `getBusyState` unless you need a mid-task re-check after a long build or play-mode transition.
- Use direct `query_*` and `action_*` tools for single operations. Reserve `run_script` for genuine multi-step or loop workflows.
- Never pull full dumps when a slice suffices:
  - Use `query_actor(getTransform)` or `getDetails` with include/exclude for position/bounding box — not `getEditableProperties` unless you are editing those properties.
  - Never return full BufferGeometry JSON, full editable-property lists, or large `findActors` lists to the model when you only need one id or one scalar (e.g. ground top Y).
- `createMany` does not support `primitiveType`. For many mesh primitives, use one `run_script` loop of `action_actor(create, primitiveType=…)` + `action_scene(save)`, not chained per-actor tool calls from the model.
- Return minimal summaries after bulk work: `{ created, saved, counts }` — not per-actor full results.
- Do not read `genesysmcp://catalog/geometry-types` for basic `primitiveType` work (`cube`, `sphere`, `cone`, `cylinder`, `torus`, `capsule`).

## Current Scope (Phase 3)

| Tool | Operations |
|------|------------|
| `query_asset` | `find`, `getDetails`, `getAssetPackInfo` |
| `action_actor` | `select`, `focus`, `rename`, `create`, `createMany`, `duplicate`, `delete` *(destructive)*, `setTransform`, `reparent` |
| `action_component` | `add`, `setProperties`, `setEnabled` |
| `action_scene` | `open`, `save`, `setActive` |
| `action_editor` | `frameSelection`, `enterPlayMode`, `exitPlayMode`, `captureScreenshot` |
| `action_asset` | `createFolder`, `move`, `rename`, `delete` *(destructive)*, `import`, `installAssetPack` |
| `action_prefab` | `createFromActor`, `instantiate`, `apply`, `unpack` |
| `action_build` | `compile`, `buildProject`, `validatePrefabs`, `buildLightmap` |

**Planned later** — `query_diagnostics` validation/job providers (`validateProject`, `validateScene`, `validatePrefab`, `getLastJob`).

**Approval** — In `auto` mode the server auto-mints the token, so apply calls succeed without any `approval`/`approvalId`. Pass an optional `approval={summary}` for a clearer `prompt`-mode dialog and audit trail; `genesys_request_approval`/`approvalId` remain for pre-approval or token reuse. In `prompt` mode every apply triggers the Genesys editor UI.

**Undo** — `undoGroupId` on results; batch `undoGroupIds` on apply batches. Build, asset filesystem, prefab apply/unpack, and screenshots have no undo.

**Diagnostics** — `getBuildErrors` / `getConsole` are authoritative when connected. Unavailable diagnostics = unknown state, not success.

## Workflow Recipes

**Inspect scene** — `query_editor(getBusyState)` → `batch_execute(readOnly)` with `query_scene` + `query_actor`.

**Discover assets** — `query_asset(find)` → `getDetails`; avoid filesystem until MCP is unavailable.

**Register a new code class in the running editor** — after adding or updating a `@ENGINE.GameClass()`:

```text
edit TypeScript class
→ pnpm lint
→ action_build(action="buildProject")
→ query_editor(operation="getRegisteredClasses", filter="YourClass")
→ action_actor(action="create", className="GAME.YourClass", position=[...])
→ action_scene(action="save")
```

- `action_build` is a direct MCP tool. Do not probe or call it through `run_script` unless you are already doing a multi-step scripted workflow.
- `run_script(mode="readOnly")` cannot call apply actions such as `actionBuild`.
- A `query_editor(getRegisteredClasses)` result with `ok: true` and `classes: []` means no matching classes are loaded yet. Rebuild with `action_build(buildProject)` and query again.

**Edit actors/scene/prefabs** — `query_editor(getState)` (mandatory probe) → `getBusyState` → optional `dryRun` for destructive/ambiguous plans → `action_actor` / `action_component` / `batch_execute(apply)` (prefer MCP over `*.genesys-scene` edits) → `action_scene(save)` → re-query. Do not append `select` / `frameSelection` unless the user asked or the next step needs selection. In `auto` mode no approval is needed; add an optional `approval={summary}` for a clearer prompt-mode dialog, and use `genesys_request_approval`/`approvalId` only for pre-approval or token reuse.

**Spawn basic mesh primitives**

- **Single shape** — `query_editor(getState)` → `query_scene(findActors, query='ground', limit=5)` → `query_actor(getTransform)` on ground → `action_actor(create, primitiveType, position)` → `action_scene(save)`.
- **Many shapes (10+)** — one `run_script(apply)` that finds ground, computes placement in-script, loops `actionActor({ action: 'create', primitiveType, … })`, then `actionScene({ action: 'save' })`; return `{ created, saved, counts }` only.
- Use `primitiveType` for `cube`, `sphere`, `cone`, `cylinder`, `torus`, and `capsule`. Do not read `genesysmcp://catalog/geometry-types` for basic primitive work. Blockout/multi-primitive creates: one script, save, stop — no automatic viewport framing. Optional (user-requested only): `select` → `frameSelection`.

**Bulk spawn many actors** — for dozens or hundreds of similar objects (model URL, material, shadow flags, transforms), prefer one `action_actor(action="createMany", payload={...})` call instead of per-actor create/add/setProperties chains. Use `createMany` for model/material/component templates only; for primitive bulk use `run_script` + `primitiveType` create loop instead.

```text
query_editor(getState)
→ query_editor(getBusyState)
→ action_actor(action="createMany", dryRun=true, payload={ version: 1, templates: {...}, actors: [...] })
→ action_actor(action="createMany", payload={...})
→ action_scene(action="save")
```

- Put shared component defaults in `templates`; each `actors[]` entry only needs `key`, `template`, transform, and sparse overrides.
- Use `actors[].components` as an override object keyed by template component key when one instance needs different properties.
- Result returns `createdActors`, `createdComponents`, and `counts` for follow-up work without extra queries.

**Scene-visible component property edit** (materials, colours, component settings) — use this for per-scene/per-instance edits to editor-authored actors instead of `BeginPlay` hacks or runtime patch code:

```text
query_editor(getState)
→ query_editor(getBusyState)
→ query_scene(getSelection) or query_scene(findActors, query="…")
→ action_component(action="setProperties", actorId=…, properties={ materialPath: "@project/assets/materials/Foo.material.json" })
   — omit componentId to target the actor root component; use query_actor(getEditableProperties) only when editing a child component or you need current property names
→ action_scene(action="save")
→ re-query affected actor/component when needed
```

After `action_actor(action="create")`, the apply result includes `rootComponentId` so you can set root properties without a component lookup. For batched create + property flows, use `componentIdFrom: "createOp.affectedComponentIds.0"` only when targeting a non-root component; for root properties omit `componentId` entirely.

MCP-first properties include per-instance `materialPath`, material asset refs, visible colour/tint fields, mesh/model refs, light intensity/colour, camera settings, component `enabled` state (via `setEnabled`), and transforms (via `action_actor(setTransform)`). Do not write TypeScript solely to change these on a specific actor already in the scene; do use TypeScript when defining reusable class defaults, construction for runtime-spawned objects, or behaviour that should apply to every instance.

**Scene-visible component property edit** (materials, colours, component settings) — use this for per-scene/per-instance edits to editor-authored actors instead of `BeginPlay` hacks or runtime patch code:

```text
query_editor(getState)
→ query_editor(getBusyState)
→ query_scene(getSelection) or query_scene(findActors, query="…")
→ query_actor(getDetails) — resolve componentId and current property names
→ action_component(action="setProperties", componentId=…, properties={ materialPath: "@project/assets/materials/Foo.material.json" })
→ action_scene(action="save")
→ re-query affected actor/component
```

MCP-first properties include per-instance `materialPath`, material asset refs, visible colour/tint fields, mesh/model refs, light intensity/colour, camera settings, component `enabled` state (via `setEnabled`), and transforms (via `action_actor(setTransform)`). Do not write TypeScript solely to change these on a specific actor already in the scene; do use TypeScript when defining reusable class defaults, construction for runtime-spawned objects, or behaviour that should apply to every instance.

**After TypeScript edits** — normal file tools → `action_build(validatePrefabs)` if prefabs changed → `compile` or `buildProject` (both run the full `.dist` pipeline for now) → `getBusyState` → `query_diagnostics(getBuildErrors)` when authoritative.

| Build action | Use for |
|--------------|---------|
| `compile` | Full `.dist` pipeline (registers game classes) |
| `buildProject` | Same as `compile` today |
| `validatePrefabs` | Prefab JSON check (no editor IPC) |

Do not run `compile` then `buildProject` unless debugging a failure. MCP `buildProject` ≠ game `pnpm build-project`.

**Screenshot** — `action_editor(captureScreenshot)` returns storage keys, not inline image bytes.

## run_script API Discipline

- Inside `run_script`, the injected `genesys` API uses camelCase method names (`queryEditor`, `queryScene`, `queryProject`, `queryActor`, `queryAsset`, `queryDiagnostics`, `actionActor`, `actionComponent`, `actionScene`, `actionBuild`, `actionEditor`, `actionPrefab`, `actionAsset`).
- Snake_case names such as `query_project` and `action_actor` are direct MCP tool names, not methods on the `genesys` script object.
- Do not invent operations. Use documented operations from the tool schema or `genesysmcp://api/typescript` (for example, class registration checks belong to `queryEditor({ operation: "getRegisteredClasses", ... })`, not `queryProject(listGameClasses)`).
- Prefer direct `query_*`/`action_*` tools for one-off calls. Use `run_script` when you need shared script state across multiple steps.

## When To Use MCP Vs Code Editing

- MCP: live editor state, scenes, actors, prefabs, per-instance component properties, transforms, materials/colours assigned to scene objects, builds, and diagnostics.
- Normal tools: TypeScript/source files, reusable gameplay behaviour, class defaults, constructors for runtime-created objects, custom actor/component classes, input, networking, and UI logic.
- Mixed work: edit TypeScript for the reusable capability, build/register it, then use MCP to place or configure instances in the scene.
- Do not present MCP as available unless Connected or Probe-capable per the gate table, and the readiness probe succeeds for mutations.
- Only fall back to direct `*.genesys-scene` editing when MCP is off or the readiness probe reports blocked/unavailable.

## Batch Patterns

- `...From` dependency keys (e.g. `actorIdsFrom: "selection.actorIds"`).
- An explicit approval must cover every scope in an apply batch; `auto` mode derives scopes from the batch operations automatically.
- `failFast: false` for partial outcomes.

## Useful Resources

- `genesysmcp://guide/overview`, `genesysmcp://guide/safety`, `genesysmcp://guide/batching`
- `genesysmcp://editor/state`, `genesysmcp://project/manifest`, `genesysmcp://scene/summary`
- `genesysmcp://catalog/geometry-types` for mesh geometry labels and default parameters

## Safety Expectations

- Prefer token-efficient workflows: mutate, save, verify — skip `select` / `frameSelection` / `focus` unless the user requests viewport help or a follow-up step requires selection.
- Use dry-run before apply for destructive, broad, or ambiguous mutations; direct apply is acceptable for low-risk, fully specified actions in `auto` mode.
- For destructive deletes, prefer an explicit `approval={summary}` naming what is removed so `prompt`-mode dialogs and audit logs are clear.
- No actor/prefab mutations during play mode or reload.
- `enterPlayMode` may save/build first; check `getBusyState` before overlapping `action_build`.

## External IDE Testing

Enable the `genesys` MCP server in Cursor while the Genesys editor is open. Maintainers: see `packages/sdk/docs/mcp-external-client-smoke.md` in the Genesys SDK monorepo.
