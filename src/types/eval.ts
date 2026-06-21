/**
 * 仿真评估结果类型（src/types/eval.ts）。
 * sim/ 各模块的**输出契约**（SceneDef 是输入契约，见 entities.ts）。
 * 这些是纯数据，scene/overlays 与 panels/StatsBar 据此渲染。
 */
import type { EntityId } from './common';

/** 单个表面采样点的覆盖结果（覆盖热图逐点着色用）。 */
export interface CoverageSample {
  /** 采样点世界坐标。 */
  position: readonly [number, number, number];
  /** 覆盖该点的相机数（含被遮挡剔除后的可见相机）。 */
  count: number;
  /** 覆盖该点的相机 id 列表（可选，用于调试/悬停）。 */
  by?: readonly EntityId[];
}

/** 覆盖度汇总指标（sim/coverage 输出）。 */
export interface CoverageStats {
  /** 总采样点数。 */
  totalSamples: number;
  /** 逐点覆盖结果（用于热图渲染）。 */
  samples: CoverageSample[];
  /** 最小覆盖数。 */
  minCoverage: number;
  /** 最大覆盖数。 */
  maxCoverage: number;
  /** 平均覆盖数。 */
  avgCoverage: number;
  /** 盲区占比 0..1（count === 0 的采样点比例）。 */
  blindRatio: number;
  /** 欠覆盖占比 0..1（count < 阈值的采样点比例）。 */
  underCoveredRatio: number;
  /** 每个相机的可见采样点数（用于权重/剔除分析）。 */
  perCamera: ReadonlyArray<{ id: EntityId; visible: number }>;
}

/** 相邻相机对的重叠与基线（sim/overlap 输出矩阵元素）。 */
export interface OverlapPair {
  a: EntityId;
  b: EntityId;
  /** 共同可见采样点占 a∪b 可见集的比例 0..1。 */
  overlap: number;
  /** 两相机世界距离（米）。 */
  baseline: number;
}

/** 重叠/baseline 汇总（sim/overlap 输出）。 */
export interface OverlapStats {
  pairs: OverlapPair[];
  /** 平均重叠率 0..1。 */
  avgOverlap: number;
  /** 平均基线（米）。 */
  avgBaseline: number;
  /** 最小基线（米）。 */
  minBaseline: number;
  /** 最大基线（米）。 */
  maxBaseline: number;
  /** 低于阈值的相机对数。 */
  belowThresholdPairs: number;
}

/** 曝光一致性结果（sim/exposure 输出）。 */
export interface ExposureStats {
  /** 每个相机的等价曝光值 EV（相对量，越大越亮）。 */
  perCamera: ReadonlyArray<{ id: EntityId; ev: number }>;
  /** 阵列内 EV 极差。 */
  spread: number;
  /** 阵列内 EV 标准差。 */
  stddev: number;
  /** 是否超出阈值（spread > maxExposureSpread）。 */
  exceedsThreshold: boolean;
}

/** 拍摄清单单行（sim/capture 输出）。 */
export interface CaptureRow {
  id: EntityId;
  name: string;
  /** 世界→相机的 4×4 矩阵（列主序，与 Three.js 一致；导出时按目标格式转置）。 */
  worldToCamera: readonly number[];
  /** 内参（针孔）。 */
  intrinsics: {
    fx: number;
    fy: number;
    cx: number;
    cy: number;
    width: number;
    height: number;
  };
  exposure: { iso: number; shutter: number; aperture: number };
  /** 4DGS 预留：期望触发时刻（秒）。 */
  time?: number;
}

/** 拍摄清单（sim/capture 输出）。 */
export interface CaptureList {
  rows: CaptureRow[];
  /** 生成时间戳（UTC ISO）。 */
  generatedAt: string;
}
