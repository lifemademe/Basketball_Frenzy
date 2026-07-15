# Compact-Hidden Tools Reference

> **Generated** — do not edit by hand. Run `pnpm --filter @gnsx/genesys.sdk generate:mcp-docs`.

These tools are **not** first-class MCP tools in compact mode (the default). They are fully accessible through `run_script` (`genesys.*` API) or `batch_execute` (`tool:` field). Do **not** call `describe_tool` or `search_tools` for these tools before dispatching a known operation — go straight to the call.

| Tool | Kind | Operations |
| --- | --- | --- |
| `action_asset` | `action` | `createFolder`, `createMaterial`, `delete`, `import`, `installAssetPack`, `move`, `rename` |
| `action_component` | `action` | `add`, `setEnabled`, `setProperties` |
| `action_prefab` | `action` | `apply`, `createFromActor`, `instantiate`, `unpack` |
| `query_asset` | `query` | `find`, `getDetails`, `getAssetPackInfo` |
| `query_diagnostics` | `query` | `getBuildErrors`, `getConsole` |

### `action_asset`

**Action Asset** · kind: `action`

Perform project asset filesystem actions. Requires `action`. Operations: createFolder, createMaterial, move, rename, delete (destructive), import, installAssetPack.

**Operations:** `createFolder`, `createMaterial`, `delete` *(destructive)*, `import`, `installAssetPack`, `move`, `rename`

**Dispatch via `run_script`:**

```js
genesys.actionAsset({ action: 'createFolder', ... })
```

**Dispatch via `batch_execute`:**

```text
{ tool: "action_asset", args: { action: "createFolder", ... } }
```

### `action_component`

**Action Component** · kind: `action`

Perform component actions. Requires `action` and `actorId`. Operations: add, setProperties, setEnabled.

**Operations:** `add` *(undoable)*, `setEnabled` *(undoable)*, `setProperties` *(undoable)*

**Dispatch via `run_script`:**

```js
genesys.actionComponent({ action: 'add', ... })
```

**Dispatch via `batch_execute`:**

```text
{ tool: "action_component", args: { action: "add", ... } }
```

### `action_prefab`

**Action Prefab** · kind: `action`

Create prefab assets from scene actors or instantiate prefabs into the active scene. Requires `action`. Operations: createFromActor, instantiate, apply, unpack.

**Operations:** `apply`, `createFromActor`, `instantiate` *(undoable)*, `unpack`

**Dispatch via `run_script`:**

```js
genesys.actionPrefab({ action: 'apply', ... })
```

**Dispatch via `batch_execute`:**

```text
{ tool: "action_prefab", args: { action: "apply", ... } }
```

### `query_asset`

**Query Asset** · kind: `query`

Preferred MCP tool for listing and inspecting project assets and asset-pack assets. Requires `operation`. It does not index engine @engine/... assets; discover those from known engine paths or filesystem/manifests. Operations: find, getDetails, getAssetPackInfo. Use find with assetType scene for scene files; results use project-relative forward-slash paths.

**Operations:** `find`, `getDetails`, `getAssetPackInfo`

**Dispatch via `run_script`:**

```js
genesys.queryAsset({ operation: 'find', ... })
```

**Dispatch via `batch_execute`:**

```text
{ tool: "query_asset", args: { operation: "find", ... } }
```

### `query_diagnostics`

**Query Diagnostics** · kind: `query`

Read project and editor diagnostics. Requires `operation`. Unavailable providers return explicit non-authoritative payloads. Operations: getBuildErrors, getConsole, validateProject, validateScene, validatePrefab, getLastJob.

**Operations:** `getBuildErrors`, `getConsole`

**Dispatch via `run_script`:**

```js
genesys.queryDiagnostics({ operation: 'getBuildErrors', ... })
```

**Dispatch via `batch_execute`:**

```text
{ tool: "query_diagnostics", args: { operation: "getBuildErrors", ... } }
```
