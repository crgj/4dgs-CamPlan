# UE5 Editor Gap Plan

> Task: T-023 UE5 编辑器能力审计与 Bug 基线  
> Date: 2026-06-19  
> Owner: gpt-5/crgj  
> Purpose: 把 Unreal Editor 5 的核心编辑器能力拆成 Planner 可执行升级路径。

## Target Baseline

Planner should behave like a focused UE5-style 4DGS capture editor, not a demo page. The target is not to clone Unreal Engine wholesale; the target is to import the editor patterns that make authoring reliable:

- deterministic viewport navigation
- clear modes and view modes
- robust placement and selection
- trustworthy Details and Outliner
- persistent layout and files
- non-blocking logs
- performance isolation for heavy evaluation

## Gap Matrix

| UE5 area | UE5 capability to emulate | Current Planner state | Gap | Task |
|---|---|---|---|---|
| Level Editor shell | Menu, toolbar, viewport center, docked panels, status/log surfaces | Has MenuBar, Toolbar, Scene, panels | Layout compile error; no durable workspace model | T-031 |
| Viewport Toolbar | Per-viewport mode controls and visualization menus | Menu-level projection toggles only | Missing in-viewport toolbar and view mode menu | T-025 |
| View Modes | Lit/Wireframe/visual diagnostics | Coverage heatmap toggle only | Missing wireframe, bounds, camera frustum, evaluation modes | T-025 |
| Viewport Controls | RMB/MMB/wheel navigation, configurable speed/sensitivity | Custom UnrealControls exists | Missing focus selected, bookmarks, preferences, orthographic view semantics | T-026 |
| Transform Tools | W/E/R, local/world, snapping, pivot, stable undo | TransformControls exists | No local/world UI, no transform-active gating, snap is too coarse | T-027 |
| Outliner | Tree, search/filter, select, attach, columns, context actions | Tree-ish Outline exists | Missing lock, right-click menu, type filters, robust reparent/selection sync | T-028 |
| Details | Categories, property search, reset, multi-select mixed values, lock | Inspector exists | Missing multi-select, search, reset, reliable Escape/commit behavior | T-029 |
| Content Browser / Place Actors | Asset and actor placement with search/categories | Top text-button Toolbar | Missing content drawer model, presets, drag preview, raycast placement | T-030 |
| Docking / Tabs | Dock, tab, float, layout reset, multiple panels | PanelWrapper attempted | Syntax broken; no persistence; no tab model | T-031 |
| Editor Preferences | Viewport controls, look/feel, snapping, language | A few store fields | No preferences panel or persistence | T-032 |
| Message / Output Log | Non-blocking errors and operation feedback | Alert/confirm | No log state, no status event stream | T-033 |
| World Settings | Environment and project-level settings | Env shown when no selection | Missing dedicated world settings and thresholds editor | T-034 |
| Save/Load | New/Open/Save/Save As, autosave, recovery | Store has load/reset only | No serializer UI, dirty state, autosave, recovery | T-035 |
| Performance | Heavy tasks async/debounced with status | Sync `useMemo` evaluation | No worker/idle scheduling or quality modes | T-036 |
| Editor E2E | Real workflow tests | Unit tests mostly | No Playwright editor-core coverage | T-037 |
| 4DGS Workspace | Domain-specific panels in editor shell | sim/export pieces exist | No cohesive capture workspace | T-038 |

## Phase 4.5 Execution Slices

### Slice A: Make the editor compile and expose true baseline

- T-023: Finish bug/gap docs.
- T-024: Remove `any` and restore type/lint cleanliness.
- Direct blocker: `PanelWrapper.tsx` syntax error must be fixed before any UI verification.

Exit criteria:

- `npm run typecheck` passes.
- `npm run lint` passes or has only accepted warnings.
- Bug list is linked to concrete tasks.

### Slice B: Fix the core manipulation loop

- T-025: Add viewport toolbar and real view modes.
- T-026: Add focus selected, Home reset, camera bookmarks, preference-ready camera controls.
- T-027: Fix gizmo/navigation conflict, local/world, snapping, undo behavior.

Exit criteria:

- Place entity -> select -> focus -> transform -> undo works reliably.
- View mode changes do not break selection or camera controls.

### Slice C: Fix editor data surfaces

- T-028: Outliner complete enough for hierarchy authoring.
- T-029: Details complete enough for precise editing.
- T-030: Content Browser / Place Actors replaces top text-button placement.

Exit criteria:

- Outliner, viewport, and Details always agree on selected data.
- Dragging a new actor lands at the expected viewport point.
- Multi-select has predictable delete, duplicate, and Details behavior.

### Slice D: Make the workspace durable

- T-031: Dock/tabs/layout persistence.
- T-032: Editor Preferences.
- T-033: Message Log / Output Log / Undo History.
- T-034: World Settings.
- T-035: Save/Load/Autosave/Recovery.

Exit criteria:

- User can customize layout, save a scene, reload, and recover work.
- Errors and warnings go to a log/status surface instead of blocking alerts.

### Slice E: Make heavy evaluation editor-safe

- T-036: Performance & async evaluation.
- T-037: Editor core E2E.
- T-038: 4DGS Capture Workspace.

Exit criteria:

- Moving objects does not freeze the editor.
- Playwright covers the real authoring loop.
- 4DGS-specific tools live inside the stable editor shell.

## Deprioritized Until Editor Baseline Is Stable

- T-018 COLMAP export
- T-019 capture list generation
- T-022 full export smoke flow

T-020 scene serialization is pulled forward through T-035 because save/load is an editor requirement, not just an export feature.

## Immediate Next Task Recommendation

Start T-024, but repair the `PanelWrapper.tsx` syntax blocker as the first sub-step. Without that, typecheck/lint cannot verify the rest of the cleanup.
