# Planner Editor Bug Baseline

> Task: T-023 UE5 编辑器能力审计与 Bug 基线  
> Date: 2026-06-19  
> Owner: gpt-5/crgj  
> Scope: 创建、选择、多选、gizmo、拖放、Inspector、Outliner、热图、面板、菜单、保存加载。

## Severity

- P0: 阻断运行、编译、核心编辑链路，必须先修。
- P1: 高频操作明显不可靠或不符合编辑器预期。
- P2: 可用性缺口、交互不完整、体验欠佳。

## P0 Blockers

### BUG-001 PanelWrapper has a syntax error

- Severity: P0
- Area: 面板 / 布局
- File: `src/panels/PanelWrapper.tsx`
- Repro:
  1. Run `npm run typecheck`.
  2. Run `npm run lint`.
- Expected: TypeScript and ESLint complete cleanly.
- Actual:
  - `typecheck` fails with `src/panels/PanelWrapper.tsx(312,1): error TS1128: Declaration or statement expected.`
  - `lint` fails with a parsing error at the same file.
- Impact: Editor cannot be trusted as runnable; current `STATE.md` claim of clean typecheck/lint is stale.
- Related task: T-031 Panel Docking / Tabs / Layout Persistence
- Suggested fix: Remove duplicated stray drag code after `handleHeaderMouseDown`; re-run typecheck/lint before any other UI task.

### BUG-002 Core editor lint errors remain in scene/sim

- Severity: P0
- Area: 类型安全 / 后续修复风险
- Files:
  - `src/scene/Scene.tsx`
  - `src/scene/objects/CameraRig.tsx`
  - `src/scene/objects/LightFixture.tsx`
  - `src/scene/objects/SubjectMesh.tsx`
  - `src/sim/frustum.ts`
  - `src/sim/coverage.ts`
- Repro:
  1. Run `npm run lint`.
- Expected: No explicit `any` in editor-critical code.
- Actual: ESLint reports multiple `@typescript-eslint/no-explicit-any` errors.
- Impact: Selection, scene entity typing, and world-transform math are fragile; later fixes can silently break entity contracts.
- Related task: T-024 Core Editor Type Safety Cleanup
- Suggested fix: Type R3F events explicitly and replace `any[]` all-entity parameters with `AnyEntity[]`.

## P1 Core Workflow Bugs

### BUG-003 Drag-drop ignores the mouse hit point

- Severity: P1
- Status: Core fixed in working tree on 2026-06-19 by gpt-5/crgj
- Area: 创建 / 放置
- File: `src/io/dropTarget.ts`
- Repro:
  1. Drag Camera/Light/Subject from the toolbar to different locations in the viewport.
  2. Compare created object transforms.
- Expected: Entity appears at the pointer ground hit point; Shift should support surface placement.
- Actual: The code calls `addCamera/addLight/addSubject` without passing a transform; the file comment says v1 placement is fixed near origin.
- Impact: Scene layout is tedious and inaccurate; this is one of the biggest "not an editor yet" gaps.
- Related task: T-030 Content Browser / Place Actors
- Suggested fix: Move drop handling into a viewport-aware raycast path, or store pointer NDC during dragover and resolve ground hit inside R3F.
- Fix: Added R3F ground hit tracking through `setViewportDropPoint`; HTML drop now creates cameras/lights/subjects at the latest viewport ground point. Full Content Drawer remains open.

### BUG-004 Focus selected is documented but not implemented

- Severity: P1
- Status: Fixed in working tree on 2026-06-19 by gpt-5/crgj
- Area: 视口导航
- File: `src/io/useKeyboard.ts`
- Repro:
  1. Select an entity.
  2. Press `F`.
- Expected: Viewport camera frames selected entity, matching UE editor focus behavior.
- Actual: `F 聚焦` exists only in the comment; no key handler handles `f`.
- Impact: Users cannot quickly navigate to selected entities in larger scenes.
- Related task: T-026 Viewport Navigation 与 Camera Bookmarks
- Fix: Added store viewport commands and `UnrealControls` consumer; `F` focuses selected entity and `Home` resets the viewport camera; covered by `store.test.ts`.

### BUG-005 Projection switching only moves a perspective camera

- Severity: P1
- Area: 视口 / View Modes
- File: `src/scene/Scene.tsx`
- Repro:
  1. Press `2`, `3`, `4` or use View menu Top/Front/Side.
  2. Inspect viewport camera behavior.
- Expected: Orthographic top/front/side style views with stable framing and navigation semantics.
- Actual: Code comments state orthographic camera is deferred; it only changes perspective camera position.
- Impact: Orthographic editing, alignment, and array layout are not reliable.
- Related task: T-025 Viewport Toolbar 与 View Modes

### BUG-006 Gizmo does not disable viewport navigation while dragging

- Severity: P1
- Status: Core fixed in working tree on 2026-06-19 by gpt-5/crgj
- Area: Gizmo / Navigation
- File: `src/scene/Gizmo.tsx`, `src/scene/UnrealControls.tsx`
- Repro:
  1. Select an entity.
  2. Drag TransformControls while using mouse movement.
- Expected: Viewport controls are suspended during gizmo interaction.
- Actual: `TransformControls` calls update callbacks but there is no shared "isTransforming" flag for `UnrealControls`.
- Impact: Camera and object manipulation can conflict, especially with RMB/MMB state.
- Related task: T-027 Transform Gizmo 与 Snapping
- Fix: Added `view.isTransforming`; TransformControls sets it during drag and `UnrealControls` ignores navigation input while active.

### BUG-007 Parent hierarchy changes do not preserve world transform

