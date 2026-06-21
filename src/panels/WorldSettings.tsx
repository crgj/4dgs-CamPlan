/**
 * T-034 World Settings（src/panels/WorldSettings.tsx）。
 * UE 风 modal overlay：评估阈值（覆盖/重叠/baseline/曝光）+ 单位说明。
 * 阈值写入 store.thresholds，驱动 StatsBar 告警与热图。
 */
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import { NumberInput } from '@/ui/NumberInput';

/** 属性行（模块级组件）。 */
function WsRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[var(--row-h)] items-center gap-3 px-3 py-1">
      <span className="w-44 shrink-0 text-[11px] text-[var(--color-text-dim)]">{label}</span>
      <div className="flex flex-1 items-center">{children}</div>
    </div>
  );
}

export function WorldSettings() {
  const { locale } = useTranslation();
  const thresholds = usePlanner((s) => s.thresholds);
  const setThresholds = usePlanner((s) => s.setThresholds);
  const setActiveOverlay = usePlanner((s) => s.setActiveOverlay);
  const scene = usePlanner((s) => s.scene);
  const commitHistory = usePlanner((s) => s.commitHistory);
  // #WDD-gpt 2026-06-21 - 视锥可视化长度（编辑器偏好，已随 setPreferences 持久化）
  const frustumDrawDistance = usePlanner((s) => s.preferences.frustumDrawDistance);
  const setPreferences = usePlanner((s) => s.setPreferences);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={() => setActiveOverlay(null)}
    >
      <div
        className="w-[520px] max-h-[80vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-panel-border)] bg-[var(--color-panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-9 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-header)] px-3">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-text)]">
            {locale === 'zh' ? '世界设置' : 'World Settings'}
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
          <SectionTitle>{locale === 'zh' ? '评估阈值（采集质量告警）' : 'Evaluation Thresholds'}</SectionTitle>
          <WsRow label={locale === 'zh' ? '最小覆盖数' : 'Min Coverage'}>
            <NumberInput
              value={thresholds.minCoverage}
              onCommitHistory={commitHistory}
              onChange={(v, hist) => setThresholds({ minCoverage: v }, hist)}
              min={1}
              step={1}
              precision={0}
              suffix={locale === 'zh' ? '视角' : 'views'}
              className="flex-1"
            />
          </WsRow>
          <WsRow label={locale === 'zh' ? '最小重叠率' : 'Min Overlap'}>
            <NumberInput
              value={thresholds.minOverlap}
              onCommitHistory={commitHistory}
              onChange={(v, hist) => setThresholds({ minOverlap: v }, hist)}
              min={0}
              max={1}
              step={0.05}
              precision={2}
              className="flex-1"
            />
          </WsRow>
          <WsRow label={locale === 'zh' ? '基线下限 (米)' : 'Min Baseline (m)'}>
            <NumberInput
              value={thresholds.baselineRange[0]}
              onCommitHistory={commitHistory}
              onChange={(v, hist) =>
                setThresholds({ baselineRange: [v, thresholds.baselineRange[1]] }, hist)
              }
              min={0}
              step={0.1}
              precision={2}
              suffix="m"
              className="flex-1"
            />
          </WsRow>
          <WsRow label={locale === 'zh' ? '基线上限 (米)' : 'Max Baseline (m)'}>
            <NumberInput
              value={thresholds.baselineRange[1]}
              onCommitHistory={commitHistory}
              onChange={(v, hist) =>
                setThresholds({ baselineRange: [thresholds.baselineRange[0], v] }, hist)
              }
              min={0}
              step={0.5}
              precision={2}
              suffix="m"
              className="flex-1"
            />
          </WsRow>
          <WsRow label={locale === 'zh' ? '最大曝光极差 (EV)' : 'Max Exposure Spread (EV)'}>
            <NumberInput
              value={thresholds.maxExposureSpread}
              onCommitHistory={commitHistory}
              onChange={(v, hist) => setThresholds({ maxExposureSpread: v }, hist)}
              min={0}
              step={0.1}
              precision={2}
              suffix="EV"
              className="flex-1"
            />
          </WsRow>

          {/* #WDD-gpt 2026-06-21 - 视口可视化设置：视锥绘制远端长度 */}
          <SectionTitle>{locale === 'zh' ? '视口可视化' : 'Viewport Visualization'}</SectionTitle>
          <WsRow label={locale === 'zh' ? '视锥绘制长度 (米)' : 'Frustum Draw Distance (m)'}>
            <NumberInput
              value={frustumDrawDistance}
              onCommitHistory={commitHistory}
              onChange={(v) => setPreferences({ frustumDrawDistance: Math.max(0.5, v) })}
              min={0.5}
              max={100}
              step={0.5}
              precision={2}
              suffix="m"
              className="flex-1"
            />
          </WsRow>
          <div className="px-3 pb-1 text-[10px] leading-relaxed text-[var(--color-text-dim)]">
            {locale === 'zh'
              ? '相机视锥线框的远端距离，独立于相机真实裁剪远平面（避免画出超长锥）。'
              : 'Visual far-end length of camera frustum wireframes, independent of the real far clip plane.'}
          </div>

          <SectionTitle>{locale === 'zh' ? '场景单位与坐标系' : 'Units & Coordinate System'}</SectionTitle>
          <div className="px-3 py-2 text-[11px] leading-relaxed text-[var(--color-text-dim)]">
            <div>{locale === 'zh' ? '• 长度单位：米 (m)' : '• Length unit: meters (m)'}</div>
            <div>{locale === 'zh' ? '• 角度单位：度 (deg)' : '• Angle unit: degrees (deg)'}</div>
            <div>{locale === 'zh' ? '• 坐标系：右手系，Y 轴向上，相机看向 -Z' : '• Coordinate system: right-handed, Y-up, cameras look toward -Z'}</div>
          </div>

          <SectionTitle>{locale === 'zh' ? '当前场景摘要' : 'Current Scene Summary'}</SectionTitle>
          <div className="px-3 py-2 text-[11px] text-[var(--color-text-dim)]">
            {locale === 'zh' ? '相机' : 'Cameras'}: {scene.cameras.length} ·{' '}
            {locale === 'zh' ? '灯光' : 'Lights'}: {scene.lights.length} ·{' '}
            {locale === 'zh' ? '主体' : 'Subjects'}: {scene.subjects.length} ·{' '}
            {locale === 'zh' ? '版本' : 'Schema'}: v{scene.version}
          </div>
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
