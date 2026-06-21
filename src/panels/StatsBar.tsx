/**
 * 底栏评估指标（src/panels/StatsBar.tsx）。
 * T-036 性能：用 useDeferredValue 让覆盖/重叠/曝光计算 debounce，避免拖动时每帧重算；
 * 计算进行中显示 "calculating" 占位，避免主线程卡顿。
 */
import { useDeferredValue, useMemo } from 'react';
import { usePlanner } from '@/state/store';
import { coverageOf } from '@/sim/coverage';
import { overlapOf } from '@/sim/overlap';
import { exposureOf } from '@/sim/exposure';
import { useTranslation } from '@/lib/i18n';

export function StatsBar() {
  const { locale } = useTranslation();
  const scene = usePlanner((s) => s.scene);
  const projection = usePlanner((s) => s.view.projection);
  const showCoverageHeatmap = usePlanner((s) => s.view.showCoverageHeatmap);
  const viewMode = usePlanner((s) => s.viewMode);
  // T-034：阈值从 store 读（World Settings 可编辑），不再硬编码
  const thresholds = usePlanner((s) => s.thresholds);

  // T-036：延迟计算——拖动/频繁更新时 scene 是急切值，deferredScene 是稳定后的延迟值。
  const deferredScene = useDeferredValue(scene);

  // 计算是否正在进行中（scene 与 deferredScene 不同步 = 正在 debounce）
  const calculating = scene !== deferredScene;

  const covStats = useMemo(() => coverageOf(deferredScene, thresholds, 16), [deferredScene, thresholds]);
  const overlapStats = useMemo(() => overlapOf(deferredScene, thresholds, 16), [deferredScene, thresholds]);
  const expStats = useMemo(() => exposureOf(deferredScene, thresholds), [deferredScene, thresholds]);

  const isCovOk = covStats.blindRatio === 0 && covStats.avgCoverage >= thresholds.minCoverage;
  const isCovWarn = covStats.blindRatio > 0 && covStats.blindRatio < 0.05;
  const covStatusColor = isCovOk ? 'bg-[var(--color-ok)]' : isCovWarn ? 'bg-[var(--color-warn)]' : 'bg-[var(--color-danger)]';
  const isOverlapOk = overlapStats.belowThresholdPairs === 0;
  const overlapStatusColor = isOverlapOk ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-warn)]';
  const isExposureOk = !expStats.exceedsThreshold;
  const exposureStatusColor = isExposureOk ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-danger)]';

  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

  const modeLabel = showCoverageHeatmap ? 'Coverage' : viewMode === 'wireframe' ? 'Wireframe' : viewMode === 'bounds' ? 'Bounds' : 'Lit';

  return (
    <div className="flex flex-1 items-center justify-between text-[11px] px-3">
      <div className="flex items-center gap-6">
        {/* 覆盖度 */}
        <div className="flex items-center gap-1.5 border-r border-[var(--color-panel-border)] pr-4">
          <span className={`w-2 h-2 rounded-full ${covStatusColor} shrink-0`} />
          <span className="text-[var(--color-text-dim)]">{locale === 'zh' ? '视角覆盖度:' : 'Coverage:'}</span>
          <span className={`font-semibold ${covStats.avgCoverage < thresholds.minCoverage ? 'text-[var(--color-warn)]' : 'text-[var(--color-text)]'}`}>
            {calculating ? '…' : `${locale === 'zh' ? '均值 ' : 'Avg '}${covStats.avgCoverage.toFixed(1)}x`}
          </span>
          <span className="text-[var(--color-text-faint)]">/</span>
          <span className={`font-semibold ${covStats.blindRatio > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
            {calculating ? '…' : `${locale === 'zh' ? '盲区 ' : 'Blind '}${formatPercent(covStats.blindRatio)}`}
          </span>
        </div>

        {/* 重叠 */}
        <div className="flex items-center gap-1.5 border-r border-[var(--color-panel-border)] pr-4">
          <span className={`w-2 h-2 rounded-full ${overlapStatusColor} shrink-0`} />
          <span className="text-[var(--color-text-dim)]">{locale === 'zh' ? '立体覆盖率:' : 'Overlap:'}</span>
          <span className="font-semibold text-[var(--color-text)]">
            {calculating ? '…' : `${locale === 'zh' ? '均值 ' : 'Avg '}${formatPercent(overlapStats.avgOverlap)}`}
          </span>
          <span className="text-[var(--color-text-faint)]">/</span>
          <span className={`font-semibold ${overlapStats.belowThresholdPairs > 0 ? 'text-[var(--color-warn)]' : 'text-[var(--color-text)]'}`}>
            {calculating ? '…' : `${locale === 'zh' ? '弱基线对 ' : 'Bad Pairs '}${overlapStats.belowThresholdPairs}`}
          </span>
        </div>

        {/* 曝光 */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${exposureStatusColor} shrink-0`} />
          <span className="text-[var(--color-text-dim)]">{locale === 'zh' ? '曝光极差:' : 'Exposure Spread:'}</span>
          <span className={`font-semibold ${expStats.exceedsThreshold ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
            {calculating ? '…' : `${expStats.spread.toFixed(2)} EV`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 text-[var(--color-text-faint)]">
        {calculating && (
          <span className="text-[var(--color-warn)]">{locale === 'zh' ? '计算中…' : 'calculating…'}</span>
        )}
        <span>{locale === 'zh' ? '仿真体素: ' : 'Voxels: '}{covStats.totalSamples}</span>
        <span>·</span>
        <span>{locale === 'zh' ? '有效相机: ' : 'Cams: '}{scene.cameras.filter((c) => c.enabled).length}</span>
        <span>·</span>
        <span>{projection}</span>
        <span>·</span>
        <span>{modeLabel}</span>
      </div>
    </div>
  );
}
