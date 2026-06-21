/**
 * 基础通用类型（src/types/common.ts）。
 * 不依赖任何其他模块；是所有实体类型与 sim/export 的公共语言。
 */

/** 三维向量（世界单位：米）。使用元组而非对象，便于序列化与矩阵运算。 */
export type Vec3 = readonly [number, number, number];

/**
 * 物体变换。
 * - position: 世界坐标，单位**米**。
 * - rotation: 欧拉角，单位**度**（存库/UI/导出入口统一用度；内部计算在 lib/math 转弧度）。
 * - scale: 各轴缩放，默认 [1,1,1]。
 *
 * 旋转顺序约定 XYZ（与 Three.js 默认一致）。
 */
export interface Transform {
  position: Vec3;
  /** 欧拉角（度）：[x(pitch), y(yaw), z(roll)] */
  rotation: Vec3;
  scale?: Vec3;
}

/** 轴对齐包围盒（世界空间）。用于覆盖栅格化、盲区近似遮挡等。 */
export interface AABB {
  /** 最小角（含） */
  min: Vec3;
  /** 最大角（含） */
  max: Vec3;
}

/** 唯一标识符。形如 `cam_3f2a`，由 lib/id 生成带前缀的短 id。 */
export type EntityId = string;

/** 实体种类枚举（UI 工具栏原型、store 派发共用）。 */
export type EntityKind =
  | 'camera'
  | 'light'
  | 'subject'
  | 'environment';

/** 颜色：统一用 hex 整数（0xRRGGBB），线性/输入换算集中在 lib/math。 */
export type ColorHex = number;

/** 可选的时间戳字段（4DGS 预留）。
 *  - 静态 v1：通常为 undefined 或 0。
 *  - 4DGS v2：表示该实体/姿态对应的采集时刻（秒）。
 * 用可选字段而非必填，保持 v1 数据向后兼容（见 .coder-protocol.md §7）。 */
export interface Timed {
  /** 采集时刻（秒）。undefined 表示静态/不限定时刻。 */
  time?: number;
}
