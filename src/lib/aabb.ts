/**
 * 轴对齐包围盒工具（src/lib/aabb.ts）。
 * 纯函数、不依赖 three。供 SubjectDef.bounds 计算、覆盖栅格化、盲区近似遮挡用。
 *
 * 约定：几何的 size/radius 指的是**局部（未变换）**尺寸；
 * 世界 AABB 由 transform 的 position/rotation/scale 推得。
 */
import type { AABB, SubjectDef, SubjectGeometry, Transform, Vec3 } from '@/types';

/** 空包围盒（无效）。 */
export const emptyAABB = (): AABB => ({
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
});

/** 两个 AABB 的并。 */
export const unionAABB = (a: AABB, b: AABB): AABB => ({
  min: [
    Math.min(a.min[0], b.min[0]),
    Math.min(a.min[1], b.min[1]),
    Math.min(a.min[2], b.min[2]),
  ],
  max: [
    Math.max(a.max[0], b.max[0]),
    Math.max(a.max[1], b.max[1]),
    Math.max(a.max[2], b.max[2]),
  ],
});

/**
 * 几何的**局部**半尺寸（局部坐标，未应用 transform）。
 * - box/plane: size 视作全尺寸，半尺寸 = size/2。
 * - sphere: 半尺寸各轴 = radius。
 * - mesh: 无已知尺寸，返回单位半尺寸 0.5（占位，v2 按模型边界）。
 */
export const localHalfExtents = (geo: SubjectGeometry): Vec3 => {
  switch (geo.type) {
    case 'box':
    case 'plane':
      return [geo.size[0] / 2, geo.size[1] / 2, geo.size[2] / 2];
    case 'sphere':
      return [geo.radius, geo.radius, geo.radius];
    case 'mesh':
      // mesh.bbox 为「模型原始单位」下的全尺寸（未乘 transform.scale）。
      // transformAABB 会再乘 scale 得到世界尺寸。省略时回退 1m 占位（覆盖计算不准）。
      // 例：Juliette OBJ 原始厘米级、视觉约 1.7m、scale=0.01 → bbox≈[170,170,40]（cm），
      // 乘 scale 0.01 后得 [1.7,1.7,0.4]m，与视觉一致。
      return geo.bbox ? [geo.bbox[0] / 2, geo.bbox[1] / 2, geo.bbox[2] / 2] : [0.5, 0.5, 0.5];
  }
};

/** 把 8 个局部角点经 transform 变到世界，再取轴对齐外框。 */
export function transformAABB(t: Transform, half: Vec3): AABB {
  // 局部角点 ±half
  const corners: Vec3[] = [
    [-half[0], -half[1], -half[2]],
    [half[0], -half[1], -half[2]],
    [-half[0], half[1], -half[2]],
    [half[0], half[1], -half[2]],
    [-half[0], -half[1], half[2]],
    [half[0], -half[1], half[2]],
    [-half[0], half[1], half[2]],
    [half[0], half[1], half[2]],
  ];
  // 复用 math 的矩阵变换（物体→世界）
  // 直接内联避免循环依赖：用 composeMatrix 需 import math；这里允许依赖（同属 lib）。
  // 为避免 lib 内部循环 import，本函数接受已变换角点更干净——但调用方多一步。
  // 折中：这里直接用旋转矩阵作用于角点（平移叠加 position），不用 scale（scale 已并入 half）。
  const [rxd, ryd, rzd] = t.rotation;
  const rx = (rxd * Math.PI) / 180,
    ry = (ryd * Math.PI) / 180,
    rz = (rzd * Math.PI) / 180;
  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);
  const s = t.scale ?? [1, 1, 1];

  let min0 = Infinity,
    min1 = Infinity,
    min2 = Infinity;
  let max0 = -Infinity,
    max1 = -Infinity,
    max2 = -Infinity;

  for (const c of corners) {
    // 先缩放
    const x0 = c[0] * s[0],
      y0 = c[1] * s[1],
      z0 = c[2] * s[2];
    // Rx
    const x1 = x0;
    const y1 = y0 * cx - z0 * sx;
    const z1 = y0 * sx + z0 * cx;
    // Ry
    const x2 = x1 * cy + z1 * sy;
    const y2 = y1;
    const z2 = -x1 * sy + z1 * cy;
    // Rz
    const x3 = x2 * cz - y2 * sz;
    const y3 = x2 * sz + y2 * cz;
    const z3 = z2;
    // 平移
    const wx = x3 + t.position[0];
    const wy = y3 + t.position[1];
    const wz = z3 + t.position[2];
    if (wx < min0) min0 = wx;
    if (wy < min1) min1 = wy;
    if (wz < min2) min2 = wz;
    if (wx > max0) max0 = wx;
    if (wy > max1) max1 = wy;
    if (wz > max2) max2 = wz;
  }

  return { min: [min0, min1, min2], max: [max0, max1, max2] };
}

/** 由主体定义算世界 AABB（bounds 的来源）。 */
export const aabbOfSubject = (s: SubjectDef): AABB =>
  transformAABB(s.transform, localHalfExtents(s.geometry));

/** AABB 的尺寸（各轴长）。 */
export const aabbSize = (a: AABB): Vec3 => [
  a.max[0] - a.min[0],
  a.max[1] - a.min[1],
  a.max[2] - a.min[2],
];

/** AABB 的中心。 */
export const aabbCenter = (a: AABB): Vec3 => [
  (a.min[0] + a.max[0]) / 2,
  (a.min[1] + a.max[1]) / 2,
  (a.min[2] + a.max[2]) / 2,
];

/** 点是否在 AABB 内（含边界）。 */
export const pointInAABB = (p: Vec3, a: AABB): boolean =>
  p[0] >= a.min[0] &&
  p[0] <= a.max[0] &&
  p[1] >= a.min[1] &&
  p[1] <= a.max[1] &&
  p[2] >= a.min[2] &&
  p[2] <= a.max[2];
