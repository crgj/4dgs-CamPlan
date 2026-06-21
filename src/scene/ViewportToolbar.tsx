/**
 * 视口左上工具条（src/scene/ViewportToolbar.tsx）。
 * UE5.8 Viewport Toolbar：投影 / View Mode(Lit/Wireframe/Bounds) / 覆盖热图 / 视锥 /
 *   变换模式(W/E/R) / 坐标系(世界/局部) / 吸附 + 步长（T-027）。
 */
import { useState } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';

const viewLabelKeys = {
  perspective: 'Perspective',
  top: 'Top',
  front: 'Front',
  side: 'Side',
} as const;

const viewModes = ['lit', 'wireframe', 'bounds'] as const;

export function ViewportToolbar() {
  const [collapsed, setCollapsed] = useState(false);
  const { t, locale } = useTranslation();
  const projection = usePlanner((s) => s.view.projection);
  const setProjection = usePlanner((s) => s.setProjection);
  const showCoverageHeatmap = usePlanner((s) => s.view.showCoverageHeatmap);
  const toggleCoverageHeatmap = usePlanner((s) => s.toggleCoverageHeatmap);
  const showFrustums = usePlanner((s) => s.view.showFrustums);
  const toggleFrustums = usePlanner((s) => s.toggleFrustums);
  const showGuides = usePlanner((s) => s.view.showGuides);
  const toggleGuides = usePlanner((s) => s.toggleGuides);
  const showViewportHud = usePlanner((s) => s.view.showViewportHud);
  const toggleViewportHud = usePlanner((s) => s.toggleViewportHud);

  // T-025 View Modes
  const viewMode = usePlanner((s) => s.viewMode);
  const setViewMode = usePlanner((s) => s.setViewMode);

  // T-027 变换模式 + 坐标系
  const transformMode = usePlanner((s) => s.view.transformMode);
  const setTransformMode = usePlanner((s) => s.setTransformMode);
  const gizmoSpace = usePlanner((s) => s.gizmoSpace);
  const setGizmoSpace = usePlanner((s) => s.setGizmoSpace);

  // T-027 吸附 + 步长
  const snapToGrid = usePlanner((s) => s.view.snapToGrid);
  const toggleSnap = usePlanner((s) => s.toggleSnap);
  const snapStep = usePlanner((s) => s.view.snapStep);
  const setSnapStep = usePlanner((s) => s.setSnapStep);

  // 组合隔离编辑面包屑
  const editingGroupId = usePlanner((s) => s.editingGroupId);
  const editingGroupName = usePlanner((s) =>
    s.editingGroupId ? (s.scene.groups ?? []).find((g) => g.id === s.editingGroupId)?.name ?? null : null,
  );
  const exitGroupEdit = usePlanner((s) => s.exitGroupEdit);

  const modeBtn = (mode: typeof transformMode, label: string) => (
    <button
      type="button"
      onClick={() => setTransformMode(mode)}
      className={`h-5 w-5 rounded-[var(--radius-sm)] border text-[10px] font-bold ${
        transformMode === mode
          ? 'border-[var(--color-accent)] bg-[var(--color-select-fill)] text-[var(--color-text)]'
          : 'border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
      }`}
      title={`${mode} (W/E/R)`}
    >
      {label}
    </button>
  );

  const toggleBtn = (
    active: boolean,
    onClick: () => void,
    label: string,
    title: string,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`h-5 rounded-[var(--radius-sm)] border px-1.5 text-[10px] ${
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-select-fill)] text-[var(--color-text)]'
          : 'border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
      }`}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <>
    {/* 组合隔离编辑面包屑（editing 模式下顶部居中显示） */}
    {editingGroupId && (
      <div className="pointer-events-auto absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[rgba(30,30,30,0.92)] px-3 py-1 text-[11px] text-[var(--color-text)] shadow-lg backdrop-blur">
        <span className="text-[var(--color-text-dim)]">{locale === 'zh' ? '主场景' : 'Main Scene'}</span>
        <span className="text-[var(--color-text-faint)]">/</span>
        <span className="font-semibold text-[var(--color-accent)]">{editingGroupName ?? '组合'}</span>
        <span className="ml-1 rounded bg-[var(--color-accent)] px-2 py-0.5 text-[10px] text-white hover:opacity-90">
          <button type="button" onClick={exitGroupEdit} title={locale === 'zh' ? '退出组合编辑 (Esc)' : 'Exit group edit (Esc)'}>
            {locale === 'zh' ? '退出编辑' : 'Exit'}
          </button>
        </span>
      </div>
    )}
    {collapsed ? (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="viewport-toolbar pointer-events-auto absolute left-2 top-2 z-20 h-6 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[rgba(30,30,30,0.82)] px-2 text-[10px] text-[var(--color-text-dim)] backdrop-blur hover:text-[var(--color-text)]"
        title={locale === 'zh' ? '展开视口工具条' : 'Expand viewport toolbar'}
      >
        {locale === 'zh' ? '工具' : 'Tools'}
      </button>
    ) : (
    <div className="viewport-toolbar pointer-events-auto absolute left-2 top-2 z-20 flex max-w-[calc(100%-10rem)] flex-wrap items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[rgba(30,30,30,0.78)] px-1 py-0.5 text-[10px] text-[var(--color-text-dim)] backdrop-blur">
      {/* #WDD-gpt  2026-06-20 - 视口工具条支持收起，减少浮动 UI 对主视口内容的遮挡 */}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className="h-5 w-5 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        title={locale === 'zh' ? '收起视口工具条' : 'Collapse viewport toolbar'}
      >
        -
      </button>
      <select
        value={projection}
        onChange={(e) => setProjection(e.target.value as typeof projection)}
        className="h-5 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-1 text-[10px] text-[var(--color-text)] outline-none"
        title="Viewport projection (1/2/3/4)"
      >
        {Object.keys(viewLabelKeys).map((value) => (
          <option key={value} value={value}>
            {t(value === 'perspective' ? 'perspective' : value === 'top' ? 'topView' : value === 'front' ? 'frontView' : 'sideView')}
          </option>
        ))}
      </select>

      <div className="mx-0.5 h-3 w-px bg-[var(--color-panel-border)]" />

      {/* T-025 View Mode */}
      <select
        value={viewMode}
        onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
        className="h-5 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-1 text-[10px] text-[var(--color-text)] outline-none"
        title="View mode"
      >
        {viewModes.map((m) => (
          <option key={m} value={m}>
            {t(m)}
          </option>
        ))}
      </select>

      <div className="mx-0.5 h-3 w-px bg-[var(--color-panel-border)]" />

      {/* T-027 变换模式 */}
      {modeBtn('translate', 'W')}
      {modeBtn('rotate', 'E')}
      {modeBtn('scale', 'R')}

      {/* T-027 世界/局部坐标系 */}
      <button
        type="button"
        onClick={() => setGizmoSpace(gizmoSpace === 'world' ? 'local' : 'world')}
        className={`h-5 rounded-[var(--radius-sm)] border px-1.5 text-[10px] ${
          gizmoSpace === 'local'
            ? 'border-[var(--color-accent)] bg-[var(--color-select-fill)] text-[var(--color-text)]'
            : 'border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
        }`}
        title="World / Local coordinate space"
      >
        {gizmoSpace === 'world' ? t('world') : t('local')}
      </button>

      <div className="mx-0.5 h-3 w-px bg-[var(--color-panel-border)]" />

      {/* T-027 吸附 + 步长 */}
      {toggleBtn(snapToGrid, toggleSnap, t('snap'), 'Toggle grid snapping (G)')}
      <input
        type="number"
        value={snapStep}
        onChange={(e) => setSnapStep(Math.max(0.01, Number(e.target.value)))}
        step={0.05}
        min={0.01}
        className={`h-5 w-12 rounded-[var(--radius-sm)] border bg-[var(--color-recessed)] px-1 text-[10px] text-[var(--color-text)] outline-none ${
          snapToGrid ? 'border-[var(--color-accent)]' : 'border-[var(--color-panel-border)]'
        }`}
        title="Snap step (m)"
      />

      <div className="mx-0.5 h-3 w-px bg-[var(--color-panel-border)]" />

      {/* 可视化开关 */}
      {toggleBtn(showCoverageHeatmap, toggleCoverageHeatmap, t('coverage'), 'Coverage heatmap (Space)')}
      {toggleBtn(showFrustums, toggleFrustums, t('frustums'), 'Camera frustums')}
      {toggleBtn(showGuides, toggleGuides, t('guides'), 'Guides & dimension labels')}
      {toggleBtn(showViewportHud, toggleViewportHud, t('hud'), 'Viewport information HUD')}
    </div>
    )}
    </>
  );
}