- Severity: P1
- Area: Outliner / Details / Transform
- Files: `src/panels/Inspector.tsx`, `src/lib/math.ts`, `src/scene/Gizmo.tsx`
- Repro:
  1. Select an entity.
  2. Change its Parent in Details.
  3. Observe the entity transform in viewport.
- Expected: Either preserve world transform by default or clearly expose a keep/local transform mode.
- Actual: Parent ID is patched directly after `commitHistory`; no keep-world transform conversion is visible in the handler.
- Impact: Reparenting can make entities jump, breaking scene organization.
- Related task: T-028 Outliner 完整化, T-029 Details Panel 完整化

### BUG-008 NumberInput Escape cannot reliably restore the original edited value

- Severity: P1
- Area: Inspector / Numeric editing
- File: `src/ui/NumberInput.tsx`
- Repro:
  1. Double-click a numeric field.
  2. Type a new valid value; it writes through on every change.
  3. Press Escape.
- Expected: Escape restores the value from before editing began.
- Actual: Escape calls `onChange(value, false)`, but `value` is the current prop and may already reflect the edited value.
- Impact: Details panel violates standard editor editing expectations.
- Related task: T-029 Details Panel 完整化

### BUG-009 Delete only removes the last selected entity

- Severity: P1
- Status: Fixed in working tree on 2026-06-19 by gpt-5/crgj
- Area: Selection / Keyboard / Outliner
- File: `src/io/useKeyboard.ts`
- Repro:
  1. Multi-select multiple entities.
  2. Press Delete or Backspace.
- Expected: All selected entities are deleted, with one undo step.
- Actual: Only `selection[selection.length - 1]` is removed.
- Impact: Multi-select is incomplete and confusing.
- Related task: T-025 Selection/Gizmo consistency, T-028 Outliner 完整化
- Fix: Added `removeEntities(ids)` in `src/state/store.ts`; Delete/Backspace now removes all selected entities in one undo step; covered by `store.test.ts`.

### BUG-010 Outliner delete is one-click destructive

- Severity: P1
- Area: Outliner
- File: `src/panels/Outline.tsx`
- Repro:
  1. Hover an entity row.
  2. Click the delete icon.
- Expected: Delete is available via keyboard or context menu, with clear undo behavior; destructive affordance should not be accidental.
- Actual: A small hover icon removes immediately.
- Impact: Accidental deletes are likely in dense editor UI.
- Related task: T-028 Outliner 完整化, T-033 Message Log / Undo History

## P2 Usability and Completeness Bugs

### BUG-011 Menu actions use blocking alert/confirm

- Severity: P2
- Area: Menu / Feedback
- File: `src/panels/MenuBar.tsx`
- Repro:
  1. Use File > Clear Scene or export error paths.
- Expected: UE-style non-blocking message log/status feedback, with modal only for real destructive confirmation.
- Actual: `alert` and `confirm` are used directly.
- Impact: Editor flow is interrupted and cannot be logged or tested well.
- Related task: T-033 Message Log / Output Log / Undo History

### BUG-012 Save/Open scene is missing from File menu

- Severity: P2
- Area: File workflow
- File: `src/panels/MenuBar.tsx`
- Repro:
  1. Open File menu.
- Expected: New, Open, Save, Save As, Autosave/Recovery status.
- Actual: File menu exposes transforms export, COLMAP placeholder, and clear scene.
- Impact: The editor cannot be used for persistent scene authoring.
- Related task: T-035 Save/Load/Autosave/Recovery

### BUG-013 Toolbar is not a UE-style Place Actors or Content Browser

- Severity: P2
- Area: Asset placement
- File: `src/panels/Toolbar.tsx`
- Repro:
  1. Inspect top toolbar.
- Expected: Dedicated Place Actors/Content drawer with categories, search, presets, and drag preview.
- Actual: A row of text buttons in the top header.
- Impact: Placement does not scale beyond a few primitives.
- Related task: T-030 Content Browser / Place Actors

### BUG-014 StatsBar computes synchronously in render path

- Severity: P2
- Area: Performance
- File: `src/panels/StatsBar.tsx`
- Repro:
  1. Add multiple cameras/subjects.
  2. Move transforms rapidly.
- Expected: Debounced or async evaluation, disabled when hidden, visible "calculating" state.
- Actual: `coverageOf`, `overlapOf`, `exposureOf` run in `useMemo` on scene changes.
- Impact: Larger scenes can still make editing feel sticky even with grid=16.
- Related task: T-036 Performance & Async Evaluation

### BUG-015 Layout is not persisted

- Severity: P2
- Area: Layout
- Files: `src/state/store.ts`, `src/panels/PanelWrapper.tsx`
- Repro:
  1. Move/dock/collapse panels.
  2. Reload page.
- Expected: Layout restores from persisted editor preferences.
- Actual: Store initializes from hardcoded defaults.
- Impact: Users lose workspace customization.
- Related task: T-031 Panel Docking / Tabs / Layout Persistence, T-032 Editor Preferences

## Command Results

```bash
npm run typecheck
# failed: src/panels/PanelWrapper.tsx(312,1): error TS1128

npm run lint
# failed: 12 errors, 1 warning
```

## First Fix Order

1. BUG-001: repair `PanelWrapper.tsx` syntax so the app can compile.
2. BUG-002: finish T-024 type cleanup.
3. BUG-003 and BUG-004: fix placement and focus navigation.
4. BUG-006 and BUG-009: stabilize gizmo/navigation conflict and multi-selection delete.
5. BUG-012: implement minimum save/load before any more export work.
