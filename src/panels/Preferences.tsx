/**
 * T-032 Editor Preferences（src/panels/Preferences.tsx）。
 * UE 风 modal overlay：导航速度/鼠标灵敏度/反转滚轮/默认投影/吸附步长/字体缩放/语言。
 * 设置写入 store.preferences 并持久化到 localStorage（即时生效）。
 */
import { useEffect } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import { NumberInput } from '@/ui/NumberInput';
import { readPrefs } from '@/io/sceneFiles';

/** 属性行（模块级组件，避免 render 内创建组件的 lint 警告）。 */
function PrefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[var(--row-h)] items-center gap-3 px-3 py-1">
      <span className="w-40 shrink-0 text-[11px] text-[var(--color-text-dim)]">{label}</span>
      <div className="flex flex-1 items-center">{children}</div>
    </div>
  );
}

export function Preferences() {
  const { locale } = useTranslation();
  const setLocale = usePlanner((s) => s.setLocale);
  const preferences = usePlanner((s) => s.preferences);
  const setPreferences = usePlanner((s) => s.setPreferences);
  const setActiveOverlay = usePlanner((s) => s.setActiveOverlay);
  const snapStep = usePlanner((s) => s.view.snapStep);

  // —— 初始从 localStorage 恢复偏好 ——
  useEffect(() => {
    const saved = readPrefs(preferences);
    setPreferences(saved);
    // 仅初始化用，不依赖 preferences 避免循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 偏好变更即持久化（store.setPreferences 内部已 writePrefs，这里只派发）
  const update = (patch: Parameters<typeof setPreferences>[0]) => {
    setPreferences(patch);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={() => setActiveOverlay(null)}
    >
      <div
        className="w-[480px] max-h-[80vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-panel-border)] bg-[var(--color-panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-9 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-header)] px-3">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-text)]">
            {locale === 'zh' ? '编辑器偏好设置' : 'Editor Preferences'}
          </span>
          <button
            type="button"
            onClick={() => setActiveOverlay(null)}
            className="text-[14px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            ✕
          </button>
        </div>

        <div className="py-2">
          <SectionTitle>{locale === 'zh' ? '视口导航' : 'Viewport Navigation'}</SectionTitle>
          <PrefRow label={locale === 'zh' ? '鼠标灵敏度' : 'Mouse Sensitivity'}>
            <NumberInput
              value={preferences.mouseSensitivity}
              onCommitHistory={() => undefined}
              onChange={(v) => update({ mouseSensitivity: v })}
              min={0.1}
              max={5}
              step={0.1}
              precision={1}
              className="flex-1"
            />
          </PrefRow>
          <PrefRow label={locale === 'zh' ? '反转滚轮缩放' : 'Invert Zoom'}>
            <input
              type="checkbox"
              checked={preferences.invertZoom}
              onChange={(e) => update({ invertZoom: e.target.checked })}
            />
          </PrefRow>
          <PrefRow label={locale === 'zh' ? '默认投影' : 'Default Projection'}>
            <select
              className="h-6 flex-1 rounded-sm border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-1 text-[11px] text-[var(--color-text)]"
              value={preferences.defaultProjection}
              onChange={(e) => update({ defaultProjection: e.target.value as typeof preferences.defaultProjection })}
            >
              <option value="perspective">Perspective</option>
              <option value="top">Top</option>
              <option value="front">Front</option>
              <option value="side">Side</option>
            </select>
          </PrefRow>

          <SectionTitle>{locale === 'zh' ? '变换吸附' : 'Transform Snapping'}</SectionTitle>
          <PrefRow label={locale === 'zh' ? '吸附步长 (米)' : 'Snap Step (m)'}>
            <NumberInput
              value={snapStep}
              onCommitHistory={() => undefined}
              onChange={(v) => usePlanner.getState().setViewSnapStep(v)}
              min={0.01}
              step={0.05}
              precision={2}
              suffix="m"
              className="flex-1"
            />
          </PrefRow>

          <SectionTitle>{locale === 'zh' ? '外观' : 'Appearance'}</SectionTitle>
          <PrefRow label={locale === 'zh' ? '字体缩放' : 'Font Scale'}>
            <NumberInput
              value={preferences.fontScale}
              onCommitHistory={() => undefined}
              onChange={(v) => update({ fontScale: v })}
              min={0.7}
              max={1.6}
              step={0.05}
              precision={2}
              className="flex-1"
            />
          </PrefRow>
          <PrefRow label={locale === 'zh' ? '高对比主题' : 'High Contrast'}>
            <input
              type="checkbox"
              checked={preferences.highContrast}
              onChange={(e) => update({ highContrast: e.target.checked })}
            />
          </PrefRow>

          <SectionTitle>{locale === 'zh' ? '地面网格' : 'Ground Grid'}</SectionTitle>
          <PrefRow label={locale === 'zh' ? '大格间距 (米)' : 'Major Spacing (m)'}>
            <NumberInput
              value={preferences.gridSectionSize}
              onCommitHistory={() => undefined}
              onChange={(v) => update({ gridSectionSize: v })}
              min={0.25}
              max={10}
              step={0.25}
              precision={2}
              suffix="m"
              className="flex-1"
            />
          </PrefRow>
          <PrefRow label={locale === 'zh' ? '主线宽度' : 'Major Line Width'}>
            <NumberInput
              value={preferences.gridSectionThickness}
              onCommitHistory={() => undefined}
              onChange={(v) => update({ gridSectionThickness: v })}
              min={0.2}
              max={3}
              step={0.1}
              precision={1}
              className="flex-1"
            />
          </PrefRow>
          <PrefRow label={locale === 'zh' ? '辅助线颜色' : 'Minor Line Color'}>
            <input
              type="color"
              value={preferences.gridCellColor}
              onChange={(e) => update({ gridCellColor: e.target.value })}
              className="h-6 w-10 rounded-sm border border-[var(--color-panel-border)] bg-[var(--color-recessed)]"
            />
            <span className="ml-2 font-mono text-[11px] text-[var(--color-text-dim)]">
              {preferences.gridCellColor}
            </span>
          </PrefRow>
          <PrefRow label={locale === 'zh' ? '主线颜色' : 'Major Line Color'}>
            <input
              type="color"
              value={preferences.gridSectionColor}
              onChange={(e) => update({ gridSectionColor: e.target.value })}
              className="h-6 w-10 rounded-sm border border-[var(--color-panel-border)] bg-[var(--color-recessed)]"
            />
            <span className="ml-2 font-mono text-[11px] text-[var(--color-text-dim)]">
              {preferences.gridSectionColor}
            </span>
          </PrefRow>

          {/* #WDD-gpt 2026-06-21 - 辅助圆环带半径（取代原 XY 标尺十字） */}
          <PrefRow label={locale === 'zh' ? '参考圆环半径 (米)' : 'Guide Ring Radius (m)'}>
            <NumberInput
              value={preferences.guideRingRadius}
              onCommitHistory={() => undefined}
              onChange={(v) => update({ guideRingRadius: v })}
              min={0.25}
              max={20}
              step={0.25}
              precision={2}
              suffix="m"
              className="flex-1"
            />
          </PrefRow>

          <SectionTitle>{locale === 'zh' ? '语言' : 'Language'}</SectionTitle>
          <PrefRow label={locale === 'zh' ? '界面语言' : 'Interface Language'}>
            <select
              className="h-6 flex-1 rounded-sm border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-1 text-[11px] text-[var(--color-text)]"
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'zh' | 'en')}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </PrefRow>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-panel-border)] px-3 py-2">
          <button
            type="button"
            onClick={() => setActiveOverlay(null)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-4 py-1 text-[11px] text-[var(--color-text)] hover:bg-[var(--color-panel-raised)]"
          >
            {locale === 'zh' ? '完成' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 border-y border-[var(--color-panel-border)] bg-[var(--color-panel-header)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-dim)]">
      {children}
    </div>
  );
}
